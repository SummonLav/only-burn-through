"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { FlameRenderer, type FlameSettings } from "@/lib/flame-renderer";
import { DistressedTitleRenderer, type TitleSettings } from "@/lib/distressed-title-renderer";
import { StudioHeader } from "./studio-header";
import styles from "./opening-studio.module.css";

// Shares the flame transition's tuned defaults so the opening matches the studio.
const flameSettings: FlameSettings = { duration: 2, width: 1.6, coreWidth: 1.2, intensity: 1.2 };
// 开场标题：小字 SINGAPORE + 大字 WEEKEND。
const titleSettings: TitleSettings = { eyebrow: "SINGAPORE", text: "WEEKEND", wear: 0.36, speed: 1, signal: 0.26, size: 1 };
const images: [string, string] = ["/images/chrome.png", "/images/gold.png"];

const HOLD = 2.4;                       // 标题停留时长（秒）
const BURN = flameSettings.duration;    // 火焰烧写时长（秒）
const TOTAL = HOLD + BURN;
const FEATHER = 7;                      // 烧蚀边缘羽化（百分比）

// Matches the shader's front: mix(-0.105, 1.035, 1 - (1 - p)^2.4).
const frontOf = (p: number) => -0.105 + 1.14 * (1 - Math.pow(1 - p, 2.4));

