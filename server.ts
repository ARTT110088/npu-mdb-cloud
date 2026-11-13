import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { createBreakerAdapter, BreakerAdapter, BreakerState, BreakerStatus } from './src/server/breakerAdapter.js';
import { AlertType, TelemetrySnapshot } from './src/types.js';

dotenv.config();

const app = express();
const PORT = 3000;
const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: ['text/*', 'application/json'] }));

// CORS middleware for ESP32 & IoT devices
app.use('/api/esp32', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ==================== PERSISTENT SETTINGS ====================
interface SettingsSchema {
  currentLimit: number;
  temperatureLimit: number;
  humidityLimit: number;
  [key: string]: any;
}

const DEFAULT_SETTINGS: SettingsSchema = {
  currentLimit: 5.0,
  temperatureLimit: 50.0,
  humidityLimit: 80.0,
};

function loadSettings(): SettingsSchema {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        currentLimit: typeof parsed.currentLimit === 'number' ? parsed.currentLimit : (parsed.maxCurrentLimit ?? DEFAULT_SETTINGS.currentLimit),
        temperatureLimit: typeof parsed.temperatureLimit === 'number' ? parsed.temperatureLimit : (parsed.maxTempLimit ?? DEFAULT_SETTINGS.temperatureLimit),
        humidityLimit: typeof parsed.humidityLimit === 'number' ? parsed.humidityLimit : (parsed.maxHumidityLimit ?? DEFAULT_SETTINGS.humidityLimit),
        ...parsed,
      };
    }
  } catch (err) {
    console.error('Error reading settings.json, creating default:', err);
  }
  saveSettings(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(newSettings: SettingsSchema) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings.json:', err);
  }
}

let settings: SettingsSchema = loadSettings();

// ==================== BREAKER ADAPTER ====================
const breakerAdapter: BreakerAdapter = createBreakerAdapter();

// Tuya Auto-Trip Retry Tracker (prevents rapid API spamming)
let tuyaOffRetryTimer: NodeJS.Timeout | null = null;
let tuyaOffRetryCount = 0;

function scheduleTuyaOffRetry(reason: string) {
  if (tuyaOffRetryCount >= 3) {
    console.warn('[Tuya AutoTrip] Max retries reached for Tuya OFF');
    return;
  }
  if (tuyaOffRetryTimer) return; // already scheduled

  tuyaOffRetryCount++;
  const delayMs = tuyaOffRetryCount * 5000;
  console.log(`[Tuya AutoTrip] Scheduling Tuya OFF retry #${tuyaOffRetryCount} in ${delayMs}ms`);

  tuyaOffRetryTimer = setTimeout(async () => {
    tuyaOffRetryTimer = null;
    const res = await breakerAdapter.turnOff(`Auto-Trip Retry #${tuyaOffRetryCount}: ${reason}`);
    if (!res.success) {
      addAlert({
        type: 'TUYA_API_ERROR',
        severity: 'danger',
        title: 'Tuya Auto-Trip Retry Failed',
        description: `พยายามส่งคำสั่งตัดไฟ Tuya อีกครั้งไม่สำเร็จ (#${tuyaOffRetryCount}): ${res.error || res.message}`,
        value: 'RETRY_FAILED',
      });
      scheduleTuyaOffRetry(reason);
    } else {
      console.log(`[Tuya AutoTrip] Retry #${tuyaOffRetryCount} succeeded!`);
      tuyaOffRetryCount = 0;
    }
  }, delayMs);
}

// ==================== STATE MANAGEMENT ====================
let telemetryData = {
  timestamp: 0,
  voltage: 0, // V
  current: 0, // A
  temperature: 0, // °C
  humidity: 0, // %
  smokeDetected: false,
  smokeAdc: 0, // Raw ADC
  smokePercent: 0, // Backward compatibility
  smokePpm: 0, // Backward compatibility
  power: 0,
  powerFactor: 0.96,
  frequency: 50.0,
  shortCircuitDetected: false,
  arcFaultDetected: false,
  fireDetected: false,
  emergency: false,
  status: 'OFFLINE' as 'NORMAL' | 'WARNING' | 'TRIPPED' | 'OFFLINE',
  statusMessage: 'กำลังรอการเชื่อมต่อและส่งสัญญาณจากบอร์ด ESP32 ผ่าน IP...',
  overCurrentCountdown: 0 as number,
  overCurrentDelayActive: false as boolean,
};

interface TelemetryHistoryItem {
  time: string;
  current: number;
  temperature: number;
  humidity: number;
  smokeAdc: number;
  voltage?: number;
}
let telemetryHistory: TelemetryHistoryItem[] = [];

// 5-second continuous overcurrent countdown state
let overCurrentStartTime: number | null = null;
let overCurrentRemainingSec: number = 0;

// Seed initial historical points for smooth real-time charts
const initChartNow = Date.now();
for (let i = 15; i >= 0; i--) {
  const t = new Date(initChartNow - i * 2000);
  telemetryHistory.push({
    time: t.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    current: 0,
    temperature: 0,
    humidity: 0,
    smokeAdc: 0,
    voltage: 0,
  });
}

