import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Utensils,
  ShieldCheck,
  Award,
  TrendingDown,
  TrendingUp,
  Minus,
  ExternalLink,
  Share2,
  Copy,
  Check,
  Hash,
  Star,
  MessageSquare,
  Calendar,
  ArrowLeft,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const FoodieCardPage = () => {
  const { channelSlug } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/foodie-card/${channelSlug}`);
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.detail || "Card not found");
        }
        const j = await r.json();
        setCard(j);
        if (j?.channel_name) {
          document.title = `${j.channel_name} · ${j.avg_coherence}% coherencia · Foodie Fake`;
        }
      } catch (e) {
        setError(e.message || "Card not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [channelSlug]);

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("¡Enlace copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCard = () => {
    if (navigator.share && card) {
      navigator.share({
        title: `${card.channel_name} - Foodie Fake Verified`,
        text: `Mira la coherencia de ${card.channel_name} en Foodie Fake (${card.avg_coherence}%)`,
        url: window.location.href,
      });
    } else {
      copyLink();
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-6">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Tarjeta No Encontrada</h1>
        <p className="text-zinc-400 mb-6">Esta tarjeta de canal no existe o aún no tiene análisis.</p>
        <Button onClick={() => navigate("/foodie-reality")} className="bg-emerald-600 hover:bg-emerald-700">
          <ArrowLeft className="w-4 h-4 mr-2" /> Ir a Foodie Fake
        </Button>
      </div>
    );
  }

  const gradeColors = {
    "A+": "from-emerald-500 to-green-600",
    "A": "from-emerald-500 to-green-600",
    "B+": "from-teal-500 to-emerald-600",
    "B": "from-teal-500 to-emerald-600",
    "C+": "from-amber-500 to-yellow-600",
    "C": "from-amber-500 to-yellow-600",
    "D": "from-orange-500 to-red-600",
    "F": "from-red-500 to-red-700",
  };

  const coherenceColorClass =
    card.avg_coherence >= 70
      ? "text-emerald-500"
      : card.avg_coherence >= 40
      ? "text-amber-500"
      : "text-red-500";

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-zinc-800">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/foodie-reality")}
            data-testid="header-logo"
          >
            <Utensils className="w-6 h-6 text-emerald-500" />
            <span className="font-heading font-bold text-white">FOODIE FAKE</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              data-testid="copy-btn"
              className="border-zinc-700 text-zinc-300"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={shareCard}
              data-testid="share-btn"
              className="border-zinc-700 text-zinc-300"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Card */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Main Card */}
          <Card
            className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border-zinc-700 shadow-2xl"
            data-testid="viral-card"
          >
            {/* Verified Badge Ribbon */}
            {card.is_verified && (
              <div className="absolute top-4 right-4">
                <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/50 rounded-full px-3 py-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400">VERIFICADO</span>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="p-8">
              {/* Avatar & Name */}
              <div className="flex flex-col items-center text-center mb-8">
                <div className="relative mb-4">
                  {card.channel_avatar ? (
                    <img
                      src={card.channel_avatar}
                      alt={card.channel_name}
                      className="w-24 h-24 rounded-full border-4 border-zinc-700 object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full border-4 border-zinc-700 bg-zinc-800 flex items-center justify-center">
                      <Utensils className="w-10 h-10 text-emerald-500" />
                    </div>
                  )}
                  {card.is_verified && (
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1.5">
                      <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <h1 className="text-2xl font-heading font-bold text-white mb-1" data-testid="channel-name">
                  {card.channel_name}
                </h1>
                <p className="text-zinc-500 text-sm flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {card.analyses_count} análisis · {card.restaurants_analyzed} restaurantes
                </p>
              </div>

              {/* Grade & Score */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {/* Veracity Grade */}
                <div className="text-center p-4 bg-zinc-800/50 rounded-xl">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Veracidad</p>
                  <div
                    className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br ${
                      gradeColors[card.coherence_grade] || "from-zinc-500 to-zinc-600"
                    }`}
                    data-testid="grade-badge"
                  >
                    <span className="text-2xl font-black text-white">{card.coherence_grade}</span>
                  </div>
                </div>

                {/* Coherence Score */}
                <div className="text-center p-4 bg-zinc-800/50 rounded-xl">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Coherencia</p>
                  <div className="flex items-center justify-center gap-1">
                    <Star className={`w-5 h-5 ${coherenceColorClass}`} />
                    <span className={`text-3xl font-mono font-bold ${coherenceColorClass}`}>
                      {Math.round(card.avg_coherence)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Trend */}
              <div className="flex items-center justify-center gap-2 p-3 bg-zinc-800/30 rounded-lg mb-6">
                {card.trend_direction === "up" ? (
                  <>
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    <span className="text-emerald-500 font-medium">
                      +{Math.abs(card.coherence_trend || 0)}% más coherente
                    </span>
                  </>
                ) : card.trend_direction === "down" ? (
                  <>
                    <TrendingDown className="w-5 h-5 text-red-500" />
                    <span className="text-red-500 font-medium">
                      -{Math.abs(card.coherence_trend || 0)}% menos coherente
                    </span>
                  </>
                ) : (
                  <>
                    <Minus className="w-5 h-5 text-zinc-500" />
                    <span className="text-zinc-400 font-medium">Estable</span>
                  </>
                )}
                <span className="text-zinc-600 text-sm">últimos análisis</span>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="text-center p-2 bg-zinc-800/30 rounded-lg">
                  <Utensils className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                  <p className="text-white font-bold">{card.restaurants_analyzed}</p>
                  <p className="text-zinc-600 text-xs">Restaurantes</p>
                </div>
                <div className="text-center p-2 bg-zinc-800/30 rounded-lg">
                  <MessageSquare className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                  <p className="text-white font-bold">{card.total_reviews_contrasted}</p>
                  <p className="text-zinc-600 text-xs">Reseñas reales</p>
                </div>
                <div className="text-center p-2 bg-zinc-800/30 rounded-lg">
                  <Calendar className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                  <p className="text-white font-bold text-sm">{formatDate(card.verified_date)}</p>
                  <p className="text-zinc-600 text-xs">Verificado</p>
                </div>
              </div>

              {/* View Full Analysis Button */}
              <Button
                onClick={() =>
                  navigate(`/foodie-reality/channel/${encodeURIComponent(card.channel_name)}`)
                }
                data-testid="view-full-btn"
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3"
              >
                Ver Análisis Completo <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-zinc-900/50 border-t border-zinc-800 flex items-center justify-center gap-2">
              <Utensils className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-zinc-500">Powered by</span>
              <span className="text-xs font-bold text-zinc-400">FOODIE FAKE</span>
            </div>
          </Card>

          {/* Coherence Scale Legend */}
          <div className="mt-6 p-4 bg-zinc-900/30 rounded-xl border border-zinc-800">
            <p className="text-xs text-zinc-500 text-center mb-3 uppercase tracking-wider">Escala de Coherencia</p>
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mb-1"></div>
                <span className="text-emerald-500 font-medium">80-100%</span>
                <span className="text-zinc-600">Top</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-teal-500 mb-1"></div>
                <span className="text-teal-500 font-medium">60-79%</span>
                <span className="text-zinc-600">Fiable</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-amber-500 mb-1"></div>
                <span className="text-amber-500 font-medium">40-59%</span>
                <span className="text-zinc-600">Irregular</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-red-500 mb-1"></div>
                <span className="text-red-500 font-medium">0-39%</span>
                <span className="text-zinc-600">Alto hype</span>
              </div>
            </div>
          </div>

          {/* Veracity Grade Legend */}
          <div className="mt-4 p-4 bg-zinc-900/30 rounded-xl border border-zinc-800">
            <p className="text-xs text-zinc-500 text-center mb-3 uppercase tracking-wider">Nota de Veracidad</p>
            <div className="grid grid-cols-4 gap-2 text-[10px] mb-3">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">A+</span>
                </div>
                <span className="text-zinc-500">90-100%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">A</span>
                </div>
                <span className="text-zinc-500">80-89%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">B+</span>
                </div>
                <span className="text-zinc-500">70-79%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">B</span>
                </div>
                <span className="text-zinc-500">60-69%</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-[10px]">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">C+</span>
                </div>
                <span className="text-zinc-500">50-59%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">C</span>
                </div>
                <span className="text-zinc-500">40-49%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">D</span>
                </div>
                <span className="text-zinc-500">25-39%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">F</span>
                </div>
                <span className="text-zinc-500">0-24%</span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 text-center mt-3">
              La nota mide cuánto coinciden las recomendaciones del creador con la experiencia real de clientes en Google
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FoodieCardPage;
