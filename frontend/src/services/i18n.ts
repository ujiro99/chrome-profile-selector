import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { Config } from "./config";
import en from "../locales/en.json";
import ja from "../locales/ja.json";

const STORAGE_KEY = "my_lang";

const resources = {
  en: { translation: en },
  ja: { translation: ja },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    detection: {
      lookupCookie: STORAGE_KEY,
      lookupLocalStorage: STORAGE_KEY,
      lookupSessionStorage: STORAGE_KEY,
    },
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

Config.getInstance().addChangeListener((conf) => {
  if (conf.language) {
    i18n.changeLanguage(conf.language, (err) => {
      if (err) return console.log("something went wrong loading", err);
    });
  }
});

export default i18n;