// 2-second ticker to keep real-time chart history updated
setInterval(() => {
  const timeLabel = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  telemetryHistory.push({
    time: timeLabel,
    current: +(telemetryData.current || 0),
    temperature: +(telemetryData.temperature || 0),
    humidity: +(telemetryData.humidity || 0),
    smokeAdc: +(telemetryData.smokeAdc || 0),
    voltage: +(telemetryData.voltage || 0),
  });
  if (telemetryHistory.length > 30) {
    telemetryHistory.shift();
  }
}, 2000);

// Background monitor for 5-second continuous overcurrent delay
setInterval(async () => {
  if (overCurrentStartTime !== null) {
    const breakerStatus = await breakerAdapter.getState();
    if (breakerStatus.state === 'TRIPPED' || breakerStatus.state === 'OFF') {
      overCurrentStartTime = null;
      overCurrentRemainingSec = 0;
      telemetryData.overCurrentDelayActive = false;
      telemetryData.overCurrentCountdown = 0;
      return;
    }

    if (telemetryData.current <= settings.currentLimit) {
      overCurrentStartTime = null;
      overCurrentRemainingSec = 0;
      telemetryData.overCurrentDelayActive = false;
      telemetryData.overCurrentCountdown = 0;
      return;
    }

    const elapsed = Date.now() - overCurrentStartTime;
    overCurrentRemainingSec = Math.max(0, Math.ceil((5000 - elapsed) / 1000));
    telemetryData.overCurrentCountdown = overCurrentRemainingSec;
    telemetryData.overCurrentDelayActive = true;

    if (elapsed >= 5000) {
      console.log(`[Auto-Trip] 5s continuous overcurrent reached! Tripping breaker.`);
      await checkAutoTrip();
      await updateSystemStatus();
    }
  }
}, 500);

let esp32Status = {
  connected: false,
  signalCut: false,
  lastHeartbeat: 0,
  ipAddress: '',
  macAddress: '24:6F:28:A1:C8:94',
  firmwareVersion: 'NPU-ESP32-v2.2.0',
  wifiRssi: 0,
  freeHeap: 214580,
  uptimeSeconds: 0,
  deviceName: 'NPU-MDB-ESP32',
  wifiSsid: '',
};

interface AlertItem {
  id: string;
  timestamp: number;
  type: AlertType;
  severity: 'info' | 'warning' | 'danger' | 'critical';
  title: string;
  description: string;
  value?: string;
  acknowledged: boolean;
  breakerTrippedAction?: boolean;
  telemetrySnapshot?: TelemetrySnapshot;
}

let alertLogs: AlertItem[] = [
  {
    id: 'init-1',
    timestamp: Date.now(),
    type: 'SYSTEM_INFO',
    severity: 'info',
    title: 'ระบบ NPU-MDB เริ่มทำงาน',
    description: 'ระบบพร้อมรับข้อมูลสัญญาณเซนเซอร์จาก ESP32 และเชื่อมต่อ Tuya Wi-Fi Breaker',
    value: 'NORMAL',
    acknowledged: true,
  },
];

function addAlert(alert: Omit<AlertItem, 'id' | 'timestamp' | 'acknowledged'>) {
  const newLog: AlertItem = {
    ...alert,
    id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: Date.now(),
    acknowledged: false,
  };
  alertLogs.unshift(newLog);
  if (alertLogs.length > 50) {
    alertLogs.pop();
  }
}

// Watchdog: Monitor heartbeat from ESP32 & Tuya online state
let lastTuyaOnlineState: boolean | null = null;

setInterval(async () => {
  const isHeartbeatExpired = esp32Status.lastHeartbeat === 0 || Date.now() - esp32Status.lastHeartbeat > 20000;
  if (esp32Status.signalCut || isHeartbeatExpired) {
    esp32Status.connected = false;
  } else {
    esp32Status.connected = true;
  }

  const breakerStatus = await breakerAdapter.getState();
  if (breakerStatus.tuyaConfigured) {
    if (lastTuyaOnlineState === true && breakerStatus.online === false) {
      addAlert({
        type: 'TUYA_DEVICE_OFFLINE',
        severity: 'danger',
        title: 'Tuya Wi-Fi Breaker OFFLINE',
        description: 'ขาดการเชื่อมต่อกับอุปกรณ์ Smart Breaker ผ่าน Tuya Cloud กรุณาตรวจเช็คสัญญาณ Wi-Fi ของเบรกเกอร์',
        value: 'OFFLINE',
      });
    }
    lastTuyaOnlineState = breakerStatus.online;
  }

  await updateSystemStatus();
}, 3000);

