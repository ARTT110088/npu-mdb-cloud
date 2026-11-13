import { TuyaClient } from './tuya.js';

export type BreakerState = 'ON' | 'OFF' | 'TRIPPED' | 'OFFLINE' | 'UNKNOWN';

export interface BreakerStatus {
  state: BreakerState;
  online: boolean;
  trippedReason: string;
  lastToggledAt: number;
  mode: 'tuya' | 'mock';
  tuyaConfigured: boolean;
  deviceId?: string;
}

export interface BreakerAdapter {
  getState(): Promise<BreakerStatus>;
  turnOn(): Promise<{ success: boolean; state: BreakerState; message: string; error?: string }>;
  turnOff(reason?: string): Promise<{ success: boolean; state: BreakerState; message: string; error?: string }>;
  trip(reason: string): Promise<{ success: boolean; state: BreakerState; reason: string; error?: string }>;
  reset(): Promise<{ success: boolean; state: BreakerState; message: string }>;
  getTuyaClient?(): TuyaClient;
}

/**
 * MockBreakerAdapter:
 * Used for development / simulation when Tuya credentials are not yet configured.
 */
export class MockBreakerAdapter implements BreakerAdapter {
  private state: BreakerState = 'ON';
  private trippedReason: string = '';
  private lastToggledAt: number = Date.now();
  private mode: 'mock' = 'mock';

  constructor(initialState: BreakerState = 'ON') {
    this.state = initialState;
  }

  async getState(): Promise<BreakerStatus> {
    return {
      state: this.state,
      online: true,
      trippedReason: this.trippedReason,
      lastToggledAt: this.lastToggledAt,
      mode: this.mode,
      tuyaConfigured: false,
    };
  }

  async turnOn(): Promise<{ success: boolean; state: BreakerState; message: string }> {
    this.state = 'ON';
    this.trippedReason = '';
    this.lastToggledAt = Date.now();
    return {
      success: true,
      state: this.state,
      message: 'เปิดเบรกเกอร์สำเร็จ (Breaker ON - Mock)',
    };
  }

  async turnOff(reason: string = 'ผู้ใช้สั่งตัดไฟ'): Promise<{ success: boolean; state: BreakerState; message: string }> {
    this.state = 'OFF';
    this.trippedReason = reason;
    this.lastToggledAt = Date.now();
    return {
      success: true,
      state: this.state,
      message: 'ตัดไฟสำเร็จ (Breaker OFF - Mock)',
    };
  }

  async trip(reason: string): Promise<{ success: boolean; state: BreakerState; reason: string }> {
    this.state = 'TRIPPED';
    this.trippedReason = reason;
    this.lastToggledAt = Date.now();
    return {
      success: true,
      state: this.state,
      reason: this.trippedReason,
    };
  }

  async reset(): Promise<{ success: boolean; state: BreakerState; message: string }> {
    this.state = 'OFF';
    this.trippedReason = '';
    this.lastToggledAt = Date.now();
    return {
      success: true,
      state: this.state,
      message: 'รีเซ็ตสถานะเบรกเกอร์เป็น OFF พร้อมเปิดใช้งาน',
    };
  }
}

/**
 * TuyaBreakerAdapter:
 * Communicates with real Tuya Smart Wi-Fi Breaker through Tuya Cloud OpenAPI.
 * Authoritative on Safety Trip: If tripped by sensor fault, state stays TRIPPED
 * until user explicitly and safely commands turnOn().
 */
export class TuyaBreakerAdapter implements BreakerAdapter {
  private tuyaClient: TuyaClient;
  private isTripped: boolean = false;
  private trippedReason: string = '';
  private lastToggledAt: number = Date.now();
  private cachedState: BreakerState = 'ON';
  private cachedOnline: boolean = true;
  private lastStatusFetchTime: number = 0;

  constructor(tuyaClient: TuyaClient) {
    this.tuyaClient = tuyaClient;
  }

  getTuyaClient(): TuyaClient {
    return this.tuyaClient;
  }

