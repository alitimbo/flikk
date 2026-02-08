import { createMMKV } from "react-native-mmkv";

export const storage = createMMKV({
  id: "flikk-storage",
});

export const MMKVStorage = {
  setItem: (key: string, value: string) => storage.set(key, value),
  getItem: (key: string) => storage.getString(key) ?? null,
  removeItem: (key: string) => storage.remove(key),
  clear: () => storage.clearAll(),
  getNumber: (key: string) => storage.getNumber(key),
  setNumber: (key: string, value: number) => storage.set(key, value),
};