// Evaluate System Status (NORMAL, WARNING, TRIPPED, OFFLINE)
async function updateSystemStatus(): Promise<'NORMAL' | 'WARNING' | 'TRIPPED' | 'OFFLINE'> {
  const breakerStatus = await breakerAdapter.getState();

  if (!esp32Status.connected) {
    telemetryData.status = 'OFFLINE';
    telemetryData.statusMessage = esp32Status.signalCut
      ? '🔌 สัญญาณ ESP32 ถูกตัดการเชื่อมต่อโดยผู้ใช้ (Signal Cut Off)'
      : 'ESP32 OFFLINE (ขาดการเชื่อมต่อกับบอร์ด ESP32)';
    return 'OFFLINE';
  }

  if (breakerStatus.state === 'TRIPPED') {
    overCurrentStartTime = null;
    overCurrentRemainingSec = 0;
    telemetryData.overCurrentDelayActive = false;
    telemetryData.overCurrentCountdown = 0;
    telemetryData.status = 'TRIPPED';
    telemetryData.statusMessage = breakerStatus.trippedReason
      ? `TRIPPED: ${breakerStatus.trippedReason}`
      : 'TRIPPED: เบรกเกอร์ตัดวงจรอัตโนมัติ (Safety Auto-Trip)';
    return 'TRIPPED';
  }

  // Active Overcurrent Delay Countdown warning
  if (overCurrentStartTime !== null) {
    telemetryData.status = 'WARNING';
    telemetryData.statusMessage = `⚠️ กระแสไฟเกินกำหนด (${telemetryData.current.toFixed(1)}A > ${settings.currentLimit.toFixed(1)}A)! กำลังนับถอยหลังตัดไฟใน ${overCurrentRemainingSec} วินาที...`;
    return 'WARNING';
  }

  // Warning conditions: close to limit (e.g. >= 85% of limit)
  const isCurrentWarning = telemetryData.current >= settings.currentLimit * 0.85;
  const isTempWarning = telemetryData.temperature >= settings.temperatureLimit * 0.85;
  const isHumWarning = telemetryData.humidity >= settings.humidityLimit * 0.9;

  if (isCurrentWarning || isTempWarning || isHumWarning) {
    telemetryData.status = 'WARNING';
    telemetryData.statusMessage = '⚠️ ระบบอยู่ในสถานะเฝ้าระวัง ค่าเซนเซอร์ใกล้ถึงขีดจำกัดความปลอดภัย';
    return 'WARNING';
  }

  telemetryData.status = 'NORMAL';
  telemetryData.statusMessage = 'ระบบไฟฟ้าและตู้ MDB ทำงานปกติ ปลอดภัย';
  return 'NORMAL';
}