  async getState(): Promise<BreakerStatus> {
    const isConfigured = this.tuyaClient.isConfigured();
    const now = Date.now();

    // Cache status query for 2.5s to avoid hitting Tuya Cloud rate limits
    if (isConfigured && now - this.lastStatusFetchTime > 2500) {
      this.lastStatusFetchTime = now;
      try {
        const status = await this.tuyaClient.getDeviceStatus();
        this.cachedOnline = status.online;
        if (!status.online) {
          this.cachedState = 'OFFLINE';
        } else if (status.state === 'ON' || status.state === 'OFF') {
          this.cachedState = status.state;
        } else {
          this.cachedState = 'UNKNOWN';
        }
      } catch (err) {
        console.error('[TuyaBreakerAdapter] Error refreshing device status:', err);
        this.cachedState = 'UNKNOWN';
      }
    }

    // Safety Trip overrides physical ON status:
    const currentState = this.isTripped ? 'TRIPPED' : this.cachedState;

    return {
      state: currentState,
      online: isConfigured ? this.cachedOnline : true,
      trippedReason: this.trippedReason,
      lastToggledAt: this.lastToggledAt,
      mode: isConfigured ? 'tuya' : 'mock',
      tuyaConfigured: isConfigured,
      deviceId: this.tuyaClient.getMaskedDeviceId(),
    };
  }

  async turnOn(): Promise<{ success: boolean; state: BreakerState; message: string; error?: string }> {
    const isConfigured = this.tuyaClient.isConfigured();

    if (isConfigured) {
      const res = await this.tuyaClient.setSwitch(true);
      if (!res.success) {
        return {
          success: false,
          state: this.isTripped ? 'TRIPPED' : this.cachedState,
          message: res.message,
          error: res.message,
        };
      }
    }

    this.isTripped = false;
    this.trippedReason = '';
    this.cachedState = 'ON';
    this.lastToggledAt = Date.now();

    return {
      success: true,
      state: 'ON',
      message: 'เปิดเบรกเกอร์สำเร็จ (Breaker ON)',
    };
  }

  async turnOff(reason: string = 'ผู้ใช้สั่งตัดไฟ'): Promise<{ success: boolean; state: BreakerState; message: string; error?: string }> {
    const isConfigured = this.tuyaClient.isConfigured();

    if (isConfigured) {
      const res = await this.tuyaClient.setSwitch(false);
      if (!res.success) {
        console.warn('[TuyaBreakerAdapter] Turn OFF command returned warning:', res.message);
      }
    }

    this.isTripped = false;
    this.trippedReason = reason;
    this.cachedState = 'OFF';
    this.lastToggledAt = Date.now();

    return {
      success: true,
      state: 'OFF',
      message: 'ตัดไฟสำเร็จ (Breaker OFF)',
    };
  }

  async trip(reason: string): Promise<{ success: boolean; state: BreakerState; reason: string; error?: string }> {
    this.isTripped = true;
    this.trippedReason = reason;
    this.cachedState = 'TRIPPED';
    this.lastToggledAt = Date.now();

    const isConfigured = this.tuyaClient.isConfigured();
    let tuyaError: string | undefined;

    if (isConfigured) {
      const res = await this.tuyaClient.setSwitch(false);
      if (!res.success) {
        tuyaError = res.message;
        console.error('[TuyaBreakerAdapter] Auto-trip switch OFF failed:', res.message);
      }
    }

    return {
      success: true,
      state: 'TRIPPED',
      reason: this.trippedReason,
      error: tuyaError,
    };
  }

  async reset(): Promise<{ success: boolean; state: BreakerState; message: string }> {
    this.isTripped = false;
    this.trippedReason = '';
    this.cachedState = 'OFF';
    this.lastToggledAt = Date.now();

    return {
      success: true,
      state: 'OFF',
      message: 'รีเซ็ตสถานะเบรกเกอร์เป็น OFF พร้อมเปิดใช้งาน',
    };
  }
}

/**
 * Factory to create Breaker Adapter
 */
export function createBreakerAdapter(): BreakerAdapter {
  const tuyaConfig = {
    baseUrl: process.env.TUYA_BASE_URL || 'https://openapi-sg.iotbing.com',
    accessId: process.env.TUYA_ACCESS_ID || '',
    accessSecret: process.env.TUYA_ACCESS_SECRET || '',
    deviceId: process.env.TUYA_DEVICE_ID || '',
    switchCode: process.env.TUYA_SWITCH_CODE || 'switch',
  };

  const tuyaClient = new TuyaClient(tuyaConfig);

  // If Tuya is configured, or if BREAKER_MODE !== 'mock', use TuyaBreakerAdapter
  if (tuyaClient.isConfigured() || process.env.BREAKER_MODE === 'tuya') {
    return new TuyaBreakerAdapter(tuyaClient);
  }

  // Fallback to MockBreakerAdapter if credentials not yet configured
  return new MockBreakerAdapter('ON');
}
