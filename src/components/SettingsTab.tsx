import React, { useState } from 'react';
import { Sliders, Zap, Thermometer, Droplets, Save, CheckCircle2 } from 'lucide-react';
import { Settings, TelemetryData } from '../types';

interface SettingsTabProps {
  settings: Settings;
  telemetry: TelemetryData;
  onSave: (newSettings: Settings) => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  telemetry,
  onSave,
}) => {
  // Empty inputs by default - no automatic pre-filling
  const [currentLimit, setCurrentLimit] = useState<string>('');
  const [temperatureLimit, setTemperatureLimit] = useState<string>('');
  const [humidityLimit, setHumidityLimit] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const newCurrent = currentLimit.trim() !== '' ? parseFloat(currentLimit) : settings.currentLimit;
      const newTemp = temperatureLimit.trim() !== '' ? parseFloat(temperatureLimit) : settings.temperatureLimit;
      const newHum = humidityLimit.trim() !== '' ? parseFloat(humidityLimit) : settings.humidityLimit;

      if (isNaN(newCurrent) || isNaN(newTemp) || isNaN(newHum)) {
        return;
      }

      await onSave({
        currentLimit: Number(newCurrent),
        temperatureLimit: Number(newTemp),
        humidityLimit: Number(newHum),
      });
      // Clear inputs after successful save - do not auto-fill
      setCurrentLimit('');
      setTemperatureLimit('');
      setHumidityLimit('');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full space-y-4">
      <div className="p-6 rounded-3xl bg-white border border-[#2D2A26]/10 card-shadow-lg space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#3D5A80]" />
            <h2 className="font-mono-space text-lg font-bold text-[#2D2A26]">
              ตั้งค่าเกณฑ์ความปลอดภัย (SETTINGS)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            กำหนดขีดจำกัดสูงสุด 3 ค่าหลัก ระบบจะสั่งตัดไฟอัตโนมัติ (Auto-Trip) ทันทีเมื่อค่าเกินกำหนด
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Current Limit */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#2D2A26] font-mono-space flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#3D5A80]" />
                <span>Current Limit (ขีดจำกัดกระแสไฟฟ้า):</span>
              </label>
              <span className="text-[11px] font-mono-space text-slate-500">
                ปัจจุบัน: <strong className="text-[#3D5A80]">{settings.currentLimit.toFixed(1)} A</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="100.0"
                value={currentLimit}
                onChange={(e) => setCurrentLimit(e.target.value)}
                placeholder={`ระบุค่าใหม่ (ค่าปัจจุบัน: ${settings.currentLimit.toFixed(1)})`}
                autoComplete="off"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white font-mono-space text-base font-bold text-[#2D2A26] focus:ring-2 focus:ring-[#3D5A80] focus:outline-none min-h-[48px] placeholder:font-normal placeholder:text-slate-400 placeholder:text-sm"
              />
              <span className="font-mono-space text-sm font-bold text-slate-500 px-2">A</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono-space">
              * สเต็ปปรับได้ทีละ 0.1 A เช่น 5.0 A (พิกัดตัดไฟเมื่อโหลดเกิน)
            </p>
          </div>

          {/* 2. Temperature Limit */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#2D2A26] font-mono-space flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-[#FF5A5F]" />
                <span>Temperature Limit (ขีดจำกัดอุณหภูมิ):</span>
              </label>
              <span className="text-[11px] font-mono-space text-slate-500">
                ปัจจุบัน: <strong className="text-[#3D5A80]">{settings.temperatureLimit.toFixed(1)} °C</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="20.0"
                max="100.0"
                value={temperatureLimit}
                onChange={(e) => setTemperatureLimit(e.target.value)}
                placeholder={`ระบุค่าใหม่ (ค่าปัจจุบัน: ${settings.temperatureLimit.toFixed(1)})`}
                autoComplete="off"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white font-mono-space text-base font-bold text-[#2D2A26] focus:ring-2 focus:ring-[#3D5A80] focus:outline-none min-h-[48px] placeholder:font-normal placeholder:text-slate-400 placeholder:text-sm"
              />
              <span className="font-mono-space text-sm font-bold text-slate-500 px-2">°C</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono-space">
              * สเต็ปปรับได้ทีละ 0.1 °C เช่น 50.0 °C (ป้องกันความร้อนสะสม)
            </p>
          </div>

          {/* 3. Humidity Limit */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#2D2A26] font-mono-space flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-cyan-600" />
                <span>Humidity Limit (ขีดจำกัดความชื้น):</span>
              </label>
              <span className="text-[11px] font-mono-space text-slate-500">
                ปัจจุบัน: <strong className="text-[#3D5A80]">{settings.humidityLimit.toFixed(0)} %</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="10"
                max="100"
                value={humidityLimit}
                onChange={(e) => setHumidityLimit(e.target.value)}
                placeholder={`ระบุค่าใหม่ (ค่าปัจจุบัน: ${settings.humidityLimit.toFixed(0)})`}
                autoComplete="off"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white font-mono-space text-base font-bold text-[#2D2A26] focus:ring-2 focus:ring-[#3D5A80] focus:outline-none min-h-[48px] placeholder:font-normal placeholder:text-slate-400 placeholder:text-sm"
              />
              <span className="font-mono-space text-sm font-bold text-slate-500 px-2">%</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono-space">
              * สเต็ปปรับได้ทีละ 1 % เช่น 80 % (ป้องกันไฟฟ้าลัดวงจรจากความชื้น)
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#3D5A80] hover:bg-[#2e4563] text-white font-mono-space text-sm font-bold tracking-wide card-shadow transition active:scale-98 min-h-[48px] flex items-center justify-center gap-2 shadow-md shadow-[#3D5A80]/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
            </button>
          </div>

          {savedSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono-space flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>บันทึกการตั้งค่าเรียบร้อยแล้ว และเขียนลงไฟล์ settings.json ถาวร</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