// Check auto-trip triggers from incoming telemetry
// RULES:
// 1. Sends Tuya OFF only ONCE when status transitions from NORMAL/WARNING -> FAULT/TRIPPED.
// 2. Does NOT repeatedly spam Tuya API on every telemetry tick while already TRIPPED.
// 3. Overcurrent: Must exceed limit continuously for 5 seconds (5s delay/countdown). If current drops before 5s, reset timer.
// 4. If Tuya OFF fails, records error and schedules retry with backoff.
async function checkAutoTrip(): Promise<{ tripped: boolean; reason: string }> {
  const breakerStatus = await breakerAdapter.getState();

  // If already TRIPPED, do NOT resend switch=false repeatedly
  if (breakerStatus.state === 'TRIPPED') {
    overCurrentStartTime = null;
    overCurrentRemainingSec = 0;
    telemetryData.overCurrentDelayActive = false;
    telemetryData.overCurrentCountdown = 0;
    return { tripped: false, reason: breakerStatus.trippedReason };
  }

  let isFault = false;
  let faultReason = '';
  let faultTitle = '';
  let faultValue = '';
  let faultLimit: number | string = '';

  // 0. Emergency Stop
  if (telemetryData.emergency) {
    isFault = true;
    faultTitle = 'สัญญาณหยุดฉุกเฉิน (EMERGENCY / E-STOP)';
    faultReason = 'ระบบได้รับสัญญาณสั่งหยุดฉุกเฉิน (Emergency Active) สั่งปลดวงจรทันที';
    faultValue = 'EMERGENCY';
    faultLimit = 'ACTIVE';
  }
  // 1. Current exceeds limit (with 5-second continuous countdown delay)
  else if (telemetryData.current > settings.currentLimit) {
    if (overCurrentStartTime === null) {
      overCurrentStartTime = Date.now();
      console.log(`[Overcurrent Delay] Started 5s countdown: ${telemetryData.current}A > Limit ${settings.currentLimit}A`);
    }
    const elapsed = Date.now() - overCurrentStartTime;
    overCurrentRemainingSec = Math.max(0, Math.ceil((5000 - elapsed) / 1000));
    telemetryData.overCurrentCountdown = overCurrentRemainingSec;
    telemetryData.overCurrentDelayActive = true;

    if (elapsed >= 5000) {
      isFault = true;
      faultTitle = 'กระแสไฟฟ้าเกินขีดจำกัดต่อเนื่อง 5 วินาที (Over Current 5s Delay)';
      faultReason = `กระแสไฟตรวจวัดได้ ${telemetryData.current} A เกินเกณฑ์ปลอดภัย (${settings.currentLimit} A) ต่อเนื่องครบ 5 วินาที`;
      faultValue = `${telemetryData.current} A`;
      faultLimit = `${settings.currentLimit} A`;
      overCurrentStartTime = null;
      overCurrentRemainingSec = 0;
      telemetryData.overCurrentDelayActive = false;
      telemetryData.overCurrentCountdown = 0;
    }
  }
  // 2. Temperature exceeds limit
  else if (telemetryData.temperature > settings.temperatureLimit) {
    isFault = true;
    faultTitle = 'อุณหภูมิในตู้สูงเกินขีดจำกัด (Over Temperature)';
    faultReason = `อุณหภูมิตรวจวัดได้ ${telemetryData.temperature} °C เกินเกณฑ์ปลอดภัยที่ตั้งไว้ ${settings.temperatureLimit} °C`;
    faultValue = `${telemetryData.temperature} °C`;
    faultLimit = `${settings.temperatureLimit} °C`;
  }
  // 3. Humidity exceeds limit
  else if (telemetryData.humidity > settings.humidityLimit) {
    isFault = true;
    faultTitle = 'ความชื้นในตู้สูงเกินขีดจำกัด (Over Humidity)';
    faultReason = `ความชื้นตรวจวัดได้ ${telemetryData.humidity} % เกินเกณฑ์ปลอดภัยที่ตั้งไว้ ${settings.humidityLimit} %`;
    faultValue = `${telemetryData.humidity} %`;
    faultLimit = `${settings.humidityLimit} %`;
  }
  // 4. Smoke detected (ADC >= 80 or smokeDetected flag)
  else if (telemetryData.smokeDetected || (telemetryData.smokeAdc && telemetryData.smokeAdc >= 80)) {
    isFault = true;
    faultTitle = 'ตรวจพบควัน (Smoke Detected >= 80 ADC)';
    faultReason = `ระบบตรวจพบควันไฟในตู้ MDB (ระดับควัน ${telemetryData.smokeAdc} ADC >= เกณฑ์ 80 ADC)`;
    faultValue = `${telemetryData.smokeAdc} ADC`;
    faultLimit = '80 ADC';
  }
  // Backward compatibility: short circuit or fire detected flags from ESP32
  else if (telemetryData.shortCircuitDetected) {
    isFault = true;
    faultTitle = 'ไฟฟ้าลัดวงจรเฉียบพลัน (Short Circuit)';
    faultReason = 'ระบบตรวจพบกระแสไฟลัดวงจรกระชากเฉียบพลัน สั่งปลดวงจรทันที';
    faultValue = 'SHORT CIRCUIT';
    faultLimit = 'IMMEDIATE';
  }

  // If current returned to normal (<= settings.currentLimit) before 5 seconds, reset the timer!
  if (telemetryData.current <= settings.currentLimit && overCurrentStartTime !== null) {
    console.log(`[Overcurrent Delay Reset] Current dropped back to ${telemetryData.current}A <= ${settings.currentLimit}A. Resetting 5s timer.`);
    overCurrentStartTime = null;
    overCurrentRemainingSec = 0;
    telemetryData.overCurrentDelayActive = false;
    telemetryData.overCurrentCountdown = 0;
  }

  if (isFault) {
    console.log(`[Auto-Trip Triggered] ${faultTitle}: ${faultReason}`);
    
    // Command Tuya Breaker OFF & transition local state to TRIPPED
    const tripResult = await breakerAdapter.trip(faultReason);

    // Record BREAKER_AUTO_TRIP event with full telemetry snapshot
    addAlert({
      type: 'BREAKER_AUTO_TRIP',
      severity: 'critical',
      title: `TRIPPED: ${faultTitle}`,
      description: faultReason,
      value: faultValue,
      breakerTrippedAction: true,
      telemetrySnapshot: {
        voltage: telemetryData.voltage,
        current: telemetryData.current,
        temperature: telemetryData.temperature,
        humidity: telemetryData.humidity,
        smokeAdc: telemetryData.smokeAdc,
        reason: faultReason,
        limit: faultLimit,
      },
    });

    if (tripResult.error) {
      addAlert({
        type: 'TUYA_API_ERROR',
        severity: 'danger',
        title: 'Tuya API Error (Auto-Trip)',
        description: `ระบบสั่งตัดไฟ Tuya Breaker ไม่สำเร็จ: ${tripResult.error}`,
        value: 'API_ERROR',
      });
      scheduleTuyaOffRetry(faultReason);
    } else {
      tuyaOffRetryCount = 0;
      if (tuyaOffRetryTimer) {
        clearTimeout(tuyaOffRetryTimer);
        tuyaOffRetryTimer = null;
      }
    }

    await updateSystemStatus();
    return { tripped: true, reason: faultReason };
  }

  return { tripped: false, reason: '' };
}

