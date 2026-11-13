/**
 * NPU-MDB: Smart Main Distribution Board Monitoring System
 * Single-file Node.js Application (Express + HTML + Chart.js)
 * 
 * ฟีเจอร์หลัก:
 * 1. ระบบหน่วงเวลากระแสเกิน 5 วินาที (Overcurrent 5s Delay / Countdown) เท่ากับฝั่ง ESP32
 *    - เมื่อ current > currentLimit จะนับถอยหลัง 5 วินาที หากเกินต่อเนื่องครบ 5s จึงสั่ง TRIPPED
 *    - หากกระแสลดลงมาต่ำกว่า limit ก่อน 5 วินาที ตัวนับเวลาจะรีเซ็ตอัตโนมัติ
 * 2. กราฟแสดงข้อมูลแบบเรียลไทม์ 3 กราฟแยกกันด้วย Chart.js:
 *    - กราฟกระแสไฟฟ้า (Current: A)
 *    - กราฟอุณหภูมิและความชื้น (Temperature: °C & Humidity: %)
 *    - กราฟระดับควันเซนเซอร์ (Smoke: ADC)
 * 3. REST API ครบถ้วน:
 *    - POST /api/esp32/telemetry
 *    - GET /api/telemetry
 *    - GET /api/telemetry/history
 *    - GET /api/breaker/status
 *    - POST /api/breaker/on
 *    - GET / POST /api/settings
 * 
 * วิธีการรัน:
 * 1. node -v (ตรวจเช็ค Node.js)
 * 2. npm install express
 * 3. node server.js
 * 4. เข้าชมที่ http://localhost:3000
 */

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS สำหรับ ESP32 และ Web Client
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ==================== IN-MEMORY STATE ====================
let telemetry = {
  voltage: 228.5,
  current: 2.1,
  temperature: 32.4,
  humidity: 55,
  smokeAdc: 12,
  smokeDetected: false,
  emergency: false,
  overCurrentCountdown: 0,
  overCurrentDelayActive: false,
  status: 'NORMAL', // NORMAL | WARNING | TRIPPED | EMERGENCY
  statusMessage: 'ระบบไฟฟ้าและตู้ MDB ทำงานปกติ ปลอดภัย',
  timestamp: Date.now()
};

let breaker = {
  state: 'ON', // ON | OFF | TRIPPED
  online: true,
  trippedReason: '',
  lastToggledAt: Date.now()
};

let settings = {
  currentLimit: 5.0,      // A
  temperatureLimit: 50.0, // °C
  humidityLimit: 80.0,    // %
  smokeAdcLimit: 80       // Alert threshold >= 80 ADC
};

// ตัวจับเวลาหน่วงเวลา 5 วินาทีสำหรับกระแสเกิน (5s Overcurrent Delay)
let overCurrentStartTime = null;
let overCurrentRemainingSec = 0;

// ประวัติข้อมูลกราฟย้อนหลัง (30 จุดข้อมูลล่าสุด)
let history = [];
const initNow = Date.now();
for (let i = 20; i >= 0; i--) {
  const t = new Date(initNow - i * 2000);
  history.push({
    time: t.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    current: +(2.0 + Math.random() * 0.3).toFixed(1),
    temperature: +(32.0 + Math.random() * 0.5).toFixed(1),
    humidity: Math.floor(54 + Math.random() * 3),
    smokeAdc: Math.floor(6 + Math.random() * 8)
  });
}

