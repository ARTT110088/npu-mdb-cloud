import React from 'react';
import {
  Power,
  PowerOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Thermometer,
  Droplets,
  Wind,
  Wifi,
  WifiOff,
  Cloud,
} from 'lucide-react';
import { TelemetryData, MDBBreakerState, Settings, BreakerState } from '../types';

interface ControlTabProps {
  telemetry: TelemetryData;
  breakerState: MDBBreakerState;
  settings: Settings;
  onRequestBreakerAction: (action: 'ON' | 'OFF') => void;
  errorMessage?: string | null;
  isLoading?: boolean;
}

export const ControlTab: React.FC<ControlTabProps> = ({
  telemetry,
  breakerState,
  settings,
  onRequestBreakerAction,
  errorMessage,
  isLoading = false,
}) => {
  const breakerStatus: BreakerState = breakerState.mainBreaker.state || 'UNKNOWN';
  const isOnline = breakerState.mainBreaker.online !== false;
  const isTripped = breakerStatus === 'TRIPPED';
  const isBreakerOn = breakerStatus === 'ON';
  const isBreakerOff = breakerStatus === 'OFF';
  const isOffline = breakerStatus === 'OFFLINE' || !isOnline;
  const isUnknown = breakerStatus === 'UNKNOWN';

  // Sensor safety status checks
  const isCurrentFault = telemetry.current > settings.currentLimit;
  const isTempFault = telemetry.temperature > settings.temperatureLimit;
  const isHumFault = telemetry.humidity > settings.humidityLimit;
  const isSmokeFault = telemetry.smokeDetected;

  const hasAnyFault = isCurrentFault || isTempFault || isHumFault || isSmokeFault;

  const getStatusColor = (state: BreakerState) => {
    switch (state) {
      case 'ON':
        return 'text-[#4CAF50]';
      case 'OFF':
        return 'text-slate-600';
      case 'TRIPPED':
        return 'text-[#FF5A5F]';
      case 'OFFLINE':
        return 'text-amber-600';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusBadge = (state: BreakerState) => {
    switch (state) {
      case 'ON':
        return 'bg-[#4CAF50]/15 text-[#4CAF50] border-[#4CAF50]/30';
      case 'OFF':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'TRIPPED':
        return 'bg-[#FF5A5F]/15 text-[#FF5A5F] border-[#FF5A5F]/30 animate-pulse';
      case 'OFFLINE':
        return 'bg-amber-500/15 text-amber-700 border-amber-500/30';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto w-full">
      {/* Smart Breaker Card */}
      <div className="p-6 rounded-3xl bg-white border border-[#2D2A26]/10 card-shadow-lg text-center space-y-4">
        {/* Header & Tuya Cloud Indicator */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-[#3D5A80]" />
            <h2 className="font-mono-space text-sm font-bold text-[#2D2A26]">
              Smart Breaker (Tuya Cloud)
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono-space">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <Wifi className="w-3.5 h-3.5" />
                <span>ONLINE</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600 font-bold">
                <WifiOff className="w-3.5 h-3.5" />
                <span>OFFLINE</span>
              </span>
            )}
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">
              {breakerState.mainBreaker.mode === 'tuya' ? 'Tuya Wi-Fi' : 'Mock Mode'}
            </span>
          </div>
        </div>

        {/* Large State Indicator */}
        <div className="flex flex-col items-center justify-center space-y-2 pt-2">
          <div
            className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all ${
              isTripped
                ? 'bg-[#FF5A5F] text-white animate-pulse'
                : isBreakerOn
                ? 'bg-[#4CAF50] text-white shadow-lg shadow-emerald-500/20'
                : isOffline
                ? 'bg-amber-500 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {isBreakerOn ? <Power className="w-10 h-10" /> : <PowerOff className="w-10 h-10" />}
          </div>

          <div className="space-y-1">
            <div className="label-mono text-[#2D2A26]/50 text-[10px]">BREAKER STATUS</div>
            <div
              className={`font-mono-space text-3xl sm:text-4xl font-black tracking-tight ${getStatusColor(
                breakerStatus
              )}`}
            >
              {breakerStatus}
            </div>
            <div>
              <span className={`label-mono text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${getStatusBadge(breakerStatus)}`}>
                ● {breakerStatus}
              </span>
            </div>
          </div>

          {/* Tripped Reason Banner */}
          {isTripped && breakerState.mainBreaker.trippedReason && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono-space text-left w-full space-y-1 mt-2">
              <div className="flex items-center gap-1.5 font-bold text-[#FF5A5F]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>สาเหตุการตัดไฟอัตโนมัติ (Trip Reason):</span>
              </div>
              <div className="pl-5 text-slate-700">{breakerState.mainBreaker.trippedReason}</div>
            </div>
          )}

          {/* Offline Notice */}
          {isOffline && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono-space text-left w-full flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
              <span>อุปกรณ์เบรกเกอร์ Wi-Fi ไม่ออนไลน์ กรุณาตรวจเช็คสัญญาณเครือข่าย</span>
            </div>
          )}
        </div>

        {/* Action Buttons: [ TURN OFF ] and [ TURN ON ] */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {/* TURN OFF Button */}
          <button
            type="button"
            onClick={() => onRequestBreakerAction('OFF')}
            disabled={isBreakerOff || isLoading}
            className={`py-4 px-4 rounded-2xl font-mono-space text-sm font-bold tracking-wider transition active:scale-95 min-h-[52px] flex items-center justify-center gap-2 border-2 ${
              isBreakerOff || isLoading
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-[#FF5A5F] hover:bg-[#e0484d] text-white border-white shadow-md glow-coral'
            }`}
          >
            <PowerOff className="w-4 h-4" />
            <span>{isLoading ? 'กำลังส่งคำสั่ง...' : 'TURN OFF'}</span>
          </button>

          {/* TURN ON Button */}
          <button
            type="button"
            onClick={() => onRequestBreakerAction('ON')}
            disabled={isBreakerOn || isLoading}
            className={`py-4 px-4 rounded-2xl font-mono-space text-sm font-bold tracking-wider transition active:scale-95 min-h-[52px] flex items-center justify-center gap-2 border-2 ${
              isBreakerOn || isLoading
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-[#4CAF50] hover:bg-[#43a047] text-white border-white shadow-md'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isLoading ? 'กำลังส่งคำสั่ง...' : 'TURN ON'}</span>
          </button>
        </div>

        {/* Dynamic Error / Warning Toast */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-mono-space flex items-start gap-2.5 text-left animate-fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">คำสั่งถูกปฏิเสธ (Safe ON Protection):</div>
              <div>{errorMessage}</div>
            </div>
          </div>
        )}

        {hasAnyFault && !isBreakerOn && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-left flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">ระบบยังตรวจพบความผิดปกติ:</span> ไม่สามารถเปิดเบรกเกอร์ได้จนกว่าค่าเซนเซอร์ทุกตัวจะกลับสู่ระดับปลอดภัย (HTTP 409 Safe Reset Protection)
            </div>
          </div>
        )}
      </div>

      {/* System Status Checklist */}
      <div className="p-5 rounded-3xl bg-white border border-[#2D2A26]/10 card-shadow space-y-3">
        <div className="label-mono text-[#2D2A26]/70 text-xs font-bold">
          ตรวจสอบความพร้อมก่อนจ่ายไฟ (SAFE RESET CHECKLIST)
        </div>

        <div className="space-y-2">
          {/* Current */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2.5">
              <Zap className={`w-4 h-4 ${isCurrentFault ? 'text-[#FF5A5F]' : 'text-slate-600'}`} />
              <span className="font-bold text-[#2D2A26]">Current:</span>
              <span className="font-mono-space text-slate-600">
                {telemetry.current.toFixed(1)} A / Limit {settings.currentLimit.toFixed(1)} A
              </span>
            </div>
            <span
              className={`label-mono px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 ${
                isCurrentFault ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isCurrentFault ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              <span>{isCurrentFault ? 'FAULT' : 'NORMAL'}</span>
            </span>
          </div>

          {/* Temperature */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2.5">
              <Thermometer className={`w-4 h-4 ${isTempFault ? 'text-[#FF5A5F]' : 'text-slate-600'}`} />
              <span className="font-bold text-[#2D2A26]">Temperature:</span>
              <span className="font-mono-space text-slate-600">
                {telemetry.temperature.toFixed(1)} °C / Limit {settings.temperatureLimit.toFixed(1)} °C
              </span>
            </div>
            <span
              className={`label-mono px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 ${
                isTempFault ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isTempFault ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              <span>{isTempFault ? 'FAULT' : 'NORMAL'}</span>
            </span>
          </div>

          {/* Humidity */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2.5">
              <Droplets className={`w-4 h-4 ${isHumFault ? 'text-[#FF5A5F]' : 'text-slate-600'}`} />
              <span className="font-bold text-[#2D2A26]">Humidity:</span>
              <span className="font-mono-space text-slate-600">
                {telemetry.humidity.toFixed(0)} % / Limit {settings.humidityLimit.toFixed(0)} %
              </span>
            </div>
            <span
              className={`label-mono px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 ${
                isHumFault ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isHumFault ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              <span>{isHumFault ? 'FAULT' : 'NORMAL'}</span>
            </span>
          </div>

          {/* Smoke */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2.5">
              <Wind className={`w-4 h-4 ${isSmokeFault ? 'text-[#FF5A5F]' : 'text-slate-600'}`} />
              <span className="font-bold text-[#2D2A26]">Smoke ADC:</span>
              <span className="font-mono-space text-slate-600">
                {telemetry.smokeAdc ?? 0} ADC ({isSmokeFault ? 'ตรวจพบควัน' : 'ระดับปกติ'})
              </span>
            </div>
            <span
              className={`label-mono px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 ${
                isSmokeFault ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isSmokeFault ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              <span>{isSmokeFault ? 'SMOKE DETECTED' : 'NORMAL'}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
