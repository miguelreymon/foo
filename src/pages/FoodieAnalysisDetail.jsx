import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  Youtube,
  Utensils,
  MapPin,
  Star,
  Users,
  FileText,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingDown,
  Loader2,
  ChevronRight,
  ChevronDown,
  Quote,
  Phone,
  Globe,
  ExternalLink,
  Euro,
  Layers,
  Eye,
  EyeOff,
  Megaphone,
  Skull,
  ShieldCheck,
  Info,
  Coffee,
  Banknote,
  HandCoins,
  HelpCircle,
} from "lucide-react";
import FoodieAnalysisDetailLegacy from "./FoodieAnalysisDetail.legacy";
import PolygraphTimeline from "@/components/PolygraphTimeline";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ---------- Verdict logic ----------
const verdictFor = (data) => {
  const ci = data?.coherence_index;
  const gap = (data?.gap_analysis?.perception_gap || "").toLowerCase();
  if (ci == null) return { key: "unknown", title: "Sin datos", sub: "Análisis incompleto", color: "zinc", Icon: Layers };
  if (ci >= 75 || gap === "bajo" || gap === "low")
    return {
      key: "honest",
      title: "DICE LA VERDAD",
      sub: "Lo que dice el influencer coincide con la experiencia real",
      color: "emerald",
      Icon: ShieldCheck,
    };
  if (ci >= 50 || gap === "medio" || gap === "medium")
    return {
      key: "exaggerates",
      title: "EXAGERA",
      sub: "Vende la moto. Hay coincidencias pero también discrepancias",
      color: "yellow",
      Icon: Megaphone,
    };
  return {
    key: "lies",
    title: "TE ESTÁ VENDIENDO HUMO",
    sub: "La realidad de los clientes contradice al influencer",
    color: "red",
    Icon: Skull,
  };
};

const colorMap = {
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500", soft: "bg-emerald-500/10", border: "border-emerald-500/40", glow: "shadow-emerald-500/40" },
  yellow:  { text: "text-yellow-400",  bg: "bg-yellow-500",  soft: "bg-yellow-500/10",  border: "border-yellow-500/40",  glow: "shadow-yellow-500/40"  },
  orange:  { text: "text-orange-400",  bg: "bg-orange-500",  soft: "bg-orange-500/10",  border: "border-orange-500/40",  glow: "shadow-orange-500/40"  },
  red:     { text: "text-red-400",     bg: "bg-red-500",     soft: "bg-red-500/10",     border: "border-red-500/40",     glow: "shadow-red-500/40"     },
  zinc:    { text: "text-zinc-400",    bg: "bg-zinc-600",    soft: "bg-zinc-700/30",    border: "border-zinc-700",       glow: "shadow-zinc-700/40"   },
};