// Process telemetry payload from ESP32 (POST or GET)
const processTelemetryPayload = async (input: any) => {
  if (esp32Status.signalCut) {
    return {
      success: false,
      signalCut: true,
      message: 'สัญญาณจาก ESP32 ถูกตัดการเชื่อมต่อโดยผู้ใช้',
      breakerState: (await breakerAdapter.getState()).state,
    };
  }

  let payload = input;
  if (typeof input === 'string') {
    try {
      payload = JSON.parse(input);
    } catch {
      payload = {};
    }
  }

  const {
    voltage,
    v,
    current,
    i,
    temperature,
    temp,
    t,
    humidity,
    hum,
    h,
    smoke,
    smokeAdc,
    adc,
    smokePercent,
    smokePpm,
    smokeDetected,
    emergency,
    shortCircuitDetected,
    arcFaultDetected,
    fireDetected,
    ip,
    rssi,
  } = payload || {};

  esp32Status.lastHeartbeat = Date.now();
  esp32Status.connected = true;
  if (ip) esp32Status.ipAddress = String(ip);
  if (rssi !== undefined) esp32Status.wifiRssi = Number(rssi);

  const rawV = voltage ?? v;
  const rawI = current ?? i;
  const rawT = temperature ?? temp ?? t;
  const rawH = humidity ?? hum ?? h;

  // Smoke reading priority:
  // 1. smokeAdc (or adc)
  // 2. smokePpm
  // 3. smokePercent (or smoke)
  let rawSmokeAdc = 0;
  if (smokeAdc !== undefined) {
    rawSmokeAdc = Number(smokeAdc);
  } else if (adc !== undefined) {
    rawSmokeAdc = Number(adc);
  } else if (smokePpm !== undefined) {
    rawSmokeAdc = Number(smokePpm);
  } else if (smokePercent !== undefined) {
    rawSmokeAdc = Number(smokePercent);
  } else if (smoke !== undefined) {
    rawSmokeAdc = Number(smoke);
  }

  if (rawV !== undefined) telemetryData.voltage = Number(rawV);
  if (rawI !== undefined) telemetryData.current = Number(rawI);
  if (rawT !== undefined) telemetryData.temperature = Number(rawT);
  if (rawH !== undefined) telemetryData.humidity = Number(rawH);
  
  // Store raw ADC value
  telemetryData.smokeAdc = rawSmokeAdc;
  // Keep backward compatibility fields without percentage logic
  telemetryData.smokePercent = rawSmokeAdc;
  telemetryData.smokePpm = rawSmokeAdc;

  // Emergency Signal Detection
  if (emergency !== undefined) {
    telemetryData.emergency = Boolean(
      emergency === true || emergency === 'true' || emergency === 1 || emergency === '1'
    );
  }

  // Smoke detection logic:
  // Normal is 0, alert triggered when >= 80 ADC
  if (smokeDetected !== undefined) {
    telemetryData.smokeDetected = Boolean(
      smokeDetected === true || smokeDetected === 'true' || smokeDetected === 1 || smokeDetected === '1'
    );
  } else if (rawSmokeAdc >= 80) {
    telemetryData.smokeDetected = true;
  } else {
    telemetryData.smokeDetected = false;
  }

  if (shortCircuitDetected !== undefined) {
    telemetryData.shortCircuitDetected = Boolean(shortCircuitDetected === true || shortCircuitDetected === 'true' || shortCircuitDetected === 1);
  }
  if (arcFaultDetected !== undefined) {
    telemetryData.arcFaultDetected = Boolean(arcFaultDetected === true || arcFaultDetected === 'true' || arcFaultDetected === 1);
  }
  if (fireDetected !== undefined) {
    telemetryData.fireDetected = Boolean(fireDetected === true || fireDetected === 'true' || fireDetected === 1);
  }

  telemetryData.power = +((telemetryData.voltage * telemetryData.current * telemetryData.powerFactor) / 1000).toFixed(2);
  telemetryData.timestamp = Date.now();

  // Evaluate auto-trip
  const tripResult = await checkAutoTrip();
  await updateSystemStatus();

  const breakerStatus = await breakerAdapter.getState();
  return {
    success: true,
    breakerState: breakerStatus.state,
    command: breakerStatus.state === 'TRIPPED' ? 'TRIP_BREAKER' : 'NORMAL',
    tripped: tripResult.tripped,
    reason: tripResult.reason,
    systemStatus: telemetryData.status,
    timestamp: telemetryData.timestamp,
  };
};

// ==================== REST APIS ====================

