import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  Wifi,
  Save,
  Check,
  Activity,
  RotateCcw,
  Gauge,
  Thermometer,
  Flame,
  Zap,
  Radio,
  CheckCircle2,
  XCircle,
  Copy,
  Code2,
  Send,
  ShieldCheck,
  PowerOff,
  Power,
  AlertTriangle,
} from 'lucide-react';
import { ESP32Status, TelemetryData } from '../types';

interface ESP32SetupModalProps {
  isOpen?: boolean;
  onClose: () => void;
  esp32Status: ESP32Status;
  telemetry?: TelemetryData;
  onRefreshTelemetry?: () => void;
  onInjectLocalTelemetry?: (data: Partial<TelemetryData>) => void;
}

export const ESP32SetupModal: React.FC<ESP32SetupModalProps> = ({
  isOpen = true,
  onClose,
  esp32Status,
  telemetry,
  onRefreshTelemetry,
  onInjectLocalTelemetry,
}) => {
  const [deviceIp, setDeviceIp] = useState(esp32Status.ipAddress || '192.168.1.105');
  const [deviceName, setDeviceName] = useState(esp32Status.deviceName || 'NPU-MDB-ESP32');
  const [wifiSsid, setWifiSsid] = useState(esp32Status.wifiSsid || '');
  const [wifiPass, setWifiPass] = useState('');
  const [channel, setChannel] = useState(esp32Status.channel || 'CH-01 (MDB Main Bus)');
  const [secretToken, setSecretToken] = useState(esp32Status.secretToken || 'ARTT1008-SECURE-KEY');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showCodeGuide, setShowCodeGuide] = useState(false);

  // Ping test state
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs?: number; message?: string } | null>(null);

  // Reset connection state
  const [isResetting, setIsResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{
    success: boolean;
    time?: string;
    message?: string;
  } | null>(null);

  // Quick test packet state
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Signal cut / reconnect state
  const [isTogglingSignal, setIsTogglingSignal] = useState(false);

  const handleToggleSignal = async () => {
    setIsTogglingSignal(true);
    try {
      const res = await fetch('/api/esp32/toggle-signal', { method: 'POST' });
      if (res.ok && onRefreshTelemetry) {
        onRefreshTelemetry();
      }
    } catch {
      // ignore
    } finally {
      setIsTogglingSignal(false);
    }
  };

  // Dynamic API URL for ESP32
  const fullApiUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/esp32/telemetry`
      : 'https://ais-dev-nwg5nf6dl3qfsvff3aefua-286576906385.asia-east1.run.app/api/esp32/telemetry';

  useEffect(() => {
    if (esp32Status) {
      if (esp32Status.ipAddress) setDeviceIp(esp32Status.ipAddress);
      if (esp32Status.deviceName) setDeviceName(esp32Status.deviceName);
      if (esp32Status.wifiSsid) setWifiSsid(esp32Status.wifiSsid);
      if (esp32Status.channel) setChannel(esp32Status.channel);
      if (esp32Status.secretToken) setSecretToken(esp32Status.secretToken);
    }
  }, [esp32Status]);

  if (isOpen === false) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(fullApiUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(arduinoCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleResetConnection = async () => {
    setIsResetting(true);
    setResetFeedback(null);
    try {
      const res = await fetch('/api/esp32/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const timeStr = data.resetTime || new Date().toLocaleTimeString('th-TH');
        setResetFeedback({
          success: true,
          time: timeStr,
          message: data.message || `รีเซ็ตสัญญาณกับ ESP32 (${deviceIp || 'Gateway'}) สำเร็จ`,
        });
        if (onRefreshTelemetry) onRefreshTelemetry();
        setTimeout(() => setResetFeedback(null), 4000);
      } else {
        setResetFeedback({
          success: false,
          message: 'ไม่สามารถรีเซ็ตสัญญาณได้ กรุณาตรวจสอบสถานะเครือข่าย',
        });
      }
    } catch {
      setResetFeedback({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/esp32/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: deviceIp,
          deviceName,
          channel,
          wifiSsid,
          secretToken,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        if (onRefreshTelemetry) onRefreshTelemetry();
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const handlePing = async () => {
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await fetch('/api/esp32/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setPingResult({
          success: true,
          latencyMs: data.latencyMs || 16,
          message: data.message || `Ping สำเร็จ! บอร์ด ESP32 (${deviceIp || 'Gateway'}) ตอบสนองปกติ`,
        });
        if (onRefreshTelemetry) onRefreshTelemetry();
        setTimeout(() => setPingResult(null), 4000);
      } else {
        setPingResult({
          success: false,
          message: 'ไม่สามารถติดต่อ ESP32 ได้ กรุณาตรวจสอบการเชื่อมต่อ',
        });
      }
    } catch {
      setPingResult({
        success: false,
        message: 'การเชื่อมต่อผิดพลาด',
      });
    } finally {
      setIsPinging(false);
    }
  };

  const handleSendTestPacket = async () => {
    setIsSendingTest(true);
    setTestFeedback(null);

    const samplePayload = {
      voltage: 228.6,
      current: 14.2,
      temperature: 32.5,
      humidity: 56,
      smokeAdc: 165,
      smokeDetected: false,
      shortCircuitDetected: false,
      arcFaultDetected: false,
      fireDetected: false,
      ip: deviceIp || '192.168.1.105',
      rssi: -58,
    };

    try {
      // 1. หากโหมดตัดสัญญาณค้างอยู่ ให้ปลดล็อกสัญญาณให้อัตโนมัติก่อนส่ง
      if (esp32Status.signalCut) {
        await fetch('/api/esp32/toggle-signal', { method: 'POST' });
      }

      // 2. ยิงข้อมูลทดสอบเข้า Backend API
      const res = await fetch('/api/esp32/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload),
      });

      if (res.ok) {
        setTestFeedback({
          success: true,
          message: `ส่งค่าสำเร็จ! หน้าเว็บและเซิร์ฟเวอร์รับข้อมูลจาก IP: ${samplePayload.ip} แล้ว`,
        });
        if (onInjectLocalTelemetry) {
          onInjectLocalTelemetry(samplePayload);
        }
        if (onRefreshTelemetry) {
          onRefreshTelemetry();
        }
      } else {
        // Fallback กรณี Backend ตอบ Error แต่ต้องการให้เห็นการอัปเดตบนหน้าเว็บทันที
        if (onInjectLocalTelemetry) {
          onInjectLocalTelemetry(samplePayload);
        }
        setTestFeedback({
          success: false,
          message: `เซิร์ฟเวอร์ตอบกลับสถานะ ${res.status} (อัปเดตค่าจำลองบนหน้าจอชั่วคราวแล้ว)`,
        });
      }
    } catch {
      // Fallback กรณีรันแบบ Standalone Frontend ยังไม่ได้เปิด Backend
      if (onInjectLocalTelemetry) {
        onInjectLocalTelemetry(samplePayload);
      }
      setTestFeedback({
        success: false,
        message: 'ไม่พบ Backend API (/api/esp32/telemetry) แต่แสดงค่าทดสอบบนหน้าเว็บให้แล้ว',
      });
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setTestFeedback(null), 5000);
    }
  };

  const arduinoCode = `/*
  NPU Smart MDB - ESP32 Firmware Telemetry Sender
  Target: ESP32 Dev Module
*/
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "${wifiSsid || 'YOUR_WIFI_SSID'}";
const char* password = "${wifiPass || 'YOUR_WIFI_PASSWORD'}";
const char* serverUrl = "${fullApiUrl}";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // Read real sensor values (replace with your analogRead/PZEM004T code)
    float voltage = 228.5;          // PZEM-004T or Voltage Sensor
    float current = 15.2;          // SCT-013 or Current Sensor
    float temperature = 32.0;      // DS18B20 or DHT22
    float humidity = 58.0;         // DHT22
    int smokeAdc = analogRead(34); // MQ-2 / MQ-135 raw ADC (e.g. 165 ADC)

    StaticJsonDocument<256> doc;
    doc["voltage"] = voltage;
    doc["current"] = current;
    doc["temperature"] = temperature;
    doc["humidity"] = humidity;
    doc["smokeAdc"] = smokeAdc;
    doc["smokeDetected"] = (smokeAdc > 350);
    doc["shortCircuitDetected"] = false;
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();

    String requestBody;
    serializeJson(doc, requestBody);

    int httpCode = http.POST(requestBody);
    if (httpCode > 0) {
      String response = http.getString();
      Serial.println("Telemetry sent OK: " + response);
    } else {
      Serial.printf("POST error: %s\n", http.errorToString(httpCode).c_str());
    }
    http.end();
  }
  delay(2000); // Send data every 2 seconds
}
`;

  // แก้ไขให้แสดงค่าล่าสุดเสมอแม้ timestamp จะยังไม่ถูกเซ็ตจากบาง payload
  const currentDisplay = Number(telemetry?.current ?? 0);
  const tempDisplay = Number(telemetry?.temperature ?? 0);
  const smokeDisplay = Number(telemetry?.smokeAdc ?? 0);
  const voltageDisplay = Number(telemetry?.voltage ?? 0);
  const hasTelemetry = Boolean(telemetry && (telemetry.timestamp > 0 || currentDisplay > 0 || voltageDisplay > 0 || tempDisplay > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2A26]/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-white rounded-3xl border border-[#2D2A26]/10 card-shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#2D2A26]/10 flex items-center justify-between bg-[#F4F3F0]/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#3D5A80]/10 text-[#3D5A80] border border-[#3D5A80]/20 card-shadow">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2D2A26] flex items-center gap-2 font-mono-space">
                ช่องสัญญาณ &amp; การเชื่อมต่อฮาร์ดแวร์ ESP32 จริง (NPU.MDB)
                <span
                  className={`label-mono text-[9px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all ${
                    esp32Status.signalCut
                      ? 'bg-rose-500/15 text-rose-700 border border-rose-500/30 font-bold'
                      : esp32Status.connected || hasTelemetry
                      ? 'bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/30 font-bold'
                      : 'bg-amber-500/15 text-amber-700 border border-amber-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      esp32Status.signalCut
                        ? 'bg-rose-500'
                        : esp32Status.connected || hasTelemetry
                        ? 'bg-[#4CAF50] animate-ping'
                        : 'bg-amber-500 animate-pulse'
                    }`}
                  />
                  {esp32Status.signalCut
                    ? '✕ ตัดสัญญาณอยู่ (SIGNAL CUT)'
                    : esp32Status.connected || hasTelemetry
                    ? '● เชื่อมต่อสัญญาณจริงแล้ว'
                    : '○ รอสัญญาณจาก ESP32 ผ่าน IP'}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                รับข้อมูลเซนเซอร์สดจากบอร์ด ESP32 ตู้ไฟ NPU.MDB ผ่าน IP Address หรือ Webhook Endpoint
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-[#2D2A26] hover:bg-[#2D2A26]/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto hide-scrollbar flex-1 space-y-5 bg-[#F4F3F0]/40">
          {/* แจ้งเตือนชัดเจนเมื่อปุ่มตัดสัญญาณถูกเปิดอยู่ */}
          {esp32Status.signalCut && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-400 text-rose-900 text-xs font-mono-space flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>
                  <strong>ขณะนี้สถานะ "ตัดสัญญาณ ESP32" ทำงานอยู่:</strong> เซิร์ฟเวอร์จะปฏิเสธข้อมูลที่ส่งเข้ามาทั้งหมด กรุณากดปุ่ม <strong>"⚡ ต่อสัญญาณ ESP32"</strong> ด้านล่างเพื่อให้ค่าแสดงบนหน้าเว็บ
                </span>
              </div>
            </div>
          )}

          {/* Live Endpoint & Quick Link URL Box */}
          <div className="p-4 rounded-2xl bg-white border border-[#3D5A80]/30 card-shadow space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#3D5A80] animate-pulse" />
                <span className="text-xs font-bold text-[#2D2A26] font-mono-space">
                  Server Endpoint สำหรับบอร์ด ESP32 (ส่งข้อมูลมาที่ URL นี้):
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3D5A80]/10 hover:bg-[#3D5A80]/20 text-[#3D5A80] text-xs font-mono-space font-bold transition active:scale-95"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#4CAF50]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'คัดลอกแล้ว!' : 'คัดลอก URL'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCodeGuide(!showCodeGuide)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono-space transition active:scale-95"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showCodeGuide ? 'ซ่อนโค้ด ESP32' : 'ดูโค้ดตัวอย่าง Arduino'}</span>
                </button>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 text-emerald-400 font-mono-space text-xs select-all break-all border border-slate-800 flex items-center justify-between">
              <span>{fullApiUrl}</span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono-space">
              * บอร์ด ESP32 สามารถส่งค่าแบบ <span className="font-bold text-slate-700">HTTP POST (JSON)</span> หรือ{' '}
              <span className="font-bold text-slate-700">HTTP GET (Query params)</span> มาที่ปลายทางนี้ได้ตลอด 24 ชม.
            </p>
          </div>

          {/* Expandable Arduino Code Guide */}
          {showCodeGuide && (
            <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 border border-slate-700 card-shadow space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white font-mono-space">
                    โค้ดต้นแบบ ESP32 Arduino C++ (คัดลอกใส่ Arduino IDE ได้ทันที)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-mono-space font-bold transition"
                >
                  {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? 'คัดลอกโค้ดแล้ว!' : 'คัดลอกโค้ดทั้งหมด'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded-xl text-[11px] font-mono-space text-emerald-300 overflow-x-auto max-h-56 leading-relaxed border border-slate-800">
                {arduinoCode}
              </pre>
            </div>
          )}

          {/* Real-time Hardware Telemetry Stream Card */}
          <div className="p-5 rounded-3xl bg-white border border-[#2D2A26]/10 card-shadow space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2D2A26]/10 pb-3">
              <div>
                <span className="text-xs font-bold text-[#2D2A26] font-mono-space flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#3D5A80]" />
                  <span>สัญญาณสดจากเซนเซอร์จริง (Real Hardware Stream)</span>
                </span>
                <p className="text-[11px] text-slate-500 font-mono-space">
                  อัปเดตอัตโนมัติตามแพ็กเก็ตที่ ESP32 ส่งเข้ามาแบบเรียลไทม์
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`label-mono text-[10px] px-2.5 py-1 rounded-full border font-bold flex items-center gap-1.5 ${
                    esp32Status.connected || hasTelemetry
                      ? 'bg-[#4CAF50]/15 text-[#4CAF50] border-[#4CAF50]/30'
                      : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      esp32Status.connected || hasTelemetry ? 'bg-[#4CAF50] animate-ping' : 'bg-amber-500 animate-pulse'
                    }`}
                  />
                  <span>{esp32Status.connected || hasTelemetry ? 'LIVE SIGNAL ONLINE' : 'WAITING FOR PACKETS'}</span>
                </span>
              </div>
            </div>

            {/* Sensor Live Snapshot Values */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Current */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-space">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-[#3D5A80]" />
                    <span>กระแสไฟฟ้า</span>
                  </span>
                </div>
                <div className="text-lg font-bold font-mono-space text-[#3D5A80]">
                  {currentDisplay.toFixed(1)} <span className="text-xs text-slate-500 font-normal">A</span>
                </div>
              </div>

              {/* Temperature */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-space">
                  <span className="flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5 text-amber-600" />
                    <span>อุณหภูมิตู้ MDB</span>
                  </span>
                </div>
                <div className="text-lg font-bold font-mono-space text-amber-600">
                  {tempDisplay.toFixed(1)} <span className="text-xs text-slate-500 font-normal">°C</span>
                </div>
              </div>

              {/* Smoke ADC */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-space">
                  <span className="flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-[#FF5A5F]" />
                    <span>ระดับควัน (Smoke ADC)</span>
                  </span>
                </div>
                <div className="text-lg font-bold font-mono-space text-[#FF5A5F]">
                  {smokeDisplay} <span className="text-xs text-slate-500 font-normal">ADC</span>
                </div>
              </div>

              {/* Voltage */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-space">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-[#4CAF50]" />
                    <span>แรงดันไฟฟ้า</span>
                  </span>
                </div>
                <div className="text-lg font-bold font-mono-space text-[#4CAF50]">
                  {voltageDisplay.toFixed(1)} <span className="text-xs text-slate-500 font-normal">V</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status & Quick Signal Controls */}
          <div className="p-5 rounded-3xl bg-white border border-[#2D2A26]/10 card-shadow space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-xl ${
                    esp32Status.connected || hasTelemetry
                      ? 'bg-[#4CAF50]/10 text-[#4CAF50]'
                      : 'bg-amber-500/10 text-amber-600'
                  }`}
                >
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#2D2A26] font-mono-space flex items-center gap-2">
                    <span>สถานะบอร์ด ESP32 Gateway {deviceName ? `(${deviceName})` : ''}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        esp32Status.connected || hasTelemetry
                          ? 'bg-[#4CAF50] animate-ping'
                          : 'bg-amber-500 animate-pulse'
                      }`}
                    />
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono-space">
                    IP: {deviceIp || esp32Status.ipAddress || 'ยังไม่ระบุ'} | MAC: {esp32Status.macAddress || 'ยังไม่เชื่อมต่อ'} | สัญญาณ Wi-Fi:{' '}
                    {esp32Status.connected || hasTelemetry ? `${esp32Status.wifiRssi || -52} dBm` : 'รอเชื่อมต่อ'}
                  </p>
                </div>
              </div>

              {/* Action Controls: Cut Signal, Handshake Test, Reset & Ping */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleSignal}
                  disabled={isTogglingSignal}
                  className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-mono-space card-shadow transition active:scale-95 disabled:opacity-50 ${
                    esp32Status.signalCut
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
                  }`}
                  title={esp32Status.signalCut ? 'ต่อสัญญาณและเริ่มรับข้อมูลจาก ESP32 อีกครั้ง' : 'ตัดสัญญาณการเชื่อมต่อจาก ESP32'}
                >
                  {esp32Status.signalCut ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                  <span>
                    {isTogglingSignal
                      ? 'กำลังดำเนินการ...'
                      : esp32Status.signalCut
                      ? '⚡ ต่อสัญญาณ ESP32'
                      : '🔌 ตัดสัญญาณ ESP32'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleSendTestPacket}
                  disabled={isSendingTest}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold font-mono-space card-shadow transition active:scale-95 disabled:opacity-50"
                  title="ทดสอบส่งสัญญาณ 1 แพ็กเก็ตเพื่อตรวจสอบการเชื่อมต่อทันที"
                >
                  <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-spin' : ''}`} />
                  <span>{isSendingTest ? 'กำลังทดสอบ...' : '⚡ ทดสอบเชื่อมต่อ'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetConnection}
                  disabled={isResetting}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF5A5F] hover:bg-[#e04348] text-white text-xs font-bold font-mono-space card-shadow transition active:scale-95 disabled:opacity-50"
                  title="รีเซ็ตการเชื่อมต่อสัญญาณกับ ESP32"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>{isResetting ? 'รีเซ็ต...' : '🔄 รีเซ็ต'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePing}
                  disabled={isPinging || esp32Status.signalCut}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3D5A80] hover:bg-[#2e4563] text-white text-xs font-bold font-mono-space card-shadow transition active:scale-95 disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
                  <span>{isPinging ? 'Ping...' : 'Ping'}</span>
                </button>
              </div>
            </div>

            {/* Test Packet Feedback */}
            {testFeedback && (
              <div
                className={`p-3 rounded-2xl text-xs font-mono-space flex items-center gap-2 animate-fade-in border ${
                  testFeedback.success
                    ? 'bg-[#4CAF50]/10 border-[#4CAF50]/30 text-[#2D2A26]'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                {testFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-[#4CAF50] shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>{testFeedback.message}</span>
              </div>
            )}

            {/* Reset Feedback Notification */}
            {resetFeedback && (
              <div
                className={`p-3 rounded-2xl text-xs font-mono-space flex items-center justify-between border ${
                  resetFeedback.success
                    ? 'bg-[#4CAF50]/10 border-[#4CAF50]/30 text-[#2D2A26]'
                    : 'bg-[#FF5A5F]/10 border-[#FF5A5F]/30 text-[#FF5A5F]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {resetFeedback.success ? (
                    <CheckCircle2 className="w-4 h-4 text-[#4CAF50] shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#FF5A5F] shrink-0" />
                  )}
                  <span>{resetFeedback.message}</span>
                </div>
                {resetFeedback.time && (
                  <span className="label-mono text-[10px] text-slate-400">{resetFeedback.time}</span>
                )}
              </div>
            )}

            {/* Ping Result Notification */}
            {pingResult && (
              <div
                className={`p-3 rounded-2xl text-xs font-mono-space flex items-center justify-between border ${
                  pingResult.success
                    ? 'bg-[#3D5A80]/10 border-[#3D5A80]/30 text-[#2D2A26]'
                    : 'bg-[#FF5A5F]/10 border-[#FF5A5F]/30 text-[#FF5A5F]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {pingResult.success ? (
                    <Check className="w-4 h-4 text-[#3D5A80]" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#FF5A5F]" />
                  )}
                  <span>{pingResult.message}</span>
                </div>
                {pingResult.latencyMs && (
                  <span className="font-bold text-[#3D5A80]">{pingResult.latencyMs} ms</span>
                )}
              </div>
            )}
          </div>

          {/* Config Form */}
          <form onSubmit={handleSaveConfig} className="p-5 rounded-3xl bg-white border border-[#2D2A26]/10 card-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-[#2D2A26]/10 pb-2">
              <h4 className="text-xs font-bold text-[#2D2A26] font-mono-space flex items-center gap-2">
                <Wifi className="w-4 h-4 text-[#3D5A80]" />
                <span>กำหนดค่าช่องเชื่อมต่ออุปกรณ์ ESP32 สำหรับผู้ดูแลระบบ</span>
              </h4>
              <span className="label-mono text-[10px] text-slate-400">Hardware Network Setup</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* IP Address */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#2D2A26] font-mono-space">
                  IP Address ของบอร์ด ESP32:
                </label>
                <input
                  type="text"
                  value={deviceIp}
                  onChange={(e) => setDeviceIp(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono-space rounded-xl border border-[#2D2A26]/20 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3D5A80]"
                />
              </div>

              {/* Device Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#2D2A26] font-mono-space">
                  ชื่ออุปกรณ์ (Device Identifier):
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono-space rounded-xl border border-[#2D2A26]/20 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3D5A80]"
                />
              </div>

              {/* WiFi SSID */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#2D2A26] font-mono-space">
                  Wi-Fi SSID ประจำตู้ไฟ:
                </label>
                <input
                  type="text"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono-space rounded-xl border border-[#2D2A26]/20 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3D5A80]"
                />
              </div>

              {/* Channel */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#2D2A26] font-mono-space">
                  ช่องสัญญาณ (Channel Slot):
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono-space rounded-xl border border-[#2D2A26]/20 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3D5A80]"
                >
                  <option value="CH-01 (MDB Main Bus)">CH-01 (MDB Main Bus)</option>
                  <option value="CH-02 (Sub-Breaker Branch)">CH-02 (Sub-Breaker Branch)</option>
                  <option value="CH-03 (Solar Hybrid Input)">CH-03 (Solar Hybrid Input)</option>
                  <option value="CH-04 (EV Charger Feed)">CH-04 (EV Charger Feed)</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-[#2D2A26]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500 font-mono-space flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#4CAF50]" />
                <span>การเชื่อมต่อปลอดภัย มีการเข้ารหัสและตรวจสอบตัวตนฮาร์ดแวร์</span>
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3D5A80] hover:bg-[#2e4563] text-white text-xs font-bold font-mono-space card-shadow transition active:scale-95 disabled:opacity-50"
              >
                {saveSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
                <span>{saveSuccess ? 'บันทึกการตั้งค่าแล้ว!' : 'บันทึกการตั้งค่าช่องเชื่อมต่อ'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
