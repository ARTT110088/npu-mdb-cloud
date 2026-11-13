import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Zap,
  Thermometer,
  Droplets,
  Activity,
  Wind,
  ShieldAlert,
  Save,
  Volume2,
  VolumeX,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Info,
  Power,
} from 'lucide-react';
import { SafetySettings, TelemetryData, MDBBreakerState } from '../types';
import { startEmergencySiren, stopEmergencySiren } from '../utils/audioAlarm';

interface SafetySettingsTabProps {
  settings: SafetySettings;
  telemetry: TelemetryData;
  breakerState: MDBBreakerState;
  onSave: (newSettings: SafetySettings) => Promise<void>;
  onRequestBreakerCommand: (command: 'TRIP' | 'RESET') => void;
}

export const SafetySettingsTab: React.FC<SafetySettingsTabProps> = ({
  settings,
  telemetry,
  breakerState,
  onSave,
  onRequestBreakerCommand,
}) => {
  const [formData, setFormData] = useState<SafetySettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isTestingSound, setIsTestingSound] = useState(false);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const handleSoundTest = () => {
    if (isTestingSound) {
      stopEmergencySiren();
      setIsTestingSound(false);
    } else {
      startEmergencySiren();
      setIsTestingSound(true);
      setTimeout(() => {
        stopEmergencySiren();
        setIsTestingSound(false);
      }, 3000);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccessMsg('');
    try {
      await onSave(formData);
      setSaveSuccessMsg('บันทึกค่าลง settings.json ถาวรเรียบร้อยแล้ว');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch {
      // handled
    } finally {
      setIsSaving(false);
    }
  };

  const currentAmps = telemetry.current;
  const currentTemp = telemetry.temperature;
  const currentHum = telemetry.humidity;
  const currentVolt = telemetry.voltage;
  const currentSmoke = telemetry.smokeAdc ?? 0;

  const isCurrentOver = telemetry.timestamp > 0 && currentAmps >= formData.maxCurrentLimit;
  const isTempOver = telemetry.timestamp > 0 && currentTemp >= formData.maxTempLimit;
  const isHumOver = telemetry.timestamp > 0 && currentHum >= formData.maxHumidityLimit;
  const isVoltOver =
    telemetry.timestamp > 0 &&
    currentVolt > 0 &&
    (currentVolt < formData.minVoltageLimit || currentVolt > formData.maxVoltageLimit);
  const isSmokeOver =
    telemetry.timestamp > 0 &&
    (currentSmoke >= formData.maxSmokeAdcLimit || telemetry.smokeDetected);

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-[#2D2A26]/10 card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-[#3D5A80]/10 text-[#3D5A80] shrink-0 border border-[#3D5A80]/20">
            <Sliders className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-[#2D2A26] font-mono-space">
                ตั้งค่าความปลอดภัย (Settings)
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono-space font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <FileCode className="w-3 h-3" />
                settings.json
              </span>
            </div>
            <p className="text-xs text-slate-500">
              กำหนดเกณฑ์ความปลอดภัยตู้ MDB และสวิตช์ Auto Trip แยกตามเงื่อนไข
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSoundTest}
          className={`min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono-space font-bold border transition touch-target self-start sm:self-auto ${
            isTestingSound
              ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          {isTestingSound ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          <span>{isTestingSound ? 'หยุดเสียงไซเรน' : '🔊 ทดสอบเสียงเตือน'}</span>
        </button>
      </div>

      {/* Breaker Command Status & Safety Action Box */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-[#2D2A26]/10 card-shadow space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Power className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF5A5F]" />
            <h3 className="text-xs sm:text-sm font-bold text-[#2D2A26] font-mono-space">
              สถานะเบรกเกอร์เมน (Breaker Status)
            </h3>
          </div>
          <span
            className={`px-3 py-1 rounded-xl text-xs font-mono-space font-bold uppercase tracking-wider ${
              breakerState.mainBreaker.state === 'TRIPPED'
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-emerald-600 text-white'
            }`}
          >
            {breakerState.mainBreaker.state === 'TRIPPED'
              ? '⚡ TRIPPED (ตัดไฟแล้ว)'
              : '● NORMAL (จ่ายไฟปกติ)'}
          </span>
        </div>

        {/* Action Buttons with confirmation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onRequestBreakerCommand('TRIP')}
            className="min-h-[48px] p-3 rounded-2xl border-2 border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-mono-space font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-98 touch-target-lg"
          >
            <Zap className="w-4 h-4" />
            <span>[ TRIP BREAKER ] สั่งตัดไฟฉุกเฉิน</span>
          </button>

          <button
            type="button"
            onClick={() => onRequestBreakerCommand('RESET')}
            className="min-h-[48px] p-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-mono-space font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-98 touch-target-lg"
          >
            <RefreshCw className="w-4 h-4" />
            <span>[ RESET BREAKER ] ขอเปิดไฟกลับ</span>
          </button>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-4">
        {/* 1. CURRENT LIMIT */}
        <div
          className={`p-4 sm:p-5 rounded-3xl bg-white border transition-all card-shadow space-y-3 ${
            isCurrentOver ? 'border-rose-400 ring-2 ring-rose-200' : 'border-[#2D2A26]/10'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#3D5A80]" />
              <label htmlFor="input-current-limit" className="font-bold text-[#2D2A26] font-mono-space text-sm sm:text-base">
                Current Limit (กระแสสูงสุด)
              </label>
            </div>
            <p className="text-xs text-slate-500">กำหนดพิกัดกระแสสูงสุดที่ยอมรับได้</p>
          </div>

          {/* Mobile Display: ชื่อค่า / [ input ] หน่วย */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-300 rounded-2xl px-3 py-2">
              <input
                id="input-current-limit"
                type="number"
                step="0.1"
                min="0.5"
                max="100.0"
                value={formData.maxCurrentLimit}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    setFormData({ ...formData, maxCurrentLimit: +val.toFixed(1) });
                  }
                }}
                className="w-full font-mono-space text-base sm:text-lg font-bold text-[#3D5A80] bg-transparent focus:outline-none"
              />
              <span className="text-xs sm:text-sm font-mono-space font-bold text-slate-500 ml-2">A</span>
            </div>

            {/* Quick Adjust Buttons */}
            <div className="flex items-center gap-1">
              {[-1, 1].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      maxCurrentLimit: Math.max(0.5, +(prev.maxCurrentLimit + step).toFixed(1)),
                    }))
                  }
                  className="min-h-[44px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-mono-space font-bold text-slate-700 touch-target"
                >
                  {step > 0 ? `+${step}A` : `${step}A`}
                </button>
              ))}
            </div>
          </div>

          {/* Switch Auto Trip & Alerts underneath (Stacked cleanly) */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="min-h-[44px] flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition touch-target">
              <span className="text-xs font-mono-space font-semibold text-slate-700">
                แจ้งเตือน: ON/OFF
              </span>
              <input
                type="checkbox"
                checked={formData.alertCurrent ?? true}
                onChange={(e) => setFormData({ ...formData, alertCurrent: e.target.checked })}
                className="w-5 h-5 accent-[#3D5A80] rounded"
              />
            </label>

            <label
              className={`min-h-[44px] flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition touch-target ${
                formData.autoTripCurrent
                  ? 'bg-rose-50/70 border-rose-300 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-mono-space font-bold">
                  Current Auto Trip (ตัดไฟอัตโนมัติ)
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.autoTripCurrent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    autoTripCurrent: e.target.checked,
                    autoTripOnOvercurrent: e.target.checked,
                  })
                }
                className="w-5 h-5 accent-rose-600 rounded"
              />
            </label>
          </div>

          {/* Current Live Value */}
          {telemetry.timestamp > 0 && (
            <div className="text-xs font-mono-space flex items-center justify-between pt-0.5 text-slate-500">
              <span>ESP32 วัดได้: <strong>{currentAmps.toFixed(2)} A</strong></span>
              {isCurrentOver ? (
                <span className="text-rose-600 font-bold flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" /> เกินเกณฑ์!
                </span>
              ) : (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ปลอดภัย
                </span>
              )}
            </div>
          )}
        </div>

        {/* 2. TEMPERATURE LIMIT */}
        <div
          className={`p-4 sm:p-5 rounded-3xl bg-white border transition-all card-shadow space-y-3 ${
            isTempOver ? 'border-rose-400 ring-2 ring-rose-200' : 'border-[#2D2A26]/10'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-[#FF5A5F]" />
              <label htmlFor="input-temp-limit" className="font-bold text-[#2D2A26] font-mono-space text-sm sm:text-base">
                Temperature Limit (อุณหภูมิสูงสุด)
              </label>
            </div>
            <p className="text-xs text-slate-500">กำหนดอุณหภูมิความร้อนสูงสุดที่ยอมรับได้</p>
          </div>

          {/* Display: ชื่อค่า / [ input ] หน่วย */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-300 rounded-2xl px-3 py-2">
              <input
                id="input-temp-limit"
                type="number"
                step="0.1"
                min="20.0"
                max="95.0"
                value={formData.maxTempLimit}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    setFormData({ ...formData, maxTempLimit: +val.toFixed(1) });
                  }
                }}
                className="w-full font-mono-space text-base sm:text-lg font-bold text-[#FF5A5F] bg-transparent focus:outline-none"
              />
              <span className="text-xs sm:text-sm font-mono-space font-bold text-slate-500 ml-2">°C</span>
            </div>

            <div className="flex items-center gap-1">
              {[-5, 5].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      maxTempLimit: Math.max(20, +(prev.maxTempLimit + step).toFixed(1)),
                    }))
                  }
                  className="min-h-[44px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-mono-space font-bold text-slate-700 touch-target"
                >
                  {step > 0 ? `+${step}°` : `${step}°`}
                </button>
              ))}
            </div>
          </div>

          {/* Switches */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="min-h-[44px] flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition touch-target">
              <span className="text-xs font-mono-space font-semibold text-slate-700">
                แจ้งเตือน: ON/OFF
              </span>
              <input
                type="checkbox"
                checked={formData.alertTemperature ?? true}
                onChange={(e) => setFormData({ ...formData, alertTemperature: e.target.checked })}
                className="w-5 h-5 accent-[#FF5A5F] rounded"
              />
            </label>

            <label
              className={`min-h-[44px] flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition touch-target ${
                formData.autoTripTemperature
                  ? 'bg-rose-50/70 border-rose-300 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-mono-space font-bold">
                  Temperature Auto Trip (ตัดไฟอัตโนมัติ)
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.autoTripTemperature}
                onChange={(e) => setFormData({ ...formData, autoTripTemperature: e.target.checked })}
                className="w-5 h-5 accent-rose-600 rounded"
              />
            </label>
          </div>

          {telemetry.timestamp > 0 && (
            <div className="text-xs font-mono-space flex items-center justify-between pt-0.5 text-slate-500">
              <span>ESP32 วัดได้: <strong>{currentTemp.toFixed(1)} °C</strong></span>
              {isTempOver ? (
                <span className="text-rose-600 font-bold flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" /> ความร้อนเกิน!
                </span>
              ) : (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ปกติ
                </span>
              )}
            </div>
          )}
        </div>

        {/* 3. HUMIDITY LIMIT */}
        <div
          className={`p-4 sm:p-5 rounded-3xl bg-white border transition-all card-shadow space-y-3 ${
            isHumOver ? 'border-rose-400 ring-2 ring-rose-200' : 'border-[#2D2A26]/10'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-600" />
              <label htmlFor="input-humidity-limit" className="font-bold text-[#2D2A26] font-mono-space text-sm sm:text-base">
                Humidity Limit (ความชื้นสูงสุด)
              </label>
            </div>
            <p className="text-xs text-slate-500">กำหนดขีดจำกัดความชื้นสัมพัทธ์ในตู้</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-300 rounded-2xl px-3 py-2">
              <input
                id="input-humidity-limit"
                type="number"
                step="1"
                min="30"
                max="99"
                value={formData.maxHumidityLimit}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setFormData({ ...formData, maxHumidityLimit: val });
                }}
                className="w-full font-mono-space text-base sm:text-lg font-bold text-cyan-600 bg-transparent focus:outline-none"
              />
              <span className="text-xs sm:text-sm font-mono-space font-bold text-slate-500 ml-2">%</span>
            </div>

            <div className="flex items-center gap-1">
              {[-5, 5].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      maxHumidityLimit: Math.max(30, Math.min(99, prev.maxHumidityLimit + step)),
                    }))
                  }
                  className="min-h-[44px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-mono-space font-bold text-slate-700 touch-target"
                >
                  {step > 0 ? `+${step}%` : `${step}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="min-h-[44px] flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition touch-target">
              <span className="text-xs font-mono-space font-semibold text-slate-700">
                แจ้งเตือน: ON/OFF
              </span>
              <input
                type="checkbox"
                checked={formData.alertHumidity ?? true}
                onChange={(e) => setFormData({ ...formData, alertHumidity: e.target.checked })}
                className="w-5 h-5 accent-cyan-600 rounded"
              />
            </label>

            <label
              className={`min-h-[44px] flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition touch-target ${
                formData.autoTripHumidity
                  ? 'bg-rose-50/70 border-rose-300 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-mono-space font-bold">
                  Humidity Auto Trip (ตัดไฟอัตโนมัติ)
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.autoTripHumidity}
                onChange={(e) => setFormData({ ...formData, autoTripHumidity: e.target.checked })}
                className="w-5 h-5 accent-rose-600 rounded"
              />
            </label>
          </div>

          {telemetry.timestamp > 0 && (
            <div className="text-xs font-mono-space flex items-center justify-between pt-0.5 text-slate-500">
              <span>ESP32 วัดได้: <strong>{currentHum.toFixed(0)} %</strong></span>
              {isHumOver ? (
                <span className="text-amber-600 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> ความชื้นสูง
                </span>
              ) : (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ปกติ
                </span>
              )}
            </div>
          )}
        </div>

        {/* 4. VOLTAGE LIMITS (Minimum & Maximum Voltage) */}
        <div
          className={`p-4 sm:p-5 rounded-3xl bg-white border transition-all card-shadow space-y-3 ${
            isVoltOver ? 'border-rose-400 ring-2 ring-rose-200' : 'border-[#2D2A26]/10'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <h4 className="font-bold text-[#2D2A26] font-mono-space text-sm sm:text-base">
                Voltage Limits (แรงดันไฟฟ้า Min / Max)
              </h4>
            </div>
            <p className="text-xs text-slate-500">
              กำหนดช่วงแรงดันปกติที่ยอมให้ทำงาน (เช่น 200V - 250V)
            </p>
          </div>

          {/* Minimum Voltage & Maximum Voltage Stacked Cleanly on Mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Minimum Voltage */}
            <div className="space-y-1">
              <label htmlFor="input-min-voltage" className="text-xs font-mono-space font-bold text-slate-600">
                Minimum Voltage
              </label>
              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-2xl px-3 py-2">
                <input
                  id="input-min-voltage"
                  type="number"
                  step="1"
                  min="160"
                  max="230"
                  value={formData.minVoltageLimit}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setFormData({ ...formData, minVoltageLimit: val });
                  }}
                  className="w-full font-mono-space text-base sm:text-lg font-bold text-emerald-700 bg-transparent focus:outline-none"
                />
                <span className="text-xs sm:text-sm font-mono-space font-bold text-slate-500 ml-2">V</span>
              </div>
            </div>

            {/* Maximum Voltage */}
            <div className="space-y-1">
              <label htmlFor="input-max-voltage" className="text-xs font-mono-space font-bold text-slate-600">
                Maximum Voltage
              </label>
              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-2xl px-3 py-2">
                <input
                  id="input-max-voltage"
                  type="number"
                  step="1"
                  min="220"
                  max="280"
                  value={formData.maxVoltageLimit}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setFormData({ ...formData, maxVoltageLimit: val });
                  }}
                  className="w-full font-mono-space text-base sm:text-lg font-bold text-emerald-700 bg-transparent focus:outline-none"
                />
                <span className="text-xs sm:text-sm font-mono-space font-bold text-slate-500 ml-2">V</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="min-h-[44px] flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition touch-target">
              <span className="text-xs font-mono-space font-semibold text-slate-700">
                แจ้งเตือน: ON/OFF
              </span>
              <input
                type="checkbox"
                checked={formData.alertVoltage ?? true}
                onChange={(e) => setFormData({ ...formData, alertVoltage: e.target.checked })}
                className="w-5 h-5 accent-emerald-600 rounded"
              />
            </label>

            <label
              className={`min-h-[44px] flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition touch-target ${
                formData.autoTripVoltage
                  ? 'bg-rose-50/70 border-rose-300 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-mono-space font-bold">
                  Voltage Auto Trip (ตัดไฟอัตโนมัติ)
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.autoTripVoltage}
                onChange={(e) => setFormData({ ...formData, autoTripVoltage: e.target.checked })}
                className="w-5 h-5 accent-rose-600 rounded"
              />
            </label>
          </div>

          {telemetry.timestamp > 0 && (
            <div className="text-xs font-mono-space flex items-center justify-between pt-0.5 text-slate-500">
              <span>ESP32 วัดได้: <strong>{currentVolt.toFixed(0)} V</strong></span>
              {isVoltOver ? (
                <span className="text-rose-600 font-bold flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" /> อยู่นอกเกณฑ์!
                </span>
              ) : (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> เสถียร
                </span>
              )}
            </div>
          )}
        </div>

        {/* 5. SMOKE THRESHOLD (RAW ADC) */}
        <div
          className={`p-4 sm:p-5 rounded-3xl bg-white border transition-all card-shadow space-y-3 ${
            isSmokeOver ? 'border-rose-400 ring-2 ring-rose-200' : 'border-[#2D2A26]/10'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-slate-700" />
              <label htmlFor="input-smoke-limit" className="font-bold text-[#2D2A26] font-mono-space text-sm sm:text-base">
                Smoke Threshold (เกณฑ์ตรวจพบควัน ADC)
              </label>
            </div>
            <p className="text-xs text-slate-500">
              ค่า ADC ดิบจาก ESP32 analogRead() (0 - 4095 ADC)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-300 rounded-2xl px-3 py-2">
              <input
                id="input-smoke-limit"
                type="number"
                step="1"
                min="20"
                max="4095"
                value={formData.maxSmokeAdcLimit}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    setFormData({
                      ...formData,
                      maxSmokeAdcLimit: val,
                      maxSmokePpmLimit: val,
                    });
                  }
                }}
                className="w-full font-mono-space text-base sm:text-lg font-bold text-slate-800 bg-transparent focus:outline-none"
              />
              <span className="text-xs sm:text-sm font-mono-space font-bold text-slate-500 ml-2">ADC</span>
            </div>

            <div className="flex items-center gap-1">
              {[-10, 10].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      maxSmokeAdcLimit: Math.max(10, prev.maxSmokeAdcLimit + step),
                      maxSmokePpmLimit: Math.max(10, prev.maxSmokeAdcLimit + step),
                    }))
                  }
                  className="min-h-[44px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-mono-space font-bold text-slate-700 touch-target"
                >
                  {step > 0 ? `+${step}` : `${step}`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="min-h-[44px] flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition touch-target">
              <span className="text-xs font-mono-space font-semibold text-slate-700">
                แจ้งเตือน: ON/OFF
              </span>
              <input
                type="checkbox"
                checked={formData.alertSmoke ?? true}
                onChange={(e) => setFormData({ ...formData, alertSmoke: e.target.checked })}
                className="w-5 h-5 accent-slate-800 rounded"
              />
            </label>

            <label
              className={`min-h-[44px] flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition touch-target ${
                formData.autoTripSmoke
                  ? 'bg-rose-50/70 border-rose-300 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-mono-space font-bold">
                  Smoke Auto Trip (ตัดไฟอัตโนมัติ)
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.autoTripSmoke}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    autoTripSmoke: e.target.checked,
                    autoTripOnFire: e.target.checked,
                  })
                }
                className="w-5 h-5 accent-rose-600 rounded"
              />
            </label>
          </div>

          {telemetry.timestamp > 0 && (
            <div className="text-xs font-mono-space flex items-center justify-between pt-0.5 text-slate-500">
              <span>ESP32 วัดได้: <strong>{currentSmoke} ADC</strong></span>
              {isSmokeOver ? (
                <span className="text-rose-600 font-bold flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" /> พบควันเกินเกณฑ์!
                </span>
              ) : (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ปลอดภัย
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bottom Save Action Bar */}
        <div className="sticky bottom-16 md:bottom-6 z-30 p-4 sm:p-5 rounded-3xl bg-white border border-[#2D2A26]/15 card-shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono-space text-slate-600 w-full sm:w-auto">
            <Info className="w-4 h-4 text-[#3D5A80] shrink-0" />
            <span className="truncate">
              {saveSuccessMsg ? (
                <strong className="text-emerald-600 font-bold">{saveSuccessMsg}</strong>
              ) : (
                'บันทึกลง settings.json ถาวร'
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFormData({ ...settings })}
              className="min-h-[48px] flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-[#2D2A26] font-mono-space font-bold text-xs transition touch-target-lg"
            >
              คืนค่าเดิม
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[48px] flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[#3D5A80] hover:bg-[#2c4260] text-white font-mono-space font-bold text-xs sm:text-sm card-shadow transition active:scale-98 disabled:opacity-50 shadow-md touch-target-lg"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