// 1. GET /api/telemetry - Dashboard stream
app.get('/api/telemetry', async (req, res) => {
  const breakerStatus = await breakerAdapter.getState();
  await updateSystemStatus();
  res.json({
    ...telemetryData,
    currentTelemetry: telemetryData,
    history: telemetryHistory,
    breakerState: {
      state: breakerStatus.state,
      online: breakerStatus.online,
      mainBreaker: {
        state: breakerStatus.state,
        online: breakerStatus.online,
        trippedReason: breakerStatus.trippedReason,
        lastToggledAt: breakerStatus.lastToggledAt,
        mode: breakerStatus.mode,
        tuyaConfigured: breakerStatus.tuyaConfigured,
        deviceId: breakerStatus.deviceId,
      },
    },
    esp32Status,
    settings: {
      currentLimit: settings.currentLimit,
      temperatureLimit: settings.temperatureLimit,
      humidityLimit: settings.humidityLimit,
      smokeAdcLimit: 80,
      // Backward compatibility aliases
      maxCurrentLimit: settings.currentLimit,
      maxTempLimit: settings.temperatureLimit,
      maxHumidityLimit: settings.humidityLimit,
    },
    safetySettings: {
      currentLimit: settings.currentLimit,
      temperatureLimit: settings.temperatureLimit,
      humidityLimit: settings.humidityLimit,
      maxCurrentLimit: settings.currentLimit,
      maxTempLimit: settings.temperatureLimit,
      maxHumidityLimit: settings.humidityLimit,
    },
  });
});

// GET /api/telemetry/history - Send historical data points for graphs
app.get('/api/telemetry/history', (req, res) => {
  res.json({
    success: true,
    history: telemetryHistory,
    count: telemetryHistory.length,
    timestamp: Date.now(),
  });
});

