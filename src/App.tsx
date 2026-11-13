import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Bell, Power, Sliders, AlertTriangle } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { DashboardTab } from './components/DashboardTab';
import { ControlTab } from './components/ControlTab';
import { AlertsTab } from './components/AlertsTab';
import { SettingsTab } from './components/SettingsTab';
import { ConfirmModal } from './components/ConfirmModal';
import { ESP32SetupModal } from './components/ESP32SetupModal';
import { TelemetryData, MDBBreakerState, Settings, AlertLog, ESP32Status, TelemetryHistoryPoint } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alerts' | 'control' | 'settings'>('dashboard');
  const [showESP32Modal, setShowESP32Modal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'ON' | 'OFF' | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>([]);

  // Core Real Data State
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    timestamp: 0,
    voltage: 0,
    current: 0,
    temperature: 0,
    humidity: 0,
    smokeDetected: false,
    smokeAdc: 0,
    status: 'OFFLINE',
    statusMessage: 'กำลังรอการเชื่อมต่อและส่งสัญญาณจากบอร์ด ESP32 ผ่าน IP...',
  });

  const [breakerState, setBreakerState] = useState<MDBBreakerState>({
    mainBreaker: {
      state: 'ON',
      trippedReason: '',
      lastToggledAt: Date.now(),
      mode: 'mock',
    },
  });

  const [settings, setSettings] = useState<Settings>({
    currentLimit: 5.0,
    temperatureLimit: 50.0,
    humidityLimit: 80.0,
  });

  const [alerts, setAlerts] = useState<AlertLog[]>([]);

  const [esp32Status, setEsp32Status] = useState<ESP32Status>({
    connected: false,
    signalCut: false,
    lastHeartbeat: 0,
    ipAddress: '',
    macAddress: '24:6F:28:A1:C8:94',
    firmwareVersion: 'NPU-ESP32-v2.2.0',
    wifiRssi: 0,
  });

  // Normalize & Map Incoming Telemetry Keys (รองรับทั้งรูปแบบ nested และ flat JSON)
  const normalizeTelemetryPayload = (raw: any): TelemetryData | null => {
    if (!raw || typeof raw !== 'object') return null;
    const src = raw.current && typeof raw.current === 'object' ? raw.current : raw;

    const voltage = Number(src.voltage ?? src.volt ?? src.v ?? 0);
    const current = Number(src.current ?? src.amp ?? src.amps ?? src.i ?? 0);
    const temperature = Number(src.temperature ?? src.temp ?? src.t ?? 0);
    const humidity = Number(src.humidity ?? src.hum ?? src.h ?? 0);
    const smokeAdc = Number(src.smokeAdc ?? src.smoke_adc ?? src.smoke ?? src.mq2 ?? 0);
    const smokeDetected = Boolean(src.smokeDetected ?? src.smoke_detected ?? smokeAdc >= 80);

    // ถ้ามีค่าใดค่าหนึ่งส่งมา แต่ timestamp เป็น 0 ให้สร้าง timestamp ปัจจุบันให้ทันทีเพื่อให้หน้าเว็บอัปเดต
    const hasValues = voltage > 0 || current > 0 || temperature > 0 || humidity > 0 || smokeAdc > 0;
    const timestamp = Number(src.timestamp) > 0 ? Number(src.timestamp) : hasValues ? Date.now() : 0;

    return {
      ...src,
      timestamp,
      voltage,
      current,
      temperature,
      humidity,
      smokeAdc,
      smokeDetected,
      status: src.status || (timestamp > 0 ? 'NORMAL' : 'OFFLINE'),
      statusMessage: src.statusMessage || (timestamp > 0 ? 'รับข้อมูลจากระบบเรียบร้อย' : 'รอข้อมูลจาก ESP32'),
    };
  };

  // Inject Local Telemetry (ใช้เมื่อกดทดสอบเชื่อมต่อ หรืออัปเดตค่าทันทีบนหน้าเว็บ)
  const handleInjectLocalTelemetry = useCallback((partial: Partial<TelemetryData>) => {
    const now = Date.now();
    const timeLabel = new Date(now).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setTelemetry((prev) => {
      const next: TelemetryData = {
        ...prev,
        ...partial,
        timestamp: now,
        voltage: Number(partial.voltage ?? prev.voltage ?? 228.6),
        current: Number(partial.current ?? prev.current ?? 0),
        temperature: Number(partial.temperature ?? prev.temperature ?? 0),
        humidity: Number(partial.humidity ?? prev.humidity ?? 0),
        smokeAdc: Number(partial.smokeAdc ?? prev.smokeAdc ?? 0),
        smokeDetected: Boolean(partial.smokeDetected ?? (Number(partial.smokeAdc ?? 0) >= 80)),
        status: 'NORMAL',
        statusMessage: 'รับสัญญาณทดสอบสำเร็จ',
      };

      setHistory((prevHist) => {
        const nextPoint: any = {
          time: timeLabel,
          current: next.current,
          temperature: next.temperature,
          humidity: next.humidity,
          smokeAdc: next.smokeAdc ?? 0,
        };
        return [...prevHist.slice(-19), nextPoint];
      });

      return next;
    });

    setEsp32Status((prev) => ({
      ...prev,
      connected: true,
      signalCut: false,
      lastHeartbeat: now,
      ipAddress: (partial as any).ip || prev.ipAddress || '192.168.1.105',
      wifiRssi: (partial as any).rssi || prev.wifiRssi || -55,
    }));
  }, []);

  // Fetch Telemetry & Settings
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeTelemetryPayload(data);
        if (normalized) {
          setTelemetry(normalized);

          // หาก Server ไม่ได้ส่ง history array มา แต่มีค่า telemetry สด ให้สะสมจุดกราฟฝั่งหน้าเว็บให้อัตโนมัติ
          if ((!Array.isArray(data.history) || data.history.length === 0) && normalized.timestamp > 0) {
            const timeLabel = new Date(normalized.timestamp).toLocaleTimeString('th-TH', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            setHistory((prev) => {
              if (prev.length > 0 && prev[prev.length - 1].time === timeLabel) return prev;
              const newPoint: any = {
                time: timeLabel,
                current: normalized.current,
                temperature: normalized.temperature,
                humidity: normalized.humidity,
                smokeAdc: normalized.smokeAdc ?? 0,
              };
              return [...prev.slice(-19), newPoint];
            });
          }
        }

        if (data.breakerState) setBreakerState(data.breakerState);
        if (data.esp32Status) {
          setEsp32Status((prev) => ({
            ...prev,
            ...data.esp32Status,
            // ซิงก์สถานะ connected ให้ตรงกับ timestamp ล่าสุดเสมอ
            connected:
              Boolean(data.esp32Status.connected || (normalized && normalized.timestamp > 0)) &&
              !data.esp32Status.signalCut,
          }));
        }
        if (data.settings) setSettings(data.settings);
        if (Array.isArray(data.history) && data.history.length > 0) {
          setHistory(data.history);
        }
      }
    } catch {
      // ignore network error during polling
    }
  }, []);

  // Fetch Alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAlerts(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    fetchAlerts();
    const interval = setInterval(() => {
      fetchTelemetry();
      fetchAlerts();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchTelemetry, fetchAlerts]);

  // Breaker Action Trigger (Opens Confirmation Modal)
  const handleRequestBreakerAction = (action: 'ON' | 'OFF') => {
    setErrorMessage(null);
    setConfirmAction(action);
  };

  // Breaker Action Execution after Confirmation
  const handleConfirmBreakerAction = async () => {
    if (!confirmAction) return;
    setIsActionLoading(true);
    setErrorMessage(null);

    const endpoint = confirmAction === 'ON' ? '/api/breaker/on' : '/api/breaker/off';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'ผู้ใช้สั่งงานผ่านหน้าเว็บ' }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.activeFaults && data.activeFaults.length > 0) {
          setErrorMessage(`ไม่สามารถเปิดเบรกเกอร์ได้ (Safe ON Protection): ${data.activeFaults.join(', ')}`);
        } else {
          setErrorMessage(data.message || 'ไม่สามารถสั่งการเบรกเกอร์ได้');
        }
      } else {
        if (data.breakerState) {
          setBreakerState(data.breakerState);
        }
        await fetchTelemetry();
        await fetchAlerts();
      }
    } catch {
      setErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsActionLoading(false);
      setConfirmAction(null);
    }
  };

  // Toggle ESP32 Signal (Cut / Connect)
  const handleToggleSignal = async () => {
    try {
      const res = await fetch('/api/esp32/toggle-signal', { method: 'POST' });
      if (res.ok) {
        await fetchTelemetry();
      }
    } catch {
      // ignore
    }
  };

  // Save Settings (Persistent in settings.json)
  const handleSaveSettings = async (newSettings: Settings) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      const normalized = normalizeTelemetryPayload(data.telemetry);
      if (normalized) setTelemetry(normalized);
      if (data.breakerState) setBreakerState(data.breakerState);
      await fetchTelemetry();
      await fetchAlerts();
    }
  };

  // Alert Handlers
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const res = await fetch('/api/alerts/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.alerts) setAlerts(data.alerts);
      }
    } catch {
      // ignore
    }
  };

  const handleClearAlerts = async () => {
    try {
      const res = await fetch('/api/alerts/clear', { method: 'POST' });
      if (res.ok) {
        setAlerts([]);
      }
    } catch {
      // ignore
    }
  };

  const unreadAlertsCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="min-h-screen bg-[#F4F3F0] text-[#2D2A26] flex flex-col overflow-x-hidden selection:bg-[#FF5A5F]/20 selection:text-[#FF5A5F]">
      {/* Top Navbar */}
      <Navbar
        status={telemetry.status}
        esp32Status={esp32Status}
        breakerState={breakerState}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenESP32Modal={() => setShowESP32Modal(true)}
        onToggleSignal={handleToggleSignal}
        unreadAlertsCount={unreadAlertsCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-3.5 sm:p-6 pb-24 md:pb-8 space-y-4">
        {/* Active Fault Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs sm:text-sm font-mono-space flex items-center justify-between gap-3 animate-fade-in card-shadow">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-800 text-xs font-bold font-mono-space px-2 py-1 rounded"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Tab 1: Dashboard */}
        {activeTab === 'dashboard' && (
          <DashboardTab
            telemetry={telemetry}
            breakerState={breakerState}
            settings={settings}
            esp32Status={esp32Status}
            history={history}
            onRequestBreakerAction={handleRequestBreakerAction}
            onOpenESP32Modal={() => setShowESP32Modal(true)}
          />
        )}

        {/* Tab 2: Control */}
        {activeTab === 'control' && (
          <ControlTab
            telemetry={telemetry}
            breakerState={breakerState}
            settings={settings}
            onRequestBreakerAction={handleRequestBreakerAction}
            errorMessage={errorMessage}
            isLoading={isActionLoading}
          />
        )}

        {/* Tab 3: Alerts */}
        {activeTab === 'alerts' && (
          <AlertsTab
            alerts={alerts}
            onAcknowledge={handleAcknowledgeAlert}
            onClearAll={handleClearAlerts}
          />
        )}

        {/* Tab 4: Settings */}
        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            telemetry={telemetry}
            onSave={handleSaveSettings}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#2D2A26]/10 px-2 py-1.5 flex items-center justify-around card-shadow shadow-lg">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === 'dashboard'
              ? 'text-[#FF5A5F] font-bold'
              : 'text-slate-500 hover:text-[#2D2A26]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-mono-space leading-tight">Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('control')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === 'control'
              ? 'text-[#FF5A5F] font-bold'
              : 'text-slate-500 hover:text-[#2D2A26]'
          }`}
        >
          <Power className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-mono-space leading-tight">Control</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('alerts')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition min-h-[48px] relative ${
            activeTab === 'alerts'
              ? 'text-[#FF5A5F] font-bold'
              : 'text-slate-500 hover:text-[#2D2A26]'
          }`}
        >
          <div className="relative">
            <Bell className="w-5 h-5 mb-0.5" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FF5A5F] animate-pulse" />
            )}
          </div>
          <span className="text-[10px] font-mono-space leading-tight">Alerts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === 'settings'
              ? 'text-[#FF5A5F] font-bold'
              : 'text-slate-500 hover:text-[#2D2A26]'
          }`}
        >
          <Sliders className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-mono-space leading-tight">Settings</span>
        </button>
      </nav>

      {/* Confirmation Modal before ON/OFF */}
      <ConfirmModal
        isOpen={confirmAction !== null}
        action={confirmAction}
        onConfirm={handleConfirmBreakerAction}
        onCancel={() => setConfirmAction(null)}
        isLoading={isActionLoading}
      />

      {/* ESP32 Hardware Info Modal */}
      {showESP32Modal && (
        <ESP32SetupModal
          esp32Status={esp32Status}
          telemetry={telemetry}
          onRefreshTelemetry={fetchTelemetry}
          onInjectLocalTelemetry={handleInjectLocalTelemetry}
          onClose={() => setShowESP32Modal(false)}
        />
      )}
    </div>
  );
}
