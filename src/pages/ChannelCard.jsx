import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import axios from "axios";
import {
  Flame,
  Shield,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Minus,
  ExternalLink,
  Share2,
  Copy,
  Check,
  Users,
  Video,
  MessageSquare,
  Calendar,
  ArrowLeft,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const ChannelCard = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchCard();
  }, [slug]);

  const fetchCard = async () => {
    try {
      const response = await axios.get(`${API}/card/${slug}`);
      setCard(response.data);
    } catch (err) {
      setError("Card not found");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("¡Enlace copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCard = () => {
    if (navigator.share) {
      navigator.share({
        title: `${card.channel_name} - SocialHate Verified`,
        text: `Check out ${card.channel_name}'s community health score on SocialHate`,
        url: window.location.href
      });
    } else {
      copyLink();
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-6">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Tarjeta No Encontrada</h1>
        <p className="text-zinc-400 mb-6">Esta tarjeta de canal no existe o ha sido eliminada.</p>
        <Button onClick={() => navigate("/")} className="btn-primary">
          <ArrowLeft className="w-4 h-4 mr-2" /> Ir a SocialHate
        </Button>
      </div>
    );
  }

  const gradeColors = {
    "A+": "from-emerald-500 to-green-600",
    "A": "from-emerald-500 to-green-600",
    "B+": "from-blue-500 to-cyan-600",
    "B": "from-blue-500 to-cyan-600",
    "C+": "from-amber-500 to-yellow-600",
    "C": "from-amber-500 to-yellow-600",
    "D": "from-orange-500 to-red-600",
    "F": "from-red-500 to-red-700"
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-zinc-800">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/")}
          >
            <Flame className="w-6 h-6 text-red-500" />
            <span className="font-heading font-bold text-white">SOCIALHATE</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyLink} className="border-zinc-700 text-zinc-300">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={shareCard} className="border-zinc-700 text-zinc-300">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Card */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Main Card */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border-zinc-700 shadow-2xl">
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
                  <img
                    src={card.channel_avatar || "/placeholder-avatar.png"}
                    alt={card.channel_name}
                    className="w-24 h-24 rounded-full border-4 border-zinc-700 object-cover"
                  />
                  {card.is_verified && (
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1.5">
                      <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <h1 className="text-2xl font-heading font-bold text-white mb-1">
                  {card.channel_name}
                </h1>
                <p className="text-zinc-500 text-sm flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {formatNumber(card.subscriber_count)} suscriptores
                </p>
              </div>

              {/* Grade & Score */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {/* Community Grade */}
                <div className="text-center p-4 bg-zinc-800/50 rounded-xl">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Community Grade</p>
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br ${gradeColors[card.community_grade] || "from-zinc-500 to-zinc-600"}`}>
                    <span className="text-2xl font-black text-white">{card.community_grade}</span>
                  </div>
                </div>

                {/* Hate Score */}
                <div className="text-center p-4 bg-zinc-800/50 rounded-xl">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Hate Score</p>
                  <div className="flex items-center justify-center gap-1">
                    <Flame className={`w-5 h-5 ${card.hate_score <= 5 ? "text-emerald-500" : card.hate_score <= 10 ? "text-amber-500" : "text-red-500"}`} />
                    <span className={`text-3xl font-mono font-bold ${card.hate_score <= 5 ? "text-emerald-500" : card.hate_score <= 10 ? "text-amber-500" : "text-red-500"}`}>
                      {card.hate_score}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Trend */}
              <div className="flex items-center justify-center gap-2 p-3 bg-zinc-800/30 rounded-lg mb-6">
                {card.trend_direction === "down" ? (
                  <>
                    <TrendingDown className="w-5 h-5 text-emerald-500" />
                    <span className="text-emerald-500 font-medium">
                      {Math.abs(card.hate_trend)}% menos hate
                    </span>
                  </>
                ) : card.trend_direction === "up" ? (
                  <>
                    <TrendingUp className="w-5 h-5 text-red-500" />
                    <span className="text-red-500 font-medium">
                      +{Math.abs(card.hate_trend)}% más hate
                    </span>
                  </>
                ) : (
                  <>
                    <Minus className="w-5 h-5 text-zinc-500" />
                    <span className="text-zinc-400 font-medium">Estable</span>
                  </>
                )}
                <span className="text-zinc-600 text-sm">últimos 30 días</span>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="text-center p-2 bg-zinc-800/30 rounded-lg">
                  <Video className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                  <p className="text-white font-bold">{card.total_videos_analyzed}</p>
                  <p className="text-zinc-600 text-xs">Videos</p>
                </div>
                <div className="text-center p-2 bg-zinc-800/30 rounded-lg">
                  <MessageSquare className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                  <p className="text-white font-bold">{formatNumber(card.total_comments_analyzed)}</p>
                  <p className="text-zinc-600 text-xs">Comentarios</p>
                </div>
                <div className="text-center p-2 bg-zinc-800/30 rounded-lg">
                  <Calendar className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                  <p className="text-white font-bold text-sm">{formatDate(card.verified_date)}</p>
                  <p className="text-zinc-600 text-xs">Verificado</p>
                </div>
              </div>

              {/* View Full Analysis Button */}
              <Button 
                onClick={() => navigate(`/channel/${card.channel_db_id}`)}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-3"
              >
                Ver Análisis Completo <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-zinc-900/50 border-t border-zinc-800 flex items-center justify-center gap-2">
              <Flame className="w-4 h-4 text-red-500" />
              <span className="text-xs text-zinc-500">Powered by</span>
              <span className="text-xs font-bold text-zinc-400">SOCIALHATE</span>
            </div>
          </Card>

          {/* Hate Scale Legend */}
          <div className="mt-6 p-4 bg-zinc-900/30 rounded-xl border border-zinc-800">
            <p className="text-xs text-zinc-500 text-center mb-3 uppercase tracking-wider">Escala de Hate</p>
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mb-1"></div>
                <span className="text-emerald-500 font-medium">0-5%</span>
                <span className="text-zinc-600">Bajo</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-amber-500 mb-1"></div>
                <span className="text-amber-500 font-medium">5-15%</span>
                <span className="text-zinc-600">Moderado</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-orange-500 mb-1"></div>
                <span className="text-orange-500 font-medium">15-25%</span>
                <span className="text-zinc-600">Alto</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-red-500 mb-1"></div>
                <span className="text-red-500 font-medium">+25%</span>
                <span className="text-zinc-600">Muy Alto</span>
              </div>
            </div>
          </div>

          {/* Community Grade Legend */}
          <div className="mt-4 p-4 bg-zinc-900/30 rounded-xl border border-zinc-800">
            <p className="text-xs text-zinc-500 text-center mb-3 uppercase tracking-wider">Community Grade</p>
            <div className="grid grid-cols-4 gap-2 text-[10px] mb-3">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">A+</span>
                </div>
                <span className="text-zinc-500">0-3%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">A</span>
                </div>
                <span className="text-zinc-500">3-5%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">B+</span>
                </div>
                <span className="text-zinc-500">5-8%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">B</span>
                </div>
                <span className="text-zinc-500">8-12%</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-[10px]">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">C+</span>
                </div>
                <span className="text-zinc-500">12-18%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">C</span>
                </div>
                <span className="text-zinc-500">18-25%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">D</span>
                </div>
                <span className="text-zinc-500">25-35%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center mb-1">
                  <span className="text-white font-black text-xs">F</span>
                </div>
                <span className="text-zinc-500">+35%</span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 text-center mt-3">
              La nota indica la salud de la comunidad basada en el % de comentarios con hate
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChannelCard;
