import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft,
  Youtube,
  Utensils,
  MapPin,
  Star,
  Users,
  FileText,
  MessageSquare,
  Info,
  CheckCircle,
  AlertTriangle,
  Minus,
  TrendingUp,
  TrendingDown,
  Loader2,
  Mic,
  Database,
  ChevronRight,
  Quote,
  Phone,
  Clock,
  Globe,
  ExternalLink,
  Euro,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const coherenceColor = (v) => {
  if (v == null) return "text-zinc-400";
  if (v >= 70) return "text-emerald-400";
  if (v >= 40) return "text-yellow-400";
  return "text-red-400";
};
const coherenceBg = (v) => {
  if (v == null) return "bg-zinc-800";
  if (v >= 70) return "bg-emerald-500";
  if (v >= 40) return "bg-yellow-500";
  return "bg-red-500";
};
const coherenceLabel = (v) => {
  if (v == null) return { text: "Sin datos", icon: Minus, color: "text-zinc-400", bg: "bg-zinc-800/60" };
  if (v >= 70) return { text: "Alta coherencia", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/20" };
  if (v >= 40) return { text: "Coherencia media", icon: Minus, color: "text-yellow-400", bg: "bg-yellow-500/20" };
  return { text: "Baja coherencia", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/20" };
};

const gapIcon = (gap) => {
  const g = (gap || "").toLowerCase();
  if (g === "bajo" || g === "low") return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (g === "medio" || g === "medium") return <Minus className="w-4 h-4 text-yellow-400" />;
  return <TrendingDown className="w-4 h-4 text-red-400" />;
};

const FoodieAnalysisDetailLegacy = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

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

  const transcript = useMemo(() => {
    if (!data?.transcript_text) return "";
    return data.transcript_text.replace(/^TRANSCRIPCIÓN DEL AUDIO:\s*/i, "").replace(/^TÍTULO:\s*/i, "");
  }, [data]);

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

  const label = coherenceLabel(data.coherence_index);
  const Icon = label.icon;
  const isProcessing = data.status === "processing";
  const isFailed = data.status === "failed";

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
          <Link
            to={`/foodie-reality/channel/${encodeURIComponent(data.channel_name || "")}`}
            className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            data-testid="link-channel"
          >
            Ver canal <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <Card className="p-0 overflow-hidden bg-zinc-900/70 border-zinc-800" data-testid="hero-card">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Embedded YouTube */}
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
              <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wider">
                <Youtube className="w-4 h-4 text-red-500" /> Foodie Reality Check
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
              <div className="flex flex-wrap items-center gap-3 text-sm mt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80">
                  <Utensils className="w-4 h-4 text-emerald-400" /> {data.restaurant_name}
                </span>
                {data.restaurant_location && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80">
                    <MapPin className="w-4 h-4 text-zinc-400" /> {data.restaurant_location}
                  </span>
                )}
                {data.restaurant_rating != null && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-300">
                    <Star className="w-4 h-4 fill-yellow-400" /> {data.restaurant_rating}/5
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Creado: {data.created_at ? new Date(data.created_at).toLocaleString() : "—"}
              </p>
            </div>
          </div>
        </Card>

        {isProcessing && (
          <Card className="p-6 bg-zinc-900/70 border-zinc-800 flex items-center gap-4" data-testid="processing-banner">
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

        {/* Coherence Index */}
        {data.status === "completed" && (
          <>
            <Card className="p-8 bg-gradient-to-br from-zinc-900 to-zinc-900/40 border-zinc-800 relative overflow-hidden" data-testid="coherence-card">
              <div className={`absolute inset-x-0 top-0 h-1.5 ${coherenceBg(data.coherence_index)}`} />
              <div className="grid md:grid-cols-3 gap-8 items-center">
                <div className="md:col-span-1 text-center">
                  <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Índice de coherencia</p>
                  <div className={`text-7xl font-black ${coherenceColor(data.coherence_index)}`}>
                    {Math.round(data.coherence_index ?? 0)}
                    <span className="text-2xl text-zinc-500 font-bold">%</span>
                  </div>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full mt-3 ${label.bg}`}>
                    <Icon className={`w-4 h-4 ${label.color}`} />
                    <span className={`text-sm font-semibold ${label.color}`}>{label.text}</span>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-4">
                  <Progress value={data.coherence_index || 0} className="h-3 bg-zinc-800" />
                  <p className="text-sm text-zinc-300 leading-relaxed" data-testid="summary-text">
                    {data.analysis_summary || "Sin resumen disponible."}
                  </p>
                  {data.confidence_level && (
                    <p className="text-xs text-zinc-500">
                      Nivel de confianza del análisis: <span className="text-zinc-300 uppercase">{data.confidence_level}</span>
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Data sources */}
            <div className="grid sm:grid-cols-3 gap-3" data-testid="sources-row">
              <Card className="p-4 bg-zinc-900/60 border-zinc-800 flex items-center gap-3">
                <Mic className={`w-5 h-5 ${data.transcription_source === "transcript" ? "text-emerald-400" : "text-yellow-400"}`} />
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Transcripción</p>
                  <p className="text-sm font-semibold">
                    {data.transcription_source === "transcript" && "Subtítulos / audio"}
                    {data.transcription_source === "fallback" && "Descripción del video"}
                    {data.transcription_source === "none" && "No disponible"}
                    {!data.transcription_source && "—"}
                  </p>
                </div>
              </Card>
              <Card className="p-4 bg-zinc-900/60 border-zinc-800 flex items-center gap-3">
                <Database className={`w-5 h-5 ${data.reviews_count > 0 ? "text-emerald-400" : "text-yellow-400"}`} />
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Reseñas reales</p>
                  <p className="text-sm font-semibold">
                    {data.reviews_count || 0} encontradas
                    {data.reviews_source && data.reviews_source !== "none" && (
                      <span className="text-zinc-500 font-normal"> · {data.reviews_source}</span>
                    )}
                  </p>
                </div>
              </Card>
              <Card className="p-4 bg-zinc-900/60 border-zinc-800 flex items-center gap-3">
                <Star className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Rating real</p>
                  <p className="text-sm font-semibold">
                    {data.restaurant_rating != null ? `${data.restaurant_rating}/5` : "N/D"}
                  </p>
                </div>
              </Card>
            </div>

            {/* Influencer vs Community */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-6 bg-zinc-900/60 border-zinc-800 space-y-4" data-testid="influencer-card">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Youtube className="w-5 h-5 text-red-500" /> Dice el influencer
                </h3>
                {data.influencer_sentiment && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Tono general:</span>
                      <span className="text-white capitalize">{data.influencer_sentiment.overall_tone || "—"}</span>
                    </div>
                    {typeof data.influencer_sentiment.score === "number" && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Score:</span>
                        <span className="text-white">{Math.round(data.influencer_sentiment.score * 100)}/100</span>
                      </div>
                    )}
                    {data.influencer_sentiment.key_claims?.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Afirmaciones clave</p>
                        <ul className="space-y-1.5">
                          {data.influencer_sentiment.key_claims.map((c, i) => (
                            <li key={i} className="text-sm text-zinc-200 flex gap-2">
                              <span className="text-emerald-400">•</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.influencer_sentiment.suspicious_patterns?.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Patrones sospechosos</p>
                        <div className="flex flex-wrap gap-1.5">
                          {data.influencer_sentiment.suspicious_patterns.map((p, i) => (
                            <span key={i} className="text-xs bg-red-500/10 text-red-300 border border-red-500/20 px-2 py-1 rounded">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {data.influencer_sentiment.positive_indicators?.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Indicadores positivos</p>
                        <div className="flex flex-wrap gap-1.5">
                          {data.influencer_sentiment.positive_indicators.map((p, i) => (
                            <span key={i} className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-1 rounded">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>

              <Card className="p-6 bg-zinc-900/60 border-zinc-800 space-y-4" data-testid="community-card">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-500" /> Dicen los clientes
                </h3>
                {data.community_sentiment && (
                  <>
                    {data.community_sentiment.estimated_rating != null && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Rating estimado:</span>
                        <span className="text-white flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          {data.community_sentiment.estimated_rating}/5
                        </span>
                      </div>
                    )}
                    {data.community_sentiment.typical_experience && (
                      <p className="text-sm text-zinc-300 leading-relaxed italic">
                        “{data.community_sentiment.typical_experience}”
                      </p>
                    )}
                    {data.community_sentiment.common_positives?.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Puntos positivos</p>
                        <div className="flex flex-wrap gap-1.5">
                          {data.community_sentiment.common_positives.map((p, i) => (
                            <span key={i} className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-1 rounded">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {data.community_sentiment.common_complaints?.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Quejas comunes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {data.community_sentiment.common_complaints.map((p, i) => (
                            <span key={i} className="text-xs bg-red-500/10 text-red-300 border border-red-500/20 px-2 py-1 rounded">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            </div>

            {/* Gap analysis */}
            {data.gap_analysis && (
              <Card className="p-6 bg-zinc-900/60 border-zinc-800 space-y-4" data-testid="gap-card">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-400" /> Análisis de discrepancias
                  </h3>
                  <span className="inline-flex items-center gap-1.5 text-sm text-zinc-300 bg-zinc-800 px-3 py-1 rounded-full">
                    {gapIcon(data.gap_analysis.perception_gap)}
                    Gap: <b className="capitalize">{data.gap_analysis.perception_gap || "—"}</b>
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Discrepancias</p>
                    {data.gap_analysis.main_discrepancies?.length > 0 ? (
                      <ul className="space-y-1.5 text-sm text-zinc-200">
                        {data.gap_analysis.main_discrepancies.map((d, i) => (
                          <li key={i} className="flex gap-2">
                            <TrendingDown className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-zinc-500">Sin discrepancias relevantes.</p>}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Coincidencias</p>
                    {data.gap_analysis.aligned_points?.length > 0 ? (
                      <ul className="space-y-1.5 text-sm text-zinc-200">
                        {data.gap_analysis.aligned_points.map((d, i) => (
                          <li key={i} className="flex gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-zinc-500">Sin coincidencias reportadas.</p>}
                  </div>
                </div>
              </Card>
            )}

            {/* Place info card (Google Places) */}
            {data.place_info && (
              <Card className="p-6 bg-zinc-900/60 border-zinc-800 space-y-4" data-testid="place-info-card">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Restaurante verificado</p>
                    <h3 className="font-bold text-white text-xl">
                      {data.place_info.display_name}
                    </h3>
                    {data.place_info.formatted_address && (
                      <p className="text-sm text-zinc-400 flex items-center gap-1.5 mt-1">
                        <MapPin className="w-4 h-4 text-emerald-400" />
                        {data.place_info.formatted_address}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {data.place_info.rating != null && (
                      <div className="text-center">
                        <div className="text-3xl font-black text-yellow-400 flex items-center gap-1.5">
                          <Star className="w-6 h-6 fill-yellow-400" />
                          {data.place_info.rating}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {data.place_info.user_rating_count} reseñas en Google
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  {data.place_info.phone && (
                    <a
                      href={`tel:${data.place_info.phone}`}
                      className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                    >
                      <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-zinc-200 text-xs truncate">{data.place_info.phone}</span>
                    </a>
                  )}
                  {data.place_info.website_uri && (
                    <a
                      href={data.place_info.website_uri}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                    >
                      <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-zinc-200 text-xs truncate">Web del restaurante</span>
                    </a>
                  )}
                  {data.place_info.google_maps_uri && (
                    <a
                      href={data.place_info.google_maps_uri}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-zinc-200 text-xs truncate">Ver en Google Maps</span>
                    </a>
                  )}
                  {data.place_info.price_level && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
                      <Euro className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-zinc-200 text-xs">
                        {data.place_info.price_level.replace("PRICE_LEVEL_", "").toLowerCase()}
                      </span>
                    </div>
                  )}
                </div>

                {data.place_info.opening_hours?.length > 0 && (
                  <details className="group" data-testid="opening-hours-details">
                    <summary className="cursor-pointer text-sm text-zinc-300 flex items-center gap-2 hover:text-white">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      Horario de apertura
                      <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                    </summary>
                    <ul className="mt-2 pl-6 text-sm text-zinc-400 space-y-1">
                      {data.place_info.opening_hours.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>
            )}

            {/* Detailed real reviews (with author + rating + date) */}
            {data.place_info?.reviews_detailed?.length > 0 ? (
              <Card className="p-6 bg-zinc-900/60 border-zinc-800" data-testid="reviews-detailed-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-500" /> Reseñas reales de Google
                  </h3>
                  <span className="text-xs text-zinc-500">
                    {data.place_info.reviews_detailed.length} mostradas · {data.place_info.user_rating_count} totales
                  </span>
                </div>
                <div className="space-y-3">
                  {data.place_info.reviews_detailed.map((r, i) => (
                    <div key={i} className="p-4 rounded-lg bg-zinc-800/40 border border-zinc-800">
                      <div className="flex items-center gap-3 mb-2">
                        {r.author_photo ? (
                          <img src={r.author_photo} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{r.author}</p>
                          <p className="text-[11px] text-zinc-500">{r.relative_time}</p>
                        </div>
                        {r.rating != null && (
                          <div className="flex items-center gap-0.5 text-yellow-400">
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Star
                                key={idx}
                                className={`w-3.5 h-3.5 ${idx < r.rating ? "fill-yellow-400" : "text-zinc-700"}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                        {r.text}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            ) : data.reviews_list?.length > 0 && (
              <Card className="p-6 bg-zinc-900/60 border-zinc-800" data-testid="reviews-card">
                <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-emerald-500" /> Reseñas reales ({data.reviews_list.length})
                </h3>
                <div className="space-y-3">
                  {data.reviews_list.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800 text-sm text-zinc-200 flex gap-3">
                      <Quote className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Transcript */}
            {transcript && (
              <Card className="p-6 bg-zinc-900/60 border-zinc-800" data-testid="transcript-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" /> Transcripción del video
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFullTranscript((v) => !v)}
                    className="bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700"
                    data-testid="toggle-transcript-btn"
                  >
                    {showFullTranscript ? "Reducir" : "Ver completa"}
                  </Button>
                </div>
                <p className={`text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap ${showFullTranscript ? "" : "line-clamp-[10]"}`}>
                  {transcript}
                </p>
                {data.transcription_source === "fallback" && (
                  <p className="mt-3 text-xs text-yellow-400/80">
                    ⚠ No se pudo obtener la transcripción del audio. Se usó la descripción del video.
                  </p>
                )}
              </Card>
            )}

            {data.disclaimer && (
              <p className="text-xs text-zinc-500 text-center italic">{data.disclaimer}</p>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default FoodieAnalysisDetailLegacy;
