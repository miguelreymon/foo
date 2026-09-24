import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import LanguageToggle from "@/components/LanguageToggle";
import Footer from "@/components/Footer";
import { HateLegend } from "@/components/HateLegend";
import { useLanguage } from "@/context/LanguageContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import { Youtube, Instagram } from "lucide-react";

// TikTok icon component
const TikTokIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

import {
  Flame,
  ArrowLeft,
  Eye,
  ThumbsUp,
  MessageSquare,
  RefreshCw,
  Loader2,
  Video,
  Plus,
  ExternalLink,
  Skull,
  Heart,
  ThumbsDown,
  CloudRain,
  Sun,
  Cloud,
  CloudLightning,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  Search,
  Link,
  ShieldCheck,
  Share2,
  Play,
  Calendar
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Helper function to detect platform from analysis
const detectPlatform = (analysis) => {
  if (analysis.thumbnail_url && analysis.thumbnail_url.includes('cdninstagram.com')) {
    return 'instagram';
  }
  return 'youtube';
};

const ChannelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [channel, setChannel] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evolution, setEvolution] = useState([]);
  const [youtubeEvolution, setYoutubeEvolution] = useState([]);
  const [tiktokEvolution, setTiktokEvolution] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [topicInput, setTopicInput] = useState("");
  const [topicPrediction, setTopicPrediction] = useState(null);
  const [predictingTopic, setPredictingTopic] = useState(false);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  
  // New states for video selector
  const [channelVideos, setChannelVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videoSearch, setVideoSearch] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [activeTab, setActiveTab] = useState("url");
  
  // Channel card states
  const [channelCard, setChannelCard] = useState(null);
  const [creatingCard, setCreatingCard] = useState(false);

  const fetchChannel = async () => {
    try {
      const channelRes = await axios.get(`${API}/channels/${id}`);
      const channelData = channelRes.data;
      
      // Get basic stats and forecast
      const [statsRes, forecastRes] = await Promise.all([
        axios.get(`${API}/channels/${id}/stats`),
        axios.get(`${API}/channel/${channelData.channel_id}/hate-forecast`)
      ]);
      
      // Fetch YouTube analyses and evolution
      let allAnalyses = [];
      let ytEvolution = [];
      try {
        const [ytRes, ytEvoRes] = await Promise.all([
          axios.get(`${API}/channel/${channelData.channel_id}/analyses`),
          axios.get(`${API}/channel/${channelData.channel_id}/evolution`)
        ]);
        allAnalyses = [...(ytRes.data.analyses || [])];
        ytEvolution = ytEvoRes.data.evolution || [];
      } catch (err) {
        console.log("No YouTube data found");
      }
      
      // Fetch TikTok analyses and evolution if channel has tiktok_channel_id
      let tkEvolution = [];
      if (channelData.tiktok_channel_id && channelData.tiktok_channel_id !== channelData.channel_id) {
        try {
          const [tkRes, tkEvoRes] = await Promise.all([
            axios.get(`${API}/channel/${channelData.tiktok_channel_id}/analyses`),
            axios.get(`${API}/channel/${channelData.tiktok_channel_id}/evolution`)
          ]);
          const tkAnalyses = (tkRes.data.analyses || []).map(a => ({...a, platform: 'tiktok'}));
          allAnalyses = [...allAnalyses, ...tkAnalyses];
          tkEvolution = tkEvoRes.data.evolution || [];
        } catch (err) {
          console.log("No TikTok data found");
        }
      }
      
      // Sort by date descending
      allAnalyses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      // Merge analyses into channel data
      setChannel({
        ...channelData,
        analyses: allAnalyses
      });
      setStats(statsRes.data.stats);
      setYoutubeEvolution(ytEvolution);
      setTiktokEvolution(tkEvolution);
      setEvolution([...ytEvolution, ...tkEvolution]); // Combined for backwards compatibility
      setForecast(forecastRes.data);
      
      // Try to fetch existing card
      try {
        const cardRes = await axios.get(`${API}/channels/${id}/card`);
        setChannelCard(cardRes.data);
      } catch (err) {
        // Card doesn't exist yet, that's okay
      }
    } catch (error) {
      console.error("Failed to fetch channel:", error);
      toast.error("Canal no encontrado");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  // Create or update channel card
  const createChannelCard = async () => {
    setCreatingCard(true);
    try {
      const response = await axios.post(`${API}/channels/${id}/card`);
      setChannelCard(response.data);
      toast.success("¡Carta verificada creada!");
    } catch (error) {
      console.error("Error creating card:", error);
      toast.error(error.response?.data?.detail || "Error al crear la carta");
    } finally {
      setCreatingCard(false);
    }
  };

  // View channel card
  const viewChannelCard = () => {
    if (channelCard?.slug) {
      window.open(`/card/${channelCard.slug}`, "_blank");
    }
  };

  const predictTopicRisk = async () => {
    if (!topicInput.trim()) {
      toast.error("Introduce un tema para predecir");
      return;
    }
    
    setPredictingTopic(true);
    try {
      const response = await axios.post(
        `${API}/channel/${channel.channel_id}/predict-topic?topic=${encodeURIComponent(topicInput)}`
      );
      setTopicPrediction(response.data);
    } catch (error) {
      toast.error("Error al predecir el tema");
    } finally {
      setPredictingTopic(false);
    }
  };

  // Fetch channel videos when dialog opens (with cache indicator)
  const fetchChannelVideos = async () => {
    setLoadingVideos(true);
    try {
      const response = await axios.get(`${API}/channels/${id}/youtube-videos?max_results=50`);
      setChannelVideos(response.data.videos || []);
      if (response.data.from_cache) {
        console.log("Videos loaded from cache");
      }
    } catch (error) {
      console.error("Error fetching channel videos:", error);
      toast.error("Error al cargar videos del canal");
    } finally {
      setLoadingVideos(false);
    }
  };

  // Handle dialog open
  const handleDialogOpen = (open) => {
    setShowAddVideo(open);
    if (open) {
      setActiveTab("browse");
      fetchChannelVideos();
    } else {
      setSelectedVideo(null);
      setVideoUrl("");
      setVideoSearch("");
    }
  };

  // Filter videos by search
  const filteredVideos = channelVideos.filter(video => 
    video.title.toLowerCase().includes(videoSearch.toLowerCase())
  );

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  useEffect(() => {
    fetchChannel();
  }, [id]);

  const handleAnalyzeVideo = async () => {
    const urlToAnalyze = selectedVideo 
      ? `https://youtube.com/watch?v=${selectedVideo.video_id}` 
      : videoUrl.trim();
    
    if (!urlToAnalyze) {
      toast.error("Selecciona un video o introduce una URL");
      return;
    }

    setAnalyzing(true);
    try {
      const response = await axios.post(
        `${API}/channels/${id}/analyze`,
        null,
        { params: { youtube_url: urlToAnalyze } }
      );
      toast.success("¡Análisis iniciado!");
      setShowAddVideo(false);
      setVideoUrl("");
      navigate(`/analysis/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al iniciar análisis");
    } finally {
      setAnalyzing(false);
    }
  };

  const getToxicityColor = (level) => {
    switch(level) {
      case "severe": return "text-red-500 bg-red-500/20 border-red-500/50";
      case "high": return "text-orange-500 bg-orange-500/20 border-orange-500/50";
      case "moderate": return "text-amber-500 bg-amber-500/20 border-amber-500/50";
      default: return "text-green-500 bg-green-500/20 border-green-500/50";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-red-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B]">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800 sticky top-0 z-50 bg-[#09090B]/90 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              data-testid="back-btn"
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Flame className="w-6 h-6 text-red-600" />
              <span className="font-heading text-xl font-black tracking-tight text-white">
                SOCIAL<span className="text-red-600">HATE</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
          </div>
        </div>
      </header>

      <main className="px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Hate Forecast - Arriba de la foto del canal - Sin borde */}
          {forecast && (
            <div className={`flex items-center gap-4 p-3 rounded-lg overflow-hidden ${
              forecast.forecast === 'storm' ? 'bg-red-900/20' :
              forecast.forecast === 'cloudy' ? 'bg-amber-900/20' :
              forecast.forecast === 'sunny' ? 'bg-green-900/20' :
              'bg-zinc-900/50'
            }`}>
              {forecast.forecast === 'storm' ? <CloudLightning className="w-6 h-6 text-red-500 flex-shrink-0" /> :
               forecast.forecast === 'cloudy' ? <CloudRain className="w-6 h-6 text-amber-500 flex-shrink-0" /> :
               forecast.forecast === 'sunny' ? <Sun className="w-6 h-6 text-green-500 flex-shrink-0" /> :
               <Cloud className="w-6 h-6 text-zinc-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="animate-marquee whitespace-nowrap">
                  <span className="text-sm text-white inline-block">{forecast.message}</span>
                  <span className="text-sm text-white inline-block mx-16">{forecast.message}</span>
                </div>
              </div>
              <Badge className={`flex-shrink-0 ${
                forecast.trend === 'rising' ? 'bg-red-500/20 text-red-500' :
                forecast.trend === 'falling' ? 'bg-green-500/20 text-green-500' :
                'bg-zinc-500/20 text-zinc-400'
              }`}>
                {forecast.trend === 'rising' ? <TrendingUp className="w-3 h-3 mr-1 inline" /> :
                 forecast.trend === 'falling' ? <TrendingDown className="w-3 h-3 mr-1 inline" /> : null}
                {forecast.risk_level}%
              </Badge>
            </div>
          )}

          {/* Channel Header */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {channel?.thumbnail_url ? (
              <img 
                src={channel.thumbnail_url} 
                alt={channel.name}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center">
                <Video className="w-10 h-10 text-zinc-600" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {channel?.category && (
                  <Badge className="bg-zinc-800 text-zinc-300">{channel.category}</Badge>
                )}
                {/* Platform badges first */}
                {channel?.analyses && channel.analyses.some(a => detectPlatform(a) === 'youtube') && (
                  <Badge className="bg-red-600/20 text-red-500 border-red-600/30">
                    <Youtube className="w-3 h-3 mr-1" />
                    YouTube
                  </Badge>
                )}
                {channel?.analyses && channel.analyses.some(a => detectPlatform(a) === 'instagram') && (
                  <Badge className="bg-pink-600/20 text-pink-500 border-pink-600/30">
                    <Instagram className="w-3 h-3 mr-1" />
                    Instagram
                  </Badge>
                )}
                {/* Toxicity badge after platform */}
                <Badge className={getToxicityColor(channel?.toxicity_level)}>
                  <Skull className="w-3 h-3 mr-1" />
                  {channel?.toxicity_level === 'high' ? t('highToxicity') :
                   channel?.toxicity_level === 'moderate' ? t('moderateToxicity') :
                   t('lowToxicity')}
                </Badge>
              </div>
              <h1 className="font-heading text-3xl font-black text-white">{channel?.name}</h1>
              <p className="text-zinc-400 mt-1 line-clamp-2">{channel?.description || "Canal de contenido"}</p>
              
              {/* Platform Links */}
              <div className="flex flex-wrap items-center gap-4 mt-3">
                {/* YouTube Link */}
                {(channel?.platforms?.includes("youtube") || channel?.youtube_channel_id || channel?.channel_id) && (
                  <a 
                    href={`https://www.youtube.com/channel/${channel.youtube_channel_id || channel.channel_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
                  >
                    <Youtube className="w-4 h-4" />
                    YouTube
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                
                {/* TikTok Link */}
                {(channel?.platforms?.includes("tiktok") || channel?.tiktok_channel_id || channel?.tiktok_username) && (
                  <a 
                    href={`https://www.tiktok.com/@${channel.tiktok_username || channel.tiktok_channel_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-sm"
                  >
                    <TikTokIcon className="w-4 h-4" />
                    TikTok
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              
              {/* Platform Specific Stats */}
              {channel?.platforms?.length > 1 && (
                <div className="flex flex-wrap gap-4 mt-4">
                  {channel.youtube_stats && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700">
                      <Youtube className="w-4 h-4 text-red-500" />
                      <div className="text-xs">
                        <span className="text-zinc-400">YouTube:</span>
                        <span className="text-white ml-1">{channel.youtube_stats.videos_analyzed} videos</span>
                        <span className="text-zinc-500 mx-1">|</span>
                        <span className={channel.youtube_stats.avg_hate_percentage >= 20 ? 'text-red-400' : channel.youtube_stats.avg_hate_percentage >= 10 ? 'text-amber-400' : 'text-green-400'}>
                          {channel.youtube_stats.avg_hate_percentage}% hate
                        </span>
                      </div>
                    </div>
                  )}
                  {channel.tiktok_stats && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700">
                      <TikTokIcon className="w-4 h-4 text-white" />
                      <div className="text-xs">
                        <span className="text-zinc-400">TikTok:</span>
                        <span className="text-white ml-1">{channel.tiktok_stats.videos_analyzed} videos</span>
                        <span className="text-zinc-500 mx-1">|</span>
                        <span className={channel.tiktok_stats.avg_hate_percentage >= 20 ? 'text-red-400' : channel.tiktok_stats.avg_hate_percentage >= 10 ? 'text-amber-400' : 'text-green-400'}>
                          {channel.tiktok_stats.avg_hate_percentage}% hate
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-4 mt-2">
                {channel?.subscriber_count > 0 && (
                  <p className="text-zinc-500 text-sm">
                    {channel.subscriber_count.toLocaleString()} suscriptores
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* Channel Card Button */}
              {channelCard ? (
                <Button 
                  data-testid="view-card-btn"
                  onClick={viewChannelCard}
                  variant="outline"
                  className="border-emerald-600/50 text-emerald-400 hover:bg-emerald-600/10 w-full sm:w-auto"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" /> Ver Carta Verificada
                </Button>
              ) : (
                <Button 
                  data-testid="create-card-btn"
                  onClick={createChannelCard}
                  disabled={creatingCard || !channel?.analyses?.length}
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 w-full sm:w-auto"
                >
                  {creatingCard ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando...</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4 mr-2" /> Crear Carta Verificada</>
                  )}
                </Button>
              )}
              
              {/* Analyze Video Button */}
              <Dialog open={showAddVideo} onOpenChange={handleDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="add-video-btn" className="btn-primary w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-2" /> {t('analyzeVideo')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl flex flex-col" style={{maxHeight: '85vh'}}>
                  <DialogHeader>
                    <DialogTitle className="text-white font-heading">{t('analyzeVideo')}</DialogTitle>
                  </DialogHeader>
                  
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 flex-1 flex flex-col min-h-0">
                    <TabsList className="grid w-full grid-cols-2 bg-zinc-800 flex-shrink-0">
                      <TabsTrigger value="browse" className="data-[state=active]:bg-red-600">
                        <Video className="w-4 h-4 mr-2" /> Videos del Canal
                      </TabsTrigger>
                      <TabsTrigger value="url" className="data-[state=active]:bg-red-600">
                        <Link className="w-4 h-4 mr-2" /> Pegar URL
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Browse Videos Tab */}
                  <TabsContent value="browse" className="flex-1 flex flex-col min-h-0 space-y-4 mt-4">
                    {/* Search Input */}
                    <div className="relative flex-shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input
                        data-testid="video-search-input"
                        placeholder="Buscar video por título..."
                        value={videoSearch}
                        onChange={(e) => setVideoSearch(e.target.value)}
                        className="bg-zinc-800 border-zinc-700 text-white pl-10"
                      />
                    </div>
                    
                    {/* Videos List */}
                    <ScrollArea className="flex-1" style={{height: '350px'}}>
                      {loadingVideos ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                        </div>
                      ) : filteredVideos.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                          {videoSearch ? "No se encontraron videos" : "No hay videos disponibles"}
                        </div>
                      ) : (
                        <div className="space-y-2 pr-4">
                          {filteredVideos.map((video) => (
                            <div
                              key={video.video_id}
                              data-testid={`video-item-${video.video_id}`}
                              onClick={() => setSelectedVideo(
                                selectedVideo?.video_id === video.video_id ? null : video
                              )}
                              className={`flex gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                selectedVideo?.video_id === video.video_id
                                  ? 'bg-red-600/20 border-2 border-red-500'
                                  : 'bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800'
                              }`}
                            >
                              <div className="relative w-32 h-20 flex-shrink-0 rounded overflow-hidden">
                                <img 
                                  src={video.thumbnail_url} 
                                  alt={video.title}
                                  className="w-full h-full object-cover"
                                />
                                {selectedVideo?.video_id === video.video_id && (
                                  <div className="absolute inset-0 bg-red-600/50 flex items-center justify-center">
                                    <Play className="w-8 h-8 text-white fill-white" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-white text-sm line-clamp-2">
                                  {video.title}
                                </h4>
                                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(video.published_at)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    {video.view_count?.toLocaleString() || 0}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    {video.comment_count?.toLocaleString() || 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                  
                  {/* URL Tab */}
                  <TabsContent value="url" className="space-y-4 pt-4">
                    <div>
                      <label className="text-sm text-zinc-400">URL del Video</label>
                      <Input
                        data-testid="video-url-input"
                        placeholder="https://youtube.com/watch?v=..."
                        value={videoUrl}
                        onChange={(e) => {
                          setVideoUrl(e.target.value);
                          setSelectedVideo(null);
                        }}
                        onKeyPress={(e) => e.key === 'Enter' && handleAnalyzeVideo()}
                        className="bg-zinc-800 border-zinc-700 text-white mt-1"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
                
                {/* Selected Video Info & Analyze Button - Always at bottom */}
                <div className="flex-shrink-0 pt-4 border-t border-zinc-800 mt-4">
                  {selectedVideo && (
                    <div className="mb-3 p-3 bg-red-600/10 border border-red-600/30 rounded-lg">
                      <p className="text-sm text-zinc-300">
                        <span className="text-zinc-500">Seleccionado:</span>{' '}
                        <span className="font-medium text-white">{selectedVideo.title}</span>
                      </p>
                    </div>
                  )}
                  <Button 
                    data-testid="start-analysis-btn"
                    onClick={handleAnalyzeVideo}
                    disabled={analyzing || (!selectedVideo && !videoUrl.trim())}
                    className="w-full btn-primary"
                  >
                    {analyzing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analizando...</>
                    ) : (
                      <><Play className="w-4 h-4 mr-2" /> Iniciar Análisis</>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="stat-card p-4">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">
                <Video className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{t('videosAnalyzed')}</span>
              </div>
              <p className="font-mono text-2xl font-bold text-white">
                {stats?.total_videos_analyzed || channel?.total_videos_analyzed || 0}
              </p>
            </Card>
            <Card className="stat-card p-4">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{t('comments_label')}</span>
              </div>
              <p className="font-mono text-2xl font-bold text-white">
                {(stats?.total_comments_analyzed || channel?.total_comments_analyzed || 0).toLocaleString()}
              </p>
            </Card>
            <Card className="stat-card p-4">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">
                <Eye className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{t('totalViews')}</span>
              </div>
              <p className="font-mono text-2xl font-bold text-white">
                {(stats?.total_views || 0).toLocaleString()}
              </p>
            </Card>
            <Card className="stat-card p-4 border-red-900/50">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <Flame className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{t('avgHate')}</span>
              </div>
              <p className="font-mono text-2xl font-bold text-red-500 glow-red">
                {stats?.avg_hate_percentage || channel?.avg_hate_percentage || 0}%
              </p>
            </Card>
          </div>

          {/* Hate Legend - Escala de Hate */}
          <HateLegend />

          {/* Sentiment Overview */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="font-heading text-white">{t('averageSentiment')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-500 flex items-center gap-1">
                    <Heart className="w-4 h-4" /> {t('positiveLabel')}
                  </span>
                  <span className="font-mono text-green-500">
                    {stats?.avg_positive_percentage || channel?.avg_positive_percentage || 0}%
                  </span>
                </div>
                <Progress 
                  value={stats?.avg_positive_percentage || channel?.avg_positive_percentage || 0} 
                  className="h-2 bg-zinc-800 [&>div]:bg-green-500" 
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-amber-500 flex items-center gap-1">
                    <ThumbsDown className="w-4 h-4" /> {t('negativeLabel')}
                  </span>
                  <span className="font-mono text-amber-500">
                    {stats?.avg_negative_percentage || channel?.avg_negative_percentage || 0}%
                  </span>
                </div>
                <Progress 
                  value={stats?.avg_negative_percentage || channel?.avg_negative_percentage || 0} 
                  className="h-2 bg-zinc-800 [&>div]:bg-amber-500" 
                />
              </div>
              <div className="pt-4 border-t border-zinc-800">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-red-500 flex items-center gap-1">
                    <Flame className="w-4 h-4" /> {t('hateSpeech')}
                  </span>
                  <span className="font-mono text-red-500">
                    {stats?.avg_hate_percentage || channel?.avg_hate_percentage || 0}%
                  </span>
                </div>
                <Progress 
                  value={stats?.avg_hate_percentage || channel?.avg_hate_percentage || 0} 
                  className="h-2 bg-zinc-800 [&>div]:bg-red-600" 
                />
              </div>
            </CardContent>
          </Card>

          {/* Video Analyses - Right after Average Sentiment */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="font-heading text-white flex items-center gap-2">
                <Video className="w-5 h-5" />
                {t('analyzedVideos')} ({channel?.analyses?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {channel?.analyses?.length > 0 ? (
                <div className="space-y-3">
                  {channel.analyses.map((analysis, index) => (
                    <div
                      key={analysis.id}
                      data-testid={`analysis-row-${index}`}
                      className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                      onClick={() => navigate(`/analysis/${analysis.id}`)}
                    >
                      {/* Platform icon */}
                      <div className="w-6 flex justify-center flex-shrink-0">
                        {analysis.platform === "tiktok" ? (
                          <TikTokIcon className="w-5 h-5 text-white" />
                        ) : (
                          <Youtube className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div className="w-24 h-14 rounded overflow-hidden bg-zinc-700 flex-shrink-0">
                        {analysis.thumbnail_url ? (
                          <img 
                            src={analysis.thumbnail_url} 
                            alt={analysis.video_title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-6 h-6 text-zinc-500" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white truncate">{analysis.video_title}</h4>
                        <Badge className={
                          analysis.status === "completed" 
                            ? "bg-green-500/20 text-green-500"
                            : "bg-amber-500/20 text-amber-500"
                        } style={{ fontSize: '0.7rem' }}>
                          {analysis.status === "completed" ? t('completed') :
                           analysis.status === "processing" ? t('processing') :
                           analysis.status === "failed" ? t('failed') :
                           analysis.status}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <span className={`font-mono font-bold ${
                          analysis.hate_percentage >= 20 ? 'text-red-500' :
                          analysis.hate_percentage >= 10 ? 'text-amber-500' : 'text-green-500'
                        }`}>
                          {analysis.hate_percentage || 0}%
                        </span>
                        <p className="text-xs text-zinc-500">{t('hate_label')}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-zinc-500" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Video className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">{t('noVideosYet')}</p>
                  <Button 
                    onClick={() => setShowAddVideo(true)}
                    className="btn-primary mt-4"
                  >
                    <Plus className="w-4 h-4 mr-2" /> {t('analyzeFirstVideo')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Channel Evolution Charts - Separate for YouTube and TikTok */}
          {(youtubeEvolution.length > 1 || tiktokEvolution.length > 1) && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="font-heading text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-red-500" />
                  {t('evolution')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* YouTube Evolution */}
                  {youtubeEvolution.length > 1 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Youtube className="w-5 h-5 text-red-600" />
                        <h4 className="font-medium text-white">YouTube</h4>
                        <span className="text-xs text-zinc-500">({youtubeEvolution.length} videos)</span>
                      </div>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={youtubeEvolution}>
                            <defs>
                              <linearGradient id="ytHateGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#DC2626" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="ytPositiveGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis 
                              dataKey="index" 
                              tick={{ fill: '#71717A', fontSize: 10 }}
                              axisLine={{ stroke: '#27272A' }}
                            />
                            <YAxis 
                              tick={{ fill: '#71717A', fontSize: 10 }}
                              axisLine={{ stroke: '#27272A' }}
                              domain={[0, 100]}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                background: '#18181B', 
                                border: '1px solid #27272A',
                                borderRadius: '8px'
                              }}
                              labelFormatter={(value) => `Video ${value}`}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="positive" 
                              stroke="#10B981" 
                              fill="url(#ytPositiveGradient)"
                              name="Positivo %"
                            />
                            <Area 
                              type="monotone" 
                              dataKey="hate" 
                              stroke="#DC2626" 
                              fill="url(#ytHateGradient)"
                              name="Hate %"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  
                  {/* TikTok Evolution */}
                  {tiktokEvolution.length > 1 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <TikTokIcon className="w-5 h-5 text-white" />
                        <h4 className="font-medium text-white">TikTok</h4>
                        <span className="text-xs text-zinc-500">({tiktokEvolution.length} videos)</span>
                      </div>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={tiktokEvolution}>
                            <defs>
                              <linearGradient id="tkHateGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#DC2626" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="tkPositiveGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00F2EA" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#00F2EA" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis 
                              dataKey="index" 
                              tick={{ fill: '#71717A', fontSize: 10 }}
                              axisLine={{ stroke: '#27272A' }}
                            />
                            <YAxis 
                              tick={{ fill: '#71717A', fontSize: 10 }}
                              axisLine={{ stroke: '#27272A' }}
                              domain={[0, 100]}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                background: '#18181B', 
                                border: '1px solid #27272A',
                                borderRadius: '8px'
                              }}
                              labelFormatter={(value) => `Video ${value}`}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="positive" 
                              stroke="#00F2EA" 
                              fill="url(#tkPositiveGradient)"
                              name="Positivo %"
                            />
                            <Area 
                              type="monotone" 
                              dataKey="hate" 
                              stroke="#DC2626" 
                              fill="url(#tkHateGradient)"
                              name="Hate %"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Legend */}
                <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-zinc-400">Positivo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm text-zinc-400">Hate</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ChannelDetail;
