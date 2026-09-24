import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Player } from "@remotion/player";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { HateRankingScroll, HateRankingNBA, HateRankingInferno } from "@/remotion/compositions/HateRankingVideo";
import { VideoAnalysisVertical } from "@/remotion/compositions/VideoAnalysisVertical";
import { ChannelEvolutionVideo } from "@/remotion/compositions/ChannelEvolutionVideo";
import { DevilPresenterVideo } from "@/remotion/compositions/DevilPresenterVideo";
import { VideoPresenterVideo } from "@/remotion/compositions/VideoPresenterVideo";
import { LongFormChannelVideo } from "@/remotion/compositions/LongFormChannelVideo";
import axios from "axios";
import { 
  Flame, 
  ArrowLeft, 
  Video,
  TrendingUp,
  BarChart3,
  Play,
  Info,
  Smartphone,
  Monitor,
  Mic,
  Volume2,
  Loader2,
  Download,
  List,
  Trophy,
  Zap,
  Ghost,
  Video as VideoIcon,
  Youtube,
  FileText,
  Wand2,
  Copy
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Ranking style components map
const RANKING_STYLES = {
  scroll: { component: HateRankingScroll, name: 'Scroll Clásico', icon: List, description: 'Lista con scroll animado' },
  nba: { component: HateRankingNBA, name: 'Cuenta Atrás NBA', icon: Trophy, description: 'Revelación dramática uno a uno' },
  inferno: { component: HateRankingInferno, name: 'Inferno Mode', icon: Flame, description: 'Fuego, explosiones y caos' },
};

const VideoGeneratorPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analyses, setAnalyses] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [selectedVideoData, setSelectedVideoData] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [activeTab, setActiveTab] = useState("video-stats");
  const [rankingStyle, setRankingStyle] = useState("scroll");
  
  // Devil video states
  const [selectedDevilVideoId, setSelectedDevilVideoId] = useState(null);
  const [selectedDevilVideoData, setSelectedDevilVideoData] = useState(null);
  const [loadingDevilVideo, setLoadingDevilVideo] = useState(false);

  // Video Presenter states
  const [selectedPresenterVideoId, setSelectedPresenterVideoId] = useState(null);
  const [selectedPresenterVideoData, setSelectedPresenterVideoData] = useState(null);
  const [loadingPresenterVideo, setLoadingPresenterVideo] = useState(false);
  
  // Voice states
  const [voiceScript, setVoiceScript] = useState(null);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState(null);
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef(null);

  // Long-form (10 min) YouTube script states
  const [longFormChannelId, setLongFormChannelId] = useState(null);
  const [longFormScript, setLongFormScript] = useState(null);
  const [generatingLongForm, setGeneratingLongForm] = useState(false);
  const [longFormError, setLongFormError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analysesRes, channelsRes] = await Promise.all([
        axios.get(`${API}/analyses`),
        axios.get(`${API}/channels`)
      ]);
      setAnalyses(analysesRes.data);
      setChannels(channelsRes.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch full video data when selected
  const fetchVideoData = async (analysisId) => {
    if (!analysisId) {
      setSelectedVideoData(null);
      return;
    }
    
    setLoadingVideo(true);
    try {
      const res = await axios.get(`${API}/analysis/${analysisId}`);
      setSelectedVideoData(res.data);
    } catch (error) {
      console.error("Failed to fetch video data:", error);
      setSelectedVideoData(null);
    } finally {
      setLoadingVideo(false);
    }
  };

  useEffect(() => {
    fetchVideoData(selectedVideoId);
    // Reset voice when video changes
    setVoiceScript(null);
    setVoiceAudioUrl(null);
    setIsPlayingAudio(false);
  }, [selectedVideoId]);

  // Fetch devil video data
  const fetchDevilVideoData = async (analysisId) => {
    if (!analysisId) {
      setSelectedDevilVideoData(null);
      return;
    }
    
    setLoadingDevilVideo(true);
    try {
      const res = await axios.get(`${API}/analysis/${analysisId}`);
      setSelectedDevilVideoData(res.data);
    } catch (error) {
      console.error("Failed to fetch devil video data:", error);
      setSelectedDevilVideoData(null);
    } finally {
      setLoadingDevilVideo(false);
    }
  };

  useEffect(() => {
    fetchDevilVideoData(selectedDevilVideoId);
  }, [selectedDevilVideoId]);

  // Fetch presenter video data
  const fetchPresenterVideoData = async (analysisId) => {
    if (!analysisId) {
      setSelectedPresenterVideoData(null);
      return;
    }
    
    setLoadingPresenterVideo(true);
    try {
      const res = await axios.get(`${API}/analysis/${analysisId}`);
      setSelectedPresenterVideoData(res.data);
    } catch (error) {
      console.error("Failed to fetch presenter video data:", error);
      setSelectedPresenterVideoData(null);
    } finally {
      setLoadingPresenterVideo(false);
    }
  };

  useEffect(() => {
    fetchPresenterVideoData(selectedPresenterVideoId);
  }, [selectedPresenterVideoId]);

  // Generate voice narration
  const generateVoice = async () => {
    if (!selectedVideoId) return;
    
    setGeneratingVoice(true);
    try {
      const res = await axios.post(`${API}/generate-voice/${selectedVideoId}`);
      setVoiceScript(res.data.script);
      setVoiceAudioUrl(`${API}/voice-audio/${selectedVideoId}`);
    } catch (error) {
      console.error("Failed to generate voice:", error);
      alert("Error generando la voz");
    } finally {
      setGeneratingVoice(false);
    }
  };

  // Play/pause audio
  const toggleAudio = () => {
    if (!audioRef.current) return;
    
    if (isPlayingAudio) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlayingAudio(!isPlayingAudio);
  };

  // Generate 10-min long form YouTube script
  const generateLongForm = async () => {
    if (!longFormChannelId) return;
    setGeneratingLongForm(true);
    setLongFormError(null);
    setLongFormScript(null);
    try {
      const res = await axios.post(`${API}/long-form-script/${longFormChannelId}`);
      setLongFormScript(res.data);
    } catch (err) {
      console.error(err);
      setLongFormError(err.response?.data?.detail || "Error generando el guión");
    } finally {
      setGeneratingLongForm(false);
    }
  };

  const copyFullScript = () => {
    if (!longFormScript) return;
    const lines = [];
    lines.push(`# ${longFormScript.title || ''}`);
    if (longFormScript.subtitle) lines.push(longFormScript.subtitle);
    lines.push('');
    (longFormScript.sections || []).forEach((s, i) => {
      lines.push(`\n=== ${i + 1}. ${s.name?.toUpperCase() || s.id} (${s.start_time} - ${s.end_time}) ===`);
      if (s.headline) lines.push(`HEADLINE: ${s.headline}`);
      lines.push('');
      lines.push(s.script || '');
      if (s.devil_lines?.length) {
        lines.push('\n[Diablito dice]:');
        s.devil_lines.forEach(d => lines.push(`  • ${d}`));
      }
      if (s.bullets?.length) {
        lines.push('\n[Overlays en pantalla]:');
        s.bullets.forEach(b => lines.push(`  - ${b}`));
      }
      if (s.b_roll_suggestions?.length) {
        lines.push('\n[B-roll]:');
        s.b_roll_suggestions.forEach(b => lines.push(`  > ${b}`));
      }
    });
    navigator.clipboard.writeText(lines.join('\n'));
    alert('Guión copiado al portapapeles');
  };

  // Prepare data for Top 10 Ranking
  const top10Data = analyses
    .filter(a => a.status === "completed")
    .sort((a, b) => (b.hate_percentage || 0) - (a.hate_percentage || 0))
    .slice(0, 10);

  // Get completed analyses for video selector
  const completedAnalyses = analyses.filter(a => a.status === "completed");

  // Prepare data for channel evolution
  const getChannelEvolutionData = (channelId) => {
    const channelAnalyses = analyses
      .filter(a => a.channel_id === channelId && a.status === "completed")
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (channelAnalyses.length === 0) return null;

    const avgHate = channelAnalyses.reduce((sum, a) => sum + (a.hate_percentage || 0), 0) / channelAnalyses.length;
    
    const recent = channelAnalyses.slice(-3);
    const old = channelAnalyses.slice(0, 3);
    const recentAvg = recent.reduce((sum, a) => sum + (a.hate_percentage || 0), 0) / recent.length;
    const oldAvg = old.reduce((sum, a) => sum + (a.hate_percentage || 0), 0) / old.length;
    const trend = recentAvg - oldAvg;

    return {
      channel_name: channelAnalyses[0].channel_name,
      analyses: channelAnalyses,
      avg_hate: avgHate,
      trend: Math.round(trend),
    };
  };

  const selectedChannelData = selectedChannel ? getChannelEvolutionData(selectedChannel) : null;

  return (
    <div className="min-h-screen bg-[#09090B]">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="text-zinc-400 hover:text-white"
              data-testid="back-button"
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
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Title */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <Video className="w-8 h-8 text-red-600" />
              <h1 className="font-heading text-3xl font-black text-white" data-testid="page-title">
                GENERADOR DE VIDEOS
              </h1>
            </div>
            <p className="text-zinc-500 text-lg">
              Crea videos dinámicos con tus análisis. Formato 9:16 para Reels y TikTok.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                100% Gratis
              </Badge>
              <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/30">
                <Smartphone className="w-3 h-3 mr-1" />
                Formato Vertical 9:16
              </Badge>
              <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                60 segundos
              </Badge>
            </div>
          </div>

          {/* Info Card */}
          <Card className="p-4 mb-8 bg-zinc-900/50 border-zinc-800">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-white font-semibold mb-1">Video Vertical para Redes Sociales</h3>
                <p className="text-zinc-400 text-sm">
                  Genera videos de 1 minuto en formato 9:16 (1080x1920) optimizados para TikTok, Instagram Reels y YouTube Shorts. 
                  Incluye miniatura, estadísticas, gráficos de sentimiento, ranking de palabras, temas trending y más.
                </p>
                <p className="text-zinc-500 text-xs mt-2">
                  Tip: Para descargar el video, usa grabación de pantalla (OBS, QuickTime, etc.)
                </p>
              </div>
            </div>
          </Card>

          {loading ? (
            <div className="grid gap-4">
              <Skeleton className="h-96 bg-zinc-800" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-zinc-900 border-zinc-800 mb-6">
                <TabsTrigger value="video-stats" className="data-[state=active]:bg-red-600" data-testid="tab-video-stats">
                  <Smartphone className="w-4 h-4 mr-2" />
                  Análisis Individual (9:16)
                </TabsTrigger>
                <TabsTrigger value="devil-presenter" className="data-[state=active]:bg-red-600" data-testid="tab-devil-presenter">
                  <Ghost className="w-4 h-4 mr-2" />
                  Diablito Presentador
                </TabsTrigger>
                <TabsTrigger value="video-presenter" className="data-[state=active]:bg-red-600" data-testid="tab-video-presenter">
                  <VideoIcon className="w-4 h-4 mr-2" />
                  Video Presentador
                </TabsTrigger>
                <TabsTrigger value="ranking" className="data-[state=active]:bg-red-600" data-testid="tab-ranking">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Top 10 Ranking
                </TabsTrigger>
                <TabsTrigger value="channel-evolution" className="data-[state=active]:bg-red-600" data-testid="tab-evolution">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Evolución de Canal
                </TabsTrigger>
                <TabsTrigger value="long-form" className="data-[state=active]:bg-red-600" data-testid="tab-long-form">
                  <Youtube className="w-4 h-4 mr-2" />
                  YouTube 10 min
                </TabsTrigger>
              </TabsList>

              {/* Video Stats - Vertical 9:16 */}
              <TabsContent value="video-stats" className="space-y-4">
                <Card className="p-6 bg-zinc-900/50 border-zinc-800">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-red-600" />
                    Video Individual - Formato Vertical
                  </h2>
                  <p className="text-zinc-400 mb-6">
                    Selecciona un video analizado para generar un video de 60 segundos con todas las métricas.
                  </p>

                  {/* Video Selector */}
                  <div className="mb-6">
                    <label className="text-sm text-zinc-400 mb-2 block">Selecciona un video analizado:</label>
                    <select
                      value={selectedVideoId || ""}
                      onChange={(e) => setSelectedVideoId(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                      data-testid="video-selector"
                    >
                      <option value="">-- Selecciona un video --</option>
                      {completedAnalyses.map(analysis => (
                        <option key={analysis.id} value={analysis.id}>
                          {analysis.video_title?.substring(0, 60) || 'Sin título'} - {analysis.channel_name} ({Math.round(analysis.hate_percentage || 0)}% hate)
                        </option>
                      ))}
                    </select>
                  </div>

                  {loadingVideo ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
                    </div>
                  ) : !selectedVideoData ? (
                    <div className="text-center py-12 text-zinc-500">
                      Selecciona un video para generar la visualización.
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      {/* Vertical Video Player - 9:16 */}
                      <div 
                        className="bg-black rounded-2xl overflow-hidden shadow-2xl shadow-red-900/20"
                        style={{ 
                          width: '405px',  // 1080/2.67
                          height: '720px', // 1920/2.67
                        }}
                        data-testid="video-player-vertical"
                      >
                        <Player
                          component={VideoAnalysisVertical}
                          inputProps={{ data: selectedVideoData }}
                          durationInFrames={1800}
                          fps={30}
                          compositionWidth={1080}
                          compositionHeight={1920}
                          style={{ width: '100%', height: '100%' }}
                          controls
                        />
                      </div>
                    </div>
                  )}

                  {/* Video Info */}
                  {selectedVideoData && (
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-500">{Math.round(selectedVideoData.hate_percentage || 0)}%</div>
                        <div className="text-xs text-zinc-500">Hate</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-500">{Math.round(selectedVideoData.positive_percentage || 0)}%</div>
                        <div className="text-xs text-zinc-500">Positivo</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-white">{(selectedVideoData.total_comments_analyzed || 0).toLocaleString()}</div>
                        <div className="text-xs text-zinc-500">Comentarios</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-white">{(selectedVideoData.view_count || 0).toLocaleString()}</div>
                        <div className="text-xs text-zinc-500">Vistas</div>
                      </div>
                    </div>
                  )}

                  {/* Voice Generation Section */}
                  {selectedVideoData && (
                    <div className="mt-6">
                      <Card className="p-5 bg-zinc-800/30 border-zinc-700">
                        <div className="flex items-center gap-3 mb-4">
                          <Mic className="w-5 h-5 text-purple-500" />
                          <h3 className="text-lg font-bold text-white">Narración con Voz</h3>
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                            GRATIS
                          </Badge>
                        </div>
                        
                        <p className="text-zinc-400 text-sm mb-4">
                          Genera automáticamente un guión sensacionalista y voz en español (España) para tu video.
                        </p>

                        {!voiceAudioUrl ? (
                          <Button
                            onClick={generateVoice}
                            disabled={generatingVoice}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            data-testid="generate-voice-btn"
                          >
                            {generatingVoice ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generando voz...
                              </>
                            ) : (
                              <>
                                <Mic className="w-4 h-4 mr-2" />
                                Generar Voz
                              </>
                            )}
                          </Button>
                        ) : (
                          <div className="space-y-4">
                            {/* Audio Player */}
                            <div className="flex items-center gap-3">
                              <Button
                                onClick={toggleAudio}
                                className="bg-purple-600 hover:bg-purple-700"
                                data-testid="play-audio-btn"
                              >
                                {isPlayingAudio ? (
                                  <>
                                    <Volume2 className="w-4 h-4 mr-2" />
                                    Pausar
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Reproducir
                                  </>
                                )}
                              </Button>
                              
                              <a
                                href={voiceAudioUrl}
                                download={`socialhate_voice_${selectedVideoId}.mp3`}
                                className="inline-flex items-center px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md text-sm font-medium transition-colors"
                                data-testid="download-audio-btn"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Descargar MP3
                              </a>
                              
                              <Button
                                onClick={generateVoice}
                                variant="outline"
                                className="border-zinc-600 text-zinc-300"
                                disabled={generatingVoice}
                              >
                                Regenerar
                              </Button>
                            </div>
                            
                            {/* Hidden audio element */}
                            <audio
                              ref={audioRef}
                              src={voiceAudioUrl}
                              onEnded={() => setIsPlayingAudio(false)}
                              onPlay={() => setIsPlayingAudio(true)}
                              onPause={() => setIsPlayingAudio(false)}
                            />
                            
                            {/* Script Display */}
                            {voiceScript && (
                              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                                <div className="text-xs text-purple-400 font-semibold mb-2 uppercase">
                                  Guión generado:
                                </div>
                                <p className="text-zinc-300 text-sm leading-relaxed">
                                  "{voiceScript}"
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Devil Presenter Video */}
              <TabsContent value="devil-presenter" className="space-y-4">
                <Card className="p-6 bg-zinc-900/50 border-zinc-800">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Ghost className="w-5 h-5 text-red-600" />
                    Diablito Presentador - Video Animado
                  </h2>
                  <p className="text-zinc-400 mb-6">
                    ¡Deja que nuestro diablito presente los datos de tu análisis de forma divertida! 
                    Video de 45 segundos en formato vertical para Reels y TikTok.
                  </p>

                  {/* Video Selector */}
                  <div className="mb-6">
                    <label className="text-sm text-zinc-400 mb-2 block">Selecciona un video analizado:</label>
                    <select
                      value={selectedDevilVideoId || ""}
                      onChange={(e) => setSelectedDevilVideoId(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                      data-testid="devil-video-selector"
                    >
                      <option value="">-- Selecciona un video --</option>
                      {completedAnalyses.map(analysis => (
                        <option key={analysis.id} value={analysis.id}>
                          {analysis.video_title?.substring(0, 60) || 'Sin título'} - {analysis.channel_name} ({Math.round(analysis.hate_percentage || 0)}% hate)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Features Preview */}
                  <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">👋</div>
                      <div className="text-xs text-zinc-400">Intro animada</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">🎬</div>
                      <div className="text-xs text-zinc-400">Info del video</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">🔥</div>
                      <div className="text-xs text-zinc-400">Reveal de hate</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">📊</div>
                      <div className="text-xs text-zinc-400">Estadísticas</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">🗣️</div>
                      <div className="text-xs text-zinc-400">Top palabras</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">✌️</div>
                      <div className="text-xs text-zinc-400">Outro</div>
                    </div>
                  </div>

                  {loadingDevilVideo ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
                    </div>
                  ) : !selectedDevilVideoData ? (
                    <div className="text-center py-12 text-zinc-500">
                      Selecciona un video para generar la animación con el diablito.
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      {/* Vertical Video Player - 9:16 */}
                      <div 
                        className="bg-black rounded-2xl overflow-hidden shadow-2xl shadow-red-900/20"
                        style={{ 
                          width: '405px',
                          height: '720px',
                        }}
                        data-testid="devil-video-player"
                      >
                        <Player
                          component={DevilPresenterVideo}
                          inputProps={{ data: selectedDevilVideoData }}
                          durationInFrames={1350}
                          fps={30}
                          compositionWidth={1080}
                          compositionHeight={1920}
                          style={{ width: '100%', height: '100%' }}
                          controls
                        />
                      </div>
                    </div>
                  )}

                  {/* Video Info */}
                  {selectedDevilVideoData && (
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-500">{Math.round(selectedDevilVideoData.hate_percentage || 0)}%</div>
                        <div className="text-xs text-zinc-500">Hate</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-500">{Math.round(selectedDevilVideoData.positive_percentage || 0)}%</div>
                        <div className="text-xs text-zinc-500">Positivo</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-white">{(selectedDevilVideoData.total_comments_analyzed || 0).toLocaleString()}</div>
                        <div className="text-xs text-zinc-500">Comentarios</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-white">{(selectedDevilVideoData.view_count || 0).toLocaleString()}</div>
                        <div className="text-xs text-zinc-500">Vistas</div>
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Video Presenter */}
              <TabsContent value="video-presenter" className="space-y-4">
                <Card className="p-6 bg-zinc-900/50 border-zinc-800">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <VideoIcon className="w-5 h-5 text-red-600" />
                    Video Presentador - Con Personaje Animado
                  </h2>
                  <p className="text-zinc-400 mb-6">
                    Un presentador animado con video real presenta los datos de tu análisis. 
                    El personaje aparece y desaparece entre escenas para hacer el video más dinámico.
                  </p>

                  {/* Video Selector */}
                  <div className="mb-6">
                    <label className="text-sm text-zinc-400 mb-2 block">Selecciona un video analizado:</label>
                    <select
                      value={selectedPresenterVideoId || ""}
                      onChange={(e) => setSelectedPresenterVideoId(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                      data-testid="presenter-video-selector"
                    >
                      <option value="">-- Selecciona un video --</option>
                      {completedAnalyses.map(analysis => (
                        <option key={analysis.id} value={analysis.id}>
                          {analysis.video_title?.substring(0, 60) || 'Sin título'} - {analysis.channel_name} ({Math.round(analysis.hate_percentage || 0)}% hate)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Features Preview */}
                  <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">🎬</div>
                      <div className="text-xs text-zinc-400">Video real</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">💬</div>
                      <div className="text-xs text-zinc-400">Burbujas de texto</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">🔥</div>
                      <div className="text-xs text-zinc-400">Efectos de fuego</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">📊</div>
                      <div className="text-xs text-zinc-400">Stats animados</div>
                    </div>
                  </div>

                  {loadingPresenterVideo ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
                    </div>
                  ) : !selectedPresenterVideoData ? (
                    <div className="text-center py-12 text-zinc-500">
                      Selecciona un video para generar la animación con el presentador.
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      {/* Vertical Video Player - 9:16 */}
                      <div 
                        className="bg-black rounded-2xl overflow-hidden shadow-2xl shadow-red-900/20"
                        style={{ 
                          width: '405px',
                          height: '720px',
                        }}
                        data-testid="presenter-video-player"
                      >
                        <Player
                          component={VideoPresenterVideo}
                          inputProps={{ data: selectedPresenterVideoData }}
                          durationInFrames={1350}
                          fps={30}
                          compositionWidth={1080}
                          compositionHeight={1920}
                          style={{ width: '100%', height: '100%' }}
                          controls
                        />
                      </div>
                    </div>
                  )}

                  {/* Video Info */}
                  {selectedPresenterVideoData && (
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-500">{Math.round(selectedPresenterVideoData.hate_percentage || 0)}%</div>
                        <div className="text-xs text-zinc-500">Hate</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-500">{Math.round(selectedPresenterVideoData.positive_percentage || 0)}%</div>
                        <div className="text-xs text-zinc-500">Positivo</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-white">{(selectedPresenterVideoData.total_comments_analyzed || 0).toLocaleString()}</div>
                        <div className="text-xs text-zinc-500">Comentarios</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-white">{(selectedPresenterVideoData.view_count || 0).toLocaleString()}</div>
                        <div className="text-xs text-zinc-500">Vistas</div>
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Top 10 Ranking */}
              <TabsContent value="ranking" className="space-y-4">
                <Card className="p-6 bg-zinc-900/50 border-zinc-800">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-red-600" />
                    Top 10 Videos con Mayor Hate (9:16)
                  </h2>
                  <p className="text-zinc-400 mb-4">
                    Ranking de los 10 videos con mayor porcentaje de comentarios de odio. Formato vertical para Reels/TikTok.
                  </p>

                  {/* Style Selector */}
                  <div className="mb-6">
                    <label className="text-sm text-zinc-400 mb-3 block">Selecciona el estilo del video:</label>
                    <div className="grid grid-cols-3 gap-3">
                      {Object.entries(RANKING_STYLES).map(([key, style]) => {
                        const Icon = style.icon;
                        const isSelected = rankingStyle === key;
                        return (
                          <button
                            key={key}
                            onClick={() => setRankingStyle(key)}
                            className={`p-4 rounded-xl border-2 transition-all ${
                              isSelected 
                                ? 'border-red-500 bg-red-500/10' 
                                : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                            }`}
                            data-testid={`ranking-style-${key}`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <Icon className={`w-8 h-8 ${isSelected ? 'text-red-500' : 'text-zinc-400'}`} />
                              <span className={`font-bold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                                {style.name}
                              </span>
                              <span className="text-xs text-zinc-500 text-center">
                                {style.description}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {top10Data.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">
                      No hay suficientes análisis completados para generar el ranking.
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      {/* Vertical Video Player - 9:16 */}
                      <div 
                        className="bg-black rounded-2xl overflow-hidden shadow-2xl shadow-red-900/20"
                        style={{ 
                          width: '405px',
                          height: '720px',
                        }}
                        data-testid="ranking-player"
                      >
                        <Player
                          component={RANKING_STYLES[rankingStyle].component}
                          inputProps={{ data: top10Data }}
                          durationInFrames={900}
                          fps={30}
                          compositionWidth={1080}
                          compositionHeight={1920}
                          style={{ width: '100%', height: '100%' }}
                          controls
                        />
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Channel Evolution */}
              <TabsContent value="channel-evolution" className="space-y-4">
                <Card className="p-6 bg-zinc-900/50 border-zinc-800">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-red-600" />
                    Evolución de Canal (16:9)
                  </h2>
                  <p className="text-zinc-400 mb-4">
                    Gráfica de evolución del hate en los videos de un canal a lo largo del tiempo.
                  </p>

                  {/* Channel Selector */}
                  <div className="mb-6">
                    <label className="text-sm text-zinc-400 mb-2 block">Selecciona un canal:</label>
                    <select
                      value={selectedChannel || ""}
                      onChange={(e) => setSelectedChannel(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      data-testid="channel-selector"
                    >
                      <option value="">-- Selecciona un canal --</option>
                      {channels.map(channel => (
                        <option key={channel.id} value={channel.id}>
                          {channel.name} ({channel.total_videos_analyzed} videos)
                        </option>
                      ))}
                    </select>
                  </div>

                  {!selectedChannelData ? (
                    <div className="text-center py-12 text-zinc-500">
                      {selectedChannel 
                        ? "Este canal no tiene suficientes análisis." 
                        : "Selecciona un canal para ver su evolución."}
                    </div>
                  ) : (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden" data-testid="evolution-player">
                      <Player
                        component={ChannelEvolutionVideo}
                        inputProps={{ data: selectedChannelData }}
                        durationInFrames={300}
                        fps={30}
                        compositionWidth={1920}
                        compositionHeight={1080}
                        style={{ width: '100%', height: '100%' }}
                        controls
                      />
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Long-form 10-min YouTube Script */}
              <TabsContent value="long-form" className="space-y-4">
                <Card className="p-6 bg-zinc-900/50 border-zinc-800">
                  <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <Youtube className="w-5 h-5 text-red-600" />
                    Vídeo YouTube 10 min - Análisis de Canal
                  </h2>
                  <p className="text-zinc-400 mb-4">
                    Genera un guión polémico optimizado para retención (estructura de 8 partes) sobre cualquier canal de SocialHate. El diablito presenta cada bloque mientras tú lees el guión a cámara.
                  </p>

                  <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Badge className="bg-red-500/10 text-red-400 border-red-500/30 justify-center py-2">10 minutos</Badge>
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 justify-center py-2">Estilo polémico</Badge>
                    <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 justify-center py-2">Datos reales</Badge>
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/30 justify-center py-2">Formato 16:9</Badge>
                  </div>

                  {/* Channel selector + generate */}
                  <div className="grid md:grid-cols-3 gap-3 mb-6">
                    <select
                      value={longFormChannelId || ""}
                      onChange={(e) => { setLongFormChannelId(e.target.value); setLongFormScript(null); }}
                      className="md:col-span-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      data-testid="long-form-channel-selector"
                    >
                      <option value="">-- Selecciona un canal de SocialHate --</option>
                      {channels.map(channel => (
                        <option key={channel.id} value={channel.id}>
                          {channel.name} ({channel.total_videos_analyzed || 0} vídeos)
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={generateLongForm}
                      disabled={!longFormChannelId || generatingLongForm}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-3"
                      data-testid="generate-long-form-btn"
                    >
                      {generatingLongForm ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando guión...</>
                      ) : (
                        <><Wand2 className="w-4 h-4 mr-2" /> Generar Guión 10 min</>
                      )}
                    </Button>
                  </div>

                  {longFormError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm" data-testid="long-form-error">
                      {longFormError}
                    </div>
                  )}

                  {!longFormScript && !generatingLongForm && (
                    <div className="text-center py-12 text-zinc-500">
                      Selecciona un canal y pulsa "Generar Guión 10 min".
                    </div>
                  )}

                  {longFormScript && (
                    <div className="space-y-6" data-testid="long-form-result">
                      {/* Title block */}
                      <div className="rounded-xl p-5 bg-gradient-to-r from-red-900/40 to-zinc-900 border border-red-700/40">
                        <div className="text-xs uppercase tracking-widest text-red-400 mb-1">Título sugerido</div>
                        <h3 className="text-2xl md:text-3xl font-black text-white leading-tight" data-testid="long-form-title">
                          {longFormScript.title}
                        </h3>
                        {longFormScript.subtitle && (
                          <p className="text-zinc-300 mt-2">{longFormScript.subtitle}</p>
                        )}
                        {longFormScript.thumbnail_hook && (
                          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm font-bold">
                            Miniatura: {longFormScript.thumbnail_hook}
                          </div>
                        )}
                      </div>

                      {/* Player */}
                      <div className="flex justify-center">
                        <div
                          className="bg-black rounded-2xl overflow-hidden shadow-2xl shadow-red-900/20"
                          style={{ width: '100%', maxWidth: 960, aspectRatio: '16/9' }}
                          data-testid="long-form-player"
                        >
                          <Player
                            component={LongFormChannelVideo}
                            inputProps={{ data: longFormScript }}
                            durationInFrames={18000}
                            fps={30}
                            compositionWidth={1920}
                            compositionHeight={1080}
                            style={{ width: '100%', height: '100%' }}
                            controls
                          />
                        </div>
                      </div>

                      {/* Sections breakdown */}
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-bold text-white flex items-center gap-2">
                          <FileText className="w-5 h-5 text-red-500" />
                          Guión completo (para teleprompter)
                        </h4>
                        <Button
                          variant="outline"
                          onClick={copyFullScript}
                          className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                          data-testid="copy-script-btn"
                        >
                          <Copy className="w-4 h-4 mr-2" /> Copiar todo
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {longFormScript.sections?.map((s, i) => (
                          <Card key={s.id || i} className="p-5 bg-zinc-900/70 border-zinc-800">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <div className="text-xs uppercase tracking-widest text-red-400 font-bold">
                                  Parte {i + 1}/{longFormScript.sections.length} · {s.name || s.id}
                                </div>
                                <div className="text-xl font-black text-white mt-1">{s.headline}</div>
                              </div>
                              <Badge className="bg-zinc-800 border-zinc-700 text-zinc-300 font-mono">
                                {s.start_time} → {s.end_time}
                              </Badge>
                            </div>
                            <p className="text-zinc-200 leading-relaxed whitespace-pre-line" data-testid={`section-script-${i}`}>
                              {s.script}
                            </p>

                            {s.devil_lines?.length > 0 && (
                              <div className="mt-4">
                                <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">
                                  🔥 Frases del diablito (overlay)
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {s.devil_lines.map((d, j) => (
                                    <span key={j} className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/40 text-red-300 text-sm">
                                      "{d}"
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {s.bullets?.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2">
                                  Datos en pantalla
                                </div>
                                <ul className="text-zinc-300 text-sm space-y-1">
                                  {s.bullets.map((b, j) => (
                                    <li key={j} className="flex gap-2"><span className="text-yellow-500">▸</span>{b}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {s.b_roll_suggestions?.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">
                                  B-roll sugerido
                                </div>
                                <ul className="text-zinc-400 text-sm space-y-1">
                                  {s.b_roll_suggestions.map((b, j) => (
                                    <li key={j} className="flex gap-2"><span className="text-purple-500">▸</span>{b}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* Scenes Info */}
          <Card className="mt-8 p-6 bg-zinc-900/50 border-zinc-800">
            <h3 className="text-lg font-bold text-white mb-4">Escenas del Video Individual (60s)</h3>
            <div className="grid md:grid-cols-4 gap-4 text-sm">
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-red-500 font-bold mb-1">0-6s</div>
                <div className="text-white font-semibold">Intro</div>
                <div className="text-zinc-500 text-xs">Miniatura, título, stats básicos</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-red-500 font-bold mb-1">6-12s</div>
                <div className="text-white font-semibold">Estadísticas</div>
                <div className="text-zinc-500 text-xs">% Hate, positivo, negativo, toxicidad</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-red-500 font-bold mb-1">12-18s</div>
                <div className="text-white font-semibold">Gráfico Circular</div>
                <div className="text-zinc-500 text-xs">Desglose de sentimientos</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-red-500 font-bold mb-1">18-24s</div>
                <div className="text-white font-semibold">Emociones</div>
                <div className="text-zinc-500 text-xs">Ira, alegría, asco, tristeza...</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-red-500 font-bold mb-1">24-31s</div>
                <div className="text-white font-semibold">Ranking Palabras</div>
                <div className="text-zinc-500 text-xs">Palabras más mencionadas</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-red-500 font-bold mb-1">31-38s</div>
                <div className="text-white font-semibold">Temas Trending</div>
                <div className="text-zinc-500 text-xs">Tópicos más discutidos</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-red-500 font-bold mb-1">38-48s</div>
                <div className="text-white font-semibold">¿Qué falla?</div>
                <div className="text-zinc-500 text-xs">Insights y resumen de críticas</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-red-500 font-bold mb-1">48-60s</div>
                <div className="text-white font-semibold">Outro</div>
                <div className="text-zinc-500 text-xs">Resumen final y CTA</div>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default VideoGeneratorPage;
