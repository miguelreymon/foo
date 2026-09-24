import { useEffect, useRef, useState, useMemo } from "react";
import { Loader2, Play, AlertTriangle, CheckCircle, XCircle, Minus } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Format seconds to mm:ss
const fmt = (s) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

const STATUS_STYLES = {
  truth:        { color: "#10b981", label: "VERDAD",       Icon: CheckCircle },
  exaggeration: { color: "#eab308", label: "EXAGERA",      Icon: AlertTriangle },
  lie:          { color: "#ef4444", label: "MIENTE",       Icon: XCircle },
  neutral:      { color: "#52525b", label: "SIN VERIFICAR", Icon: Minus },
};

// Score → color gradient (green → yellow → red)
const scoreToColor = (score) => {
  if (score >= 70) return "#10b981";
  if (score >= 45) return "#eab308";
  if (score >= 20) return "#f97316";
  return "#ef4444";
};

// Load YouTube IFrame API once
let ytApiLoaderPromise = null;
const loadYouTubeAPI = () => {
  if (ytApiLoaderPromise) return ytApiLoaderPromise;
  ytApiLoaderPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const first = document.getElementsByTagName("script")[0];
    first.parentNode.insertBefore(tag, first);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
  });
  return ytApiLoaderPromise;
};

export const PolygraphTimeline = ({ analysisId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null);   // segment index hovered
  const [pinned, setPinned] = useState(null);     // segment index pinned (clicked)
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);

  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const playerDivId = useRef(`yt-player-${Math.random().toString(36).slice(2, 9)}`);

  // Fetch timeline
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API}/reality-check/${analysisId}/timeline`)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo generar el polígrafo");
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  // Mount YT player when we have a video_id
  useEffect(() => {
    if (!data?.video_id) return;
    let interval;
    let cancelled = false;
    loadYouTubeAPI().then((YT) => {
      if (cancelled) return;
      const div = document.getElementById(playerDivId.current);
      if (!div) return;
      playerRef.current = new YT.Player(playerDivId.current, {
        videoId: data.video_id,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            setPlayerReady(true);
            interval = setInterval(() => {
              try {
                const t = playerRef.current?.getCurrentTime?.() ?? 0;
                setCurrentSeconds(t);
              } catch (e) { /* noop */ }
            }, 250);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      try { playerRef.current?.destroy?.(); } catch (e) { /* noop */ }
      playerRef.current = null;
    };
  }, [data?.video_id]);

  const segments = data?.segments || [];
  const duration = data?.duration_seconds || (segments.at(-1)?.end_s || 0);

  // Stats summary
  const stats = useMemo(() => {
    const counts = { truth: 0, exaggeration: 0, lie: 0, neutral: 0 };
    let totalNonNeutralTime = 0;
    let truthTime = 0;
    let lieTime = 0;
    segments.forEach((s) => {
      counts[s.status] = (counts[s.status] || 0) + 1;
      const dur = (s.end_s - s.start_s) || 0;
      if (s.status !== "neutral") {
        totalNonNeutralTime += dur;
        if (s.status === "truth") truthTime += dur;
        if (s.status === "lie") lieTime += dur;
      }
    });
    const truthPct = totalNonNeutralTime > 0 ? Math.round((truthTime / totalNonNeutralTime) * 100) : 0;
    const liePct = totalNonNeutralTime > 0 ? Math.round((lieTime / totalNonNeutralTime) * 100) : 0;
    return { counts, truthPct, liePct };
  }, [segments]);

  // Find which segment is "current" based on player time
  const currentIdx = segments.findIndex((s) => currentSeconds >= s.start_s && currentSeconds < s.end_s);
  const activeIdx = pinned ?? hovered ?? (currentIdx >= 0 ? currentIdx : null);
  const activeSegment = activeIdx != null ? segments[activeIdx] : null;

  const seekTo = (seconds) => {
    try {
      playerRef.current?.seekTo?.(seconds, true);
      playerRef.current?.playVideo?.();
    } catch (e) { /* noop */ }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
        <p className="text-sm text-zinc-400">Generando el polígrafo cronológico…</p>
      </div>
    );
  }
  if (error || !data) {
    return null;
  }

  return (
    <div ref={containerRef} className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden" data-testid="polygraph-timeline">
      <div className="px-6 pt-6 pb-3 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">polígrafo cronológico</div>
          <h3 className="text-2xl md:text-3xl font-black mt-1" style={{ fontFamily: 'Impact, "Bebas Neue", sans-serif', letterSpacing: 1 }}>
            ¿CUÁNDO MIENTE? VES LA VERDAD MINUTO A MINUTO
          </h3>
          <p className="text-sm text-zinc-400 mt-1 max-w-xl">
            Cada bloque es un tramo del vídeo. Verde = lo que dice cuadra con los clientes. Rojo = los clientes le contradicen. Click → salta al segundo exacto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-emerald-400 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30">
            {stats.truthPct}% del tiempo dice verdad
          </span>
          {stats.liePct > 0 && (
            <span className="text-[11px] uppercase tracking-widest text-red-400 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/30">
              {stats.liePct}% del tiempo miente
            </span>
          )}
        </div>
      </div>

      {/* Player */}
      <div className="px-6 pt-2">
        <div className="aspect-video bg-black rounded-xl overflow-hidden">
          <div id={playerDivId.current} className="w-full h-full" />
        </div>
      </div>

      {/* Timeline */}
      <div className="px-6 py-5">
        <div
          className="relative h-12 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800"
          style={{ display: "grid", gridTemplateColumns: `repeat(${segments.length}, 1fr)` }}
        >
          {segments.map((s, i) => {
            const isActive = activeIdx === i;
            const color = scoreToColor(s.score);
            return (
              <button
                key={i}
                type="button"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  setPinned(pinned === i ? null : i);
                  seekTo(s.start_s);
                }}
                className="relative h-full transition-all"
                style={{
                  background: color,
                  opacity: isActive ? 1 : 0.65,
                  boxShadow: isActive ? `inset 0 0 0 2px white` : "none",
                }}
                data-testid={`polygraph-segment-${i}`}
                title={`${fmt(s.start_s)} - ${s.claim_summary || s.status}`}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-black/70">
                  {Math.round(s.score)}
                </span>
              </button>
            );
          })}

          {/* Live playhead (player time indicator) */}
          {duration > 0 && playerReady && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] pointer-events-none transition-[left] duration-200"
              style={{ left: `${(currentSeconds / duration) * 100}%` }}
            >
              <div className="absolute -top-1 -translate-x-1/2 w-3 h-3 rounded-full bg-white" />
            </div>
          )}
        </div>

        {/* Time scale */}
        <div className="flex justify-between mt-1.5 text-[10px] font-mono text-zinc-500">
          <span>0:00</span>
          <span>{fmt(duration / 4)}</span>
          <span>{fmt(duration / 2)}</span>
          <span>{fmt((duration * 3) / 4)}</span>
          <span>{fmt(duration)}</span>
        </div>

        {/* Active segment detail */}
        {activeSegment ? (
          <div
            className="mt-5 p-4 rounded-xl border-2 transition-colors"
            style={{
              borderColor: scoreToColor(activeSegment.score) + "66",
              background: scoreToColor(activeSegment.score) + "10",
            }}
            data-testid="polygraph-active-detail"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="text-xs px-2.5 py-1 rounded font-mono font-bold"
                  style={{
                    background: scoreToColor(activeSegment.score),
                    color: "#0a0a0a",
                  }}
                >
                  {fmt(activeSegment.start_s)} - {fmt(activeSegment.end_s)}
                </span>
                <span
                  className="text-xs uppercase tracking-widest font-bold"
                  style={{ color: scoreToColor(activeSegment.score) }}
                >
                  {STATUS_STYLES[activeSegment.status]?.label || activeSegment.status} · {activeSegment.score}/100
                </span>
              </div>
              <button
                onClick={() => seekTo(activeSegment.start_s)}
                className="text-xs px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 transition-colors"
                data-testid="polygraph-jump-btn"
              >
                <Play className="w-3 h-3" /> Saltar a este momento
              </button>
            </div>
            {activeSegment.claim_summary && (
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-0.5">Qué dice el influencer</div>
                <p className="text-sm md:text-base text-white leading-snug">{activeSegment.claim_summary}</p>
              </div>
            )}
            {activeSegment.reason && (
              <div className="mt-2.5">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-0.5">Qué dicen los clientes</div>
                <p className="text-sm text-zinc-300 leading-snug">{activeSegment.reason}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 text-sm text-zinc-500 text-center">
            Pasa el ratón por la línea o reproduce el vídeo para ver qué pasa en cada momento.
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: "#10b981" }} /> Verdad
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: "#eab308" }} /> Exagera
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: "#f97316" }} /> Casi miente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: "#ef4444" }} /> Miente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: "#52525b" }} /> Sin verificar
          </span>
        </div>
      </div>
    </div>
  );
};

export default PolygraphTimeline;
