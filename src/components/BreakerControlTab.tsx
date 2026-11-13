import React from 'react';
import {
  Zap,
  RefreshCw,
  PowerOff,
  Power,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { TelemetryData, MDBBreakerState, SafetySettings, ESP32Status } from '../types';

interface BreakerControlTabProps {
  telemetry: TelemetryData;
  breakerState: MDBBreakerState;
  settings: SafetySettings;
  esp32Status?: ESP32Status;
  onRequestCommand: (command: 'TRIP' | 'RESET') => void;
  onOpenSettings: () => void;
}

export const BreakerControlTab: React.FC<BreakerControlTabProps> = ({
  telemetry,
  breakerState,
  settings,
  esp32Status,
  onRequestCommand,
  onOpenSettings,
}) => {
  const isMasterTripped =
    breakerState.mainBreaker.state === 'TRIPPED' || breakerState.breakerCommand === 'TRIP';
  const isSignalCut = esp32Status?.signalCut;
  const isConnected = esp32Status?.connected && !isSignalCut;

  // Status computation
  const status: 'NORMAL' | 'TRIPPED' | 'EMERGENCY' | 'OFFLINE' =
    isSignalCut || !isConnected || telemetry.timestamp === 0
      ? 'OFFLINE'
      : isMasterTripped
      ? 'TRIPPED'
      : telemetry.status === 'critical' ||
        telemetry.status === 'fire_hazard' ||
        (telemetry.activeFaults && telemetry.activeFaults.length > 0)
      ? 'EMERGENCY'
      : 'NORMAL';

  const statusConfig = {
    NORMAL: {
      badge: 'bg-[#4CAF50] text-white',
      border: 'border-emerald-500',
      title: 'NORMAL',
      subtitle: 'สถานะปกติ - กำลังจ่ายกระแสไฟฟ้า 220V เข้าสู่ระบบตู้ MDB',
      icon: ShieldCheck,
      color: 'text-[#4CAF50]',
    },
    TRIPPED: {
      badge: 'bg-rose-700 text-white animate-pulse',
      border: 'border-rose-600',
      title: 'TRIPPED',
      subtitle: breakerState.mainBreaker.trippedReason || 'เบรกเกอร์ปลดวงจรตัดไฟแล้ว',
      icon: PowerOff,
      color: 'text-rose-600',
    },
    EMERGENCY: {
      badge: 'bg-[#FF5A5F] text-white animate-pulse glow-coral',
      border: 'border-rose-500',
      title: 'EMERGENCY',
      subtitle: 'ตรวจพบสภาวะอันตรายเกินพิกัดความปลอดภัย',
      icon: ShieldAlert,
      color: 'text-[#FF5A5F]',
    },
    OFFLINE: {
      badge: 'bg-slate-600 text-white',
      border: 'border-slate-500',
      title: 'OFFLINE',
      subtitle: isSignalCut ? 'ตัดสัญญาณการเชื่อมต่อ ESP32' : 'รอสัญญาณเชื่อมต่อจากบอร์ด ESP32',
      icon: Radio,
      color: 'text-slate-500',
    },
  }[status];

  const StatusIcon = statusConfig.icon;
  const currentRatio = (telemetry.current / (settings.maxCurrentLimit || 5)) * 100;
  const hasActiveFaults = telemetry.activeFaults && telemetry.activeFaults.length > 0;

  return (
    <div className="space-y-4 max-w-3xl mx-auto w-full">
      {/* 1. System Status Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#2D2A26]/10 card-shadow space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Power className="w-5 h-5 text-[#3D5A80]" />
            <h2 className="text-base sm:text-lg font-bold text-[#2D2A26] font-mono-space">
              แผงควบคุมเบรกเกอร์ (Breaker Control)
            </h2>
          </div>

          <div
            className={`label-mono px-3.5 py-1.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xs ${statusConfig.badge}`}
          >
            <StatusIcon className="w-4 h-4" />
            <span>{statusConfig.title}</span>
          </div>
        </div>

        {/* Current status explanation */}
        <div className="p-4 rounded-2xl bg-[#2D2A26]/5 border border-[#2D2A26]/10 flex items-start gap-3">
          <StatusIcon className={`w-5 h-5 shrink-0 mt-0.5 ${statusConfig.color}`} />
          <div className="space-y-0.5">
            <div className="font-bold text-xs sm:text-sm text-[#2D2A26] font-mono-space">
              สถานะ: {statusConfig.title}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{statusConfig.subtitle}</p>
          </div>
        </div>

        {/* Real-time Load Readout */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="label-mono text-[11px] text-slate-500 font-bold">กระแสปัจจุบัน</div>
            <div className="font-mono-space text-2xl sm:text-3xl font-bold text-[#2D2A26] mt-0.5">
              {telemetry.current.toFixed(2)}{' '}
              <span className="text-sm text-slate-400 font-normal">A</span>
            </div>
            <div className="text-[11px] font-mono-space text-slate-500 mt-1">
              พิกัด: {settings.maxCurrentLimit.toFixed(1)} A
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="label-mono text-[11px] text-slate-500 font-bold">แรงดันไฟฟ้า</div>
            <div className="font-mono-space text-2xl sm:text-3xl font-bold text-[#2D2A26] mt-0.5">
              {telemetry.voltage.toFixed(0)}{' '}
              <span className="text-sm text-slate-400 font-normal">V</span>
            </div>
            <div className="text-[11px] font-mono-space text-slate-500 mt-1">
              ช่วง: {settings.minVoltageLimit}–{settings.maxVoltageLimit} V
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1 pt-1">
          <div className="w-full bg-[#2D2A26]/5 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isMasterTripped || status === 'EMERGENCY'
                  ? 'bg-[#FF5A5F]'
                  : currentRatio > 85
                  ? 'bg-amber-400'
                  : 'bg-[#4CAF50]'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, currentRatio))}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-mono-space">
            <span>0 A</span>
            <span>โหลดกระแส {Math.round(currentRatio)}%</span>
            <span>{settings.maxCurrentLimit.toFixed(1)} A</span>
          </div>
        </div>
      </div>

      {/* 2. Active Fault Alert (if any) */}
      {hasActiveFaults && (
        <div className="bg-rose-50 border border-rose-300 rounded-3xl p-4 sm:p-5 text-xs font-mono-space space-y-2">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
            <span>ตรวจพบสภาวะอันตราย (Active Faults):</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-7">
            {telemetry.activeFaults.map((fault, idx) => (
              <span
                key={idx}
                className="bg-rose-600 text-white px-2.5 py-1 rounded-xl text-xs font-bold border border-rose-400 shadow-xs"
              >
                ● {fault}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-rose-700 pl-7 leading-relaxed">
            * ระบบล็อคป้องกันการจ่ายไฟซ้ำอัตโนมัติ (Anti-Auto-Reclose Safety Lock) จะไม่อนุญาตให้ RESET เบรกเกอร์จนกว่าค่าทั้งหมดจะปลอดภัย
          </p>
        </div>
      )}

      {/* 3. TRIP BREAKER BUTTON (Separated clearly to prevent mis-clicks) */}
      <div className="bg-white rounded-3xl p-5 border-2 border-rose-200 card-shadow space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-rose-50 text-[#FF5A5F] shrink-0 border border-rose-200">
            <Zap className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-sm sm:text-base font-bold text-rose-700 font-mono-space">
              คำสั่งตัดไฟฉุกเฉิน (Emergency Trip)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              กดเพื่อสั่งปลดวงจรเบรกเกอร์เมนทันที มีหน้าต่างยืนยันก่อนทำงานเพื่อป้องกันกดผิด
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRequestCommand('TRIP')}
          className="w-full min-h-[48px] px-6 py-3.5 rounded-2xl bg-[#FF5A5F] hover:bg-[#e0484d] text-white font-mono-space font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2.5 transition active:scale-98 glow-coral shadow-md"
        >
          <Zap className="w-5 h-5 animate-pulse" />
          <span>[ TRIP BREAKER ] - สั่งตัดไฟทันที</span>
        </button>
      </div>

      {/* 4. RESET BREAKER BUTTON */}
      <div className="bg-white rounded-3xl p-5 border-2 border-emerald-200 card-shadow space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 shrink-0 border border-emerald-200">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-sm sm:text-base font-bold text-emerald-800 font-mono-space">
              คำสั่งเปิดเบรกเกอร์กลับ (Reset Breaker)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              ขอสับสวิตช์จ่ายไฟกลับเข้าระบบหลังตรวจสอบความเรียบร้อย มีหน้าต่างยืนยันก่อนทำงาน
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRequestCommand('RESET')}
          disabled={hasActiveFaults}
          className={`w-full min-h-[48px] px-6 py-3.5 rounded-2xl font-mono-space font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2.5 transition active:scale-98 shadow-md ${
            hasActiveFaults
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-[#4CAF50] hover:bg-[#43a047] text-white'
          }`}
        >
          <RefreshCw className="w-5 h-5" />
          <span>[ RESET BREAKER ] - ขอเปิดไฟกลับ</span>
        </button>

        {hasActiveFaults && (
          <div className="text-[11px] text-amber-700 font-mono-space text-center flex items-center justify-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>ปุ่มจะปลดล็อคเมื่อค่าเซนเซอร์กลับสู่เกณฑ์ปลอดภัยทั้งหมด</span>
          </div>
        )}
      </div>

      {/* 5. Shortcut to Safety Settings */}
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={onOpenSettings}
          className="min-h-[44px] px-4 py-2 text-xs font-mono-space font-bold text-[#3D5A80] hover:text-[#FF5A5F] transition inline-flex items-center gap-1.5"
        >
          <Sliders className="w-4 h-4" />
          <span>ไปที่หน้าตั้งค่าขีดจำกัดความปลอดภัย (Safety Settings) &rarr;</span>
        </button>
      </div>
    </div>
  );
};
