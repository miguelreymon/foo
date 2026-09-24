import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import axios from "axios";
import { useLanguage } from "@/context/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import { 
  Youtube, 
  BarChart3, 
  MessageSquareWarning, 
  TrendingUp, 
  Flame,
  ArrowRight,
  Loader2,
  Trophy,
  Users,
  Skull,
  Video,
  X,
  Utensils
} from "lucide-react";

// TikTok icon component
const TikTokIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [channels, setChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  
  // Global stats
  const [globalStats, setGlobalStats] = useState({
    total_videos: 0,
    total_comments: 0,
    analyses_today: 0,
    last_analysis: null,
    total_hate_comments: 0
  });
  
  // Progress popup state
  const [showProgressPopup, setShowProgressPopup] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    fetchChannels();
    fetchGlobalStats();
  }, []);

  const fetchGlobalStats = async () => {
    try {
      const response = await axios.get(`${API}/stats/global`);
      setGlobalStats(response.data);
    } catch (error) {
      console.error("Failed to fetch global stats:", error);
    }
  };

  const fetchChannels = async () => {
    setLoadingChannels(true);
    try {
      const response = await axios.get(`${API}/channels`);
      // Sort by hate percentage descending
      const sorted = (Array.isArray(response.data) ? response.data : [])
        .sort((a, b) => (b.avg_hate_percentage || 0) - (a.avg_hate_percentage || 0));
      setChannels(sorted);
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleAnalyze = async () => {
    if (!youtubeUrl.trim()) {
      toast.error(t('enterUrl'));
      return;
    }

    const url = youtubeUrl.trim();
    const isInstagram = url.includes('instagram.com');
    const isTikTok = url.includes('tiktok.com');
    
    setIsAnalyzing(true);
    setShowProgressPopup(true);
    setAnalysisProgress(5);
    setAnalysisStatus(
      isInstagram ? "Analizando Instagram..." : 
      isTikTok ? "Analizando TikTok..." :
      "Iniciando análisis..."
    );
    
    try {
      // Determine which API to call based on URL
      const endpoint = isInstagram ? `${API}/instagram/analyze` : 
                       isTikTok ? `${API}/tiktok/analyze` :
                       `${API}/youtube/analyze`;
      const payload = isInstagram ? { instagram_url: url } : 
                      isTikTok ? { url: url } :
                      { youtube_url: url };
      
      const response = await axios.post(endpoint, payload);
      
      // Handle Instagram profile response (shows posts to choose)
      if (isInstagram && response.data.type === "profile") {
        setShowProgressPopup(false);
        setIsAnalyzing(false);
        const user = response.data.user;
        toast.success(`Perfil encontrado: @${user.username}`, {
          description: `${user.full_name || ''} - ${response.data.posts?.length || 0} posts recientes`
        });
        // For now, show a message that they need to select a specific post
        if (response.data.posts?.length === 0) {
          toast.info("Introduce la URL de un post específico para analizar sus comentarios");
        }
        return;
      }
      
      const analysisId = response.data.id;
      setCurrentAnalysisId(analysisId);
      setAnalysisProgress(10);
      setAnalysisStatus(
        isInstagram ? "Obteniendo comentarios de Instagram..." :
        isTikTok ? "Obteniendo comentarios de TikTok..." :
        "Obteniendo comentarios de YouTube..."
      );
      
      // Start polling for progress
      let progress = 10;
      const progressSteps = [
        { pct: 25, msg: "Analizando lote 1/4..." },
        { pct: 40, msg: "Analizando lote 2/4..." },
        { pct: 55, msg: "Analizando lote 3/4..." },
        { pct: 70, msg: "Analizando lote 4/4..." },
        { pct: 85, msg: "Generando resumen..." },
        { pct: 95, msg: "Finalizando..." }
      ];
      let stepIndex = 0;
      let pollCount = 0;
      const maxPolls = 30; // Max 4 minutes (30 * 8 seconds)
      
      pollingRef.current = setInterval(async () => {
        pollCount++;
        
        // Timeout after max polls
        if (pollCount > maxPolls) {
          clearInterval(pollingRef.current);
          setShowProgressPopup(false);
          setIsAnalyzing(false);
          toast.error("Tiempo de espera agotado. El análisis puede estar tardando más de lo esperado.");
          return;
        }
        
        try {
          const statusRes = await axios.get(`${API}/analysis/${analysisId}`);
          
          if (statusRes.data && statusRes.data.status === "completed") {
            clearInterval(pollingRef.current);
            setAnalysisProgress(100);
            setAnalysisStatus("¡Análisis completado!");
            
            setTimeout(() => {
              setShowProgressPopup(false);
              setIsAnalyzing(false);
              navigate(`/analysis/${analysisId}`);
            }, 1000);
          } else if (statusRes.data && (statusRes.data.status === "error" || statusRes.data.status === "failed")) {
            clearInterval(pollingRef.current);
            setShowProgressPopup(false);
            setIsAnalyzing(false);
            toast.error(statusRes.data.error || "Error en el análisis");
          } else {
            // Simulate progress while processing
            if (stepIndex < progressSteps.length) {
              setAnalysisProgress(progressSteps[stepIndex].pct);
              setAnalysisStatus(progressSteps[stepIndex].msg);
              stepIndex++;
            }
          }
        } catch (err) {
          // Continue polling, analysis might still be processing
          if (stepIndex < progressSteps.length) {
            setAnalysisProgress(progressSteps[stepIndex].pct);
            setAnalysisStatus(progressSteps[stepIndex].msg);
            stepIndex++;
          }
        }
      }, 8000); // Poll every 8 seconds
      
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errorAnalysis'));
      setShowProgressPopup(false);
      setIsAnalyzing(false);
    }
  };
  
  const cancelAnalysis = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    setShowProgressPopup(false);
    setIsAnalyzing(false);
    setYoutubeUrl("");
    toast.info("Análisis cancelado");
  };

  return (
    <div className="min-h-screen bg-[#09090B] relative overflow-hidden">
      {/* Progress Popup */}
      {showProgressPopup && (
        <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-300">
          <div className="bg-zinc-900/95 backdrop-blur-md border-b border-zinc-700 shadow-2xl">
            <div className="max-w-3xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                    <div className="absolute inset-0 w-6 h-6 bg-red-500/20 rounded-full animate-ping" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-white text-lg">Analizando video</h3>
                    <p className="text-sm text-zinc-400">{analysisStatus}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelAnalysis}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="relative">
                <Progress value={analysisProgress} className="h-2 bg-zinc-800" />
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-zinc-500">200 comentarios</span>
                  <span className="text-xs text-red-500 font-mono font-bold">{analysisProgress}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1764258058148-239b3af7bf6e?crop=entropy&cs=srgb&fm=jpg&q=85')",
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#09090B]/80 via-[#09090B]/90 to-[#09090B]" />

      <div className="relative z-10">
        {/* Header */}
        <header className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Flame className="w-8 h-8 text-red-600 glow-red" />
            <span className="font-heading text-2xl font-black tracking-tight text-white">
              SOCIAL<span className="text-red-600">HATE</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button 
              data-testid="view-analyses-btn"
              variant="outline"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="md:hidden bg-zinc-800/50 border-zinc-700 hover:bg-zinc-700 text-white"
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button 
              data-testid="view-analyses-btn-desktop"
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="hidden md:flex bg-zinc-800/50 border-zinc-700 hover:bg-zinc-700 text-white"
            >
              {t('viewAnalyses')}
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-12 gap-8 mb-12">
              {/* Left - Hero */}
              <div className="lg:col-span-5 space-y-6">
                <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                  {t('heroTitle1')}{" "}
                  <span className="text-red-600 glow-red">{t('heroTitle2')}</span>
                  <br />
                  {t('heroTitle3')}
                </h1>
                <p className="text-zinc-400 text-lg">
                  {t('heroSubtitle')}
                </p>

                {/* Quick Analysis Form */}
                <Card className="p-6 bg-zinc-900/50 border-zinc-800 space-y-4">
                  <h3 className="font-heading font-bold text-white flex items-center gap-2">
                    <Youtube className="w-5 h-5 text-red-600" />
                    <span className="text-zinc-500">/</span>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="url(#instagram-gradient)">
                      <defs>
                        <linearGradient id="instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#FFDC80" />
                          <stop offset="25%" stopColor="#F77737" />
                          <stop offset="50%" stopColor="#E1306C" />
                          <stop offset="75%" stopColor="#C13584" />
                          <stop offset="100%" stopColor="#833AB4" />
                        </linearGradient>
                      </defs>
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    <span className="text-zinc-500">/</span>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                    {t('quickAnalysis')}
                  </h3>
                  <div className="space-y-3">
                    <Input
                      data-testid="youtube-url-input"
                      placeholder={t('pasteUrl')}
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    />
                    <Button
                      data-testid="analyze-btn"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="w-full btn-primary"
                    >
                      {isAnalyzing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('analyzing')}</>
                      ) : (
                        <><ArrowRight className="w-4 h-4 mr-2" /> {t('analyze')}</>
                      )}
                    </Button>
                  </div>
                </Card>

                {/* Features */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3 bg-zinc-900/30 border-zinc-800">
                    <MessageSquareWarning className="w-5 h-5 text-red-500 mb-1" />
                    <h4 className="font-bold text-white text-sm">{t('hateDetection')}</h4>
                    <p className="text-xs text-zinc-500">{t('hateDetectionDesc')}</p>
                  </Card>
                  <Card className="p-3 bg-zinc-900/30 border-zinc-800">
                    <BarChart3 className="w-5 h-5 text-red-500 mb-1" />
                    <h4 className="font-bold text-white text-sm">{t('sentiment')}</h4>
                    <p className="text-xs text-zinc-500">{t('sentimentDesc')}</p>
                  </Card>
                  <Card className="p-3 bg-zinc-900/30 border-zinc-800">
                    <TrendingUp className="w-5 h-5 text-red-500 mb-1" />
                    <h4 className="font-bold text-white text-sm">{t('trendingTopics')}</h4>
                    <p className="text-xs text-zinc-500">{t('trendingTopicsDesc')}</p>
                  </Card>
                  <Card className="p-3 bg-zinc-900/30 border-zinc-800">
                    <Trophy className="w-5 h-5 text-red-500 mb-1" />
                    <h4 className="font-bold text-white text-sm">{t('rankings')}</h4>
                    <p className="text-xs text-zinc-500">{t('rankingsDesc')}</p>
                  </Card>
                </div>

                {/* Foodie Reality Banner */}
                <Card 
                  className="p-4 bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border-emerald-700/50 cursor-pointer hover:border-emerald-500/70 transition-all group"
                  onClick={() => navigate("/reality-check")}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-emerald-500 flex-shrink-0">
                      {/* Fork - 3 prongs up */}
                      <svg className="w-6 h-8" viewBox="0 0 24 32" fill="currentColor">
                        <path d="M4 1v10c0 2 2 3 4 3v17h4V14c2 0 4-1 4-3V1h-3v9h-2V1h-2v9H7V1H4z"/>
                      </svg>
                      {/* Knife - blade up */}
                      <svg className="w-5 h-8" viewBox="0 0 20 32" fill="currentColor">
                        <path d="M8 1c-4 4-6 8-6 14v2h6v14h4V17h6v-2c0-6-2-10-6-14h-4z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Nuevo</span>
                      </div>
                      <h4 className="font-black text-sm sm:text-base">
                        <span className="text-white">FOODIE </span><span className="text-emerald-500">FAKE</span>
                      </h4>
                      <p className="text-xs text-zinc-400 line-clamp-2">¿Los influencers de comida dicen la verdad? Compara sus opiniones con reseñas reales.</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                  </div>
                </Card>
              </div>

              {/* Right - Analyzed Channels */}
              <div className="lg:col-span-7">
                <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
                  <div className="p-3 sm:p-4 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Users className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                      <h2 className="font-heading text-base sm:text-xl font-black text-white">
                        {t('analyzedChannels')}
                      </h2>
                    </div>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/channels")}
                      className="border-zinc-700 text-zinc-400 hover:text-white text-xs px-2 py-1 h-7 sm:text-sm sm:px-3 sm:py-2 sm:h-8"
                    >
                      {t('viewAll')}
                    </Button>
                  </div>

                  {/* Channel List with Auto-Scroll Animation */}
                  <div className="relative h-[500px] overflow-hidden">
                    {loadingChannels ? (
                      <div className="p-8 text-center">
                        <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
                        <p className="text-zinc-500 mt-2">{t('loadingChannels')}</p>
                      </div>
                    ) : channels.length === 0 ? (
                      <div className="p-8 text-center">
                        <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                        <h3 className="text-white font-bold mb-1">{t('noChannelsYet')}</h3>
                        <p className="text-zinc-500 text-sm mb-4">{t('analyzeToSee')}</p>
                      </div>
                    ) : (
                      <div className="animate-scroll-vertical">
                        {/* Duplicate channels for seamless loop */}
                        {[...channels.slice(0, 10), ...channels.slice(0, 10)].map((channel, index) => (
                          <div 
                            key={`${channel.id}-${index}`}
                            data-testid={`channel-row-${index}`}
                            onClick={() => navigate(`/channel/${channel.id}`)}
                            className="p-2.5 sm:p-4 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              {/* Platform Logo(s) */}
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {(channel.platforms?.includes("youtube") || channel.platform === "youtube" || (!channel.platforms && !channel.platform)) && (
                                  <Youtube className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-600" />
                                )}
                                {(channel.platforms?.includes("tiktok") || channel.platform === "tiktok") && (
                                  <TikTokIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                                )}
                              </div>
                              
                              {/* Avatar */}
                              {channel.thumbnail_url ? (
                                <img src={channel.thumbnail_url} alt="" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                  <Users className="w-4 h-4 text-zinc-600" />
                                </div>
                              )}

                              {/* Info - Name and stats */}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white text-xs sm:text-base truncate">{channel.name}</h4>
                                <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-zinc-500 mt-0.5">
                                  <span className="flex items-center gap-0.5">
                                    <Video className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                    {channel.total_videos_analyzed} {t('videos')}
                                  </span>
                                  <span className="hidden sm:flex items-center gap-1">
                                    <MessageSquareWarning className="w-3 h-3" />
                                    {channel.total_comments_analyzed?.toLocaleString()} {t('comments')}
                                  </span>
                                </div>
                              </div>

                              {/* Badge and Percentage - stacked on mobile */}
                              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 flex-shrink-0">
                                <Badge className={`text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 ${
                                  channel.avg_hate_percentage >= 20 ? 'text-red-500 bg-red-500/20' : 
                                  channel.avg_hate_percentage >= 10 ? 'text-amber-500 bg-amber-500/20' : 
                                  'text-green-500 bg-green-500/20'
                                }`}>
                                  <Skull className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5" />
                                  {channel.avg_hate_percentage >= 20 ? t('high') : 
                                   channel.avg_hate_percentage >= 10 ? t('moderate') : t('low')}
                                </Badge>
                                <div className="hidden sm:block w-20">
                                  <Progress 
                                    value={Math.min(channel.avg_hate_percentage, 100)} 
                                    className="h-2 bg-zinc-800"
                                  />
                                </div>
                                <span className={`font-mono text-xs sm:text-lg font-bold ${
                                  channel.avg_hate_percentage >= 20 ? 'text-red-500' : 
                                  channel.avg_hate_percentage >= 10 ? 'text-amber-500' : 'text-green-500'
                                }`}>
                                  {channel.avg_hate_percentage?.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </main>

        {/* Stats Section */}
        <section className="px-4 sm:px-6 py-8 sm:py-12 border-t border-zinc-800/50">
          <div className="max-w-7xl mx-auto">
            {/* Stats Grid - 1 column on mobile, 4 on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
              <Card className="bg-zinc-900/50 border-zinc-800 p-6 sm:p-8 text-center">
                <p className="font-heading text-4xl sm:text-5xl font-black text-white mb-2">
                  {globalStats.total_videos.toLocaleString()}
                </p>
                <p className="text-zinc-400 text-base sm:text-lg">{t('videosAnalyzed')}</p>
              </Card>
              
              <Card className="bg-zinc-900/50 border-zinc-800 p-6 sm:p-8 text-center">
                <p className="font-heading text-4xl sm:text-5xl font-black text-white mb-2">
                  {globalStats.total_comments > 1000000 
                    ? `+${(globalStats.total_comments / 1000000).toFixed(1)}M`
                    : globalStats.total_comments > 1000
                    ? `+${(globalStats.total_comments / 1000).toFixed(0)}K`
                    : globalStats.total_comments.toLocaleString()}
                </p>
                <p className="text-zinc-400 text-base sm:text-lg">{t('commentsProcessed')}</p>
              </Card>
              
              <Card className="bg-zinc-900/50 border-zinc-800 p-6 sm:p-8 text-center">
                <p className="font-heading text-5xl sm:text-6xl font-black text-amber-500 mb-2">
                  {globalStats.analyses_today}
                </p>
                <p className="text-zinc-400 text-base sm:text-lg">{t('analysesToday')}</p>
              </Card>
              
              <Card className="bg-zinc-900/50 border-zinc-800 p-6 sm:p-8 text-center">
                <p className="font-heading text-5xl sm:text-6xl font-black text-red-500 mb-2">
                  {globalStats.total_hate_comments.toLocaleString()}
                </p>
                <p className="text-zinc-400 text-base sm:text-lg">{t('hateComments')}</p>
              </Card>
            </div>
          </div>
        </section>

        {/* About Section - Legal/Informativo */}
        <section className="px-6 py-16 border-t border-zinc-800/30">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-4 text-xs text-zinc-500 leading-relaxed">
              <p>
                <strong className="text-zinc-400">SocialHate</strong> {t('aboutParagraph1')}
              </p>
              <p>
                {t('aboutParagraph2')}
              </p>
              <p>
                {t('aboutParagraph3')}
              </p>
              <p>
                {t('aboutParagraph4')}
              </p>
              <p>
                {t('aboutParagraph5')}
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-6 border-t border-zinc-800/50">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-zinc-600">
            <span>{t('copyright')}</span>
            <span className="font-mono text-xs">{t('poweredBy')}</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
