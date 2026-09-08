"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { FlameRenderer, type FlameSettings } from "@/lib/flame-renderer";

const defaults: FlameSettings = { duration: 3.8, width: 1, intensity: 1.15 };
const images = [
  { src: "/images/chrome.png", label: "冷银", name: "CHROME" },
  { src: "/images/gold.png", label: "熔金", name: "GOLD" },
];

function Icon({ name, size = 18 }: { name: "play" | "pause" | "replay" | "swap" | "expand"; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "play" && <path d="m9 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />}
    {name === "pause" && <><path d="M8 5v14M16 5v14" strokeWidth="3" /></>}
    {name === "replay" && <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>}
    {name === "swap" && <><path d="M4 8h15l-4-4M20 16H5l4 4" /></>}
    {name === "expand" && <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" /></>}
  </svg>;
}

function Slider({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void;
}) {
  return <label className="slider-field">
    <span className="field-heading"><span>{label}</span><output>{display}</output></span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value}
      style={{ "--fill": `${(value - min) / (max - min) * 100}%` } as CSSProperties}
      onChange={(event) => onChange(Number(event.target.value))} />
  </label>;
}

export function FlameStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<FlameRenderer | null>(null);
  const values = useRef({ progress: 0, time: 0, settings: defaults, reversed: false });
  const interacted = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [settings, setSettings] = useState(defaults);
  const [reversed, setReversed] = useState(false);
  const [loop, setLoop] = useState(false);
  const [retry, setRetry] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const draw = useCallback(() => {
    const v = values.current;
    rendererRef.current?.render(v.progress, v.time, v.settings, v.reversed);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let autoPlay: ReturnType<typeof setTimeout> | undefined;
    let renderer: FlameRenderer | undefined;
    const observer = new ResizeObserver(draw);
    const onLost = (event: Event) => {
      event.preventDefault();
      setPlaying(false);
      setReady(false);
      setError("画布连接暂时中断，正在等待恢复。");
    };
    const onRestored = () => setRetry((key) => key + 1);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    const init = async () => {
      try {
        renderer = new FlameRenderer(canvas);
        rendererRef.current = renderer;
        await renderer.load([images[0].src, images[1].src]);
        if (cancelled) return;
        setError("");
        setReady(true);
        observer.observe(canvas);
        draw();
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          autoPlay = setTimeout(() => { if (!interacted.current) setPlaying(true); }, 1200);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "画布启动失败，请重试。");
      }
    };
    void init();
    return () => {
      cancelled = true;
      clearTimeout(autoPlay);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      renderer?.dispose();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [draw, retry]);

  useEffect(() => {
    if (!playing || !ready) return;
    let frame = 0;
    let previous = 0;
    let lastUiUpdate = 0;
    const resetClock = () => { previous = 0; };
    document.addEventListener("visibilitychange", resetClock);
    const animate = (now: number) => {
      if (document.hidden) { previous = 0; frame = requestAnimationFrame(animate); return; }
      const delta = previous ? (now - previous) / 1000 : 0;
      previous = now;
      values.current.progress = Math.min(1, values.current.progress + delta / values.current.settings.duration);
      values.current.time += delta;
      draw();
      if (now - lastUiUpdate > 40 || values.current.progress === 1) {
        setProgress(values.current.progress);
        lastUiUpdate = now;
      }
      if (values.current.progress < 1) frame = requestAnimationFrame(animate);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resetClock);
    };
  }, [playing, ready, draw]);

  useEffect(() => {
    if (!loop || playing || progress < 1 || !ready) return;
    const timer = setTimeout(() => {
      values.current.reversed = !values.current.reversed;
      setReversed(values.current.reversed);
      values.current.progress = 0;
      values.current.time = 0;
      setProgress(0);
      draw();
      setPlaying(true);
    }, 1300);
    return () => clearTimeout(timer);
  }, [loop, playing, progress, ready, draw]);

  const play = useCallback(() => {
    if (!ready) return;
    interacted.current = true;
    if (values.current.progress >= 1) {
      values.current.progress = 0;
      values.current.time = 0;
      setProgress(0);
      draw();
    }
    setPlaying((current) => !current);
  }, [ready, draw]);

  const restart = useCallback(() => {
    if (!ready) return;
    interacted.current = true;
    values.current.progress = 0;
    values.current.time = 0;
    setProgress(0);
    draw();
    setPlaying(true);
  }, [ready, draw]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("button, input, select, textarea, a, [contenteditable]")) return;
      if (event.code === "Space") { event.preventDefault(); play(); }
      if (event.code === "KeyR") restart();
    };
    const fullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", keydown);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      window.removeEventListener("keydown", keydown);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, [play, restart]);

  const seek = (value: number) => {
    interacted.current = true;
    setPlaying(false);
    setLoop(false);
    values.current.progress = value;
    values.current.time = value * values.current.settings.duration;
    setProgress(value);
    draw();
  };

  const changeSetting = (key: keyof FlameSettings, value: number) => {
    interacted.current = true;
    const next = { ...values.current.settings, [key]: value };
    values.current.settings = next;
    setSettings(next);
    draw();
  };

  const swap = () => {
    interacted.current = true;
    setPlaying(false);
    setProgress(0);
    values.current.reversed = !values.current.reversed;
    values.current.progress = 0;
    values.current.time = 0;
    setReversed(values.current.reversed);
    draw();
  };

  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stageRef.current?.requestFullscreen) await stageRef.current.requestFullscreen();
      else { stageRef.current?.classList.toggle("expanded"); setIsFullscreen((current) => !current); }
    } catch { stageRef.current?.classList.toggle("expanded"); setIsFullscreen((current) => !current); }
  };

  const from = images[reversed ? 1 : 0];
  const to = images[reversed ? 0 : 1];
  const phase = progress === 0 ? "静候点燃" : progress === 1 ? "转场完成" : playing ? "火焰上行" : "已暂停";

  return <main className="studio">
    <header className="header">
      <a className="wordmark" href="/" aria-label="Ember 首页"><span className="brand-spark" aria-hidden="true">✳</span> ember<span className="wordmark-dot">.</span></a>
      <span className="header-caption">MOTION EXPERIMENTS <span>/</span> 001</span>
      <span className="header-status"><span className="status-dot" /> {error ? "等待恢复" : ready ? "实时渲染" : "准备中"}</span>
    </header>

    <div className="workspace">
      <section className="preview-section" aria-label="火焰转场预览">
        <div className="preview-topline"><span>THE PREVIEW</span><span>{from.name} <span className="text-dim">→</span> {to.name}</span></div>
        <div className="stage" ref={stageRef}>
          <div className="canvas-wrap">
            {/* Original image also provides a useful fallback before WebGL is ready. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="fallback-image" src={from.src} alt="金属人像转场原图" />
            <canvas ref={canvasRef} className={ready ? "flame-canvas ready" : "flame-canvas"} aria-label="从下向上推进的不规则火焰带，在冷银和熔金人像之间过渡" />
          </div>
          <div className="stage-top"><span className="stage-pill"><span className={playing ? "status-dot active" : "status-dot"} /> {phase}</span><span className="stage-number">{progress === 1 ? "02" : "01"}<span> / 02</span></span></div>
          <div className="stage-bottom"><span className="stage-caption">{progress === 1 ? to.label : from.label}<span> {progress === 1 ? to.name : from.name}</span></span><button className="icon-button glass" onClick={() => void fullscreen()} aria-label={isFullscreen ? "退出全屏" : "全屏预览"}><Icon name="expand" /></button></div>
          {error && <div className="canvas-message" role="alert"><p>{error}</p><button onClick={() => { setError(""); setRetry((key) => key + 1); }}>重新加载</button></div>}
          {!ready && !error && <span className="loading-label" role="status">正在准备画面…</span>}
        </div>
        <div className="preview-bottomline"><span><span className="tiny-cross">+</span> 向上燃烧，向另一幕。</span><span>RED · YELLOW · WHITE</span></div>
      </section>

      <aside className="controls" aria-label="转场控制">
        <div className="intro"><span className="eyebrow">THE ART OF TRANSITION</span><h1>一瞬，<br />燃入下一幕<span className="orange">。</span></h1><p>炽白的焰心，流动的金色。<br />从底部疾起，在顶端缓缓消隐。</p></div>

        <div className="section-label"><span>01 <span className="label-divider">/</span> 画面</span><button className="text-button" onClick={swap} disabled={!ready} aria-label="交换前后图片"><Icon name="swap" size={14} /> 交换</button></div>
        <div className="image-pair">
          {[from, to].map((item, index) => <button className={`image-tile ${progress === index ? "selected" : ""}`} key={item.name} onClick={() => seek(index)} disabled={!ready} aria-label={index === 0 ? "查看转场前图片" : "查看转场后图片"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.src} alt={item.label} />
            <span className="tile-position">{index === 0 ? "FROM" : "TO"}</span><span className="tile-label">{item.label}<span>0{index + 1}</span></span>
          </button>)}
          <span className="pair-arrow" aria-hidden="true">↗</span>
        </div>

        <div className="parameter-section">
          <div className="section-label"><span>02 <span className="label-divider">/</span> 火焰</span><button className="text-button" onClick={() => { interacted.current = true; values.current.settings = defaults; setSettings(defaults); draw(); }}>重置</button></div>
          <Slider label="转场时长" value={settings.duration} min={1.5} max={7} step={0.1} display={`${settings.duration.toFixed(1)} s`} onChange={(value) => changeSetting("duration", value)} />
          <Slider label="火焰宽度" value={settings.width} min={0.5} max={1.8} step={0.05} display={`${Math.round(settings.width * 100)}%`} onChange={(value) => changeSetting("width", value)} />
          <Slider label="辉光强度" value={settings.intensity} min={0.5} max={2} step={0.05} display={`${Math.round(settings.intensity * 100)}%`} onChange={(value) => changeSetting("intensity", value)} />
          <div className="easing-note"><svg viewBox="0 0 60 26" width="52" height="25" fill="none" aria-hidden="true"><path d="M1 24H59M1 2v22" stroke="#38342f" /><path d="M2 23C13 4 27 3 57 3" stroke="#ff8958" strokeWidth="1.5" /></svg><span>快速起势 <span className="text-dim">→</span> 柔和收尾</span><span className="easing-tag">EASE OUT</span></div>
        </div>

        <div className="playback">
          <Slider label="转场进度" value={progress} min={0} max={1} step={0.001} display={`${Math.round(progress * 100)}%`} onChange={seek} />
          <div className="play-buttons"><button className="play-button" onClick={play} disabled={!ready}><Icon name={playing ? "pause" : progress >= 1 ? "replay" : "play"} />{playing ? "暂停转场" : progress >= 1 ? "再次点燃" : progress > 0 ? "继续播放" : "播放转场"}</button><button className="replay-button" onClick={restart} disabled={!ready} aria-label="从头重播" title="从头重播 · R"><Icon name="replay" /></button></div>
          <div className="playback-footer"><label className="loop-control"><input type="checkbox" checked={loop} onChange={(event) => { interacted.current = true; setLoop(event.target.checked); if (event.target.checked && progress === 0) setPlaying(true); }} /><span className="switch-track" />循环播放</label><span className="shortcut"><kbd>SPACE</kbd> 播放 / 暂停</span></div>
        </div>
      </aside>
    </div>
    <footer className="footer"><span>EMBER — A STUDY IN CHANGE</span><span>两张画面，一道流动的火。</span><span className="footer-index">EXPERIMENT № 001</span></footer>
  </main>;
}
