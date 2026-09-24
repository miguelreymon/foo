import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import axios from "axios";
import LanguageToggle from "@/components/LanguageToggle";
import Footer from "@/components/Footer";
import {
  Flame,
  ArrowLeft,
  Users,
  Video,
  MessageSquare,
  TrendingUp,
  Skull,
  Heart,
  ChevronRight,
  Loader2,
  Youtube
} from "lucide-react";

// TikTok icon component
const TikTokIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function ChannelsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelAnalyses, setChannelAnalyses] = useState([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, []);

  useEffect(() => {
    // Auto-select channel from URL parameter
    const channelId = searchParams.get('channel');
    if (channelId && channels.length > 0) {
      const channel = channels.find(c => c.id === channelId);
      if (channel) {
        selectChannel(channel);
      }
    }
  }, [searchParams, channels]);

  const fetchChannels = async () => {
    try {
      const response = await axios.get(`${API}/channels`);
      // API returns array directly
      setChannels(Array.isArray(response.data) ? response.data : response.data.channels || []);
    } catch (error) {
      toast.error("Error cargando canales");
    } finally {
      setLoading(false);
    }
  };

  const selectChannel = async (channel) => {
    setSelectedChannel(channel);
    setLoadingAnalyses(true);
    try {
      const response = await axios.get(`${API}/channel/${channel.channel_id}/analyses`);
      // API returns array directly
      setChannelAnalyses(Array.isArray(response.data) ? response.data : response.data.analyses || []);
    } catch (error) {
      toast.error("Error cargando análisis del canal");
    } finally {
      setLoadingAnalyses(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num?.toString() || "0";
  };

  const getHateColor = (percentage) => {
    if (percentage >= 20) return "text-red-500";
    if (percentage >= 10) return "text-amber-500";
    return "text-green-500";
  };

  const getHateBadge = (percentage) => {
    if (percentage >= 20) return { bg: "bg-red-600/20", text: "text-red-500", label: "Alto" };
    if (percentage >= 10) return { bg: "bg-amber-600/20", text: "text-amber-500", label: "Medio" };
    return { bg: "bg-green-600/20", text: "text-green-500", label: "Bajo" };
  };

  return (
    <div className="min-h-screen bg-[#09090B]">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800 sticky top-0 z-50 bg-[#09090B]/90 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => selectedChannel ? setSelectedChannel(null) : navigate("/dashboard")}
              className="text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Flame className="w-6 h-6 text-red-600" />
              <span className="font-heading text-xl font-black text-white">
                SOCIAL<span className="text-red-600">HATE</span>
              </span>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
          </div>
        ) : selectedChannel ? (
          // Channel Detail View
          <div className="space-y-6">
            {/* Channel Header */}
            <Card className="bg-zinc-900/50 border-zinc-800 p-4 md:p-6">
              <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                <img
                  src={selectedChannel.thumbnail_url}
                  alt={selectedChannel.name}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-red-600"
                />
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-xl md:text-2xl font-bold text-white">{selectedChannel.name}</h1>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-6 mt-2 text-zinc-400 text-sm">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {formatNumber(selectedChannel.subscriber_count)} subs
                    </span>
                    <span className="flex items-center gap-1">
                      <Video className="w-4 h-4" />
                      {selectedChannel.total_videos_analyzed} analizados
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {formatNumber(selectedChannel.total_comments_analyzed)} comentarios
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl md:text-4xl font-black ${getHateColor(selectedChannel.avg_hate_percentage)}`}>
                    {selectedChannel.avg_hate_percentage}%
                  </div>
                  <div className="text-sm text-zinc-500">Hate promedio</div>
                </div>
              </div>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-zinc-900/50 border-zinc-800 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-600/20">
                    <Skull className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{selectedChannel.avg_hate_percentage}%</div>
                    <div className="text-xs text-zinc-500">Hate Promedio</div>
                  </div>
                </div>
              </Card>
              <Card className="bg-zinc-900/50 border-zinc-800 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-600/20">
                    <Heart className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{selectedChannel.avg_positive_percentage}%</div>
                    <div className="text-xs text-zinc-500">Positivo Promedio</div>
                  </div>
                </div>
              </Card>
              <Card className="bg-zinc-900/50 border-zinc-800 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-600/20">
                    <Video className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{selectedChannel.total_videos_analyzed}</div>
                    <div className="text-xs text-zinc-500">Videos Analizados</div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Videos List */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Videos Analizados</h2>
              {loadingAnalyses ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                </div>
              ) : channelAnalyses.length === 0 ? (
                <p className="text-center text-zinc-500 py-10">No hay videos analizados</p>
              ) : (
                <div className="space-y-3">
                  {channelAnalyses.map(analysis => {
                    const hateBadge = getHateBadge(analysis.hate_percentage || 0);
                    return (
                      <Card
                        key={analysis.id}
                        onClick={() => navigate(`/analysis/${analysis.id}`)}
                        className="bg-zinc-900/50 border-zinc-800 p-3 md:p-4 cursor-pointer hover:bg-zinc-800/50 transition-all"
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <img
                            src={analysis.thumbnail_url}
                            alt={analysis.video_title}
                            className="w-20 h-12 md:w-32 md:h-20 object-cover rounded flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white text-sm md:text-base line-clamp-2 md:truncate">{analysis.video_title}</h3>
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1 md:mt-2 text-xs md:text-sm text-zinc-400">
                              <span>{formatNumber(analysis.total_comments_analyzed || 0)} comentarios</span>
                              <span className="hidden md:inline">{new Date(analysis.created_at).toLocaleDateString("es-ES")}</span>
                            </div>
                          </div>
                          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
                            <div className="text-center md:text-right">
                              <div className={`text-lg md:text-xl font-bold ${getHateColor(analysis.hate_percentage || 0)}`}>
                                {analysis.hate_percentage || 0}%
                              </div>
                              <Badge className={`${hateBadge.bg} ${hateBadge.text} text-xs`}>
                                {hateBadge.label}
                              </Badge>
                            </div>
                            <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-zinc-600 flex-shrink-0" />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Channels List View
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-white">Canales Analizados</h1>
              <Badge className="bg-red-600/20 text-red-500">{channels.length} canales</Badge>
            </div>

            {channels.length === 0 ? (
              <Card className="bg-zinc-900/50 border-zinc-800 p-10 text-center">
                <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No hay canales analizados</h3>
                <p className="text-zinc-500 mb-4">Analiza videos de YouTube para ver los canales aquí</p>
                <Button onClick={() => navigate("/")} className="bg-red-600 hover:bg-red-700">
                  Analizar un video
                </Button>
              </Card>
            ) : (
              <div className="grid gap-3">
                {channels.map(channel => {
                  const hateBadge = getHateBadge(channel.avg_hate_percentage || 0);
                  return (
                    <Card
                      key={channel.channel_id}
                      onClick={() => selectChannel(channel)}
                      className="bg-zinc-900/50 border-zinc-800 p-3 cursor-pointer hover:bg-zinc-800/50 transition-all"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Platform icons */}
                        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                          {(channel.platforms?.includes("youtube") || channel.platform === "youtube" || (!channel.platforms && !channel.platform)) && (
                            <Youtube className="w-4 h-4 text-red-600" />
                          )}
                          {(channel.platforms?.includes("tiktok") || channel.platform === "tiktok") && (
                            <TikTokIcon className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <img
                          src={channel.thumbnail_url}
                          alt={channel.name}
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white text-sm sm:text-base truncate">{channel.name}</h3>
                          <div className="flex items-center gap-2 sm:gap-3 mt-0.5 text-xs text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {formatNumber(channel.subscriber_count)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Video className="w-3 h-3" />
                              {channel.total_videos_analyzed}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <span className={`font-mono text-base sm:text-lg font-bold ${getHateColor(channel.avg_hate_percentage || 0)}`}>
                              {channel.avg_hate_percentage || 0}%
                            </span>
                          </div>
                          <Badge className={`${hateBadge.bg} ${hateBadge.text} text-xs`}>
                            {hateBadge.label}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
