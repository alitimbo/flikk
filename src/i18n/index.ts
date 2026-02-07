import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import fr from "./locales/fr.json";

const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const;

function getDeviceLanguage(): "fr" | "en" {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const language = locale.split(/[-_]/)[0];
    return language === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
}

void i18next.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

export default i18next;
