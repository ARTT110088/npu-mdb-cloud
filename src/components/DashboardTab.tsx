import React from 'react';
import {
  Activity,
  Zap,
  Thermometer,
  Droplets,
  Wind,
  Power,
  PowerOff,
  AlertTriangle,
  Cpu,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { TelemetryData, MDBBreakerState, Settings, ESP32Status, TelemetryHistoryPoint } from '../types';

interface DashboardTabProps {
  telemetry: TelemetryData;
  breakerState: MDBBreakerState;
  settings: Settings;
  esp32Status: ESP32Status;
  history?: TelemetryHistoryPoint[];
  onRequestBreakerAction: (action: 'ON' | 'OFF') => void;
  onOpenESP32Modal: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  telemetry,
  breakerState,
  settings,
  esp32Status,
  history = [],
  onRequestBreakerAction,
  onOpenESP32Modal,
}) => {
  // ปรับเงื่อนไขการแสดงผล: หากมีข้อมูลเข้ามาแล้ว (timestamp > 0) และไม่ได้ถูกกดตัดสัญญาณ ให้ถือว่าได้รับค่าสด
  const hasData = Boolean(telemetry && telemetry.timestamp > 0);
  const isOnline = (esp32Status.connected || hasData) && !esp32Status.signalCut;

  const breakerStatus = breakerState?.mainBreaker?.state || 'ON';
  const isTripped = breakerStatus === 'TRIPPED';
  const isBreakerOn = breakerStatus === 'ON';

  // Safe numeric fallbacks กันค่า undefined/null ทำให้หน้าจอค้างหรือไม่เรนเดอร์
  const voltageVal = Number(telemetry?.voltage ?? 0);
  const currentVal = Number(telemetry?.current ?? 0);
  const tempVal = Number(telemetry?.temperature ?? 0);
  const humVal = Number(telemetry?.humidity ?? 0);
  const smokeAdcVal = Number(telemetry?.smokeAdc ?? 0);

  // 5 Sensors State Logic
  const isCurrentOver = currentVal > settings.currentLimit;
  const isCurrentWarn = currentVal >= settings.currentLimit * 0.85;

  const isTempOver = tempVal > settings.temperatureLimit;
  const isTempWarn = tempVal >= settings.temperatureLimit * 0.85;

  const isHumOver = humVal > settings.humidityLimit;
  const isHumWarn = humVal >= settings.humidityLimit * 0.9;

  const isSmokeDetected = Boolean(telemetry?.smokeDetected) || smokeAdcVal >= 80;

  // Fallback points for real-time chart (รวม temperature และ humidity ครบถ้วน)
  const chartPoints =
    history.length > 0
      ? history.map((pt) => ({
          ...pt,
          current: Number(pt.current ?? 0),
          temperature: Number((pt as any).temperature ?? tempVal),
          humidity: Number((pt as any).humidity ?? humVal),
          smokeAdc: Number(pt.smokeAdc ?? 0),
        }))
      : [
          {
            time: '00:00:00',
            current: 0,
            temperature: 0,
            humidity: 0,
            smokeAdc: 0,
          },
          {
            time: new Date().toLocaleTimeString('th-TH', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            current: currentVal,
            temperature: tempVal,
            humidity: humVal,
            smokeAdc: smokeAdcVal,
          },
        ];

  return (
    <div className="space-y-4 max-w-5xl mx-auto w-full">
      {/* 1. System Status & Breaker Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Status: ESP32 Status Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#2D2A26]/10 card-shadow flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                esp32Status.signalCut
                  ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                  : isOnline
                  ? 'bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/30'
                  : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
              }`}
            >
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="label-mono text-[#2D2A26]/60 text-[10px]">สถานะระบบ (SYSTEM STATUS)</div>
              <div className="font-mono-space text-lg font-bold text-[#2D2A26] flex items-center gap-2">
                <span>
                  {esp32Status.signalCut
                    ? 'SIGNAL CUT'
                    : isOnline
                    ? 'ESP32 ONLINE'
                    : 'ESP32 OFFLINE'}
                </span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    esp32Status.signalCut
                      ? 'bg-rose-500'
                      : isOnline
                      ? 'bg-[#4CAF50] animate-pulse'
                      : 'bg-amber-500'
                  }`}
                />
              </div>
            </div>
          </div>

          <button
            onClick={onOpenESP32Modal}
            className="text-[11px] font-mono-space text-[#3D5A80] hover:underline px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200"
          >
            ตั้งค่า IP
          </button>
        </div>

        {/* Status: Circuit Breaker Card */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border card-shadow flex items-center justify-between ${
            isTripped
              ? 'bg-[#FFF9F9] border-[#FF5A5F]/40'
              : isBreakerOn
              ? 'bg-white border-[#4CAF50]/30'
              : 'bg-white border-[#2D2A26]/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                isTripped
                  ? 'bg-[#FF5A5F] text-white animate-pulse'
                  : isBreakerOn
                  ? 'bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/30'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {isBreakerOn ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="label-mono text-[#2D2A26]/60 text-[10px] flex items-center gap-1.5">
                <span>สถานะเบรกเกอร์ (BREAKER)</span>
                {breakerState?.mainBreaker?.mode === 'tuya' && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#3D5A80]/10 text-[#3D5A80] font-bold">
                    Tuya Wi-Fi
                  </span>
                )}
              </div>
              <div className="font-mono-space text-lg font-bold flex items-center gap-2">
                <span
                  className={
                    isTripped
                      ? 'text-[#FF5A5F]'
                      : isBreakerOn
                      ? 'text-[#4CAF50]'
                      : breakerStatus === 'OFFLINE'
                      ? 'text-amber-600'
                      : 'text-slate-600'
                  }
                >
                  ● {breakerStatus}
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  ({breakerState?.mainBreaker?.online !== false ? 'Online' : 'Offline'})
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="flex items-center gap-2">
            {isBreakerOn ? (
              <button
                onClick={() => onRequestBreakerAction('OFF')}
                className="px-4 py-2.5 rounded-xl bg-[#FF5A5F] hover:bg-[#e0484d] text-white text-xs font-bold font-mono-space transition active:scale-95 min-h-[44px] flex items-center gap-1.5"
              >
                <PowerOff className="w-3.5 h-3.5" />
                <span>ตัดไฟ</span>
              </button>
            ) : (
              <button
                onClick={() => onRequestBreakerAction('ON')}
                className="px-4 py-2.5 rounded-xl bg-[#4CAF50] hover:bg-[#43a047] text-white text-xs font-bold font-mono-space transition active:scale-95 min-h-[44px] flex items-center gap-1.5"
              >
                <Power className="w-3.5 h-3.5" />
                <span>เปิดไฟ</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Signal Cut Warning Banner */}
      {esp32Status.signalCut && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-mono-space flex items-center justify-between gap-3 card-shadow">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>โหมดตัดสัญญาณ (Signal Cut) เปิดใช้งานอยู่:</strong> ระบบกำลังบล็อกค่าจาก ESP32 และรีเซ็ตตัวเลขเป็น 0 กด "ตั้งค่า IP" เพื่อต่อสัญญาณใหม่
            </span>
          </div>
          <button
            onClick={onOpenESP32Modal}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold shrink-0 hover:bg-rose-700"
          >
            ต่อสัญญาณ
          </button>
        </div>
      )}

      {/* Tripped Reason Alert Box (when TRIPPED) */}
      {isTripped && (
        <div className="p-4 rounded-2xl bg-[#FFF9F9] border-2 border-[#FF5A5F] card-shadow flex items-start gap-3 animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-[#FF5A5F] shrink-0 mt-0.5 animate-bounce" />
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#FF5A5F] font-mono-space">
                ● TRIPPED (เบรกเกอร์ถูกสั่งตัดไฟอัตโนมัติ)
              </span>
              <span className="label-mono text-[9px] px-2 py-0.5 rounded-full bg-[#FF5A5F] text-white font-bold">
                SAFETY AUTO-TRIP
              </span>
            </div>

            <div className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-rose-100 font-mono-space space-y-1">
              <div>
                <span className="font-bold text-[#2D2A26]">Reason: </span>
                <span className="text-rose-700 font-bold">
                  {breakerState?.mainBreaker?.trippedReason || 'Sensor fault detected'}
                </span>
              </div>
              {currentVal > settings.currentLimit && (
                <div className="text-[11px] text-slate-600 flex items-center gap-3">
                  <span>
                    Measured: <strong className="text-rose-600">{currentVal.toFixed(1)} A</strong>
                  </span>
                  <span>
                    Limit: <strong>{settings.currentLimit.toFixed(1)} A</strong>
                  </span>
                </div>
              )}
              {tempVal > settings.temperatureLimit && (
                <div className="text-[11px] text-slate-600 flex items-center gap-3">
                  <span>
                    Measured: <strong className="text-rose-600">{tempVal.toFixed(1)} °C</strong>
                  </span>
                  <span>
                    Limit: <strong>{settings.temperatureLimit.toFixed(1)} °C</strong>
                  </span>
                </div>
              )}
              {humVal > settings.humidityLimit && (
                <div className="text-[11px] text-slate-600 flex items-center gap-3">
                  <span>
                    Measured: <strong className="text-rose-600">{humVal.toFixed(0)} %</strong>
                  </span>
                  <span>
                    Limit: <strong>{settings.humidityLimit.toFixed(0)} %</strong>
                  </span>
                </div>
              )}
              {isSmokeDetected && (
                <div className="text-[11px] text-slate-600 flex items-center gap-3">
                  <span>
                    Smoke ADC: <strong className="text-rose-600">{smokeAdcVal} ADC</strong>
                  </span>
                  <span>
                    Status: <strong className="text-rose-600">SMOKE DETECTED</strong>
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 font-mono-space">
              * ระบบตัดไฟเพื่อความปลอดภัย ไม่อนุญาตให้เปิดเบรกเกอร์จนกว่าค่าเซนเซอร์จะปลอดภัย (Safe ON Protection)
            </p>
          </div>
        </div>
      )}

      {/* 1.1 Overcurrent 5-Second Delay Countdown Warning Banner */}
      {!isTripped && (telemetry?.overCurrentDelayActive || isCurrentOver) && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 card-shadow flex items-start gap-3 animate-fade-in">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-700 font-bold shrink-0 text-base">
            ⏳
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-amber-950 font-mono-space flex items-center gap-2">
                <span>⚠️ ตรวจพบกระแสไฟฟ้าเกินเกณฑ์ (Over Current Delay 5s)</span>
              </span>
              <span className="label-mono text-xs px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold animate-pulse">
                หน่วงเวลานับถอยหลัง: {telemetry?.overCurrentCountdown ?? 5} วินาที
              </span>
            </div>
            <p className="text-xs text-amber-900 font-mono-space leading-relaxed">
              กระแสไฟฟ้าตรวจวัดได้ <strong className="text-rose-600">{currentVal.toFixed(1)} A</strong> (เกินขีดจำกัด{' '}
              {settings.currentLimit.toFixed(1)} A) &bull; กำลังรอเทียบเคียง ESP32 เป็นเวลา 5 วินาที หากกระแสยังคงเกินต่อเนื่องจะสั่งตัดเบรกเกอร์ (TRIPPED) อัตโนมัติ แต่หากกระแสลดลงต่ำกว่าพิกัดก่อนครบ 5 วินาที ตัวนับเวลาจะรีเซ็ตกลับเป็นปกติทันที
            </p>
          </div>
        </div>
      )}

      {/* 2. Sensor Cards Grid (5 Core Values) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="label-mono text-[#2D2A26]/70 text-xs font-bold">
            ข้อมูลเซนเซอร์ตรวจวัด (SENSORS)
          </span>
          <span className="text-[11px] font-mono-space text-slate-400">
            {hasData
              ? `อัปเดต: ${new Date(telemetry.timestamp).toLocaleTimeString('th-TH')}`
              : 'รอข้อมูล ESP32'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
          {/* Card 1: Voltage (แรงดันไฟฟ้า) */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-[#2D2A26]/10 card-shadow flex flex-col justify-between space-y-1 h-full min-h-[88px] sm:min-h-[94px]">
            <div className="flex items-center justify-between gap-1">
              <span className="label-mono text-[#2D2A26]/70 flex items-center gap-1.5 font-bold text-xs truncate">
                <Activity className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Voltage</span>
              </span>
              <span className="label-mono text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-[#4CAF50]/10 text-[#4CAF50] shrink-0">
                220V
              </span>
            </div>
            <div className="my-0.5">
              <div className="font-mono-space text-lg sm:text-xl font-bold text-[#2D2A26] leading-tight">
                {voltageVal.toFixed(0)}
                <span className="text-xs font-normal text-slate-400 ml-1">V</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono-space truncate mt-0.5">
                มาตรฐาน 50Hz
              </div>
            </div>
          </div>

          {/* Card 2: Current (กระแสไฟฟ้า) */}
          <div
            className={`p-2.5 sm:p-3 rounded-xl card-shadow flex flex-col justify-between space-y-1 h-full min-h-[88px] sm:min-h-[94px] ${
              isCurrentOver
                ? 'bg-[#FFF9F9] border-2 border-[#FF5A5F]'
                : isCurrentWarn
                ? 'bg-amber-50/50 border border-amber-300'
                : 'bg-white border border-[#2D2A26]/10'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="label-mono text-[#2D2A26]/70 flex items-center gap-1.5 font-bold text-xs truncate">
                <Zap className={`w-3.5 h-3.5 shrink-0 ${isCurrentOver ? 'text-[#FF5A5F]' : 'text-[#3D5A80]'}`} />
                <span>Current</span>
              </span>
              <span
                className={`label-mono text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                  isCurrentOver
                    ? 'bg-[#FF5A5F] text-white animate-pulse'
                    : isCurrentWarn
                    ? 'bg-amber-500 text-white'
                    : 'bg-[#4CAF50]/10 text-[#4CAF50]'
                }`}
              >
                {isCurrentOver ? 'เกิน' : isCurrentWarn ? 'เตือน' : 'ปกติ'}
              </span>
            </div>
            <div className="my-0.5">
              <div
                className={`font-mono-space text-lg sm:text-xl font-bold leading-tight ${
                  isCurrentOver ? 'text-[#FF5A5F]' : 'text-[#2D2A26]'
                }`}
              >
                {currentVal.toFixed(1)}
                <span className="text-xs font-normal text-slate-400 ml-1">A</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono-space truncate mt-0.5">
                Limit: <span className="font-bold">{settings.currentLimit.toFixed(1)} A</span>
              </div>
            </div>
          </div>

          {/* Card 3: Temperature (อุณหภูมิ) */}
          <div
            className={`p-2.5 sm:p-3 rounded-xl card-shadow flex flex-col justify-between space-y-1 h-full min-h-[88px] sm:min-h-[94px] ${
              isTempOver
                ? 'bg-[#FFF9F9] border-2 border-[#FF5A5F]'
                : isTempWarn
                ? 'bg-amber-50/50 border border-amber-300'
                : 'bg-white border border-[#2D2A26]/10'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="label-mono text-[#2D2A26]/70 flex items-center gap-1.5 font-bold text-xs truncate">
                <Thermometer
                  className={`w-3.5 h-3.5 shrink-0 ${isTempOver ? 'text-[#FF5A5F]' : 'text-amber-500'}`}
                />
                <span>Temp</span>
              </span>
              <span
                className={`label-mono text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                  isTempOver
                    ? 'bg-[#FF5A5F] text-white animate-pulse'
                    : isTempWarn
                    ? 'bg-amber-500 text-white'
                    : 'bg-[#4CAF50]/10 text-[#4CAF50]'
                }`}
              >
                {isTempOver ? 'ร้อน' : isTempWarn ? 'เตือน' : 'ปกติ'}
              </span>
            </div>
            <div className="my-0.5">
              <div
                className={`font-mono-space text-lg sm:text-xl font-bold leading-tight ${
                  isTempOver ? 'text-[#FF5A5F]' : 'text-[#2D2A26]'
                }`}
              >
                {tempVal.toFixed(1)}
                <span className="text-xs font-normal text-slate-400 ml-1">°C</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono-space truncate mt-0.5">
                Limit: <span className="font-bold">{settings.temperatureLimit.toFixed(1)} °C</span>
              </div>
            </div>
          </div>

          {/* Card 4: Humidity (ความชื้น) */}
          <div
            className={`p-2.5 sm:p-3 rounded-xl card-shadow flex flex-col justify-between space-y-1 h-full min-h-[88px] sm:min-h-[94px] ${
              isHumOver
                ? 'bg-[#FFF9F9] border-2 border-[#FF5A5F]'
                : isHumWarn
                ? 'bg-amber-50/50 border border-amber-300'
                : 'bg-white border border-[#2D2A26]/10'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="label-mono text-[#2D2A26]/70 flex items-center gap-1.5 font-bold text-xs truncate">
                <Droplets className={`w-3.5 h-3.5 shrink-0 ${isHumOver ? 'text-[#FF5A5F]' : 'text-cyan-600'}`} />
                <span>Humidity</span>
              </span>
              <span
                className={`label-mono text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                  isHumOver
                    ? 'bg-[#FF5A5F] text-white animate-pulse'
                    : isHumWarn
                    ? 'bg-amber-500 text-white'
                    : 'bg-[#4CAF50]/10 text-[#4CAF50]'
                }`}
              >
                {isHumOver ? 'ชื้น' : isHumWarn ? 'เตือน' : 'ปกติ'}
              </span>
            </div>
            <div className="my-0.5">
              <div
                className={`font-mono-space text-lg sm:text-xl font-bold leading-tight ${
                  isHumOver ? 'text-[#FF5A5F]' : 'text-[#2D2A26]'
                }`}
              >
                {humVal.toFixed(0)}
                <span className="text-xs font-normal text-slate-400 ml-1">%</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono-space truncate mt-0.5">
                Limit: <span className="font-bold">{settings.humidityLimit.toFixed(0)} %</span>
              </div>
            </div>
          </div>

          {/* Card 5: Smoke ADC (ระดับควัน) */}
          <div
            className={`p-2.5 sm:p-3 rounded-xl card-shadow flex flex-col justify-between space-y-1 h-full min-h-[88px] sm:min-h-[94px] ${
              isSmokeDetected
                ? 'bg-[#FFF9F9] border-2 border-[#FF5A5F]'
                : 'bg-white border border-[#2D2A26]/10'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="label-mono text-[#2D2A26]/70 flex items-center gap-1.5 font-bold text-xs truncate">
                <Wind
                  className={`w-3.5 h-3.5 shrink-0 ${isSmokeDetected ? 'text-[#FF5A5F]' : 'text-slate-600'}`}
                />
                <span>{isSmokeDetected ? 'พบควัน' : 'ระดับควัน'}</span>
              </span>
              <span
                className={`label-mono text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                  isSmokeDetected
                    ? 'bg-[#FF5A5F] text-white animate-pulse'
                    : 'bg-[#4CAF50]/10 text-[#4CAF50]'
                }`}
              >
                {isSmokeDetected ? 'พบควัน' : 'ปกติ'}
              </span>
            </div>

            <div className="my-0.5">
              <div
                className={`font-mono-space text-lg sm:text-xl font-bold leading-tight ${
                  isSmokeDetected ? 'text-[#FF5A5F]' : 'text-[#2D2A26]'
                }`}
              >
                {smokeAdcVal}
                <span className="text-xs font-normal text-slate-400 ml-1">ADC</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono-space truncate mt-0.5">
                สถานะ:{' '}
                <span className={`font-bold ${isSmokeDetected ? 'text-[#FF5A5F]' : 'text-[#4CAF50]'}`}>
                  {isSmokeDetected ? 'DETECTED' : 'NORMAL'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Real-time Line Charts (Current, Temp/Hum & Smoke Sensor ADC) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="label-mono text-[#2D2A26]/70 text-xs font-bold flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#3D5A80]" />
            <span>กราฟตรวจวัดแบบเรียลไทม์ (REAL-TIME LINE CHARTS)</span>
          </span>
          <span className="text-[11px] font-mono-space text-slate-400">
            อัปเดตอัตโนมัติทุก 2 วินาที (Auto 2s)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Chart 1: Current Line Chart */}
          <div className="p-4 rounded-2xl bg-white border border-[#2D2A26]/10 card-shadow space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 font-bold shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-mono-space text-xs font-bold text-[#2D2A26]">
                    กระแสไฟฟ้า (Current: A)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono-space">
                    Limit: {settings.currentLimit.toFixed(1)} A
                  </p>
                </div>
              </div>
              <div className="font-mono-space text-sm sm:text-base font-bold text-amber-600 bg-amber-50/80 px-2 py-0.5 rounded-lg border border-amber-200/80">
                {currentVal.toFixed(1)} A
              </div>
            </div>

            <div className="h-48 sm:h-52 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis domain={[0, Math.max(settings.currentLimit + 2, currentVal + 2, 8)]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    formatter={(val: any) => [`${val} A`, 'Current']}
                  />
                  <ReferenceLine
                    y={settings.currentLimit}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: `${settings.currentLimit}A`, fill: '#ef4444', fontSize: 9 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: '#f59e0b' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono-space text-slate-500 pt-1 border-t border-slate-100">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> กระแสวัดจริง (A)
              </span>
              <span className="flex items-center gap-1 text-rose-500 font-bold">
                <span className="w-2 h-0.5 bg-rose-500" /> ตัดไฟ 5s ({settings.currentLimit}A)
              </span>
            </div>
          </div>

          {/* Chart 2: Temperature & Humidity Real-time Chart */}
          <div className="p-4 rounded-2xl bg-white border border-[#2D2A26]/10 card-shadow space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    isTempOver || isHumOver
                      ? 'bg-rose-500/15 border border-rose-500/30 text-rose-600'
                      : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600'
                  }`}
                >
                  <Thermometer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-mono-space text-xs font-bold text-[#2D2A26]">
                    อุณหภูมิ & ความชื้น (Temp & Hum)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono-space">
                    Limit: {settings.temperatureLimit}°C / {settings.humidityLimit}%
                  </p>
                </div>
              </div>
              <div className="font-mono-space text-xs font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                <span className="text-rose-600">{tempVal.toFixed(1)}°C</span>
                <span className="text-slate-300 mx-1">|</span>
                <span className="text-cyan-600">{humVal.toFixed(0)}%</span>
              </div>
            </div>

            <div className="h-48 sm:h-52 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    formatter={(val: any, name: any) => [
                      name === 'temperature' ? `${val} °C` : `${val} %`,
                      name === 'temperature' ? 'อุณหภูมิ' : 'ความชื้น',
                    ]}
                  />
                  <ReferenceLine
                    y={settings.temperatureLimit}
                    stroke="#f43f5e"
                    strokeDasharray="3 3"
                    label={{ value: `${settings.temperatureLimit}°C`, fill: '#f43f5e', fontSize: 9 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    name="temperature"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={{ r: 2, fill: '#f43f5e' }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="humidity"
                    name="humidity"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ r: 2, fill: '#06b6d4' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono-space text-slate-500 pt-1 border-t border-slate-100">
              <span className="flex items-center gap-1 text-rose-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> อุณหภูมิ (°C)
              </span>
              <span className="flex items-center gap-1 text-cyan-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-cyan-500" /> ความชื้น (%)
              </span>
            </div>
          </div>

          {/* Chart 3: Smoke Sensor ADC Line Chart */}
          <div className="p-4 rounded-2xl bg-white border border-[#2D2A26]/10 card-shadow space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    isSmokeDetected
                      ? 'bg-rose-500/15 border border-rose-500/30 text-rose-600'
                      : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-600'
                  }`}
                >
                  <Wind className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-mono-space text-xs font-bold text-[#2D2A26]">
                    ระดับควันเซนเซอร์ (Smoke ADC)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono-space">
                    ค่าปกติ 0 &bull; เกณฑ์เตือน &ge; 80 ADC
                  </p>
                </div>
              </div>
              <div
                className={`font-mono-space text-sm sm:text-base font-bold px-2 py-0.5 rounded-lg border ${
                  isSmokeDetected
                    ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
                    : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                }`}
              >
                {smokeAdcVal} ADC
              </div>
            </div>

            <div className="h-48 sm:h-52 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis domain={[0, Math.max(120, smokeAdcVal + 20)]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    formatter={(val: any) => [`${val} ADC`, 'Smoke ADC']}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: 'Warn ≥80', fill: '#ef4444', fontSize: 9 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="smokeAdc"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: '#06b6d4' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono-space text-slate-500 pt-1 border-t border-slate-100">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-500" /> ควัน RAW ADC
              </span>
              <span className="flex items-center gap-1 text-rose-500 font-bold">
                <span className="w-2 h-0.5 bg-rose-500" /> เตือน (&ge;80 ADC)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