// ตรวจสอบความปลอดภัยและ Auto-Trip
function evaluateSafety() {
  if (breaker.state === 'TRIPPED') {
    overCurrentStartTime = null;
    overCurrentRemainingSec = 0;
    telemetry.overCurrentDelayActive = false;
    telemetry.overCurrentCountdown = 0;
    telemetry.status = 'TRIPPED';
    return true;
  }

  // 1. ตรวจสอบ Emergency Stop
  if (telemetry.emergency) {
    breaker.state = 'TRIPPED';
    breaker.trippedReason = 'สัญญาณหยุดฉุกเฉิน (EMERGENCY / E-STOP Active)';
    telemetry.status = 'EMERGENCY';
    telemetry.statusMessage = '🚨 EMERGENCY: ตรวจพบการสั่งหยุดฉุกเฉิน ปลดวงจรทันที';
    overCurrentStartTime = null;
    telemetry.overCurrentDelayActive = false;
    return true;
  }

  // 2. ตรวจสอบกระแสเกิน (หน่วงเวลา 5 วินาทีต่อเนื่อง)
  if (telemetry.current > settings.currentLimit) {
    if (overCurrentStartTime === null) {
      overCurrentStartTime = Date.now();
      console.log(`[Overcurrent] เริ่มนับถอยหลัง 5 วินาที: ${telemetry.current}A > ${settings.currentLimit}A`);
    }
    const elapsed = Date.now() - overCurrentStartTime;
    overCurrentRemainingSec = Math.max(0, Math.ceil((5000 - elapsed) / 1000));
    telemetry.overCurrentCountdown = overCurrentRemainingSec;
    telemetry.overCurrentDelayActive = true;

    if (elapsed >= 5000) {
      // เกินต่อเนื่องครบ 5 วินาทีแล้ว สั่งตัดไฟ TRIPPED
      breaker.state = 'TRIPPED';
      breaker.trippedReason = `กระแสไฟฟ้าเกินกำหนด (${telemetry.current}A > ${settings.currentLimit}A) ต่อเนื่องครบ 5 วินาที`;
      telemetry.status = 'TRIPPED';
      telemetry.statusMessage = `⚠️ TRIPPED: ${breaker.trippedReason}`;
      overCurrentStartTime = null;
      overCurrentRemainingSec = 0;
      telemetry.overCurrentDelayActive = false;
      telemetry.overCurrentCountdown = 0;
      return true;
    } else {
      // อยู่ในช่วงหน่วงเวลา 5 วินาที แจ้งเตือน WARNING ยังไม่ตัดไฟ
      telemetry.status = 'WARNING';
      telemetry.statusMessage = `⚠️ กระแสไฟเกิน (${telemetry.current.toFixed(1)}A > ${settings.currentLimit.toFixed(1)}A) กำลังนับถอยหลังตัดไฟใน ${overCurrentRemainingSec} วินาที...`;
    }
  } else {
    // กระแสกลับลงมาต่ำกว่า limit ก่อน 5 วินาที -> รีเซ็ตตัวนับเวลาทันที!
    if (overCurrentStartTime !== null) {
      console.log(`[Overcurrent Reset] กระแสลดลงมาที่ ${telemetry.current}A <= ${settings.currentLimit}A รีเซ็ตตัวนับเวลาเรียบร้อย`);
      overCurrentStartTime = null;
      overCurrentRemainingSec = 0;
    }
    telemetry.overCurrentDelayActive = false;
    telemetry.overCurrentCountdown = 0;
  }

  // 3. ตรวจสอบควันไฟ
  if (telemetry.smokeDetected || telemetry.smokeAdc >= settings.smokeAdcLimit) {
    breaker.state = 'TRIPPED';
    breaker.trippedReason = `ตรวจพบควันในตู้ (${telemetry.smokeAdc} ADC >= เกณฑ์ ${settings.smokeAdcLimit} ADC)`;
    telemetry.status = 'TRIPPED';
    telemetry.statusMessage = `⚠️ TRIPPED: ${breaker.trippedReason}`;
    return true;
  }

  // 4. ตรวจสอบอุณหภูมิเกิน
  if (telemetry.temperature > settings.temperatureLimit) {
    breaker.state = 'TRIPPED';
    breaker.trippedReason = `อุณหภูมิสูงเกินกำหนด (${telemetry.temperature}°C > ${settings.temperatureLimit}°C)`;
    telemetry.status = 'TRIPPED';
    telemetry.statusMessage = `⚠️ TRIPPED: ${breaker.trippedReason}`;
    return true;
  }

  // 5. ตรวจสอบความชื้นเกิน
  if (telemetry.humidity > settings.humidityLimit) {
    breaker.state = 'TRIPPED';
    breaker.trippedReason = `ความชื้นสูงเกินกำหนด (${telemetry.humidity}% > ${settings.humidityLimit}%)`;
    telemetry.status = 'TRIPPED';
    telemetry.statusMessage = `⚠️ TRIPPED: ${breaker.trippedReason}`;
    return true;
  }

  if (telemetry.status !== 'WARNING') {
    telemetry.status = 'NORMAL';
    telemetry.statusMessage = 'ระบบไฟฟ้าและตู้ MDB ทำงานปกติ ปลอดภัย';
  }
  return false;
}

