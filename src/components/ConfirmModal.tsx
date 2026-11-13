import React from 'react';
import { AlertTriangle, Power, Zap, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  action: 'ON' | 'OFF' | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  action,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen || !action) return null;

  const isTurningOn = action === 'ON';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-white border border-[#2D2A26]/10 card-shadow-lg p-5 sm:p-6 space-y-4">
        {/* Header Icon */}
        <div className="flex items-center justify-between">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isTurningOn
                ? 'bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/30'
                : 'bg-[#FF5A5F]/15 text-[#FF5A5F] border border-[#FF5A5F]/30'
            }`}
          >
            {isTurningOn ? <Power className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-2 rounded-xl text-slate-400 hover:text-[#2D2A26] hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Text */}
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-[#2D2A26] font-mono-space">
            {isTurningOn ? 'ยืนยันการเปิดไฟ (Breaker ON)?' : 'ยืนยันการตัดไฟ (Breaker OFF)?'}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            {isTurningOn
              ? 'ระบบจะตรวจสอบว่าไม่มีค่าเซนเซอร์ที่ผิดปกติก่อนสั่งเปิดสวิตช์เบรกเกอร์เมนจ่ายไฟเข้าบ้าน'
              : 'เบรกเกอร์เมนจะถูกสั่งปลดวงจรทันที และกระแสไฟฟ้าในบ้านจะหยุดจ่าย'}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#2D2A26] text-xs font-bold font-mono-space transition min-h-[46px]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-3 px-4 rounded-xl text-white text-xs font-bold font-mono-space card-shadow transition active:scale-95 min-h-[46px] flex items-center justify-center gap-1.5 ${
              isTurningOn
                ? 'bg-[#4CAF50] hover:bg-[#43a047]'
                : 'bg-[#FF5A5F] hover:bg-[#e0484d]'
            }`}
          >
            {isLoading ? (
              <span>กำลังดำเนินการ...</span>
            ) : isTurningOn ? (
              <span>ยืนยันเปิดไฟ</span>
            ) : (
              <span>ยืนยันตัดไฟ</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
