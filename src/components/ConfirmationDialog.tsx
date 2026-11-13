import React from 'react';
import { AlertTriangle, Zap, RefreshCw, X, ShieldAlert } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  command: 'TRIP' | 'RESET' | null;
  activeFaults?: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  command,
  activeFaults = [],
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !command) return null;

  const isTrip = command === 'TRIP';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in safe-bottom"
    >
      <div className="w-full max-w-md rounded-3xl bg-white border border-[#2D2A26]/10 card-shadow-lg overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div
          className={`px-5 py-4 text-white flex items-center justify-between ${
            isTrip ? 'bg-[#FF5A5F]' : 'bg-[#4CAF50]'
          }`}
        >
          <div className="flex items-center gap-2 font-mono-space font-bold text-sm tracking-wide">
            {isTrip ? <Zap className="w-5 h-5 animate-pulse" /> : <RefreshCw className="w-5 h-5" />}
            <span>
              {isTrip
                ? 'ยืนยันสั่งตัดไฟฉุกเฉิน (TRIP BREAKER)'
                : 'ยืนยันสั่งเปิดเบรกเกอร์ (RESET BREAKER)'}
            </span>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-xl bg-black/20 hover:bg-black/30 text-white transition active:scale-95"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-2xl shrink-0 ${
                isTrip
                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}
            >
              {isTrip ? <AlertTriangle className="w-6 h-6" /> : <RefreshCw className="w-6 h-6" />}
            </div>

            <div className="space-y-1">
              <h4 className="text-base sm:text-lg font-bold text-[#2D2A26] font-mono-space">
                {isTrip
                  ? 'ต้องการตัดกระแสไฟฟ้าตู้ MDB ทันที?'
                  : 'ต้องการสั่งสับเปิดเบรกเกอร์จ่ายไฟกลับ?'}
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {isTrip
                  ? 'คำสั่ง TRIP จะปลดวงจรเมนเบรกเกอร์ทันที อุปกรณ์ไฟฟ้าทั้งหมดที่ต่อกับตู้ MDB จะหยุดทำงานเพื่อความปลอดภัย'
                  : 'คำสั่ง RESET จะขอต่อกระแสไฟ 220V กลับเข้าระบบ กรุณาตรวจสอบให้แน่ใจว่าอุปกรณ์และสายไฟอยู่ในสภาพปลอดภัย'}
              </p>
            </div>
          </div>

          {/* Fault warning if attempting reset with faults */}
          {!isTrip && activeFaults.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1 text-xs font-mono-space">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <ShieldAlert className="w-4 h-4" />
                <span>คำเตือน: ยังมีพารามิเตอร์ผิดปกติ</span>
              </div>
              <p className="text-[11px] text-amber-700">
                ขณะนี้มีข้อผิดพลาด: {activeFaults.join(', ')} ระบบจะไม่อนุญาตให้เปิดจ่ายไฟเพื่อความปลอดภัย (Anti-Auto-Reclose)
              </p>
            </div>
          )}

          {/* Action Buttons - minimum 48px height */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[48px] px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-[#2D2A26] font-mono-space font-bold text-xs sm:text-sm transition active:scale-98 flex items-center justify-center"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={onConfirm}
              className={`min-h-[48px] px-4 py-3 rounded-2xl text-white font-mono-space font-bold text-xs sm:text-sm transition active:scale-98 flex items-center justify-center gap-2 shadow-md ${
                isTrip
                  ? 'bg-[#FF5A5F] hover:bg-[#e0484d] glow-coral'
                  : 'bg-[#4CAF50] hover:bg-[#43a047]'
              }`}
            >
              {isTrip ? <Zap className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              <span>{isTrip ? 'ยืนยัน TRIP' : 'ยืนยัน RESET'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
