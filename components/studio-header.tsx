import Link from "next/link";
import styles from "./studio-header.module.css";

export function StudioHeader({ active }: { active: "transition" | "typography" }) {
  return <header className={styles.header}>
    <Link href="/" className={styles.brand}>The Weeknd Concert Transition</Link>
    <nav className={styles.switcher} aria-label="页面切换">
      <Link href="/" aria-current={active === "transition" ? "page" : undefined}>火焰转场</Link>
      <Link href="/typography" aria-current={active === "typography" ? "page" : undefined}>字体效果</Link>
    </nav>
  </header>;
}
