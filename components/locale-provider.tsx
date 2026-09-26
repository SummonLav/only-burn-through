"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { english } from "@/lib/translations";

type Locale = "en" | "zh-CN";
type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const storageKey = "only-burn-through-language";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>("en");

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "zh-CN") updateLocale("zh-CN");
    } catch { /* Language switching still works when storage is unavailable. */ }
  }, []);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const setLocale = (next: Locale) => {
    updateLocale(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Optional persistence. */ }
  };
  const t = (text: string) => {
    if (locale === "zh-CN") return text;
    if (english[text]) return english[text];
    // Renderer errors may include a browser-provided diagnostic after the prefix.
    const prefix = Object.keys(english).find(key => key.endsWith("：") && text.startsWith(key));
    return prefix ? english[prefix] + text.slice(prefix.length) : text;
  };

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale requires LocaleProvider");
  return value;
}
