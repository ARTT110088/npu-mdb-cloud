import crypto from 'crypto';

export interface TuyaConfig {
  baseUrl: string;
  accessId: string;
  accessSecret: string;
  deviceId: string;
  switchCode?: string;
}

export interface TuyaDeviceStatusResult {
  online: boolean;
  state: 'ON' | 'OFF' | 'UNKNOWN' | 'OFFLINE';
  error?: string;
  rawStatus?: any;
}

export class TuyaClient {
  private baseUrl: string;
  private accessId: string;
  private accessSecret: string;
  private deviceId: string;
  private switchCode: string;

  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: TuyaConfig) {
    this.baseUrl = (config.baseUrl || 'https://openapi-sg.iotbing.com').replace(/\/+$/, '');
    this.accessId = (config.accessId || '').trim();
    this.accessSecret = (config.accessSecret || '').trim();
    this.deviceId = (config.deviceId || '').trim();
    this.switchCode = (config.switchCode || 'switch').trim();
  }

  public isConfigured(): boolean {
    return Boolean(
      this.accessId &&
      this.accessId !== 'YOUR_ACCESS_ID' &&
      this.accessSecret &&
      this.accessSecret !== 'YOUR_ACCESS_SECRET' &&
      this.deviceId &&
      this.deviceId !== 'YOUR_DEVICE_ID'
    );
  }

  public getMaskedDeviceId(): string {
    if (!this.deviceId || this.deviceId === 'YOUR_DEVICE_ID') return 'Not Configured';
    if (this.deviceId.length <= 6) return '***' + this.deviceId;
    return this.deviceId.substring(0, 3) + '***' + this.deviceId.substring(this.deviceId.length - 4);
  }

  private generateSignature(
    method: string,
    pathAndQuery: string,
    bodyStr: string,
    t: string,
    accessToken: string = ''
  ): string {
    const contentHash = crypto.createHash('sha256').update(bodyStr, 'utf8').digest('hex');
    const stringToSign = [method.toUpperCase(), contentHash, '', pathAndQuery].join('\n');
    const signSource = accessToken
      ? this.accessId + accessToken + t + stringToSign
      : this.accessId + t + stringToSign;

    return crypto
      .createHmac('sha256', this.accessSecret)
      .update(signSource, 'utf8')
      .digest('hex')
      .toUpperCase();
  }

  private async safeFetch(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  public async getAccessToken(forceRefresh = false): Promise<string | null> {
    if (!this.isConfigured()) return null;

    const now = Date.now();
    if (!forceRefresh && this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    try {
      const path = '/v1.0/token?grant_type=1';
      const t = now.toString();
      const sign = this.generateSignature('GET', path, '', t, '');

      const response = await this.safeFetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          client_id: this.accessId,
          sign: sign,
          t: t,
          sign_method: 'HMAC-SHA256',
        },
      });

      if (!response.ok) return null;

      const data: any = await response.json();
      if (data && data.success && data.result?.access_token) {
        this.cachedToken = data.result.access_token;
        this.tokenExpiresAt = now + (data.result.expire_time || 7200) * 1000;
        return this.cachedToken;
      }
      return null;
    } catch (err) {
      console.error('[TuyaClient] Token request failed:', err);
      return null;
    }
  }

  public async getDeviceStatus(): Promise<TuyaDeviceStatusResult> {
    if (!this.isConfigured()) {
      return { online: true, state: 'UNKNOWN', error: 'Mock Mode' };
    }

    const token = await this.getAccessToken();
    if (!token) {
      return { online: false, state: 'OFFLINE', error: 'No access token' };
    }

    try {
      const path = `/v1.0/devices/${this.deviceId}`;
      const t = Date.now().toString();
      const sign = this.generateSignature('GET', path, '', t, token);

      const response = await this.safeFetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          client_id: this.accessId,
          access_token: token,
          sign: sign,
          t: t,
          sign_method: 'HMAC-SHA256',
        },
      });

      if (!response.ok) {
        if (response.status === 401) this.cachedToken = null;
        return { online: false, state: 'UNKNOWN', error: `HTTP ${response.status}` };
      }

      const data: any = await response.json();
      if (!data.success) return { online: false, state: 'UNKNOWN', error: data.msg };

      const result = data.result || {};
      const isOnline = Boolean(result.online);
      const statusList = result.status || [];

      if (!isOnline) {
        return { online: false, state: 'OFFLINE', error: 'Device offline' };
      }

      const switchItem = statusList.find(
        (item: any) =>
          item.code === this.switchCode ||
          item.code === 'switch' ||
          item.code === 'switch_1'
      );

      let state: 'ON' | 'OFF' | 'UNKNOWN' = 'UNKNOWN';
      if (switchItem && typeof switchItem.value === 'boolean') {
        state = switchItem.value ? 'ON' : 'OFF';
      }

      return { online: true, state, rawStatus: statusList };
    } catch (err: any) {
      return { online: false, state: 'UNKNOWN', error: err?.message };
    }
  }

  public async setSwitch(on: boolean): Promise<{ success: boolean; message: string; raw?: any }> {
    if (!this.isConfigured()) {
      return { success: true, message: `[Mock] Switched to ${on ? 'ON' : 'OFF'}` };
    }

    const token = await this.getAccessToken();
    if (!token) {
      return { success: false, message: 'ไม่สามารถติดต่อ Tuya Cloud: ไม่ได้รับ Access Token' };
    }

    try {
      const path = `/v1.0/devices/${this.deviceId}/commands`;
      const body = {
        commands: [
          {
            code: this.switchCode,
            value: on,
          },
        ],
      };
      const bodyStr = JSON.stringify(body);
      const t = Date.now().toString();
      const sign = this.generateSignature('POST', path, bodyStr, t, token);

      const response = await this.safeFetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          client_id: this.accessId,
          access_token: token,
          sign: sign,
          t: t,
          sign_method: 'HMAC-SHA256',
          'Content-Type': 'application/json',
        },
        body: bodyStr,
      });

      if (!response.ok) {
        if (response.status === 401) this.cachedToken = null;
        return { success: false, message: `Tuya API HTTP ${response.status}` };
      }

      const data: any = await response.json();
      if (data && data.success) {
        return { success: true, message: `สั่งการ Tuya สำเร็จ (${on ? 'ON' : 'OFF'})`, raw: data };
      } else {
        return { success: false, message: data?.msg || 'Tuya API Error', raw: data };
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Exception in setSwitch' };
    }
  }
}