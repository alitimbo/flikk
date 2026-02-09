import { MMKVStorage } from "@/storage/mmkv";

const DEVICE_ID_KEY = "flikk:deviceId";

function generateDeviceId(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `dev_${stamp}_${rand}`;
}

export class DeviceService {
  static getDeviceId(): string {
    const existing = MMKVStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const deviceId = generateDeviceId();
    MMKVStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  }
}