// Background Monitor ทุกๆ 500ms ตรวจสอบการนับถอยหลัง 5 วินาทีของ Overcurrent
setInterval(() => {
  if (overCurrentStartTime !== null && breaker.state === 'ON') {
    const elapsed = Date.now() - overCurrentStartTime;
    overCurrentRemainingSec = Math.max(0, Math.ceil((5000 - elapsed) / 1000));
    telemetry.overCurrentCountdown = overCurrentRemainingSec;
    telemetry.overCurrentDelayActive = true;

    if (elapsed >= 5000) {
      console.log(`[Auto-Trip] กระแสเกินต่อเนื่องครบ 5 วินาที! สั่งตัดไฟ TRIPPED`);
      evaluateSafety();
    }
  }
}, 500);

// บันทึกประวัติจุดข้อมูลกราฟทุกๆ 2 วินาที
setInterval(() => {
  const timeLabel = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  history.push({
    time: timeLabel,
    current: telemetry.current,
    temperature: telemetry.temperature,
    humidity: telemetry.humidity,
    smokeAdc: telemetry.smokeAdc
  });
  if (history.length > 30) history.shift();
}, 2000);

// ==================== REST APIS ====================

// 1. รับข้อมูลจาก ESP32 ผ่าน POST /api/esp32/telemetry
app.post('/api/esp32/telemetry', (req, res) => {
  const data = req.body || {};

  if (data.voltage !== undefined) telemetry.voltage = Number(data.voltage);
  if (data.current !== undefined) telemetry.current = Number(data.current);
  if (data.temperature !== undefined) telemetry.temperature = Number(data.temperature);
  if (data.humidity !== undefined) telemetry.humidity = Number(data.humidity);

  // รองรับ smokePercent, smokeAdc, adc
  const rawSmoke = Number(data.smokeAdc ?? data.adc ?? data.smokePercent ?? data.smoke ?? telemetry.smokeAdc);
  telemetry.smokeAdc = isNaN(rawSmoke) ? 0 : rawSmoke;

  if (data.smokeDetected !== undefined) {
    telemetry.smokeDetected = Boolean(data.smokeDetected === true || data.smokeDetected === 'true' || data.smokeDetected === 1);
  } else {
    telemetry.smokeDetected = telemetry.smokeAdc >= settings.smokeAdcLimit;
  }

  if (data.emergency !== undefined) {
    telemetry.emergency = Boolean(data.emergency === true || data.emergency === 'true' || data.emergency === 1);
  }

  telemetry.timestamp = Date.now();
  evaluateSafety();

  res.json({
    success: true,
    breakerState: breaker.state,
    command: breaker.state === 'TRIPPED' ? 'TRIP_BREAKER' : 'NORMAL',
    status: telemetry.status,
    overCurrentCountdown: telemetry.overCurrentCountdown,
    timestamp: telemetry.timestamp
  });
});

// 2. ดึงข้อมูลล่าสุดให้หน้าเว็บผ่าน GET /api/telemetry
app.get('/api/telemetry', (req, res) => {
  evaluateSafety();
  res.json({
    ...telemetry,
    breakerState: breaker,
    settings: settings,
    history: history
  });
});

// 3. ส่งประวัติย้อนหลังสำหรับวาดกราฟผ่าน GET /api/telemetry/history
app.get('/api/telemetry/history', (req, res) => {
  res.json({
    success: true,
    history: history,
    count: history.length,
    timestamp: Date.now()
  });
});

// 4. ตรวจสอบสถานะเบรกเกอร์ GET /api/breaker/status
app.get('/api/breaker/status', (req, res) => {
  res.json({
    success: true,
    state: breaker.state,
    online: breaker.online,
    trippedReason: breaker.trippedReason,
    lastToggledAt: breaker.lastToggledAt
  });
});

// 5. สั่งเปิดเบรกเกอร์ POST /api/breaker/on
app.post('/api/breaker/on', (req, res) => {
  const faults = [];
  if (telemetry.emergency) faults.push('สถานะ Emergency ยังทำงานอยู่');
  if (telemetry.current > settings.currentLimit) faults.push(`กระแสเกิน (${telemetry.current}A > ${settings.currentLimit}A)`);
  if (telemetry.smokeDetected || telemetry.smokeAdc >= settings.smokeAdcLimit) faults.push(`ควันยังสูงเกิน (${telemetry.smokeAdc} ADC)`);
  if (telemetry.temperature > settings.temperatureLimit) faults.push(`อุณหภูมิเกิน (${telemetry.temperature}°C)`);

  if (faults.length > 0) {
    return res.status(409).json({
      success: false,
      message: 'ไม่อนุญาตให้เปิดเบรกเกอร์ ค่าเซนเซอร์ยังไม่ปลอดภัย (Safe ON Protection): ' + faults.join(', '),
      faults: faults
    });
  }

  breaker.state = 'ON';
  breaker.trippedReason = '';
  breaker.lastToggledAt = Date.now();
  overCurrentStartTime = null;
  overCurrentRemainingSec = 0;
  telemetry.overCurrentDelayActive = false;
  telemetry.overCurrentCountdown = 0;
  telemetry.status = 'NORMAL';
  telemetry.emergency = false;
  telemetry.statusMessage = 'ผู้ใช้สั่งเปิดเบรกเกอร์ จ่ายกระแสไฟฟ้าตามปกติ';

  res.json({
    success: true,
    state: 'ON',
    message: 'เปิดเบรกเกอร์จ่ายไฟเรียบร้อยแล้ว'
  });
});

