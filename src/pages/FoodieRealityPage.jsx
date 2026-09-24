import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Youtube,
  Utensils,
  ArrowRight,
  Loader2,
  X,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Minus,
  Info,
  MapPin,
  Users,
  XCircle,
  Hash,
  ChevronRight,
  Sparkles,
  Star,
  Upload,
  Shield,
  Eye,
  Zap,
  Lock,
  Mic,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getCoherenceColor = (v) => {
  if (v == null) return "text-zinc-400";
  if (v >= 70) return "text-emerald-400";
  if (v >= 40) return "text-yellow-400";
  return "text-red-400";
};

const FoodieRealityPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantLocation, setRestaurantLocation] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisId, setAnalysisId] = useState(null);
  const [error, setError] = useState(null);

  // Progress popup
  const [showProgressPopup, setShowProgressPopup] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const pollingRef = useRef(null);

  // Lists
  const [channels, setChannels] = useState([]);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // Suggest restaurant from video
  const [suggesting, setSuggesting] = useState(false);
  const [suggestResult, setSuggestResult] = useState(null);

  // Autocomplete
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const autocompleteTimer = useRef(null);

  useEffect(() => {
    fetchLists();
  }, []);

  // Poll for the analysis currently being created -> redirect when done
  useEffect(() => {
    if (!analysisId) return;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/reality-check/${analysisId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "processing") {
          setAnalysisProgress((prev) => Math.min(prev + 12, 90));
        }
        if (data.status === "completed") {
          setAnalysisProgress(100);
          clearInterval(pollingRef.current);
          setShowProgressPopup(false);
          setIsAnalyzing(false);
          toast.success("Análisis completado");
          navigate(`/foodie-reality/analysis/${analysisId}`);
        } else if (data.status === "failed") {
          clearInterval(pollingRef.current);
          setShowProgressPopup(false);
          setIsAnalyzing(false);
          toast.error("El análisis falló");
          navigate(`/foodie-reality/analysis/${analysisId}`);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [analysisId, navigate]);

  const fetchLists = async () => {
    setLoadingLists(true);
    try {
      const [chRes, reRes] = await Promise.all([
        fetch(`${API}/reality-check-channels`),
        fetch(`${API}/reality-checks?limit=8`),
      ]);
      const chData = chRes.ok ? await chRes.json() : [];
      const reData = reRes.ok ? await reRes.json() : [];
      setChannels(chData);
      setRecentAnalyses(reData);
    } catch (err) {
      console.error("Failed to fetch lists:", err);
    } finally {
      setLoadingLists(false);
    }
  };

  const isValidYoutubeUrl = (url) => /youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|tiktok\.com\/|vm\.tiktok\.com\/|vt\.tiktok\.com\//.test(url || "");

  const handleSuggestRestaurant = async () => {
    if (!videoUrl.trim() || !isValidYoutubeUrl(videoUrl)) {
      toast.error("Introduce una URL de YouTube o TikTok válida primero");
      return;
    }
    setSuggesting(true);
    setSuggestResult(null);
    try {
      const res = await fetch(`${API}/reality-check/suggest-restaurant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error detectando restaurante");

      setSuggestResult(data);

      if (data.restaurant_name && (data.confidence || 0) >= 0.4) {
        setRestaurantName(data.restaurant_name);
        if (data.location) setRestaurantLocation(data.location);
        toast.success(
          data.verified_place
            ? `Detectado: ${data.restaurant_name} (verificado en Google Maps)`
            : `Detectado: ${data.restaurant_name}`
        );
      } else {
        toast.info("No hemos podido localizar el restaurante. Búscalo tú mismo.");
      }
    } catch (err) {
      toast.error(err.message || "Error detectando restaurante");
    } finally {
      setSuggesting(false);
    }
  };

  const fetchAutocomplete = async (q) => {
    if ((q || "").trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const url = `${API}/reality-check/autocomplete?q=${encodeURIComponent(q)}${restaurantLocation ? `&location=${encodeURIComponent(restaurantLocation)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const onRestaurantNameChange = (value) => {
    setRestaurantName(value);
    setShowSuggestions(true);
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    autocompleteTimer.current = setTimeout(() => fetchAutocomplete(value), 250);
  };

  const pickSuggestion = (s) => {
    setRestaurantName(s.main_text || s.full_text || "");
    if (s.secondary_text) {
      // Try to extract city from secondary_text (e.g. "Calle ..., Madrid")
      const parts = s.secondary_text.split(",").map((x) => x.trim());
      const city = parts[parts.length - 1];
      if (city) setRestaurantLocation(city);
    }
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleAnalyze = async () => {
    if (!videoUrl.trim() || !restaurantName.trim()) {
      toast.error("Introduce la URL del video y el nombre del restaurante");
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    setAnalysisProgress(10);
    setAnalysisStatus("Iniciando análisis...");
    setShowProgressPopup(true);

    try {
      const response = await fetch(`${API}/reality-check/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: videoUrl,
          restaurant_name: restaurantName,
          restaurant_location: restaurantLocation,
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Error de servidor. Inténtalo de nuevo.");
      }

      if (!response.ok) {
        throw new Error(data.detail || "Error al iniciar el análisis");
      }

      setAnalysisId(data.id);
      setAnalysisStatus("Obteniendo transcripción...");
      setAnalysisProgress(25);
      setTimeout(() => setAnalysisStatus("Buscando reseñas reales..."), 6000);
      setTimeout(() => {
        setAnalysisStatus("Comparando percepciones con IA...");
        setAnalysisProgress((p) => Math.max(p, 55));
      }, 14000);
    } catch (err) {
      setError(err.message || "Error desconocido");
      setIsAnalyzing(false);
      setShowProgressPopup(false);
      toast.error(err.message);
    }
  };

  const cancelAnalysis = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setShowProgressPopup(false);
    setIsAnalyzing(false);
    setAnalysisId(null);
    toast.info("Análisis cancelado (continúa en segundo plano)");
  };

  return (
    <div className="min-h-screen bg-[#09090B] relative overflow-hidden text-white">
      {/* Progress popup */}
      {showProgressPopup && (
        <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-300">
          <div className="bg-zinc-900/95 backdrop-blur-md border-b border-zinc-700 shadow-2xl">
            <div className="max-w-3xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                    <div className="absolute inset-0 w-6 h-6 bg-emerald-500/20 rounded-full animate-ping" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Analizando video</h3>
                    <p className="text-sm text-zinc-400">{analysisStatus}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelAnalysis}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                  data-testid="cancel-analysis-btn"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="relative">
                <Progress value={analysisProgress} className="h-2 bg-zinc-800" />
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-zinc-500">Transcripción + Reseñas + IA</span>
                  <span className="text-xs text-emerald-500 font-mono font-bold">{analysisProgress}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#09090B]/80 via-[#09090B]/90 to-[#09090B]" />

      <div className="relative z-10">
        {/* Header */}
        <header className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-emerald-500">
              <svg className="w-6 h-8" viewBox="0 0 24 32" fill="currentColor">
                <path d="M4 1v10c0 2 2 3 4 3v17h4V14c2 0 4-1 4-3V1h-3v9h-2V1h-2v9H7V1H4z" />
              </svg>
              <svg className="w-5 h-8" viewBox="0 0 20 32" fill="currentColor">
                <path d="M8 1c-4 4-6 8-6 14v2h6v14h4V17h6v-2c0-6-2-10-6-14h-4z" />
              </svg>
            </div>
            <span className="text-2xl font-black tracking-tight">
              <span className="text-white">FOODIE </span>
              <span className="text-emerald-500">FAKE</span>
            </span>
            <span className="text-xs text-zinc-500 hidden sm:inline ml-1">by SocialHate</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="bg-zinc-800/50 border-zinc-700 hover:bg-zinc-700 text-white"
            >
              <span className="hidden sm:inline">Ir a SocialHate</span>
              <ArrowRight className="w-4 h-4 sm:ml-2" />
            </Button>
          </div>
        </header>

        {/* Hero + Form */}
        <main className="px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-12 gap-8 mb-12">
              <div className="lg:col-span-5 space-y-6">
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                  ¿Coincide el <span className="text-emerald-500">influencer</span>
                  <br />
                  con la <span className="text-emerald-500">realidad</span>?
                </h1>
                <p className="text-zinc-400 text-lg">
                  Comparamos lo que dicen los foodies con las opiniones reales de clientes. Tú decides.
                </p>

                <Card className="p-6 bg-zinc-900/50 border-zinc-800 space-y-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Youtube className="w-5 h-5 text-red-500" />
                    Analizar video de foodie
                    <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                      YouTube + TikTok
                    </span>
                  </h3>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Input
                        data-testid="video-url-input"
                        placeholder="YouTube o TikTok: https://youtube.com/watch?v=... · https://tiktok.com/@..."
                        value={videoUrl}
                        onChange={(e) => {
                          setVideoUrl(e.target.value);
                          setSuggestResult(null);
                        }}
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                        disabled={isAnalyzing}
                      />
                      <Button
                        type="button"
                        onClick={handleSuggestRestaurant}
                        disabled={!videoUrl || suggesting || isAnalyzing}
                        variant="outline"
                        data-testid="suggest-btn"
                        className="w-full bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 text-emerald-300 hover:text-emerald-200 gap-2"
                      >
                        {suggesting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Detectando restaurante...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Detectar restaurante automáticamente
                          </>
                        )}
                      </Button>
                      {suggestResult && (
                        <div
                          className={`text-xs p-2 rounded border flex items-start gap-2 ${
                            suggestResult.restaurant_name && suggestResult.confidence >= 0.4
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                              : "bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
                          }`}
                          data-testid="suggest-result"
                        >
                          {suggestResult.restaurant_name && suggestResult.confidence >= 0.4 ? (
                            <>
                              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-semibold">
                                  {suggestResult.restaurant_name}
                                  {suggestResult.verified_place && (
                                    <span className="ml-2 text-emerald-400/80">✓ Google Maps</span>
                                  )}
                                </p>
                                {suggestResult.verified_place?.formatted_address && (
                                  <p className="text-emerald-400/70 text-[11px] mt-0.5">
                                    {suggestResult.verified_place.formatted_address}
                                    {suggestResult.verified_place.rating && (
                                      <span className="ml-2">
                                        ⭐ {suggestResult.verified_place.rating} ({suggestResult.verified_place.user_rating_count})
                                      </span>
                                    )}
                                  </p>
                                )}
                                <p className="text-[11px] opacity-70 mt-1">{suggestResult.reasoning}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold">No hemos podido localizar el restaurante</p>
                                <p className="text-[11px] opacity-80 mt-0.5">Búscalo tú mismo y escríbelo abajo.</p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <Utensils className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10" />
                        <Input
                          data-testid="restaurant-name-input"
                          placeholder="Restaurante *"
                          value={restaurantName}
                          onChange={(e) => onRestaurantNameChange(e.target.value)}
                          onFocus={() => restaurantName && setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                          className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                          disabled={isAnalyzing}
                          autoComplete="off"
                        />
                        {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
                          <div
                            className="absolute top-full left-0 right-0 z-50 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden max-h-80 overflow-y-auto"
                            data-testid="autocomplete-dropdown"
                          >
                            {loadingSuggestions && suggestions.length === 0 && (
                              <div className="p-3 text-xs text-zinc-500 flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                              </div>
                            )}
                            {suggestions.map((s) => (
                              <button
                                key={s.place_id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  pickSuggestion(s);
                                }}
                                data-testid={`autocomplete-item-${s.place_id}`}
                                className="w-full text-left p-3 hover:bg-zinc-800 border-b border-zinc-800 last:border-0 transition-colors"
                              >
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white font-medium truncate">{s.main_text}</p>
                                    <p className="text-[11px] text-zinc-500 truncate">{s.secondary_text}</p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input
                          data-testid="location-input"
                          placeholder="Ciudad"
                          value={restaurantLocation}
                          onChange={(e) => setRestaurantLocation(e.target.value)}
                          className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                          disabled={isAnalyzing}
                        />
                      </div>
                    </div>
                    <Button
                      data-testid="analyze-btn"
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-6"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !videoUrl || !restaurantName}
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Analizando...
                        </>
                      ) : (
                        <>
                          Verificar coherencia
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400">
                      <XCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}
                </Card>

                <Card className="p-6 bg-zinc-900/50 border-zinc-800 space-y-6">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Info className="w-5 h-5 text-emerald-500" />
                    ¿Cómo funciona?
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { n: 1, t: "Analizamos el video", d: "Extraemos tono, claims y contenido." },
                      { n: 2, t: "Buscamos reseñas reales", d: "Contrastamos con opiniones de clientes reales." },
                      { n: 3, t: "Índice de coherencia", d: "Medimos la diferencia influencer vs clientes." },
                    ].map((s) => (
                      <div key={s.n} className="text-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                          <span className="text-emerald-400 font-bold text-lg">{s.n}</span>
                        </div>
                        <h4 className="font-semibold text-white text-sm mb-2">{s.t}</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">{s.d}</p>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500 text-center flex items-center justify-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      Este análisis es orientativo. No afirmamos si alguien miente o dice la verdad.
                    </p>
                  </div>
                </Card>
              </div>

              {/* Right column - Canales + Videos recientes */}
              <div className="lg:col-span-7 space-y-8">
                {/* Canales */}
                <section data-testid="channels-section">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-500" />
                      Canales analizados
                    </h2>
                    {channels.length > 0 && (
                      <span className="text-xs text-zinc-500">{channels.length} canales</span>
                    )}
                  </div>

                  {loadingLists ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    </div>
                  ) : channels.length === 0 ? (
                    <Card className="p-8 bg-zinc-900/50 border-zinc-800 text-center">
                      <Utensils className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                      <p className="text-zinc-500 text-sm">Aún no hay canales. ¡Sé el primero en analizar!</p>
                    </Card>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {channels.map((ch) => (
                        <Link
                          key={ch.channel_name}
                          to={`/foodie-reality/channel/${encodeURIComponent(ch.channel_name)}`}
                          className="group"
                          data-testid={`channel-card-${ch.channel_name}`}
                        >
                          <Card className="p-4 bg-zinc-900/60 border-zinc-800 hover:border-emerald-500/40 transition-all">
                            <div className="flex items-start gap-3">
                              <div className="w-14 h-14 rounded-full bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                {ch.latest_thumbnail ? (
                                  <img src={ch.latest_thumbnail} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Youtube className="w-6 h-6 text-red-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm text-white line-clamp-1 group-hover:text-emerald-400 transition-colors">
                                  {ch.channel_name}
                                </h3>
                                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                  <span className="flex items-center gap-1">
                                    <Hash className="w-3 h-3" /> {ch.analyses_count}
                                  </span>
                                  <span className={`flex items-center gap-1 ${getCoherenceColor(ch.avg_coherence)}`}>
                                    <TrendingUp className="w-3 h-3" /> {ch.avg_coherence}%
                                  </span>
                                </div>
                                {ch.latest_video_title && (
                                  <p className="text-[11px] text-zinc-500 mt-1 line-clamp-1">
                                    Último: {ch.latest_video_title}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400" />
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>

                {/* Videos recientes */}
                <section data-testid="recent-section">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                      Análisis recientes
                    </h2>
                  </div>
                  {!loadingLists && recentAnalyses.length === 0 ? (
                    <Card className="p-6 bg-zinc-900/50 border-zinc-800 text-center text-zinc-500 text-sm">
                      Aún no hay análisis.
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {recentAnalyses.map((a) => (
                        <Link
                          key={a.id}
                          to={`/foodie-reality/analysis/${a.id}`}
                          className="block group"
                          data-testid={`recent-card-${a.id}`}
                        >
                          <Card className="p-3 bg-zinc-900/50 border-zinc-800 hover:border-emerald-500/40 transition-all">
                            <div className="flex items-center gap-3">
                              {a.thumbnail_url && (
                                <img src={a.thumbnail_url} alt="" className="w-20 h-12 object-cover rounded flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-white text-sm line-clamp-1 group-hover:text-emerald-400 transition-colors">
                                  {a.video_title || "Sin título"}
                                </h3>
                                <p className="text-xs text-zinc-500 flex items-center gap-1.5 truncate">
                                  <Utensils className="w-3 h-3" /> {a.restaurant_name}
                                  <span className="text-zinc-600">·</span>
                                  <span className="truncate">{a.channel_name}</span>
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className={`text-xl font-bold ${getCoherenceColor(a.coherence_index)}`}>
                                  {a.coherence_index != null ? `${Math.round(a.coherence_index)}%` : "—"}
                                </div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                  {a.status === "completed" ? "coherencia" : a.status}
                                </p>
                              </div>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* ============ PARA FOODIES — PRÓXIMAMENTE ============ */}
            <section className="mt-16 mb-8" data-testid="foodie-creator-section">
              <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-700/40 bg-gradient-to-br from-emerald-950/40 via-zinc-950 to-zinc-950">
                {/* Decorative blobs */}
                <div className="absolute -top-24 -left-24 w-80 h-80 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative p-8 md:p-14">
                  <div className="flex flex-col lg:flex-row items-start gap-10">
                    {/* Left: Heading + description */}
                    <div className="flex-1 max-w-2xl">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-5">
                        <Sparkles className="w-3.5 h-3.5" />
                        ¿Eres foodie? · Próximamente
                      </div>

                      <h2
                        className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[0.95]"
                        style={{ fontFamily: 'Impact, "Bebas Neue", sans-serif', letterSpacing: 1 }}
                      >
                        ANALIZA TU VÍDEO <span className="text-emerald-400">ANTES</span> DE SUBIRLO
                      </h2>

                      <p className="text-zinc-300 text-lg mt-5 leading-relaxed">
                        Vas a poder <strong className="text-white">subir tu vídeo aquí antes de publicarlo en YouTube</strong>.
                        Te diremos si lo que cuentas <strong className="text-emerald-400">coincide con lo que opinan los clientes reales</strong> del
                        restaurante en Google.
                      </p>

                      <p className="text-zinc-400 mt-3 leading-relaxed">
                        En menos de 60 segundos sabrás qué afirmaciones se sostienen, cuáles los clientes contradicen y
                        en qué momentos del vídeo estás exagerando. <strong className="text-white">Edita, ajusta y publica
                        con la tranquilidad</strong> de que tu review es honesta y a prueba de críticos.
                      </p>

                      {/* CTA */}
                      <div className="flex flex-col sm:flex-row gap-3 mt-7">
                        <Button
                          disabled
                          className="bg-emerald-600/50 text-white cursor-not-allowed opacity-70 px-6 py-6 text-base font-bold"
                          data-testid="foodie-upload-disabled-btn"
                        >
                          <Lock className="w-4 h-4 mr-2" />
                          Próximamente: subir vídeo privado
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const el = document.getElementById("foodie-faq");
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="border-emerald-700/60 text-emerald-300 hover:bg-emerald-500/10 px-6 py-6 text-base font-bold"
                          data-testid="foodie-learn-more-btn"
                        >
                          ¿Cómo funcionará? <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>

                      <p className="text-xs text-zinc-500 mt-4">
                        El vídeo no será público ni almacenado. Análisis 100% privado para uso del creador.
                      </p>
                    </div>

                    {/* Right: 3-step visual */}
                    <div className="w-full lg:w-[420px] flex-shrink-0 space-y-3">
                      {[
                        { n: 1, Icon: Upload, title: "Sube tu vídeo (sin publicar)", desc: "Drop privado del vídeo o audio. Solo tú lo ves." },
                        { n: 2, Icon: Zap, title: "Análisis vs. clientes reales", desc: "Comparamos tus afirmaciones con reseñas verificadas en Google." },
                        { n: 3, Icon: Shield, title: "Recibes tu informe de honestidad", desc: "Score, segmentos que cojean y sugerencias de matiz." },
                      ].map((step) => (
                        <div
                          key={step.n}
                          className="flex items-start gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-emerald-700/60 transition-colors"
                        >
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-300 flex-shrink-0">
                            <step.Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                              Paso {step.n}
                            </div>
                            <div className="text-white font-bold text-base leading-tight mt-0.5">
                              {step.title}
                            </div>
                            <p className="text-zinc-400 text-sm leading-snug mt-1">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom row: 4 benefits */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
                    {[
                      {
                        Icon: Eye,
                        title: "Detecta lo que se te escapa",
                        desc: "Cosas que los clientes mencionan y tú no estás contando en cámara.",
                      },
                      {
                        Icon: Mic,
                        title: "Polígrafo minuto a minuto",
                        desc: "Mapa cronológico de tu vídeo con verde/rojo según coherencia con la realidad.",
                      },
                      {
                        Icon: Shield,
                        title: "Tu credibilidad blindada",
                        desc: "Evita el ridículo público. Edita las exageraciones antes de que las vean millones.",
                      },
                      {
                        Icon: Sparkles,
                        title: "Recomendación de matices",
                        desc: "La IA sugiere cómo reformular afirmaciones débiles para que suenen verdaderas.",
                      },
                    ].map((b, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800"
                      >
                        <b.Icon className="w-5 h-5 text-emerald-400 mb-2" />
                        <div className="text-white font-bold text-sm">{b.title}</div>
                        <p className="text-zinc-400 text-xs mt-1 leading-snug">{b.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* FAQ mini */}
                  <div id="foodie-faq" className="mt-10 pt-8 border-t border-zinc-800/80">
                    <h3 className="text-white font-black text-2xl mb-5" style={{ fontFamily: 'Impact, "Bebas Neue", sans-serif', letterSpacing: 1 }}>
                      DUDAS RÁPIDAS
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-emerald-300 font-bold text-sm">¿Mi vídeo se hará público?</p>
                        <p className="text-zinc-400 text-sm mt-1">
                          No. El upload es privado y solo lo ves tú. Tras el análisis, lo borramos automáticamente. Nada se publica ni se indexa.
                        </p>
                      </div>
                      <div>
                        <p className="text-emerald-300 font-bold text-sm">¿Qué formato y duración?</p>
                        <p className="text-zinc-400 text-sm mt-1">
                          MP4 o un link privado. Hasta 30 minutos por vídeo. Bastará con tener el audio claro: nos centramos en lo que dices.
                        </p>
                      </div>
                      <div>
                        <p className="text-emerald-300 font-bold text-sm">¿Qué obtengo exactamente?</p>
                        <p className="text-zinc-400 text-sm mt-1">
                          Informe con tu score de coherencia, polígrafo minuto a minuto, lista de afirmaciones débiles y sugerencias de cómo reformularlas.
                        </p>
                      </div>
                      <div>
                        <p className="text-emerald-300 font-bold text-sm">¿Cuándo estará disponible?</p>
                        <p className="text-zinc-400 text-sm mt-1">
                          Estamos puliendo la versión privada para creadores. Será un servicio premium para foodies serios que cuidan su credibilidad.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default FoodieRealityPage;
