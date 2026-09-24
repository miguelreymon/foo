import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  Youtube,
  Utensils,
  MapPin,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Minus,
  Hash,
  TrendingUp,
  Award,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const coherenceColor = (v) => {
  if (v == null) return "text-zinc-400";
  if (v >= 70) return "text-emerald-400";
  if (v >= 40) return "text-yellow-400";
  return "text-red-400";
};
const coherenceLabel = (v) => {
  if (v == null) return { text: "—", icon: Minus, color: "text-zinc-400", bg: "bg-zinc-800/60" };
  if (v >= 70) return { text: "Alta", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (v >= 40) return { text: "Media", icon: Minus, color: "text-yellow-400", bg: "bg-yellow-500/10" };
  return { text: "Baja", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" };
};

const FoodieChannelDetail = () => {
  const { channelName } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/reality-check-channels/${encodeURIComponent(channelName)}`);
        if (!res.ok) throw new Error("No se pudo cargar el canal");
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e.message || "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [channelName]);

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
          <p>{error || "Canal no disponible"}</p>
          <Button className="mt-4" onClick={() => navigate("/foodie-reality")}>Volver</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <header className="border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            data-testid="back-btn"
            onClick={() => navigate("/foodie-reality")}
            className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Foodie Fake</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        {/* Channel header */}
        <Card className="p-6 bg-gradient-to-br from-zinc-900 to-zinc-900/50 border-zinc-800 relative overflow-hidden" data-testid="channel-hero">
          <div className="absolute inset-0 opacity-10">
            {data.latest_thumbnail && (
              <img src={data.latest_thumbnail} alt="" className="w-full h-full object-cover blur-3xl" />
            )}
          </div>
          <div className="relative grid md:grid-cols-3 gap-6 items-center">
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-widest">
                <Youtube className="w-4 h-4 text-red-500" /> Canal analizado
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white" data-testid="channel-title">
                {data.channel_name}
              </h1>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80">
                  <Hash className="w-4 h-4 text-emerald-400" />
                  {data.analyses_count} análisis
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Coherencia media: <b className={coherenceColor(data.avg_coherence)}>{data.avg_coherence}%</b>
                </span>
              </div>
              <div className="pt-2">
                <Link to={`/foodie-card/${encodeURIComponent(data.channel_name)}`}>
                  <Button
                    data-testid="view-card-btn"
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold"
                  >
                    <Award className="w-4 h-4 mr-2" /> Ver tarjeta verificada compartible
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex justify-center md:justify-end">
              <div className={`w-40 h-40 rounded-full bg-zinc-900 border-4 border-zinc-800 flex flex-col items-center justify-center`}>
                <div className={`text-5xl font-black ${coherenceColor(data.avg_coherence)}`}>
                  {Math.round(data.avg_coherence || 0)}
                  <span className="text-lg">%</span>
                </div>
                <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Coherencia</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Analyses list */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Utensils className="w-5 h-5 text-emerald-500" />
            Videos analizados
          </h2>
          {data.analyses.length === 0 ? (
            <Card className="p-10 bg-zinc-900/50 border-zinc-800 text-center text-zinc-500">
              Este canal aún no tiene análisis.
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="analyses-grid">
              {data.analyses.map((a) => {
                const label = coherenceLabel(a.coherence_index);
                const Icon = label.icon;
                return (
                  <Link
                    key={a.id}
                    to={`/foodie-reality/analysis/${a.id}`}
                    className="group"
                    data-testid={`analysis-card-${a.id}`}
                  >
                    <Card className="overflow-hidden bg-zinc-900/60 border-zinc-800 hover:border-emerald-500/50 transition-all h-full">
                      <div className="aspect-video relative bg-zinc-950">
                        {a.thumbnail_url && (
                          <img src={a.thumbnail_url} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                        )}
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full">
                          <Icon className={`w-3.5 h-3.5 ${label.color}`} />
                          <span className={`text-xs font-bold ${label.color}`}>
                            {a.coherence_index != null ? `${Math.round(a.coherence_index)}%` : "—"}
                          </span>
                        </div>
                        {a.status !== "completed" && (
                          <div className="absolute bottom-2 left-2 text-xs px-2 py-1 rounded bg-yellow-500/80 text-black font-semibold uppercase">
                            {a.status}
                          </div>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <h3 className="font-bold text-sm text-white line-clamp-2 group-hover:text-emerald-400 transition-colors">
                          {a.video_title || "Sin título"}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <Utensils className="w-3 h-3 text-emerald-500" />
                          <span className="truncate">{a.restaurant_name}</span>
                          {a.restaurant_location && (
                            <>
                              <MapPin className="w-3 h-3 text-zinc-500 ml-1" />
                              <span className="truncate">{a.restaurant_location}</span>
                            </>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500">
                          {a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}
                        </p>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default FoodieChannelDetail;
