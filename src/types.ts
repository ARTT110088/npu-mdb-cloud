export type SystemStatus = 'NORMAL' | 'WARNING' | 'TRIPPED' | 'OFFLINE';
export type BreakerState = 'ON' | 'OFF' | 'TRIPPED' | 'OFFLINE' | 'UNKNOWN';

export interface TelemetryData {
  timestamp: number;
  voltage: number; // V
  current: number; // A
  temperature: number; // °C
  humidity: number; // %
  smokeDetected: boolean;
  smokeAdc?: number; // Raw ADC reading if provided by ESP32 analogRead
  smokePercent?: number;
  smokePpm?: number;
  emergency?: boolean;
  status: SystemStatus;
  statusMessage: string;
  // Backward compatibility fields for ESP32 firmware
  power?: number;
  powerFactor?: number;
  frequency?: number;
  shortCircuitDetected?: boolean;
  arcFaultDetected?: boolean;
  fireDetected?: boolean;
  overCurrentCountdown?: number;
  overCurrentDelayActive?: boolean;
}

export interface TelemetryHistoryPoint {
  time: string;
  current: number;
  temperature: number;
  humidity: number;
  smokeAdc: number;
  voltage?: number;
}

export interface Settings {
  currentLimit: number; // e.g. 5.0 A
  temperatureLimit: number; // e.g. 50.0 °C
  humidityLimit: number; // e.g. 80 %
  // Backward compatibility aliases
  maxCurrentLimit?: number;
  maxTempLimit?: number;
  maxHumidityLimit?: number;
  maxSmokePercentLimit?: number;
  maxSmokePpmLimit?: number;
  autoTripOnShortCircuit?: boolean;
  autoTripOnFire?: boolean;
  autoTripOnOvercurrent?: boolean;
  soundAlertEnabled?: boolean;
}

// Alias for backwards compatibility
export type SafetySettings = Settings;
export type SafetyStatus = SystemStatus;

export interface MDBBreakerState {
  mainBreaker: {
    state: BreakerState;
    online: boolean;
    trippedReason?: string;
    lastToggledAt: number;
    mode?: 'tuya' | 'mock';
    tuyaConfigured?: boolean;
    deviceId?: string;
    ratedAmps?: number;
    currentAmps?: number;
  };
}

export interface TelemetrySnapshot {
  voltage: number;
  current: number;
  temperature: number;
  humidity: number;
  smokeAdc: number;
  reason?: string;
  limit?: number | string;
}

export type AlertType =
  | 'OVERCURRENT'
  | 'HIGH_TEMPERATURE'
  | 'HIGH_HUMIDITY'
  | 'SMOKE_DETECTED'
  | 'MANUAL_OFF'
  | 'MANUAL_ON'
  | 'AUTO_TRIP'
  | 'SYSTEM_INFO'
  | 'BREAKER_MANUAL_ON'
  | 'BREAKER_MANUAL_OFF'
  | 'BREAKER_AUTO_TRIP'
  | 'BREAKER_ON_BLOCKED'
  | 'TUYA_DEVICE_OFFLINE'
  | 'TUYA_API_ERROR';

export interface AlertLog {
  id: string;
  timestamp: number;
  type: AlertType;
  severity: 'info' | 'warning' | 'danger' | 'critical';
  title: string;
  description: string;
  value?: string;
  acknowledged?: boolean;
  breakerTrippedAction?: boolean;
  telemetrySnapshot?: TelemetrySnapshot;
}

export interface ESP32Status {
  connected: boolean;
  signalCut?: boolean;
  lastHeartbeat: number;
  ipAddress: string;
  macAddress?: string;
  firmwareVersion?: string;
  wifiRssi?: number;
  deviceName?: string;
  wifiSsid?: string;
  freeHeap?: number;
  uptimeSeconds?: number;
  channel?: string;
  secretToken?: string;
}
