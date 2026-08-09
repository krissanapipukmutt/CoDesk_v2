import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

export type AppLanguage = "th" | "en";
export const languageStorageKey = "codesk.language";

function storedLanguage(): AppLanguage {
  if (typeof window === "undefined") return "th";
  const value = window.localStorage.getItem(languageStorageKey);
  return value === "en" || value === "th" ? value : "th";
}

function applyDocumentLanguage(language: string) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language === "en" ? "en" : "th";
    document.title = `${i18n.t("app.name")} · ${i18n.t("app.tagline")}`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", i18n.t("app.tagline"));
  }
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: storedLanguage(),
    fallbackLng: "th",
    supportedLngs: ["th", "en"],
    interpolation: { escapeValue: false },
  });
}

applyDocumentLanguage(i18n.resolvedLanguage ?? i18n.language);
i18n.on("languageChanged", applyDocumentLanguage);

export async function setLanguage(language: AppLanguage) {
  window.localStorage.setItem(languageStorageKey, language);
  await i18n.changeLanguage(language);
}

export default i18n;
