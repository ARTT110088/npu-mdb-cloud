import React from 'react';
import { LayoutDashboard, Bell, Power, Sliders, Cpu, PowerOff } from 'lucide-react';
import { ESP32Status, SystemStatus, MDBBreakerState } from '../types';

interface NavbarProps {
  status: SystemStatus;
  esp32Status: ESP32Status;
  breakerState: MDBBreakerState;
  activeTab: 'dashboard' | 'alerts' | 'control' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'alerts' | 'control' | 'settings') => void;
  onOpenESP32Modal: () => void;
  onToggleSignal: () => void;
  unreadAlertsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  status,
  esp32Status,
  breakerState,
  activeTab,
  setActiveTab,
  onOpenESP32Modal,
  onToggleSignal,
  unreadAlertsCount,
}) => {
  const isOnline = esp32Status.connected && !esp32Status.signalCut;
  const breakerStatus = breakerState.mainBreaker.state;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#2D2A26]/10 px-4 py-2.5 sm:px-6 card-shadow">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-baseline gap-1.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <h1 className="font-brand text-2xl sm:text-3xl text-[#FF5A5F] font-bold leading-none select-none tracking-tight">
              NPU.MDB
            </h1>
            <span className="text-[10px] font-mono-space font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 hidden xs:inline-block">
              ESP32
            </span>
          </div>

          {/* System Status Tag */}
          <span
            className={`label-mono text-[9px] px-2 py-0.5 rounded-full font-bold border hidden sm:flex items-center gap-1 ${
              status === 'TRIPPED'
                ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                : status === 'WARNING'
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : status === 'OFFLINE'
                ? 'bg-slate-100 text-slate-600 border-slate-300'
                : 'bg-emerald-100 text-emerald-700 border-emerald-300'
            }`}
          >
            ● {status}
          </span>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono-space font-bold transition ${
              activeTab === 'dashboard'
                ? 'bg-white text-[#2D2A26] card-shadow'
                : 'text-slate-600 hover:text-[#2D2A26]'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('control')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono-space font-bold transition ${
              activeTab === 'control'
                ? 'bg-white text-[#2D2A26] card-shadow'
                : 'text-slate-600 hover:text-[#2D2A26]'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>Control</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono-space font-bold transition relative ${
              activeTab === 'alerts'
                ? 'bg-white text-[#2D2A26] card-shadow'
                : 'text-slate-600 hover:text-[#2D2A26]'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Alerts</span>
            {unreadAlertsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#FF5A5F] animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono-space font-bold transition ${
              activeTab === 'settings'
                ? 'bg-white text-[#2D2A26] card-shadow'
                : 'text-slate-600 hover:text-[#2D2A26]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Right Badges & ESP32 Connect/Cut button */}
        <div className="flex items-center gap-2">
          {/* Signal Cut/Connect Button */}
          <button
            onClick={onToggleSignal}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-mono-space font-bold border transition ${
              esp32Status.signalCut
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border-slate-200 hover:border-rose-300'
            }`}
            title={esp32Status.signalCut ? 'ต่อสัญญาณ ESP32 อีกครั้ง' : 'ตัดสัญญาณ ESP32'}
          >
            {esp32Status.signalCut ? (
              <>
                <Power className="w-3 h-3 text-white" />
                <span className="hidden sm:inline">ต่อสัญญาณ</span>
              </>
            ) : (
              <>
                <PowerOff className="w-3 h-3 text-rose-500" />
                <span className="hidden sm:inline">ตัดสัญญาณ</span>
              </>
            )}
          </button>

          {/* ESP32 Status Pill */}
          <button
            onClick={onOpenESP32Modal}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono-space font-bold border transition card-shadow ${
              isOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-[#4CAF50] animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