// Single-File Standalone Code download / view
app.get('/api/code/standalone', (req, res) => {
  const filePath = path.join(process.cwd(), 'standalone-server.js');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(fs.readFileSync(filePath, 'utf-8'));
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// 2. ESP32 Telemetry APIs
app.post('/api/esp32/telemetry', async (req, res) => {
  const result = await processTelemetryPayload(req.body);
  res.json(result);
});

app.get('/api/esp32/telemetry', async (req, res) => {
  if (Object.keys(req.query).length > 0) {
    const result = await processTelemetryPayload(req.query);
    return res.json(result);
  }
  const breakerStatus = await breakerAdapter.getState();
  res.json({
    telemetry: telemetryData,
    esp32Status,
    breakerState: breakerStatus.state,
  });
});

// 3. ESP32 Heartbeat API
app.all('/api/esp32/heartbeat', async (req, res) => {
  esp32Status.lastHeartbeat = Date.now();
  esp32Status.connected = true;
  if (req.query?.ip) esp32Status.ipAddress = String(req.query.ip);
  if (req.body?.ip) esp32Status.ipAddress = String(req.body.ip);
  const breakerStatus = await breakerAdapter.getState();
  res.json({
    success: true,
    status: 'ONLINE',
    time: Date.now(),
    breakerCommand: breakerStatus.state === 'TRIPPED' ? 'TRIP' : 'NORMAL',
    breakerState: breakerStatus.state,
  });
});

// 4. ESP32 Admin / Signal control endpoints
app.post('/api/esp32/config', (req, res) => {
  const { ipAddress, deviceName, wifiSsid } = req.body;
  if (ipAddress) esp32Status.ipAddress = ipAddress;
  if (deviceName) esp32Status.deviceName = deviceName;
  if (wifiSsid) esp32Status.wifiSsid = wifiSsid;
  esp32Status.lastHeartbeat = Date.now();
  esp32Status.connected = true;
  res.json({ success: true, esp32Status });
});

app.post('/api/esp32/ping', (req, res) => {
  esp32Status.lastHeartbeat = Date.now();
  esp32Status.connected = true;
  res.json({
    success: true,
    connected: true,
    latencyMs: Math.floor(10 + Math.random() * 15),
    ipAddress: esp32Status.ipAddress,
  });
});

app.post('/api/esp32/reset', (req, res) => {
  esp32Status.lastHeartbeat = Date.now();
  esp32Status.connected = true;
  res.json({
    success: true,
    connected: true,
    resetTime: new Date().toLocaleTimeString('th-TH'),
    message: 'รีเซ็ตสัญญาณ ESP32 สำเร็จ',
  });
});

app.post('/api/esp32/toggle-signal', async (req, res) => {
  esp32Status.signalCut = !esp32Status.signalCut;
  if (esp32Status.signalCut) {
    esp32Status.connected = false;
    telemetryData.timestamp = 0;
    telemetryData.voltage = 0;
    telemetryData.current = 0;
    telemetryData.temperature = 0;
    telemetryData.humidity = 0;
    telemetryData.smokeDetected = false;
  } else {
    esp32Status.connected = true;
    esp32Status.lastHeartbeat = Date.now();
  }
  await updateSystemStatus();
  res.json({
    success: true,
    signalCut: esp32Status.signalCut,
    connected: esp32Status.connected,
    esp32Status,
    telemetry: telemetryData,
  });
});

// 5. BREAKER CONTROL APIS (Decoupled with BreakerAdapter)

// 5.1 POST /api/breaker/off - Power switch off
app.post('/api/breaker/off', async (req, res) => {
  const reason = req.body?.reason || 'ผู้ใช้สั่งตัดไฟผ่านหน้าเว็บ';
  const result = await breakerAdapter.turnOff(reason);
  telemetryData.current = 0;
  telemetryData.power = 0;
  await updateSystemStatus();

  if (!result.success) {
    addAlert({
      type: 'TUYA_API_ERROR',
      severity: 'danger',
      title: 'Tuya API Warning (Turn OFF)',
      description: `ส่งคำสั่งปิดสวิตช์ Tuya ไม่สำเร็จ: ${result.message}`,
      value: 'API_ERROR',
    });
  }

  addAlert({
    type: 'BREAKER_MANUAL_OFF',
    severity: 'info',
    title: 'ผู้ใช้สั่งตัดไฟ (Breaker OFF)',
    description: reason,
    value: 'OFF',
    breakerTrippedAction: false,
  });

  const breakerStatus = await breakerAdapter.getState();
  res.json({
    success: true,
    state: result.state,
    online: breakerStatus.online,
    message: result.message,
    breakerState: {
      mainBreaker: breakerStatus,
    },
  });
});

// 5.2 POST /api/breaker/on - Safety Re-closing Check (HTTP 409 if fault active)
app.post('/api/breaker/on', async (req, res) => {
  // Check active faults before turning ON
  const activeFaults: string[] = [];

  if (telemetryData.timestamp > 0 && esp32Status.connected) {
    if (telemetryData.current > settings.currentLimit) {
      activeFaults.push(`กระแสยังสูงเกินค่าที่กำหนด (${telemetryData.current} A > ${settings.currentLimit} A)`);
    }
    if (telemetryData.temperature > settings.temperatureLimit) {
      activeFaults.push(`อุณหภูมิยังสูงเกินค่าที่กำหนด (${telemetryData.temperature} °C > ${settings.temperatureLimit} °C)`);
    }
    if (telemetryData.humidity > settings.humidityLimit) {
      activeFaults.push(`ความชื้นยังสูงเกินค่าที่กำหนด (${telemetryData.humidity} % > ${settings.humidityLimit} %)`);
    }
    if (telemetryData.smokeDetected) {
      activeFaults.push(`ตรวจพบควันในตู้ MDB (${telemetryData.smokeAdc} ADC)`);
    }
  }

  // Safety Requirement: Return HTTP 409 and block turning ON if any fault is active!
  if (activeFaults.length > 0) {
    const errorMsg = 'Cannot turn breaker ON while fault is active';
    addAlert({
      type: 'BREAKER_ON_BLOCKED',
      severity: 'warning',
      title: 'ปฏิเสธการเปิดเบรกเกอร์ (Safe ON Blocked)',
      description: `ระบบไม่อนุญาตให้เปิดเบรกเกอร์เนื่องจากยังมี Fault: ${activeFaults.join(', ')}`,
      value: 'BLOCKED',
    });
    return res.status(409).json({
      success: false,
      message: errorMsg,
      activeFaults,
    });
  }

  const result = await breakerAdapter.turnOn();
  await updateSystemStatus();

  if (!result.success) {
    addAlert({
      type: 'TUYA_API_ERROR',
      severity: 'danger',
      title: 'Tuya API Error (Turn ON)',
      description: `ไม่สามารถเปิดสวิตช์ Tuya ได้: ${result.message}`,
      value: 'API_ERROR',
    });
    return res.status(502).json({
      success: false,
      message: result.message,
      state: result.state,
    });
  }

  addAlert({
    type: 'BREAKER_MANUAL_ON',
    severity: 'info',
    title: 'ผู้ใช้สั่งเปิดเบรกเกอร์ (Breaker ON)',
    description: 'ระบบจ่ายกระแสไฟฟ้าเข้าตู้ MDB และส่งคำสั่งเปิดสวิตช์ Tuya Smart Breaker สำเร็จ',
    value: 'ON',
  });

  const breakerStatus = await breakerAdapter.getState();
  res.json({
    success: true,
    state: result.state,
    online: breakerStatus.online,
    message: result.message,
    breakerState: {
      mainBreaker: breakerStatus,
    },
  });
});

// 5.3 Breaker status & backward compatible toggle endpoint
app.get('/api/breaker/status', async (req, res) => {
  const status = await breakerAdapter.getState();
  res.json({
    success: true,
    state: status.state,
    online: status.online,
    trippedReason: status.trippedReason,
    lastToggledAt: status.lastToggledAt,
    mode: status.mode,
    tuyaConfigured: status.tuyaConfigured,
    deviceId: status.deviceId,
  });
});

app.get('/api/breakers', async (req, res) => {
  const breakerStatus = await breakerAdapter.getState();
  res.json({
    mainBreaker: breakerStatus,
  });
});

app.post('/api/breakers/toggle', async (req, res) => {
  const { state, reason } = req.body;
  if (state === 'ON') {
    // Run safety check
    if (telemetryData.timestamp > 0 && esp32Status.connected) {
      if (telemetryData.current > settings.currentLimit) {
        return res.status(400).json({ success: false, message: `ไม่สามารถเปิดเบรกเกอร์ได้ กระแสยังสูงเกินค่าที่กำหนด` });
      }
      if (telemetryData.temperature > settings.temperatureLimit) {
        return res.status(400).json({ success: false, message: `ไม่สามารถเปิดเบรกเกอร์ได้ อุณหภูมิยังสูงเกินค่าที่กำหนด` });
      }
      if (telemetryData.humidity > settings.humidityLimit) {
        return res.status(400).json({ success: false, message: `ไม่สามารถเปิดเบรกเกอร์ได้ ความชื้นยังสูงเกินค่าที่กำหนด` });
      }
      if (telemetryData.smokeDetected) {
        return res.status(400).json({ success: false, message: `ไม่สามารถเปิดเบรกเกอร์ได้ ตรวจพบควันในตู้ MDB` });
      }
    }
    await breakerAdapter.turnOn();
  } else if (state === 'TRIPPED') {
    await breakerAdapter.trip(reason || 'ผู้ใช้สั่งสับเบรกเกอร์ฉุกเฉิน');
  } else {
    await breakerAdapter.turnOff(reason || 'ผู้ใช้สั่งปิดเบรกเกอร์');
  }
  await updateSystemStatus();
  const breakerStatus = await breakerAdapter.getState();
  res.json({
    success: true,
    breakerState: {
      mainBreaker: breakerStatus,
    },
  });
});

// 6. SETTINGS APIS (GET / POST with persistence to settings.json)
app.get('/api/settings', (req, res) => {
  res.json({
    currentLimit: settings.currentLimit,
    temperatureLimit: settings.temperatureLimit,
    humidityLimit: settings.humidityLimit,
    // Backward compatibility aliases
    maxCurrentLimit: settings.currentLimit,
    maxTempLimit: settings.temperatureLimit,
    maxHumidityLimit: settings.humidityLimit,
  });
});

app.post('/api/settings', async (req, res) => {
  const body = req.body || {};

  const currentLimit = Number(body.currentLimit ?? body.maxCurrentLimit ?? settings.currentLimit);
  const temperatureLimit = Number(body.temperatureLimit ?? body.maxTempLimit ?? settings.temperatureLimit);
  const humidityLimit = Number(body.humidityLimit ?? body.maxHumidityLimit ?? settings.humidityLimit);

  if (!isNaN(currentLimit) && currentLimit > 0) settings.currentLimit = +currentLimit.toFixed(1);
  if (!isNaN(temperatureLimit) && temperatureLimit > 0) settings.temperatureLimit = +temperatureLimit.toFixed(1);
  if (!isNaN(humidityLimit) && humidityLimit > 0) settings.humidityLimit = Math.round(humidityLimit);

  // Preserve other backward compatibility properties
  settings = {
    ...settings,
    ...body,
    currentLimit: settings.currentLimit,
    temperatureLimit: settings.temperatureLimit,
    humidityLimit: settings.humidityLimit,
    maxCurrentLimit: settings.currentLimit,
    maxTempLimit: settings.temperatureLimit,
    maxHumidityLimit: settings.humidityLimit,
  };

  saveSettings(settings);

  // Re-check auto-trip with new settings
  await checkAutoTrip();
  await updateSystemStatus();

  addAlert({
    type: 'SYSTEM_INFO',
    severity: 'info',
    title: 'บันทึกการตั้งค่าขีดจำกัดใหม่',
    description: `กระแส: ${settings.currentLimit} A | อุณหภูมิ: ${settings.temperatureLimit} °C | ความชื้น: ${settings.humidityLimit} %`,
    value: `${settings.currentLimit}A / ${settings.temperatureLimit}°C`,
  });

  const breakerStatus = await breakerAdapter.getState();
  res.json({
    success: true,
    settings: {
      currentLimit: settings.currentLimit,
      temperatureLimit: settings.temperatureLimit,
      humidityLimit: settings.humidityLimit,
      maxCurrentLimit: settings.currentLimit,
      maxTempLimit: settings.temperatureLimit,
      maxHumidityLimit: settings.humidityLimit,
    },
    telemetry: telemetryData,
    breakerState: {
      mainBreaker: breakerStatus,
    },
    alerts: alertLogs,
  });
});

// 7. ALERTS APIS
app.get('/api/alerts', (req, res) => {
  res.json(alertLogs);
});

app.post('/api/alerts/acknowledge', (req, res) => {
  const { alertId } = req.body;
  if (alertId === 'all') {
    alertLogs.forEach((a) => (a.acknowledged = true));
  } else {
    const alert = alertLogs.find((a) => a.id === alertId);
    if (alert) alert.acknowledged = true;
  }
  res.json({ success: true, alerts: alertLogs });
});

app.post('/api/alerts/clear', (req, res) => {
  alertLogs = [];
  res.json({ success: true, alerts: [] });
});

// ==================== VITE SERVER ====================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NPU-MDB Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
