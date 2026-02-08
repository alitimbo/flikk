import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { Platform } from "react-native";
import { MMKVStorage } from "@/storage/mmkv";

import en from "./locales/en.json";
import fr from "./locales/fr.json";

const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const;

type StorageLike = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
};

const memoryStore = new Map<string, string>();

function createStorage(): StorageLike {
  if (Platform.OS === "web") {
    return {
      getString: (key) => memoryStore.get(key),
      set: (key, value) => memoryStore.set(key, value),
    };
  }
  return {
    getString: (key) => MMKVStorage.getItem(key) ?? undefined,
    set: (key, value) => MMKVStorage.setItem(key, value),
  };
}

const storage = createStorage();
const LANGUAGE_KEY = "flikk:language";

function getDeviceLanguage(): "fr" | "en" {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const language = locale.split(/[-_]/)[0];
    return language === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
}

function getStoredLanguage(): "fr" | "en" | null {
  const value = storage.getString(LANGUAGE_KEY);
  if (value === "fr" || value === "en") return value;
  return null;
}

// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources,
  lng: getStoredLanguage() ?? getDeviceLanguage(),
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: "fr" | "en") {
  storage.set(LANGUAGE_KEY, lang);
  // eslint-disable-next-line import/no-named-as-default-member
  return i18n.changeLanguage(lang);
}

export default i18n;