// 6. ตั้งค่า Limit ผ่าน GET / POST /api/settings
app.get('/api/settings', (req, res) => {
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  const body = req.body || {};
  if (body.currentLimit !== undefined) settings.currentLimit = Number(body.currentLimit);
  if (body.temperatureLimit !== undefined) settings.temperatureLimit = Number(body.temperatureLimit);
  if (body.humidityLimit !== undefined) settings.humidityLimit = Number(body.humidityLimit);
  if (body.smokeAdcLimit !== undefined) settings.smokeAdcLimit = Number(body.smokeAdcLimit);
  res.json({ success: true, settings });
});

// ==================== FRONTEND (DASHBOARD UI WITH CHART.JS) ====================
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NPU-MDB | Smart Electrical Monitoring</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&family=JetBrains+Mono:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Chakra Petch', sans-serif; background-color: #090d16; color: #f8fafc; }
    .mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">

  <!-- Header Navbar -->
  <header class="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-50 px-4 py-3 sm:px-6">
    <div class="max-w-6xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-lg">⚡</div>
        <div>
          <h1 class="text-lg font-bold tracking-wider text-white">NPU-MDB</h1>
          <p class="text-[11px] text-slate-400">ระบบมอนิเตอร์ตู้ไฟฟ้าอัจฉริยะ (Smart Distribution Board)</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
        <span id="updateTime" class="mono text-xs text-slate-400">อัปเดต: --:--:--</span>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-5">

    <!-- Overcurrent 5s Countdown Banner -->
    <div id="overcurrentBanner" class="hidden p-4 rounded-2xl bg-amber-950/60 border-2 border-amber-500 shadow-lg flex items-start gap-3.5 animate-pulse">
      <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0 text-xl">
        ⏳
      </div>
      <div class="flex-1 space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold text-amber-300 mono flex items-center gap-2">
            <span>⚠️ ตรวจพบกระแสไฟฟ้าเกินกำหนด (Over Current 5s Delay)</span>
          </span>
          <span id="countdownBadge" class="mono text-xs px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold">
            นับถอยหลัง 5s
          </span>
        </div>
        <p class="text-xs text-amber-200/90 leading-relaxed">
          ระบบกำลังหน่วงเวลา 5 วินาทีเท่ากับฝั่ง ESP32 หากกระแสยังเกินต่อเนื่องจะสั่งตัดเบรกเกอร์ (TRIPPED) อัตโนมัติ แต่หากกระแสลดลงต่ำกว่าพิกัดก่อนครบ 5 วินาที ตัวนับเวลาจะรีเซ็ตกลับเป็นปกติทันที
        </p>
      </div>
    </div>

    <!-- 1. System Status & Breaker Banner -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      
      <!-- Status Box -->
      <div id="statusBox" class="p-4 sm:p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between md:col-span-2 transition-all">
        <div class="flex items-center gap-3.5">
          <div id="statusIcon" class="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-2xl">
            🛡️
          </div>
          <div>
            <div class="text-[11px] text-slate-400 font-bold uppercase tracking-wider">สถานะระบบ (SYSTEM STATUS)</div>
            <div id="statusText" class="mono text-xl sm:text-2xl font-bold text-emerald-400 flex items-center gap-2">
              NORMAL
            </div>
            <p id="statusDesc" class="text-xs text-slate-300 mt-0.5">ระบบไฟฟ้าทำงานปกติ ปลอดภัย</p>
          </div>
        </div>
        <div id="statusBadge" class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
          ปกติ
        </div>
      </div>

      <!-- Breaker Control Card -->
      <div class="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div>
          <div class="text-[11px] text-slate-400 font-bold uppercase tracking-wider">เบรกเกอร์ (BREAKER)</div>
          <div id="breakerStateText" class="mono text-xl font-bold text-emerald-400">● ON จ่ายไฟ</div>
          <div id="breakerReason" class="text-[10px] text-rose-400 truncate max-w-[150px]"></div>
        </div>
        <button id="btnTurnOn" onclick="turnOnBreaker()" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm mono shadow-lg shadow-emerald-900/40 transition active:scale-95 flex items-center gap-2">
          <span>⚡</span>
          <span>ON / เปิดไฟ</span>
        </button>
      </div>
    </div>

    <!-- 2. Sensor Metrics Grid (5 Values) -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <!-- Voltage -->
      <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
        <span class="text-xs text-slate-400 font-bold">Voltage</span>
        <div class="mono text-2xl font-bold text-white my-1"><span id="valVoltage">220</span><span class="text-xs text-slate-400 ml-1">V</span></div>
        <span class="text-[10px] text-slate-500 mono">มาตรฐาน 220V</span>
      </div>

      <!-- Current -->
      <div id="cardCurrent" class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between transition-colors">
        <div class="flex items-center justify-between">
          <span class="text-xs text-slate-400 font-bold">Current</span>
          <span id="badgeCurrent" class="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">ปกติ</span>
        </div>
        <div class="mono text-2xl font-bold text-amber-400 my-1"><span id="valCurrent">0.0</span><span class="text-xs text-slate-400 ml-1">A</span></div>
        <span class="text-[10px] text-slate-400 mono">Limit: <strong id="limitCurrent">5.0 A</strong></span>
      </div>

      <!-- Temperature -->
      <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
        <span class="text-xs text-slate-400 font-bold">Temperature</span>
        <div class="mono text-2xl font-bold text-rose-400 my-1"><span id="valTemp">30.0</span><span class="text-xs text-slate-400 ml-1">°C</span></div>
        <span class="text-[10px] text-slate-400 mono">Limit: <strong id="limitTemp">50.0 °C</strong></span>
      </div>

      <!-- Humidity -->
      <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
        <span class="text-xs text-slate-400 font-bold">Humidity</span>
        <div class="mono text-2xl font-bold text-cyan-400 my-1"><span id="valHum">55</span><span class="text-xs text-slate-400 ml-1">%</span></div>
        <span class="text-[10px] text-slate-400 mono">Limit: <strong id="limitHum">80 %</strong></span>
      </div>

      <!-- Smoke ADC -->
      <div id="cardSmoke" class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between transition-colors">
        <div class="flex items-center justify-between">
          <span class="text-xs text-slate-400 font-bold">Smoke ADC</span>
          <span id="badgeSmoke" class="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">NORMAL</span>
        </div>
        <div class="mono text-2xl font-bold text-white my-1"><span id="valSmoke">0</span><span class="text-xs text-slate-400 ml-1">ADC</span></div>
        <span class="text-[10px] text-slate-400 mono">เตือนเมื่อ: <strong class="text-rose-400">&ge; 80 ADC</strong></span>
      </div>
    </div>

    <!-- 3. Real-time Line Charts (3 Separate Charts using Chart.js) -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      
      <!-- Chart 1: Current Line Chart -->
      <div class="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-amber-400 text-base">⚡</span>
            <h2 class="text-sm font-bold text-white tracking-wide">กระแสไฟฟ้า (Current: A)</h2>
          </div>
          <span class="text-[10px] mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">อัปเดตทุก 2s</span>
        </div>
        <div class="h-56 relative w-full">
          <canvas id="currentChart"></canvas>
        </div>
        <div class="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
          <span>เส้นเหลือง: กระแสที่วัดได้จริง (A)</span>
          <span class="text-rose-400">เส้นประ: ตัดไฟ 5s (5.0A)</span>
        </div>
      </div>

      <!-- Chart 2: Temperature & Humidity Real-time Chart -->
      <div class="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-rose-400 text-base">🌡️</span>
            <h2 class="text-sm font-bold text-white tracking-wide">อุณหภูมิ &amp; ความชื้น (Temp &amp; Hum)</h2>
          </div>
          <span class="text-[10px] mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">°C / %</span>
        </div>
        <div class="h-56 relative w-full">
          <canvas id="tempHumChart"></canvas>
        </div>
        <div class="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
          <span class="text-rose-400">เส้นชมพู: อุณหภูมิ (°C)</span>
          <span class="text-cyan-400">เส้นฟ้า: ความชื้น (%)</span>
        </div>
      </div>

      <!-- Chart 3: Smoke Sensor ADC Line Chart -->
      <div class="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-cyan-400 text-base">💨</span>
            <h2 class="text-sm font-bold text-white tracking-wide">ระดับควันเซนเซอร์ (Smoke ADC)</h2>
          </div>
          <span class="text-[10px] mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">เกณฑ์ &ge; 80 ADC</span>
        </div>
        <div class="h-56 relative w-full">
          <canvas id="smokeChart"></canvas>
        </div>
        <div class="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
          <span>เส้นฟ้า: ควัน RAW ADC</span>
          <span class="text-rose-400">เส้นประ: เกณฑ์เตือน (80 ADC)</span>
        </div>
      </div>

    </div>

    <!-- Toast Notification -->
    <div id="toast" class="hidden p-3.5 rounded-xl text-xs mono text-center font-bold transition-all"></div>

  </main>

  <!-- Footer -->
  <footer class="p-4 border-t border-slate-800 text-center text-xs text-slate-500">
    NPU-MDB Smart Distribution Board &bull; Node.js Express 5s Delay Engine &amp; Chart.js
  </footer>

  <!-- Script: Real-time Fetch & Chart.js -->
  <script>
    // 1. Chart 1: Current Chart
    const ctxCurrent = document.getElementById('currentChart').getContext('2d');
    const currentChart = new Chart(ctxCurrent, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Current (A)',
            data: [],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 2.5,
            pointBackgroundColor: '#f59e0b'
          },
          {
            label: 'Limit',
            data: [],
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8', font: { size: 9, family: 'JetBrains Mono' } }
          },
          y: {
            min: 0,
            suggestedMax: 8,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8', font: { size: 9, family: 'JetBrains Mono' } }
          }
        }
      }
    });

    // 2. Chart 2: Temperature & Humidity Chart (Dual line)
    const ctxTempHum = document.getElementById('tempHumChart').getContext('2d');
    const tempHumChart = new Chart(ctxTempHum, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Temp (°C)',
            data: [],
            borderColor: '#f43f5e',
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 2,
            pointBackgroundColor: '#f43f5e'
          },
          {
            label: 'Humidity (%)',
            data: [],
            borderColor: '#06b6d4',
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 2,
            pointBackgroundColor: '#06b6d4'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { color: '#cbd5e1', font: { size: 10, family: 'JetBrains Mono' }, boxWidth: 12 }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8', font: { size: 9, family: 'JetBrains Mono' } }
          },
          y: {
            min: 0,
            suggestedMax: 100,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8', font: { size: 9, family: 'JetBrains Mono' } }
          }
        }
      }
    });

    // 3. Chart 3: Smoke Sensor ADC Chart
    const ctxSmoke = document.getElementById('smokeChart').getContext('2d');
    const smokeChart = new Chart(ctxSmoke, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Smoke (ADC)',
            data: [],
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.12)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 2.5,
            pointBackgroundColor: '#06b6d4'
          },
          {
            label: 'Warn (80 ADC)',
            data: [],
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8', font: { size: 9, family: 'JetBrains Mono' } }
          },
          y: {
            min: 0,
            suggestedMax: 120,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8', font: { size: 9, family: 'JetBrains Mono' } }
          }
        }
      }
    });

    // 4. Fetch Telemetry Data Every 2s (Using GET /api/telemetry & GET /api/telemetry/history)
    let currentLimitVal = 5.0;
    let smokeLimitVal = 80;

    async function fetchTelemetry() {
      try {
        const res = await fetch('/api/telemetry');
        if (!res.ok) return;
        const data = await res.json();

        // อัปเดตเวลา
        document.getElementById('updateTime').innerText = 'อัปเดต: ' + new Date(data.timestamp || Date.now()).toLocaleTimeString('th-TH');

        // อัปเดตตัวเลขในการ์ด
        document.getElementById('valVoltage').innerText = Number(data.voltage || 0).toFixed(0);
        document.getElementById('valCurrent').innerText = Number(data.current || 0).toFixed(1);
        document.getElementById('valTemp').innerText = Number(data.temperature || 0).toFixed(1);
        document.getElementById('valHum').innerText = Number(data.humidity || 0).toFixed(0);
        document.getElementById('valSmoke').innerText = Number(data.smokeAdc || 0);

        if (data.settings) {
          currentLimitVal = Number(data.settings.currentLimit || 5.0);
          smokeLimitVal = Number(data.settings.smokeAdcLimit || 80);
          document.getElementById('limitCurrent').innerText = currentLimitVal.toFixed(1) + ' A';
          document.getElementById('limitTemp').innerText = Number(data.settings.temperatureLimit || 50).toFixed(1) + ' °C';
          document.getElementById('limitHum').innerText = Number(data.settings.humidityLimit || 80).toFixed(0) + ' %';
        }

        // แสดงผลแบนเนอร์นับถอยหลัง 5 วินาทีกระแสเกิน (Countdown Banner)
        const banner = document.getElementById('overcurrentBanner');
        const countdownBadge = document.getElementById('countdownBadge');
        const bState = data.breakerState?.state || data.breakerState || 'ON';
        const isCurrentOver = (data.current > currentLimitVal);

        if (bState !== 'TRIPPED' && (data.overCurrentDelayActive || isCurrentOver)) {
          banner.classList.remove('hidden');
          const remaining = (data.overCurrentCountdown !== undefined && data.overCurrentCountdown > 0) ? data.overCurrentCountdown : 5;
          countdownBadge.innerText = 'นับถอยหลัง ' + remaining + 's';
        } else {
          banner.classList.add('hidden');
        }

        // สถานะเบรกเกอร์
        const elBText = document.getElementById('breakerStateText');
        const elBReason = document.getElementById('breakerReason');
        if (bState === 'ON') {
          elBText.innerText = '● ON จ่ายไฟ';
          elBText.className = 'mono text-xl font-bold text-emerald-400';
          elBReason.innerText = '';
        } else if (bState === 'TRIPPED') {
          elBText.innerText = '● TRIPPED ตัดไฟ';
          elBText.className = 'mono text-xl font-bold text-rose-500 animate-pulse';
          elBReason.innerText = data.breakerState?.trippedReason || 'วงจรตัดการทำงานอัตโนมัติ';
        } else {
          elBText.innerText = '● OFF ดับไฟ';
          elBText.className = 'mono text-xl font-bold text-slate-400';
          elBReason.innerText = '';
        }

        // กล่องสถานะระบบ NORMAL vs WARNING vs EMERGENCY / TRIPPED
        const statusBox = document.getElementById('statusBox');
        const statusText = document.getElementById('statusText');
        const statusIcon = document.getElementById('statusIcon');
        const statusBadge = document.getElementById('statusBadge');
        const statusDesc = document.getElementById('statusDesc');

        const isEmergency = data.emergency || data.status === 'EMERGENCY';
        const isTripped = bState === 'TRIPPED' || data.status === 'TRIPPED';
        const isWarn = data.status === 'WARNING' || data.overCurrentDelayActive;

        if (isEmergency) {
          statusBox.className = 'p-4 sm:p-5 rounded-2xl bg-rose-950/70 border-2 border-rose-500 flex items-center justify-between md:col-span-2 animate-pulse';
          statusText.innerText = 'EMERGENCY';
          statusText.className = 'mono text-xl sm:text-2xl font-bold text-rose-400';
          statusIcon.innerText = '🚨';
          statusIcon.className = 'w-12 h-12 rounded-2xl bg-rose-500/30 border border-rose-400 flex items-center justify-center text-2xl';
          statusBadge.innerText = 'หยุดฉุกเฉิน';
          statusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-rose-500 text-white';
          statusDesc.innerText = data.statusMessage || 'ตรวจพบการสั่งหยุดฉุกเฉิน ปลดวงจรทันที';
        } else if (isTripped) {
          statusBox.className = 'p-4 sm:p-5 rounded-2xl bg-rose-950/40 border border-rose-500/50 flex items-center justify-between md:col-span-2';
          statusText.innerText = 'TRIPPED';
          statusText.className = 'mono text-xl sm:text-2xl font-bold text-rose-400';
          statusIcon.innerText = '⚠️';
          statusIcon.className = 'w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-2xl';
          statusBadge.innerText = 'ตัดไฟออโต้';
          statusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30';
          statusDesc.innerText = data.statusMessage || 'เบรกเกอร์ตัดวงจรอัตโนมัติเนื่องจากค่าเกินเกณฑ์';
        } else if (isWarn) {
          statusBox.className = 'p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-500/50 flex items-center justify-between md:col-span-2';
          statusText.innerText = 'WARNING';
          statusText.className = 'mono text-xl sm:text-2xl font-bold text-amber-400';
          statusIcon.innerText = '⏳';
          statusIcon.className = 'w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-2xl';
          statusBadge.innerText = 'เฝ้าระวัง';
          statusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30';
          statusDesc.innerText = data.statusMessage || 'ระบบกำลังเฝ้าระวังและนับถอยหลังตัดไฟ';
        } else {
          statusBox.className = 'p-4 sm:p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between md:col-span-2';
          statusText.innerText = 'NORMAL';
          statusText.className = 'mono text-xl sm:text-2xl font-bold text-emerald-400';
          statusIcon.innerText = '🛡️';
          statusIcon.className = 'w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-2xl';
          statusBadge.innerText = 'ปกติ';
          statusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
          statusDesc.innerText = 'ระบบไฟฟ้าและตู้ MDB ทำงานปกติ ปลอดภัย';
        }

        // อัปเดตการแจ้งเตือนควัน
        const isSmokeWarn = data.smokeDetected || (data.smokeAdc >= smokeLimitVal);
        const cardSmoke = document.getElementById('cardSmoke');
        const badgeSmoke = document.getElementById('badgeSmoke');
        if (isSmokeWarn) {
          cardSmoke.className = 'p-3.5 rounded-xl bg-rose-950/50 border-2 border-rose-500 flex flex-col justify-between animate-pulse';
          badgeSmoke.innerText = 'SMOKE DETECTED';
          badgeSmoke.className = 'text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold';
        } else {
          cardSmoke.className = 'p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between';
          badgeSmoke.innerText = 'NORMAL';
          badgeSmoke.className = 'text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold';
        }

        // อัปเดตกราฟทั้ง 3 กราฟจากประวัติ
        if (data.history && data.history.length > 0) {
          const labels = data.history.map(h => h.time);
          const currentVals = data.history.map(h => h.current);
          const tempVals = data.history.map(h => h.temperature || 0);
          const humVals = data.history.map(h => h.humidity || 0);
          const smokeVals = data.history.map(h => h.smokeAdc);

          // 1. Current Chart
          currentChart.data.labels = labels;
          currentChart.data.datasets[0].data = currentVals;
          currentChart.data.datasets[1].data = labels.map(() => currentLimitVal);
          currentChart.update('none');

          // 2. Temp & Humidity Chart
          tempHumChart.data.labels = labels;
          tempHumChart.data.datasets[0].data = tempVals;
          tempHumChart.data.datasets[1].data = humVals;
          tempHumChart.update('none');

          // 3. Smoke Chart
          smokeChart.data.labels = labels;
          smokeChart.data.datasets[0].data = smokeVals;
          smokeChart.data.datasets[1].data = labels.map(() => smokeLimitVal);
          smokeChart.update('none');
        }

      } catch (err) {
        console.error('Fetch error:', err);
      }
    }

    // 5. สั่งเปิดเบรกเกอร์ POST /api/breaker/on
    async function turnOnBreaker() {
      const toast = document.getElementById('toast');
      try {
        const res = await fetch('/api/breaker/on', { method: 'POST' });
        const result = await res.json();
        toast.classList.remove('hidden');
        if (res.ok) {
          toast.className = 'p-3 rounded-xl bg-emerald-900/80 border border-emerald-500 text-emerald-200 text-xs mono text-center font-bold';
          toast.innerText = '✅ สั่งเปิดเบรกเกอร์จ่ายไฟสำเร็จ!';
        } else {
          toast.className = 'p-3 rounded-xl bg-rose-900/80 border border-rose-500 text-rose-200 text-xs mono text-center font-bold';
          toast.innerText = '❌ ' + (result.message || 'ไม่สามารถเปิดเบรกเกอร์ได้');
        }
        await fetchTelemetry();
        setTimeout(() => toast.classList.add('hidden'), 4000);
      } catch (err) {
        toast.className = 'p-3 rounded-xl bg-rose-900/80 border border-rose-500 text-rose-200 text-xs mono text-center font-bold';
        toast.innerText = '❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 4000);
      }
    }

    // เริ่มต้น Fetch และวนลูปทุกๆ 2 วินาที (2000 ms)
    fetchTelemetry();
    setInterval(fetchTelemetry, 2000);
  </script>
</body>
</html>`);
});

// เริ่มต้นรันเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` NPU-MDB Smart Monitor Server กำลังทำงานที่พอร์ต: ${PORT}`);
  console.log(` Web Dashboard: http://localhost:${PORT}`);
  console.log(` API Endpoints:`);
  console.log(` - POST /api/esp32/telemetry`);
  console.log(` - GET  /api/telemetry`);
  console.log(` - GET  /api/telemetry/history`);
  console.log(` - GET  /api/breaker/status`);
  console.log(` - POST /api/breaker/on`);
  console.log(` - GET/POST /api/settings`);
  console.log(`====================================================`);
});