// ---------- Polygraph dial (animated suspense + settle) ----------
const PolygraphDial = ({ coherence, color }) => {
  const target = Math.max(0, Math.min(100, coherence ?? 0));
  const targetAngle = -90 + (target * 180) / 100;
  const [angle, setAngle] = useState(0);
  const [phase, setPhase] = useState("suspense"); // suspense | settle | done
  const angleRef = useRef(0);
  angleRef.current = angle;

  useEffect(() => {
    let raf;
    const start = performance.now();
    const SUSPENSE_MS = 1800;

    const tick = (now) => {
      const elapsed = now - start;
      if (elapsed < SUSPENSE_MS) {
        // Phase 1: chaotic oscillation, decaying as we approach settle
        const decay = 1 - elapsed / SUSPENSE_MS;
        const wobble = Math.sin(elapsed * 0.022) * 80 * decay;
        const drift = Math.sin(elapsed * 0.007) * 25 * decay;
        const noise = (Math.random() - 0.5) * 14 * decay;
        setAngle(wobble + drift + noise);
        raf = requestAnimationFrame(tick);
      } else {
        setPhase("settle");
        const settleStart = performance.now();
        const startAngle = angleRef.current;
        const SETTLE_MS = 900;
        const overshoot = (targetAngle - startAngle) * 0.18;
        const easeOutBack = (t) => {
          const c1 = 1.70158;
          const c3 = c1 + 1;
          return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        };
        const settleTick = (n) => {
          const e = (n - settleStart) / SETTLE_MS;
          if (e < 1) {
            const k = easeOutBack(e);
            setAngle(startAngle + (targetAngle + overshoot - startAngle) * k);
            raf = requestAnimationFrame(settleTick);
          } else {
            setAngle(targetAngle);
            setPhase("done");
          }
        };
        raf = requestAnimationFrame(settleTick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [targetAngle]);

  const displayedValue = phase === "done"
    ? target
    : Math.max(0, Math.min(100, ((angle + 90) / 180) * 100));

  return (
    <div className="relative w-full max-w-md mx-auto select-none">
      <svg viewBox="0 0 200 120" className="w-full">
        <defs>
          <linearGradient id="dial" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="needleGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          stroke="url(#dial)"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
          opacity="0.9"
        />
        {[0, 25, 50, 75, 100].map((p) => {
          const a = (-90 + (p * 180) / 100) * (Math.PI / 180);
          const x1 = 100 + Math.cos(a) * 86;
          const y1 = 100 + Math.sin(a) * 86;
          const x2 = 100 + Math.cos(a) * 96;
          const y2 = 100 + Math.sin(a) * 96;
          return <line key={p} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#52525b" strokeWidth="2" />;
        })}
        <g transform={`rotate(${angle} 100 100)`} filter="url(#needleGlow)">
          <line x1="100" y1="100" x2="100" y2="22" stroke="#fafafa" strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="22" r="4" fill="#fafafa" />
        </g>
        <circle cx="100" cy="100" r="10" fill="#0a0a0a" stroke="#fafafa" strokeWidth="2" />
        <text x="20" y="118" fontSize="9" fill="#dc2626" fontWeight="700">MIENTE</text>
        <text x="92" y="118" fontSize="9" fill="#eab308" fontWeight="700">VENDE HUMO</text>
        <text x="160" y="118" fontSize="9" fill="#10b981" fontWeight="700">VERDAD</text>
      </svg>
      <div className="text-center mt-2">
        <div
          className={`text-6xl font-black leading-none transition-colors duration-500 ${
            phase === "done" ? colorMap[color].text : "text-zinc-300"
          }`}
          style={{ fontFamily: 'Impact, "Bebas Neue", sans-serif', letterSpacing: 1 }}
        >
          {Math.round(displayedValue)}<span className="text-2xl text-zinc-500">%</span>
        </div>
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mt-1">
          {phase === "suspense" ? "calculando…" : phase === "settle" ? "veredicto…" : "índice de verdad"}
        </div>
      </div>
    </div>
  );
};

// ---------- Stars distribution bar ----------
const StarsDistribution = ({ reviews }) => {
  if (!reviews || reviews.length === 0) return null;
  const buckets = [0, 0, 0, 0, 0];
  reviews.forEach((r) => {
    const n = Math.round(r.rating || 0);
    if (n >= 1 && n <= 5) buckets[5 - n]++;
  });
  const max = Math.max(1, ...buckets);
  return (
    <div className="space-y-1.5">
      {buckets.map((count, idx) => {
        const stars = 5 - idx;
        const pct = (count / max) * 100;
        return (
          <div key={stars} className="flex items-center gap-2 text-xs">
            <span className="w-7 text-right text-zinc-400 font-mono">{stars}★</span>
            <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full ${stars >= 4 ? "bg-emerald-500" : stars === 3 ? "bg-yellow-500" : "bg-red-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 text-zinc-500 font-mono">{count}</span>
          </div>
        );
      })}
    </div>
  );
};

// ---------- Single review (collapsible) ----------
const ReviewItem = ({ r, idx }) => {
  const [open, setOpen] = useState(false);
  const text = r.text || "";
  const isLong = text.length > 200;
  const preview = isLong ? text.slice(0, 200) + "…" : text;
  return (
    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-3 mb-2">
        {r.author_photo ? (
          <img src={r.author_photo} alt="" className="w-9 h-9 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-zinc-300">
            {(r.author || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{r.author || "Anónimo"}</p>
          <p className="text-[11px] text-zinc-500">{r.relative_time}</p>
        </div>
        {r.rating != null && (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-zinc-700"}`} />
            ))}
          </div>
        )}
      </div>
      <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
        {open ? text : preview}
      </p>
      {isLong && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-emerald-400 hover:text-emerald-300 mt-2 flex items-center gap-1"
          data-testid={`review-toggle-${idx}`}
        >
          {open ? "Mostrar menos" : "Leer entera"} <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
};

// ---------- Claim verification helpers ----------
// Tokenize: lowercase, drop accents, drop short words and stopwords
const STOPWORDS = new Set([
  "para","como","desde","entre","cuando","donde","tanto","sobre","hasta","muchos","muchas","mucho","mucha",
  "este","esta","estos","estas","tiene","tienen","esto","unas","unos","pero","aunque","porque","tambien",
  "siempre","nunca","casi","mejor","peor","alta","alto","altas","altos","bajo","bajos","baja","bajas",
  "mismo","misma","mismos","mismas","todo","toda","todos","todas","cada","sus","con","una","uno","las","los","del","sin","por",
  "que","mas","menos","ser","muy","sea","son","fue","han","han","est","esta","estab","aqui","alli","entre","ese","esa","esos","esas",
]);

const stripAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const tokenize = (text) => {
  if (!text) return [];
  const clean = stripAccents(String(text).toLowerCase()).replace(/[^a-z0-9\s]/g, " ");
  return clean
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w));
};

// Compare a claim against a list of points; return the best match and shared keywords
const matchClaim = (claim, points) => {
  const claimTokens = new Set(tokenize(claim));
  if (claimTokens.size === 0 || !points?.length) return null;
  let best = null;
  for (const point of points) {
    const pTokens = new Set(tokenize(point));
    const shared = [...claimTokens].filter((t) => pTokens.has(t));
    if (shared.length === 0) continue;
    const score = shared.length / Math.max(1, claimTokens.size);
    if (!best || score > best.score) {
      best = { point, shared, score };
    }
  }
  return best;
};

const evaluateClaim = (claim, aligned, discrepancies) => {
  const okMatch = matchClaim(claim, aligned);
  const koMatch = matchClaim(claim, discrepancies);

  if (okMatch && (!koMatch || okMatch.score >= koMatch.score)) {
    return {
      status: "ok",
      reason: okMatch.point,
      keywords: okMatch.shared,
      explanation:
        "Esta afirmación está respaldada por las reseñas reales de Google. Una de las coincidencias detectadas por el análisis menciona los mismos elementos clave.",
    };
  }
  if (koMatch) {
    return {
      status: "ko",
      reason: koMatch.point,
      keywords: koMatch.shared,
      explanation:
        "Lo que dice el influencer choca con lo que cuentan los clientes en las reseñas reales. Detectamos una discrepancia que toca los mismos términos.",
    };
  }
  return {
    status: "neutral",
    reason: null,
    keywords: [],
    explanation:
      "Ninguna reseña real menciona explícitamente esta afirmación, ni a favor ni en contra. No hay evidencia suficiente para confirmarla o desmentirla.",
  };
};

// ---------- Single claim row with expandable explanation ----------
const ClaimRow = ({ claim, aligned, discrepancies, idx }) => {
  const [open, setOpen] = useState(false);
  const verdict = useMemo(() => evaluateClaim(claim, aligned, discrepancies), [claim, aligned, discrepancies]);
  const { status, reason, keywords, explanation } = verdict;
  const styles = status === "ok"
    ? { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400", label: "Confirmado" }
    : status === "ko"
    ? { bg: "bg-red-500/5", border: "border-red-500/20", text: "text-red-400", label: "Contradicho" }
    : { bg: "bg-zinc-800/40", border: "border-zinc-800", text: "text-zinc-500", label: "Sin verificar" };

  return (
    <div className={`rounded-lg border ${styles.bg} ${styles.border} transition-colors`}>
      <div className="flex items-start gap-3 p-3.5">
        <div className="flex-shrink-0 mt-0.5">
          {status === "ok" ? (
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          ) : status === "ko" ? (
            <XCircle className="w-5 h-5 text-red-400" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-zinc-600" />
          )}
        </div>
        <p className="text-sm md:text-base text-zinc-200 leading-snug flex-1">{claim}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] uppercase tracking-widest font-bold ${styles.text}`}>
            {styles.label}
          </span>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
              open
                ? "bg-zinc-700 border-zinc-600 text-white"
                : "bg-zinc-900/60 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
            aria-label="Por qué"
            data-testid={`claim-info-btn-${idx}`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {open && (
        <div
          className="px-3.5 pb-3.5 pl-12 border-t border-zinc-800/60 pt-3 space-y-2"
          data-testid={`claim-explanation-${idx}`}
        >
          <div className="text-[11px] uppercase tracking-widest text-zinc-500">¿En qué nos basamos?</div>
          <p className="text-sm text-zinc-300 leading-relaxed">{explanation}</p>
          {reason && (
            <div className="mt-2 p-3 rounded-md bg-zinc-950/60 border border-zinc-800">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-1">
                <Quote className="w-3 h-3" />
                {status === "ok" ? "Coincidencia encontrada en reseñas reales" : "Discrepancia detectada"}
              </div>
              <p className="text-sm text-zinc-200 italic leading-relaxed">“{reason}”</p>
              {keywords?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {keywords.slice(0, 6).map((k, i) => (
                    <span key={i} className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                      status === "ok"
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                        : "bg-red-500/10 text-red-300 border border-red-500/30"
                    }`}>
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {!reason && status === "neutral" && (
            <p className="text-xs text-zinc-500 italic mt-2">
              Si más clientes reseñan este restaurante, podríamos verificar esta afirmación en el futuro.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ---------- Invitation/sponsor disclosure card ----------
const INVITATION_STYLES = {
  none: {
    label: "Pagó como cliente",
    color: "emerald",
    Icon: ShieldCheck,
    description: "El influencer dejó claro que pagó la cuenta o asistió como cliente anónimo.",
  },
  minor: {
    label: "Le invitaron a algo puntual",
    color: "yellow",
    Icon: Coffee,
    description: "Hubo invitación de la casa, pero solo a algo menor (café, postre, chupito, detalle).",
  },
  meal: {
    label: "Le invitaron a la comida",
    color: "orange",
    Icon: HandCoins,
    description: "El restaurante cubrió la comida o cena completa del influencer.",
  },
  sponsored: {
    label: "Colaboración pagada",
    color: "red",
    Icon: Banknote,
    description: "Es contenido patrocinado o una colaboración comercial declarada con el restaurante.",
  },
  unknown: {
    label: "No nos consta",
    color: "zinc",
    Icon: HelpCircle,
    description: "No se ha encontrado ninguna mención explícita en el vídeo. No podemos confirmar ni desmentir si fue invitado.",
  },
};

const InvitationCard = ({ analysisId }) => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API}/reality-check/${analysisId}/invitation`)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo verificar la transparencia");
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setInfo(j);
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

  if (loading) {
    return (
      <Card className="p-6 bg-zinc-900/60 border-zinc-800 flex items-center gap-3" data-testid="invitation-loading">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
        <p className="text-sm text-zinc-400">Verificando si fue invitado…</p>
      </Card>
    );
  }
  if (error || !info) {
    return null; // silent fail, not critical
  }

  const cfg = INVITATION_STYLES[info.level] || INVITATION_STYLES.unknown;
  const c = colorMap[cfg.color] || colorMap.zinc;
  const IconC = cfg.Icon;

  const confidenceLabel =
    info.confidence === "high" ? "Confianza alta" :
    info.confidence === "medium" ? "Confianza media" :
    "Confianza baja";

  return (
    <Card
      className={`p-6 md:p-7 border-2 ${c.border} ${c.soft}`}
      data-testid="invitation-card"
    >
      <div className="flex items-start gap-4 flex-wrap md:flex-nowrap">
        <div className={`w-14 h-14 rounded-xl ${c.soft} border ${c.border} flex items-center justify-center flex-shrink-0`}>
          <IconC className={`w-7 h-7 ${c.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 mb-1">
            Transparencia · ¿pagó o le invitaron?
          </div>
          <h3 className={`text-2xl md:text-3xl font-black ${c.text} leading-tight`} style={{ fontFamily: 'Impact, "Bebas Neue", sans-serif', letterSpacing: 1 }}>
            {(info.label || cfg.label).toUpperCase()}
          </h3>
          <p className="text-zinc-300 mt-2 text-sm leading-relaxed">
            {info.detail || cfg.description}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[11px] px-2.5 py-1 rounded-md bg-zinc-800/70 text-zinc-300 font-mono uppercase">
              nivel: {info.level}
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-md bg-zinc-800/70 text-zinc-300 font-mono uppercase">
              {confidenceLabel}
            </span>
          </div>
          {info.evidence_quotes?.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500">Pruebas (palabras del influencer)</div>
              {info.evidence_quotes.map((q, i) => (
                <div key={i} className="p-3 rounded-md bg-zinc-950/60 border border-zinc-800 flex gap-2 items-start">
                  <Quote className={`w-3.5 h-3.5 ${c.text} flex-shrink-0 mt-1`} />
                  <p className="text-sm text-zinc-200 italic leading-snug">“{q}”</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// ---------- New dramatic detail view ----------
const FoodieAnalysisDetailNew = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const fetchOnce = async () => {
      try {
        const res = await fetch(`${API}/reality-check/${id}`);
        if (!res.ok) throw new Error("No se pudo cargar el análisis");
        const json = await res.json();
        if (cancelled) return;
        setData(json);
        setLoading(false);
        if (json.status === "processing") {
          timer = setTimeout(fetchOnce, 2500);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e.message || "Error");
        setLoading(false);
      }
    };
    fetchOnce();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  // Clean transcript: remove HTML entities like &nbsp; that come raw
  const transcript = useMemo(() => {
    if (!data?.transcript_text) return "";
    let t = data.transcript_text
      .replace(/^TRANSCRIPCIÓN DEL AUDIO:\s*/i, "")
      .replace(/^TÍTULO:\s*/i, "");
    // strip leftover html entities
    t = t.replace(/&nbsp;/gi, " ").replace(/\[\s*&nbsp;\s*_?\s*&nbsp;\s*\]/gi, "");
    t = t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    // collapse extra spaces
    t = t.replace(/[ \t]{2,}/g, " ").trim();
    return t;
  }, [data]);

  const claims = data?.influencer_sentiment?.key_claims || [];
  const aligned = data?.gap_analysis?.aligned_points || [];
  const discrepancies = data?.gap_analysis?.main_discrepancies || [];
  const claimsStats = useMemo(() => {
    let ok = 0, ko = 0, neutral = 0;
    claims.forEach((c) => {
      const v = evaluateClaim(c, aligned, discrepancies);
      if (v.status === "ok") ok++;
      else if (v.status === "ko") ko++;
      else neutral++;
    });
    return { ok, ko, neutral };
  }, [claims, aligned, discrepancies]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center text-zinc-300">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p>{error || "Análisis no disponible"}</p>
          <Button className="mt-4" onClick={() => navigate("/foodie-reality")}>Volver</Button>
        </div>
      </div>
    );
  }

  const verdict = verdictFor(data);
  const VC = colorMap[verdict.color];
  const VerdictIcon = verdict.Icon;
  const isProcessing = data.status === "processing";
  const isFailed = data.status === "failed";

  // Influencer score (0-100) and clients rating (1-5 → 0-100)
  const infScore = typeof data.influencer_sentiment?.score === "number" ? Math.round(data.influencer_sentiment.score * 100) : null;
  const clientsRating = data.community_sentiment?.estimated_rating ?? data.restaurant_rating ?? data.place_info?.rating ?? null;
  const clientsScore = clientsRating != null ? Math.round((clientsRating / 5) * 100) : null;

  const reviewsAll = data.place_info?.reviews_detailed || [];
  const reviewsToShow = showAllReviews ? reviewsAll : reviewsAll.slice(0, 2);

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            data-testid="back-btn"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Volver</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                localStorage.setItem("foodie_view_mode", "legacy");
                window.location.reload();
              }}
              className="text-xs text-zinc-500 hover:text-zinc-200 flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-800 hover:border-zinc-700 transition-colors"
              data-testid="switch-to-legacy-btn"
              title="Volver a la vista clásica"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Vista clásica
            </button>
            <Link
              to={`/foodie-reality/channel/${encodeURIComponent(data.channel_name || "")}`}
              className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              data-testid="link-channel"
            >
              Ver canal <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Hero - Video + Title */}
        <Card className="p-0 overflow-hidden bg-zinc-900/70 border-zinc-800" data-testid="hero-card">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="aspect-video bg-black">
              {data.video_id ? (
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${data.video_id}`}
                  title={data.video_title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : data.thumbnail_url ? (
                <img src={data.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div className="p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-[0.25em]">
                <Youtube className="w-4 h-4 text-red-500" /> Foodie Fake · Reality Check
              </div>
              <h1 className="text-2xl md:text-3xl font-black leading-tight" data-testid="video-title">
                {data.video_title}
              </h1>
              <Link
                to={`/foodie-reality/channel/${encodeURIComponent(data.channel_name || "")}`}
                className="text-sm text-zinc-400 hover:text-emerald-400 flex items-center gap-1 w-fit"
              >
                <span className="font-semibold text-emerald-400">{data.channel_name}</span>
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-sm mt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80">
                  <Utensils className="w-4 h-4 text-emerald-400" /> {data.restaurant_name}
                </span>
                {data.restaurant_location && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80">
                    <MapPin className="w-4 h-4 text-zinc-400" /> {data.restaurant_location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {isProcessing && (
          <Card className="p-6 bg-zinc-900/70 border-zinc-800 flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            <div>
              <p className="font-bold">Analizando video…</p>
              <p className="text-sm text-zinc-400">Recuperando transcripción, reseñas y comparando con IA.</p>
            </div>
          </Card>
        )}

        {isFailed && (
          <Card className="p-6 bg-red-500/10 border-red-500/30">
            <p className="text-red-300 font-bold">El análisis falló.</p>
            {data.error && <p className="text-sm text-red-200/80 mt-1">{data.error}</p>}
          </Card>
        )}

        {data.status === "completed" && (
          <>
            {/* ============ HERO VERDICT ============ */}
            <Card
              className={`relative overflow-hidden p-8 md:p-10 border-2 ${VC.border} ${VC.soft} shadow-2xl ${VC.glow}`}
              data-testid="verdict-hero"
            >
              {/* Subtle scanlines */}
              <div
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 4px)",
                }}
              />
              <div className="relative grid lg:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-3 flex items-center gap-2">
                    <VerdictIcon className={`w-4 h-4 ${VC.text}`} /> Veredicto
                  </div>
                  <h2
                    className={`text-5xl md:text-6xl font-black leading-[0.9] ${VC.text}`}
                    style={{ fontFamily: 'Impact, "Bebas Neue", sans-serif', letterSpacing: 1 }}
                    data-testid="verdict-title"
                  >
                    {(data.channel_name || "Este foodie").toUpperCase()}<br />
                    {verdict.title}
                  </h2>
                  <p className="text-zinc-300 mt-4 text-lg leading-snug max-w-md">
                    {verdict.sub}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-5">
                    <span className="text-xs px-2.5 py-1 rounded-md bg-zinc-800/70 text-zinc-300 font-mono">
                      {Math.round(data.coherence_index ?? 0)}% coherencia
                    </span>
                    {data.gap_analysis?.perception_gap && (
                      <span className="text-xs px-2.5 py-1 rounded-md bg-zinc-800/70 text-zinc-300 font-mono uppercase">
                        gap: {data.gap_analysis.perception_gap}
                      </span>
                    )}
                    {data.confidence_level && (
                      <span className="text-xs px-2.5 py-1 rounded-md bg-zinc-800/70 text-zinc-300 font-mono uppercase">
                        confianza: {data.confidence_level}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <PolygraphDial coherence={data.coherence_index ?? 0} color={verdict.color} />
                </div>
              </div>
            </Card>

            {/* ============ VS COMPARISON ============ */}
            {(infScore != null || clientsScore != null) && (
              <Card className="p-6 md:p-8 bg-zinc-900/60 border-zinc-800" data-testid="vs-card">
                <div className="text-center mb-6">
                  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">influencer vs realidad</div>
                  <h3 className="text-2xl md:text-3xl font-black mt-1" style={{ fontFamily: 'Impact, "Bebas Neue", sans-serif', letterSpacing: 1 }}>
                    EL DUELO
                  </h3>
                </div>
                <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
                  {/* Influencer side */}
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-widest text-red-400 mb-1 flex items-center gap-2 justify-end">
                      <Youtube className="w-4 h-4" /> Influencer
                    </div>
                    <div className="text-6xl font-black text-red-400" style={{ fontFamily: 'Impact, "Bebas Neue", sans-serif' }}>
                      {infScore != null ? `${infScore}` : "—"}
                      <span className="text-2xl text-zinc-500">/100</span>
                    </div>
                    <p className="text-sm text-zinc-400 capitalize mt-1">
                      {data.influencer_sentiment?.overall_tone?.replace(/_/g, " ") || "—"}
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-red-500 ml-auto" style={{ width: `${infScore || 0}%` }} />
                    </div>
                  </div>
                  {/* VS divider */}
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-zinc-950 border-2 border-zinc-700 flex items-center justify-center mx-auto" style={{ fontFamily: 'Impact, "Bebas Neue", sans-serif' }}>
                      <span className="text-zinc-300 text-xl font-black">VS</span>
                    </div>
                  </div>
                  {/* Clients side */}
                  <div>
                    <div className="text-xs uppercase tracking-widest text-emerald-400 mb-1 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Realidad
                    </div>
                    <div className="text-6xl font-black text-emerald-400" style={{ fontFamily: 'Impact, "Bebas Neue", sans-serif' }}>
                      {clientsScore != null ? `${clientsScore}` : "—"}
                      <span className="text-2xl text-zinc-500">/100</span>
                    </div>
                    <p className="text-sm text-zinc-400 mt-1 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      {clientsRating != null ? `${clientsRating}/5` : "Sin rating"}
                      {data.place_info?.user_rating_count && (
                        <span className="text-zinc-500"> · {data.place_info.user_rating_count} reseñas</span>
                      )}
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${clientsScore || 0}%` }} />
                    </div>
                  </div>
                </div>

                {/* Quote from clients */}
                {data.community_sentiment?.typical_experience && (
                  <div className="mt-6 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800">
                    <div className="text-[11px] uppercase tracking-widest text-emerald-400 mb-1.5 flex items-center gap-1.5">
                      <Quote className="w-3.5 h-3.5" /> Resumen de la experiencia real
                    </div>
                    <p className="text-zinc-200 italic leading-relaxed">
                      “{data.community_sentiment.typical_experience}”
                    </p>
                  </div>
                )}
              </Card>
            )}

            {/* ============ POLYGRAPH TIMELINE ============ */}
            <PolygraphTimeline analysisId={data.id || id} />

            {/* ============ INVITATION / TRANSPARENCY ============ */}
            <InvitationCard analysisId={data.id || id} />

            {/* ============ CLAIMS CHECK ============ */}
            {claims.length > 0 && (
              <Card className="p-6 md:p-8 bg-zinc-900/60 border-zinc-800" data-testid="claims-check-card">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">verificación de afirmaciones</div>
                    <h3 className="text-2xl font-black mt-1" style={{ fontFamily: 'Impact, "Bebas Neue", sans-serif', letterSpacing: 1 }}>
                      ¿LO QUE DICE ES VERDAD?
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" /> {claimsStats.ok} confirmadas
                    </span>
                    <span className="flex items-center gap-1.5 text-red-400">
                      <XCircle className="w-3.5 h-3.5" /> {claimsStats.ko} contradichas
                    </span>
                    {claimsStats.neutral > 0 && (
                      <span className="flex items-center gap-1.5 text-zinc-500">
                        {claimsStats.neutral} sin verificar
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {claims.map((c, i) => (
                    <ClaimRow
                      key={i}
                      idx={i}
                      claim={c}
                      aligned={aligned}
                      discrepancies={discrepancies}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* ============ DISCREPANCIES SHOWDOWN ============ */}
            {(discrepancies.length > 0 || aligned.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                {discrepancies.length > 0 && (
                  <Card className="p-6 bg-red-500/5 border-red-500/30">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingDown className="w-5 h-5 text-red-400" />
                      <h3 className="font-bold text-red-300 uppercase tracking-wider text-sm">
                        Discrepancias ({discrepancies.length})
                      </h3>
                    </div>
                    <ul className="space-y-2.5">
                      {discrepancies.map((d, i) => (
                        <li key={i} className="text-sm text-zinc-200 leading-relaxed flex gap-2">
                          <span className="text-red-400 flex-shrink-0">▸</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
                {aligned.length > 0 && (
                  <Card className="p-6 bg-emerald-500/5 border-emerald-500/30">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-bold text-emerald-300 uppercase tracking-wider text-sm">
                        Coincidencias ({aligned.length})
                      </h3>
                    </div>
                    <ul className="space-y-2.5">
                      {aligned.map((a, i) => (
                        <li key={i} className="text-sm text-zinc-200 leading-relaxed flex gap-2">
                          <span className="text-emerald-400 flex-shrink-0">▸</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            )}

            {/* ============ POSITIVES vs COMPLAINTS QUOTES ============ */}
            {(data.community_sentiment?.common_positives?.length > 0 || data.community_sentiment?.common_complaints?.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                {data.community_sentiment?.common_positives?.length > 0 && (
                  <Card className="p-6 bg-zinc-900/60 border-zinc-800">
                    <div className="text-xs uppercase tracking-[0.25em] text-emerald-400 mb-3 flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5" /> Lo que aman los clientes
                    </div>
                    <div className="space-y-2">
                      {data.community_sentiment.common_positives.map((p, i) => (
                        <div key={i} className="text-sm text-zinc-100 leading-snug px-3 py-2 rounded-md bg-emerald-500/5 border-l-2 border-emerald-500/60">
                          {p}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {data.community_sentiment?.common_complaints?.length > 0 && (
                  <Card className="p-6 bg-zinc-900/60 border-zinc-800">
                    <div className="text-xs uppercase tracking-[0.25em] text-red-400 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" /> De lo que se quejan
                    </div>
                    <div className="space-y-2">
                      {data.community_sentiment.common_complaints.map((p, i) => (
                        <div key={i} className="text-sm text-zinc-100 leading-snug px-3 py-2 rounded-md bg-red-500/5 border-l-2 border-red-500/60">
                          {p}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ============ RESTAURANT INFO ============ */}
            {data.place_info && (
              <Card className="p-6 md:p-7 bg-zinc-900/60 border-zinc-800" data-testid="place-info-card">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 mb-1">Restaurante verificado</div>
                    <h3 className="font-black text-white text-2xl">{data.place_info.display_name}</h3>
                    {data.place_info.formatted_address && (
                      <p className="text-sm text-zinc-400 flex items-center gap-1.5 mt-1">
                        <MapPin className="w-4 h-4 text-emerald-400" />
                        {data.place_info.formatted_address}
                      </p>
                    )}
                  </div>
                  {data.place_info.rating != null && (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-4xl font-black text-yellow-400 flex items-center gap-1.5" style={{ fontFamily: 'Impact, "Bebas Neue", sans-serif' }}>
                          <Star className="w-7 h-7 fill-yellow-400" />
                          {data.place_info.rating}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {data.place_info.user_rating_count} reseñas
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Stars distribution */}
                {reviewsAll.length > 0 && (
                  <div className="mt-5 max-w-sm">
                    <StarsDistribution reviews={reviewsAll} />
                  </div>
                )}

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm mt-5">
                  {data.place_info.phone && (
                    <a href={`tel:${data.place_info.phone}`} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 transition-colors">
                      <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-zinc-200 text-xs truncate">{data.place_info.phone}</span>
                    </a>
                  )}
                  {data.place_info.website_uri && (
                    <a href={data.place_info.website_uri} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 transition-colors">
                      <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-zinc-200 text-xs truncate">Web</span>
                    </a>
                  )}
                  {data.place_info.google_maps_uri && (
                    <a href={data.place_info.google_maps_uri} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 transition-colors">
                      <ExternalLink className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-zinc-200 text-xs truncate">Google Maps</span>
                    </a>
                  )}
                  {data.place_info.price_level && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-800">
                      <Euro className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-zinc-200 text-xs capitalize">
                        {data.place_info.price_level.replace("PRICE_LEVEL_", "").toLowerCase()}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* ============ REVIEWS COLLAPSIBLE ============ */}
            {reviewsAll.length > 0 && (
              <Card className="p-6 bg-zinc-900/60 border-zinc-800" data-testid="reviews-detailed-card">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-500" /> Reseñas reales de Google
                  </h3>
                  <span className="text-xs text-zinc-500">
                    {reviewsAll.length} mostradas · {data.place_info?.user_rating_count} totales
                  </span>
                </div>
                <div className="space-y-3">
                  {reviewsToShow.map((r, i) => (
                    <ReviewItem key={i} idx={i} r={r} />
                  ))}
                </div>
                {reviewsAll.length > 2 && (
                  <button
                    onClick={() => setShowAllReviews((v) => !v)}
                    className="mt-4 w-full text-sm text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
                    data-testid="toggle-all-reviews-btn"
                  >
                    {showAllReviews ? "Ocultar reseñas" : `Ver las ${reviewsAll.length - 2} restantes`}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAllReviews ? "rotate-180" : ""}`} />
                  </button>
                )}
              </Card>
            )}

            {/* ============ TRANSCRIPT - Collapsed by default ============ */}
            {transcript && (
              <Card className="bg-zinc-900/60 border-zinc-800" data-testid="transcript-card">
                <button
                  onClick={() => setShowTranscript((v) => !v)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-zinc-800/30 transition-colors"
                  data-testid="toggle-transcript-btn"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="font-bold text-white">Transcripción del video</p>
                      <p className="text-xs text-zinc-500">
                        {transcript.length.toLocaleString()} caracteres ·{" "}
                        {data.transcription_source === "transcript" && "subtítulos / audio"}
                        {data.transcription_source === "fallback" && "descripción del video"}
                        {data.transcription_source === "none" && "no disponible"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <span className="text-xs">{showTranscript ? "Ocultar" : "Mostrar"}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showTranscript ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {showTranscript && (
                  <div className="px-5 pb-5">
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto pr-2">
                      {transcript}
                    </p>
                    {data.transcription_source === "fallback" && (
                      <p className="mt-3 text-xs text-yellow-400/80">
                        ⚠ No se pudo obtener la transcripción del audio. Se usó la descripción del video.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            )}

            {data.disclaimer && (
              <p className="text-[11px] text-zinc-600 text-center italic max-w-2xl mx-auto">
                {data.disclaimer}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
};

// ---------- Wrapper with view-mode toggle ----------
const FoodieAnalysisDetail = () => {
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return "new";
    return localStorage.getItem("foodie_view_mode") || "new";
  });

  // Floating switcher visible in legacy mode (in new mode it's in the header)
  if (viewMode === "legacy") {
    return (
      <div className="relative">
        <FoodieAnalysisDetailLegacy />
        <button
          onClick={() => {
            localStorage.setItem("foodie_view_mode", "new");
            setViewMode("new");
          }}
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/50 flex items-center gap-2"
          data-testid="switch-to-new-btn"
        >
          <Eye className="w-4 h-4" /> Probar vista dramática
        </button>
      </div>
    );
  }

  return <FoodieAnalysisDetailNew />;
};

export default FoodieAnalysisDetail;
