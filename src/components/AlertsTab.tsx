import React from 'react';
import {
  Bell,
  ShieldAlert,
  AlertTriangle,
  Zap,
  Thermometer,
  Droplets,
  Wind,
  Trash2,
  Check,
  Power,
  PowerOff,
  WifiOff,
  CloudOff,
  Lock,
} from 'lucide-react';
import { AlertLog } from '../types';

interface AlertsTabProps {
  alerts: AlertLog[];
  onAcknowledge: (id: string) => void;
  onClearAll: () => void;
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
  alerts,
  onAcknowledge,
  onClearAll,
}) => {
  const getIcon = (type: AlertLog['type']) => {
    switch (type) {
      case 'OVERCURRENT':
        return Zap;
      case 'HIGH_TEMPERATURE':
        return Thermometer;
      case 'HIGH_HUMIDITY':
        return Droplets;
      case 'SMOKE_DETECTED':
        return Wind;
      case 'BREAKER_MANUAL_ON':
      case 'MANUAL_ON':
        return Power;
      case 'BREAKER_MANUAL_OFF':
      case 'MANUAL_OFF':
        return PowerOff;
      case 'BREAKER_AUTO_TRIP':
      case 'AUTO_TRIP':
        return AlertTriangle;
      case 'BREAKER_ON_BLOCKED':
        return Lock;
      case 'TUYA_DEVICE_OFFLINE':
        return WifiOff;
      case 'TUYA_API_ERROR':
        return CloudOff;
      default:
        return ShieldAlert;
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full space-y-4">
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#2D2A26]/10 card-shadow space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#3D5A80]" />
            <div>
              <h2 className="font-mono-space text-base sm:text-lg font-bold text-[#2D2A26]">
                ประวัติการแจ้งเตือน & เหตุการณ์ (EVENT LOG)
              </h2>
              <p className="text-[11px] text-slate-500 font-mono-space">
                แสดงเหตุการณ์สำคัญล่าสุด ({alerts.length} รายการ)
              </p>
            </div>
          </div>

          {alerts.length > 0 && (
            <button
              onClick={onClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono-space text-slate-500 hover:text-rose-600 hover:border-rose-300 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ล้างประวัติ</span>
            </button>
          )}
        </div>

        {/* List of Alerts */}
        <div className="space-y-2.5">
          {alerts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-mono-space">
              ไม่มีประวัติแจ้งเตือน ระบบทำงานปกติปลอดภัย
            </div>
          ) : (
            alerts.map((item) => {
              const Icon = getIcon(item.type);
              const timeStr = new Date(item.timestamp).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              const isDanger = item.severity === 'critical' || item.severity === 'danger';
              const isWarning = item.severity === 'warning';
              const isSuccess = item.type === 'BREAKER_MANUAL_ON' || item.type === 'MANUAL_ON';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition card-shadow flex items-start justify-between gap-3 ${
                    isDanger
                      ? 'bg-[#FFF9F9] border-[#FF5A5F]/30'
                      : isWarning
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-white border-[#2D2A26]/10'
                  } ${!item.acknowledged ? 'ring-1 ring-[#FF5A5F]/40' : 'opacity-95'}`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`p-2.5 rounded-xl border shrink-0 ${
                        isDanger
                          ? 'bg-rose-100/50 text-[#FF5A5F] border-rose-200'
                          : isWarning
                          ? 'bg-amber-100/50 text-amber-700 border-amber-200'
                          : isSuccess
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono-space text-xs font-bold text-slate-500">
                          {timeStr}
                        </span>
                        <span className="font-mono-space text-xs font-bold text-[#2D2A26] truncate">
                          {item.title}
                        </span>
                        {item.breakerTrippedAction && (
                          <span className="label-mono text-[9px] px-2 py-0.2 rounded-full bg-[#FF5A5F] text-white font-bold">
                            TRIPPED
                          </span>
                        )}
                        {item.type === 'BREAKER_ON_BLOCKED' && (
                          <span className="label-mono text-[9px] px-2 py-0.2 rounded-full bg-amber-500 text-white font-bold">
                            SAFE BLOCKED
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 font-mono-space leading-relaxed">
                        {item.description}
                      </p>

                      {/* Telemetry Snapshot (for Auto Trip events) */}
                      {item.telemetrySnapshot && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1.5 text-[10px] font-mono-space text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 mt-1.5">
                          <div>
                            ⚡ V: <span className="font-bold text-[#2D2A26]">{item.telemetrySnapshot.voltage.toFixed(0)} V</span>
                          </div>
                          <div>
                            🔌 I: <span className="font-bold text-rose-600">{item.telemetrySnapshot.current.toFixed(1)} A</span>
                          </div>
                          <div>
                            🌡️ T: <span className="font-bold text-[#2D2A26]">{item.telemetrySnapshot.temperature.toFixed(1)} °C</span>
                          </div>
                          <div>
                            💧 H: <span className="font-bold text-[#2D2A26]">{item.telemetrySnapshot.humidity.toFixed(0)} %</span>
                          </div>
                          <div>
                            💨 Smoke: <span className="font-bold text-[#2D2A26]">{item.telemetrySnapshot.smokeAdc} ADC</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {!item.acknowledged && (
                    <button
                      onClick={() => onAcknowledge(item.id)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs shrink-0 transition"
                      title="รับทราบ"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
