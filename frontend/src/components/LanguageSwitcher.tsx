import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setLanguage, type AppLanguage } from "../i18n";
import { cn } from "../utils/cn";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current: AppLanguage = i18n.resolvedLanguage === "en" ? "en" : "th";
  return (
    <div
      role="group"
      aria-label={t("language.switcherLabel")}
      className="inline-flex items-center gap-1 rounded-lg border border-[#d0d5dd] bg-white p-1 text-xs font-semibold shadow-sm"
    >
      <Languages aria-hidden="true" size={15} className="mx-1 text-[#667085]" />
      {(["th", "en"] as const).map((language) => (
        <button
          key={language}
          type="button"
          aria-pressed={current === language}
          onClick={() => void setLanguage(language)}
          className={cn(
            "rounded-md px-2 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3157d5]",
            current === language ? "bg-[#3157d5] text-white" : "text-[#475467] hover:bg-[#f2f4f7]",
          )}
        >
          {t(language === "th" ? "language.thai" : "language.english")}
        </button>
      ))}
    </div>
  );
}
