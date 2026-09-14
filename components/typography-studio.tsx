"use client";

import { useRef, useState, type CSSProperties } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { defaultTitleSettings, DistressedTitleRenderer, TITLE_DURATION, type TitleSettings } from "@/lib/distressed-title-renderer";
import { StudioHeader } from "./studio-header";
import styles from "./typography-studio.module.css";

gsap.registerPlugin(useGSAP);

function Parameter({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) {
  return <label className={styles.parameter}>
    <span><span>{label}</span><output>{display}</output></span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value} style={{ "--fill": `${(value - min) / (max - min) * 100}%` } as CSSProperties} onChange={event => onChange(Number(event.target.value))} />
  </label>;
}

export function TypographyStudio() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<DistressedTitleRenderer | null>(null);
  const tween = useRef<gsap.core.Tween | null>(null);
  const clock = useRef({ time: 0 });
  const values = useRef(defaultTitleSettings);
  const playingRef = useRef(false);
  const [settings, setSettings] = useState(defaultTitleSettings);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [background, setBackground] = useState("black");
  const [reference, setReference] = useState(false);

  const draw = () => renderer.current?.render(clock.current.time, values.current);
  useGSAP(() => {
    const element = canvas.current;
    if (!element) return;
    let instance: DistressedTitleRenderer;
    try { instance = new DistressedTitleRenderer(element); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "字幕预览启动失败。"); return; }
    renderer.current = instance;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      instance.resize(rect.width * ratio, rect.height * ratio);
      instance.render(clock.current.time, values.current);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element); resize(); setReady(true);
    let lastUpdate = 0;
    const animation = gsap.to(clock.current, {
      time: TITLE_DURATION, duration: TITLE_DURATION, ease: "none", repeat: -1, paused: true,
      onUpdate: () => {
        instance.render(clock.current.time, values.current);
        if (performance.now() - lastUpdate > 90) { setTime(clock.current.time); lastUpdate = performance.now(); }
      },
    });
    tween.current = animation;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotionPreference = () => {
      playingRef.current = !motion.matches;
      setPlaying(playingRef.current);
      animation.paused(!playingRef.current || document.hidden);
    };
    applyMotionPreference();
    motion.addEventListener("change", applyMotionPreference);
    const visibility = () => animation.paused(document.hidden || !playingRef.current);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect(); motion.removeEventListener("change", applyMotionPreference);
      document.removeEventListener("visibilitychange", visibility);
      animation.kill(); instance.dispose();
      renderer.current = null; tween.current = null;
    };
  }, { scope: root });

  const update = (next: Partial<TitleSettings>) => {
    values.current = { ...values.current, ...next };
    setSettings(values.current); draw();
  };
  const toggle = () => {
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
    tween.current?.paused(!playingRef.current);
    if (!playingRef.current) setTime(clock.current.time);
  };
  const seek = (next: number) => {
    playingRef.current = false; setPlaying(false);
    tween.current?.pause().time(next, true);
    clock.current.time = next; setTime(next); draw();
  };
  const exportFrame = () => {
    if (!canvas.current) return;
    draw();
    canvas.current.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = "the-weeknd-title.png"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };
  const presets = [
    { label: "参考字样", eyebrow: "AND", text: "LILY-ROSE\nDEPP" },
    { label: "THE WEEKND", eyebrow: "LIVE IN", text: "THE\nWEEKND" },
    { label: "DIE FOR YOU", eyebrow: "", text: "DIE FOR\nYOU" },
  ];

  return <div ref={root} className={`studio ${styles.studio}`}>
    <StudioHeader active="typography" />

    <main className={styles.workspace}>
      <section className={styles.preview} aria-label="动态字体预览">
        <div className={styles.previewHeading}><div className={styles.segmented} aria-label="对比参考"><button aria-pressed={!reference} onClick={() => setReference(false)}>效果</button><button aria-pressed={reference} onClick={() => setReference(true)}>参考</button></div></div>
        <div className={`${styles.stage} ${background === "transparent" ? styles.checker : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {background === "concert" && <img src="/images/title-concert.jpg" alt="" className={styles.backdrop} />}
          <canvas ref={canvas} className={styles.canvas} style={{ opacity: reference ? 0 : 1 }} aria-label={`红色动态磨损字幕：${settings.eyebrow} ${settings.text.replaceAll("\n", " ")}`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {reference && <img src="/references/mv-title.png" alt="提供的官方 MV 字体参考：红色模板字形、镂空 AND 和字内磨损" className={styles.reference} />}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {!ready && !error && <span className={styles.loading}>正在准备字形…</span>}
        </div>
        <div className={styles.belowStage}><div className={styles.backgrounds} aria-label="预览背景">{[{ id: "black", label: "纯黑" }, { id: "concert", label: "现场" }, { id: "transparent", label: "透明" }].map(item => <button key={item.id} aria-pressed={background === item.id} onClick={() => setBackground(item.id)}>{item.label}</button>)}</div></div>
        <div className={styles.transport}>
          <div className={styles.transportHeading}><span>纹理时间</span><output>{time.toFixed(2)} <i>/</i> {TITLE_DURATION.toFixed(2)} s</output></div>
          <input aria-label="纹理时间" type="range" min={0} max={TITLE_DURATION} step={1 / 30} value={time} style={{ "--fill": `${time / TITLE_DURATION * 100}%` } as CSSProperties} onChange={event => seek(Number(event.target.value))} />
          <div className={styles.transportActions}><button className={styles.play} onClick={toggle} disabled={!ready}>{playing ? "Ⅱ 暂停" : "▶ 播放"}</button><button className={styles.step} onClick={() => seek((Math.round(clock.current.time * 30) + 1) % 181 / 30)} disabled={!ready}>前进一帧 <span>↦</span></button></div>
        </div>
      </section>

      <aside className={styles.controls} aria-label="字体样式控制">
        <div className={styles.controlHeading}><span>字样</span><button onClick={() => update(defaultTitleSettings)}>重置</button></div>
        <label className={styles.textField}>镂空小字<input aria-label="镂空小字" type="text" maxLength={40} value={settings.eyebrow} onChange={event => update({ eyebrow: event.target.value })} placeholder="留空可隐藏" /></label>
        <label className={styles.textField}>主标题<textarea aria-label="主标题" rows={2} maxLength={90} value={settings.text} onChange={event => update({ text: event.target.value })} spellCheck={false} /></label>
        <div className={styles.presets}>{presets.map(preset => <button key={preset.label} aria-pressed={settings.text === preset.text && settings.eyebrow === preset.eyebrow} onClick={() => update({ text: preset.text, eyebrow: preset.eyebrow })}>{preset.label}</button>)}</div>
        <div className={styles.rule} />
        <div className={styles.controlHeading}><span>质感</span></div>
        <Parameter label="字号" value={settings.size} min={0.65} max={1.35} step={0.01} display={`${Math.round(settings.size * 100)}%`} onChange={size => update({ size })} />
        <Parameter label="擦除与磨损" value={settings.wear} min={0} max={1} step={0.01} display={`${Math.round(settings.wear * 100)}%`} onChange={wear => update({ wear })} />
        <Parameter label="老电视信号" value={settings.signal} min={0} max={1} step={0.01} display={`${Math.round(settings.signal * 100)}%`} onChange={signal => update({ signal })} />
        <Parameter label="纹理变化速度" value={settings.speed} min={0.25} max={2} step={0.05} display={`${settings.speed.toFixed(2)}×`} onChange={speed => update({ speed })} />
        <div className={styles.export}><button onClick={exportFrame} disabled={!ready}>导出透明 PNG <span>↓</span></button></div>
      </aside>
    </main>
  </div>;
}
