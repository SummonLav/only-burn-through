"use client";

import Link from "next/link";
import { useLocale } from "./locale-provider";
import styles from "./studio-header.module.css";

export function StudioHeader({ active }: { active: "transition" | "typography" | "opening" }) {
  const { locale, setLocale, t } = useLocale();
  return <header className={styles.header}>
    <Link href="/" className={styles.brand}>Only Burn Through</Link>
    <nav className={styles.switcher} aria-label={t("页面切换")}>
      <Link href="/" aria-current={active === "transition" ? "page" : undefined}>{t("火焰转场")}</Link>
      <Link href="/typography" aria-current={active === "typography" ? "page" : undefined}>{t("字体效果")}</Link>
      <Link href="/opening" aria-current={active === "opening" ? "page" : undefined}>{t("字焰开场")}</Link>
    </nav>
    <div className={styles.languages} role="group" aria-label={t("语言")}>
      <button lang="en" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
      <button lang="zh-CN" aria-pressed={locale === "zh-CN"} onClick={() => setLocale("zh-CN")}>中文</button>
    </div>
  </header>;
}
