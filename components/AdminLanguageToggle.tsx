"use client";
import { Languages } from "lucide-react";

export function AdminLanguageToggle({ english, onSwitch }: { english: boolean; onSwitch: () => void }) {
  const label = english ? "Switch dashboard to Arabic" : "تغيير لغة لوحة الإدارة إلى الإنجليزية";
  return <button type="button" className="admin-secondary-button admin-language-toggle" onClick={onSwitch} aria-label={label} title={label}>
    <Languages size={16} aria-hidden="true" /><span lang={english ? "ar" : "en"}>{english ? "العربية" : "English"}</span>
  </button>;
}