function Icon({ name, size = 18 }: { name: "play" | "pause" | "replay"; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "play" && <path d="m9 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />}
    {name === "pause" && <path d="M8 5v14M16 5v14" strokeWidth="3" />}
    {name === "replay" && <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>}
  </svg>;
}

export function OpeningStudio() {
  const stageRef = useRef<HTMLDivElement>(null);
  const flameRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLCanvasElement>(null);
  const flame = useRef<FlameRenderer | null>(null);
  const title = useRef<DistressedTitleRenderer | null>(null);
  const clock = useRef({ elapsed: 0, fireTime: 0 });
  const playingRef = useRef(false);
  const interacted = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [retry, setRetry] = useState(0);

  // Paint one frame: flame reveal underneath, distressed title on top, burned away
  // from the bottom up by masking the title in sync with the flame front.
  const draw = useCallback(() => {
    const t = clock.current.elapsed;
    const progress = t <= HOLD ? 0 : Math.min(1, (t - HOLD) / BURN);
    flame.current?.render(progress, clock.current.fireTime, flameSettings);
    title.current?.render(Math.max(0, t), titleSettings);

    const canvas = titleRef.current;
    if (canvas) {
      const fadeIn = Math.min(1, t / 0.2);
      const burn = Math.max(0, Math.min(1, frontOf(progress)));
      canvas.style.opacity = String(progress >= 1 ? 0 : fadeIn);
      if (progress <= 0) {
        canvas.style.maskImage = canvas.style.webkitMaskImage = "";
      } else {
        const lo = Math.max(0, burn * 100 - FEATHER);
        const hi = Math.min(100, burn * 100 + FEATHER);
        const mask = `linear-gradient(to top, transparent ${lo}%, rgba(0,0,0,0.18) ${(lo + hi) / 2}%, #000 ${hi}%)`;
        canvas.style.maskImage = canvas.style.webkitMaskImage = mask;
      }
    }
  }, []);

  const resize = useCallback(() => {
    const stage = stageRef.current, canvas = titleRef.current;
    if (!stage || !canvas) return;
    const rect = stage.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    title.current?.resize(rect.width * ratio, rect.height * ratio);
    draw();
  }, [draw]);

  useEffect(() => {
    const flameCanvas = flameRef.current, titleCanvas = titleRef.current, stage = stageRef.current;
    if (!flameCanvas || !titleCanvas || !stage) return;
    let cancelled = false;
    let autoPlay: ReturnType<typeof setTimeout> | undefined;
    let flameInstance: FlameRenderer | undefined;
    let titleInstance: DistressedTitleRenderer | undefined;
    const observer = new ResizeObserver(resize);
    const onLost = (event: Event) => { event.preventDefault(); setPlaying(false); playingRef.current = false; setReady(false); setError("画布连接暂时中断，正在等待恢复。"); };
    const onRestored = () => setRetry((key) => key + 1);
    flameCanvas.addEventListener("webglcontextlost", onLost);
    flameCanvas.addEventListener("webglcontextrestored", onRestored);

    const init = async () => {
      try {
        flameInstance = new FlameRenderer(flameCanvas);
        flame.current = flameInstance;
        titleInstance = new DistressedTitleRenderer(titleCanvas);
        title.current = titleInstance;
        await flameInstance.load(images);
        if (cancelled) return;
        setError("");
        setReady(true);
        observer.observe(stage);
        resize();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          clock.current.elapsed = HOLD * 0.5; // 静态展示标题
          draw();
        } else {
          autoPlay = setTimeout(() => { if (!interacted.current) { playingRef.current = true; setPlaying(true); } }, 300);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "开场动画启动失败，请重试。");
      }
    };
    void init();
    return () => {
      cancelled = true;
      clearTimeout(autoPlay);
      observer.disconnect();
      flameCanvas.removeEventListener("webglcontextlost", onLost);
      flameCanvas.removeEventListener("webglcontextrestored", onRestored);
      titleInstance?.dispose();
      flameInstance?.dispose();
      if (flame.current === flameInstance) flame.current = null;
      if (title.current === titleInstance) title.current = null;
    };
  }, [draw, resize, retry]);

  // Advance the timeline while playing; stops after the burn completes.
  useEffect(() => {
    if (!playing || !ready) return;
    let frame = 0;
    let previous = 0;
    let lastUi = 0;
    const reset = () => { previous = 0; };
    document.addEventListener("visibilitychange", reset);
    const animate = (now: number) => {
      if (document.hidden) { previous = 0; frame = requestAnimationFrame(animate); return; }
      const delta = previous ? (now - previous) / 1000 : 0;
      previous = now;
      clock.current.elapsed = Math.min(TOTAL, clock.current.elapsed + delta);
      if (clock.current.elapsed > HOLD) clock.current.fireTime += delta;
      draw();
      if (now - lastUi > 40 || clock.current.elapsed >= TOTAL) { setElapsed(clock.current.elapsed); lastUi = now; }
      if (clock.current.elapsed < TOTAL) frame = requestAnimationFrame(animate);
      else { playingRef.current = false; setPlaying(false); }
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", reset); };
  }, [playing, ready, draw]);

  const replay = useCallback(() => {
    if (!ready) return;
    interacted.current = true;
    clock.current.elapsed = 0;
    clock.current.fireTime = 0;
    setElapsed(0);
    draw();
    playingRef.current = true;
    setPlaying(true);
  }, [ready, draw]);

  const toggle = useCallback(() => {
    if (!ready) return;
    interacted.current = true;
    if (clock.current.elapsed >= TOTAL) { replay(); return; }
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
  }, [ready, replay]);

  const seek = (value: number) => {
    interacted.current = true;
    playingRef.current = false;
    setPlaying(false);
    clock.current.elapsed = value;
    clock.current.fireTime = Math.max(0, value - HOLD);
    setElapsed(value);
    draw();
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("button, input, select, textarea, a, [contenteditable]")) return;
      if (event.code === "Space") { event.preventDefault(); toggle(); }
      if (event.code === "KeyR") replay();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [toggle, replay]);

  const done = elapsed >= TOTAL;
  return <main className="studio">
    <StudioHeader active="opening" />

    <div className={styles.solo}>
      <section className="preview-section" aria-label="Singapore weekend 开场预览">
        <div className="stage" ref={stageRef}>
          <div className="canvas-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="fallback-image" src={images[0]} alt="冷银人像开场底图" />
            <canvas ref={flameRef} className={ready ? "flame-canvas ready" : "flame-canvas"} aria-label="火焰从底部升起，将 Singapore weekend 标题烧散并过渡到熔金人像" />
            <canvas ref={titleRef} className={styles.titleCanvas} aria-hidden="true" />
          </div>
          {error && <div className="canvas-message" role="alert"><p>{error}</p><button onClick={() => { setError(""); setRetry((key) => key + 1); }}>重新加载</button></div>}
          {!ready && !error && <span className="loading-label" role="status">正在准备开场…</span>}
        </div>
      </section>

      <div className={styles.transport}>
        <button className="play-button" onClick={toggle} disabled={!ready}>
          <Icon name={playing ? "pause" : done ? "replay" : "play"} />{playing ? "暂停" : done ? "重播" : "播放"}
        </button>
        <button className="replay-button" onClick={replay} disabled={!ready} aria-label="从头重播" title="从头重播 · R"><Icon name="replay" /></button>
        <input className={styles.scrubber} type="range" aria-label="开场进度" min={0} max={TOTAL} step={0.01} value={elapsed}
          style={{ "--fill": `${elapsed / TOTAL * 100}%` } as CSSProperties}
          onChange={(event) => seek(Number(event.target.value))} disabled={!ready} />
        <output className={styles.stamp}>{elapsed < HOLD ? "标题" : done ? "熔金" : "火焰"}</output>
      </div>
    </div>
  </main>;
}
