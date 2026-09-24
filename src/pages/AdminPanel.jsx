import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import {
  Flame,
  Search,
  Plus,
  Trash2,
  Clock,
  Users,
  Video,
  RefreshCw,
  Lock,
  LogOut,
  PlayCircle,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  ThumbsUp,
  MessageSquare,
  ListVideo,
  Zap,
  Flag,
  AlertTriangle,
  Check,
  X,
  Download
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const CATEGORIES = [
  { value: "foodies", label: "Foodies" },
  { value: "gaming", label: "Gaming" },
  { value: "tech", label: "Tecnología" },
  { value: "entretenimiento", label: "Entretenimiento" },
  { value: "deportes", label: "Deportes" },
  { value: "musica", label: "Música" },
  { value: "politica", label: "Política" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "educacion", label: "Educación" },
  { value: "otros", label: "Otros" }
];

const SENTIMENT_OPTIONS = [
  { value: "positive", label: "Positivo", color: "text-green-500" },
  { value: "negative", label: "Negativo", color: "text-amber-500" },
  { value: "neutral", label: "Neutral", color: "text-zinc-400" }
];

export default function AdminPanel() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("foodies");
  
  // Tracked channels
  const [trackedChannels, setTrackedChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  
  // Scheduled analyses
  const [scheduledAnalyses, setScheduledAnalyses] = useState([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  
  // Video selection modal
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedChannelForVideos, setSelectedChannelForVideos] = useState(null);
  const [channelVideos, setChannelVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  const [analyzingVideos, setAnalyzingVideos] = useState(false);
  
  // Reports
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [correctedSentiment, setCorrectedSentiment] = useState("");
  const [correctedIsHate, setCorrectedIsHate] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem("adminAuth");
    if (auth === "true") {
      setIsAuthenticated(true);
      loadData();
    }
  }, []);

  const loadData = async () => {
    await Promise.all([
      fetchTrackedChannels(),
      fetchScheduledAnalyses(),
      fetchReports()
    ]);
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const response = await axios.get(`${API}/admin/reports`);
      setReports(response.data);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoadingReports(false);
    }
  };

  const approveReport = async (reportId) => {
    try {
      await axios.put(`${API}/admin/reports/${reportId}`, {
        status: "approved"
      });
      toast.success("Clasificación aprobada");
      fetchReports();
    } catch (error) {
      toast.error("Error al aprobar");
    }
  };

  const correctReport = async (reportId) => {
    try {
      await axios.put(`${API}/admin/reports/${reportId}`, {
        status: "corrected",
        corrected_sentiment: correctedSentiment,
        corrected_is_hate: correctedIsHate
      });
      toast.success("Clasificación corregida");
      setSelectedReport(null);
      setCorrectedSentiment("");
      setCorrectedIsHate(false);
      fetchReports();
    } catch (error) {
      toast.error("Error al corregir");
    }
  };

  const deleteReport = async (reportId) => {
    try {
      await axios.delete(`${API}/admin/reports/${reportId}`);
      toast.success("Reporte eliminado");
      fetchReports();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const response = await axios.post(`${API}/admin/login`, { username, password });
      
      // Check if user is Medusa - redirect to advanced panel
      if (response.data.role === "medusa") {
        localStorage.setItem("adminAuth", "medusa");
        toast.success("Bienvenido a MEDUSA 🐍");
        navigate("/medusa");
        return;
      }
      
      localStorage.setItem("adminAuth", "true");
      setIsAuthenticated(true);
      toast.success("Login correcto");
      loadData();
    } catch (error) {
      toast.error("Credenciales incorrectas");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminAuth");
    setIsAuthenticated(false);
    toast.info("Sesión cerrada");
  };

  const searchChannels = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const response = await axios.get(`${API}/admin/search-channels`, {
        params: { query: searchQuery, max_results: 10 }
      });
      setSearchResults(response.data.channels);
    } catch (error) {
      toast.error("Error buscando canales");
    } finally {
      setSearching(false);
    }
  };

  const trackChannel = async (channel) => {
    try {
      await axios.post(`${API}/admin/track-channel`, {
        channel_id: channel.channel_id,
        channel_name: channel.channel_name,
        thumbnail_url: channel.thumbnail_url,
        category: selectedCategory,
        auto_analyze: true,
        delay_hours: 24
      });
      toast.success(`Canal "${channel.channel_name}" añadido`);
      fetchTrackedChannels();
      setSearchResults(prev => prev.filter(c => c.channel_id !== channel.channel_id));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error añadiendo canal");
    }
  };

  const untrackChannel = async (channelId) => {
    try {
      await axios.delete(`${API}/admin/tracked-channel/${channelId}`);
      toast.success("Canal eliminado");
      fetchTrackedChannels();
    } catch (error) {
      toast.error("Error eliminando canal");
    }
  };

  const fetchTrackedChannels = async () => {
    setLoadingChannels(true);
    try {
      const response = await axios.get(`${API}/admin/tracked-channels`);
      setTrackedChannels(response.data.channels);
    } catch (error) {
      console.error("Error fetching tracked channels:", error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const fetchScheduledAnalyses = async () => {
    setLoadingScheduled(true);
    try {
      const response = await axios.get(`${API}/admin/scheduled-analyses`);
      setScheduledAnalyses(response.data.analyses);
    } catch (error) {
      console.error("Error fetching scheduled analyses:", error);
    } finally {
      setLoadingScheduled(false);
    }
  };

  const checkNewVideos = async () => {
    try {
      await axios.post(`${API}/admin/check-new-videos`);
      toast.success("Verificación de nuevos videos iniciada");
      setTimeout(fetchScheduledAnalyses, 5000);
    } catch (error) {
      toast.error("Error verificando videos");
    }
  };

  const runScheduled = async () => {
    try {
      await axios.post(`${API}/admin/run-scheduled`);
      toast.success("Análisis programados iniciados");
      setTimeout(fetchScheduledAnalyses, 5000);
    } catch (error) {
      toast.error("Error ejecutando análisis");
    }
  };

  const openVideoModal = async (channel) => {
    setSelectedChannelForVideos(channel);
    setShowVideoModal(true);
    setSelectedVideos(new Set());
    setLoadingVideos(true);
    
    try {
      const response = await axios.get(`${API}/admin/channel-videos/${channel.channel_id}`, {
        params: { max_results: 20 }
      });
      setChannelVideos(response.data.videos);
    } catch (error) {
      toast.error("Error cargando videos del canal");
      setChannelVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  const toggleVideoSelection = (videoId) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const selectLast5Videos = () => {
    const last5 = channelVideos.slice(0, 5).map(v => v.video_id);
    setSelectedVideos(new Set(last5));
  };

  const selectAllVideos = () => {
    if (selectedVideos.size === channelVideos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(channelVideos.map(v => v.video_id)));
    }
  };

  const analyzeSelectedVideos = async () => {
    if (selectedVideos.size === 0) {
      toast.error("Selecciona al menos un video");
      return;
    }
    
    setAnalyzingVideos(true);
    
    try {
      const videoUrls = channelVideos
        .filter(v => selectedVideos.has(v.video_id))
        .map(v => `https://www.youtube.com/watch?v=${v.video_id}`);
      
      const response = await axios.post(`${API}/admin/analyze-videos`, videoUrls);
      
      toast.success(`${response.data.queued} videos añadidos para análisis`);
      setShowVideoModal(false);
      setSelectedVideos(new Set());
      
      // Redirect to dashboard after a moment
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
      
    } catch (error) {
      toast.error("Error al analizar videos");
    } finally {
      setAnalyzingVideos(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num?.toString() || "0";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-900/50 border-zinc-800">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Flame className="w-10 h-10 text-red-600" />
              <span className="font-heading text-3xl font-black text-white">
                SOCIAL<span className="text-red-600">HATE</span>
              </span>
            </div>
            <CardTitle className="text-xl text-zinc-400">Panel de Administración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <Button 
              onClick={handleLogin} 
              disabled={loginLoading}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {loginLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin Panel
  return (
    <div className="min-h-screen bg-[#09090B]">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800 sticky top-0 z-50 bg-[#09090B]/90 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Flame className="w-8 h-8 text-red-600" />
              <span className="font-heading text-2xl font-black text-white">
                SOCIAL<span className="text-red-600">HATE</span>
              </span>
            </div>
            <Badge className="bg-red-600/20 text-red-500 border-red-600/30">ADMIN</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="bg-zinc-800/50 border-zinc-700 hover:bg-zinc-700 text-white"
            >
              Ver App
            </Button>
            <Button
              variant="outline"
              onClick={async (e) => {
                if (downloadingZip) return;
                const withSecrets = e.shiftKey || e.altKey;
                if (withSecrets) {
                  if (!window.confirm("⚠️ Vas a descargar el proyecto INCLUYENDO secretos (.env, firebase-credentials.json). Solo guárdalo en local. ¿Continuar?")) return;
                }
                try {
                  setDownloadingZip(true);
                  const url = `${process.env.REACT_APP_BACKEND_URL}/api/admin/download-project?include_secrets=${withSecrets}`;
                  const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                  });
                  if (!res.ok) {
                    const t = await res.text();
                    alert("Error descargando: " + t);
                    return;
                  }
                  const cd = res.headers.get("content-disposition") || "";
                  const m = cd.match(/filename="?([^";]+)"?/i);
                  const fname = m ? m[1] : `socialhate_project_${Date.now()}.zip`;
                  const blob = await res.blob();
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = fname;
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                } catch (err) {
                  alert("Error: " + err.message);
                } finally {
                  setDownloadingZip(false);
                }
              }}
              title="Click: descarga sin secrets · Shift/Alt+Click: incluye .env y firebase-credentials.json"
              className="bg-emerald-600/15 border-emerald-600/40 hover:bg-emerald-600/30 text-emerald-300"
              data-testid="download-project-btn"
            >
              {downloadingZip ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando…</>
              ) : (
                <><Download className="w-4 h-4 mr-2" /> Descargar proyecto</>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-zinc-400 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="channels" className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="channels" className="data-[state=active]:bg-zinc-800">
              <Users className="w-4 h-4 mr-2" />
              Canales
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-zinc-800">
              <Flag className="w-4 h-4 mr-2" />
              Reportes
              {reports.filter(r => r.status === "pending").length > 0 && (
                <Badge className="ml-2 bg-red-600 text-white text-xs">
                  {reports.filter(r => r.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Channels Tab */}
          <TabsContent value="channels" className="space-y-8">
            {/* Search Section */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-red-500" />
                  Buscar Canales de YouTube
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Input
                    placeholder="Buscar canales (ej: foodies españa, gaming...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchChannels()}
                    className="flex-1 bg-zinc-800 border-zinc-700 text-white"
                  />
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value} className="text-white">
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={searchChannels} 
                    disabled={searching}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-3 mt-4">
                <h3 className="text-sm font-medium text-zinc-400">Resultados ({searchResults.length})</h3>
                <div className="grid gap-3">
                  {searchResults.map(channel => (
                    <div 
                      key={channel.channel_id}
                      className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700"
                    >
                      <img 
                        src={channel.thumbnail_url} 
                        alt={channel.channel_name}
                        className="w-12 h-12 rounded-full"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-white">{channel.channel_name}</h4>
                        <div className="flex items-center gap-4 text-sm text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {formatNumber(channel.subscriber_count)} subs
                          </span>
                          <span className="flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            {channel.video_count} videos
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openVideoModal(channel)}
                        className="bg-blue-600/20 border-blue-600/50 text-blue-400 hover:bg-blue-600/30"
                      >
                        <ListVideo className="w-4 h-4 mr-1" />
                        Videos
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => trackChannel(channel)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Seguir
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tracked Channels */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-red-500" />
              Canales Seguidos ({trackedChannels.length})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTrackedChannels}
              className="bg-zinc-800 border-zinc-700 text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loadingChannels ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
              </div>
            ) : trackedChannels.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">No hay canales seguidos</p>
            ) : (
              <div className="grid gap-3">
                {trackedChannels.map(channel => (
                  <div 
                    key={channel.channel_id}
                    className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700"
                  >
                    <img 
                      src={channel.thumbnail_url} 
                      alt={channel.channel_name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{channel.channel_name}</h4>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <Badge variant="outline" className="text-xs border-zinc-600">
                          {channel.category}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Análisis: {channel.delay_hours}h después
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => untrackChannel(channel.channel_id)}
                      className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduled Analyses */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-red-500" />
              Análisis Programados ({scheduledAnalyses.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={checkNewVideos}
                className="bg-zinc-800 border-zinc-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Buscar Videos
              </Button>
              <Button
                size="sm"
                onClick={runScheduled}
                className="bg-green-600 hover:bg-green-700"
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                Ejecutar Pendientes
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingScheduled ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
              </div>
            ) : scheduledAnalyses.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">No hay análisis programados</p>
            ) : (
              <div className="space-y-3">
                {scheduledAnalyses.map(analysis => (
                  <div 
                    key={analysis.id}
                    className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-white text-sm">{analysis.video_title}</h4>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                        <span>{analysis.channel_name}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(analysis.scheduled_for)}
                        </span>
                      </div>
                    </div>
                    <Badge className={
                      analysis.status === "completed" ? "bg-green-600/20 text-green-500" :
                      analysis.status === "failed" ? "bg-red-600/20 text-red-500" :
                      analysis.status === "processing" ? "bg-amber-600/20 text-amber-500" :
                      "bg-zinc-600/20 text-zinc-400"
                    }>
                      {analysis.status === "completed" && <CheckCircle className="w-3 h-3 mr-1" />}
                      {analysis.status === "failed" && <XCircle className="w-3 h-3 mr-1" />}
                      {analysis.status === "processing" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      {analysis.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                      {analysis.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Flag className="w-5 h-5 text-amber-500" />
                  Comentarios Reportados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingReports ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                  </div>
                ) : reports.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">
                    <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No hay comentarios reportados</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reports.map(report => (
                      <Card 
                        key={report.id} 
                        className={`bg-zinc-800/50 border-zinc-700 ${
                          report.status === "pending" ? "border-l-4 border-l-amber-500" :
                          report.status === "approved" ? "border-l-4 border-l-green-500" :
                          "border-l-4 border-l-blue-500"
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge className={`text-xs ${
                                  report.status === "pending" ? "bg-amber-500/20 text-amber-500" :
                                  report.status === "approved" ? "bg-green-500/20 text-green-500" :
                                  "bg-blue-500/20 text-blue-500"
                                }`}>
                                  {report.status === "pending" ? "Pendiente" :
                                   report.status === "approved" ? "Aprobado" : "Corregido"}
                                </Badge>
                                <span className="text-xs text-zinc-500">
                                  Video: {report.video_title?.slice(0, 40)}...
                                </span>
                              </div>
                              
                              <p className="text-zinc-300 text-sm mb-3 bg-zinc-900/50 p-3 rounded">
                                "{report.comment_text}"
                              </p>
                              
                              <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-zinc-500">Clasificación actual:</span>
                                  <Badge className={`${
                                    report.current_sentiment === "positive" ? "bg-green-500/20 text-green-500" :
                                    report.current_sentiment === "negative" ? "bg-amber-500/20 text-amber-500" :
                                    "bg-zinc-500/20 text-zinc-400"
                                  }`}>
                                    {report.current_sentiment}
                                  </Badge>
                                  {report.current_is_hate && (
                                    <Badge className="bg-red-500/20 text-red-500">HATE</Badge>
                                  )}
                                </div>
                                <span className="text-zinc-500">
                                  Hate score: {(report.hate_score * 100).toFixed(1)}%
                                </span>
                              </div>
                              
                              {report.status === "corrected" && (
                                <div className="mt-2 flex items-center gap-2 text-xs">
                                  <span className="text-zinc-500">Corregido a:</span>
                                  <Badge className={`${
                                    report.corrected_sentiment === "positive" ? "bg-green-500/20 text-green-500" :
                                    report.corrected_sentiment === "negative" ? "bg-amber-500/20 text-amber-500" :
                                    "bg-zinc-500/20 text-zinc-400"
                                  }`}>
                                    {report.corrected_sentiment}
                                  </Badge>
                                  {report.corrected_is_hate && (
                                    <Badge className="bg-red-500/20 text-red-500">HATE</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {report.status === "pending" && (
                              <div className="flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => approveReport(report.id)}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Correcto
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedReport(report);
                                    setCorrectedSentiment(report.current_sentiment);
                                    setCorrectedIsHate(report.current_is_hate);
                                  }}
                                  className="border-blue-500 text-blue-500 hover:bg-blue-500/20"
                                >
                                  <AlertTriangle className="w-4 h-4 mr-1" />
                                  Corregir
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteReport(report.id)}
                                  className="text-zinc-500 hover:text-red-500"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Correction Modal */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Corregir Clasificación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Sentimiento correcto:</label>
              <Select value={correctedSentiment} onValueChange={setCorrectedSentiment}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {SENTIMENT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-white">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isHate"
                checked={correctedIsHate}
                onCheckedChange={setCorrectedIsHate}
              />
              <label htmlFor="isHate" className="text-sm text-zinc-300">
                Es contenido de odio (HATE)
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setSelectedReport(null)}
              className="text-zinc-400"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => correctReport(selectedReport?.id)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Guardar Corrección
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Selection Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ListVideo className="w-5 h-5 text-red-500" />
              Videos de {selectedChannelForVideos?.channel_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center justify-between py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={selectLast5Videos}
                className="bg-amber-600/20 border-amber-600/50 text-amber-400 hover:bg-amber-600/30"
              >
                <Zap className="w-4 h-4 mr-1" />
                Últimos 5
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={selectAllVideos}
                className="bg-zinc-700 border-zinc-600 text-white"
              >
                {selectedVideos.size === channelVideos.length ? "Deseleccionar todo" : "Seleccionar todo"}
              </Button>
            </div>
            <Badge className="bg-red-600/20 text-red-500">
              {selectedVideos.size} seleccionados
            </Badge>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {loadingVideos ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
              </div>
            ) : channelVideos.length === 0 ? (
              <p className="text-center text-zinc-500 py-12">No hay videos disponibles</p>
            ) : (
              <div className="space-y-2">
                {channelVideos.map((video, index) => (
                  <div 
                    key={video.video_id}
                    onClick={() => toggleVideoSelection(video.video_id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedVideos.has(video.video_id) 
                        ? "bg-red-600/20 border-red-600/50" 
                        : "bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800"
                    }`}
                  >
                    <Checkbox 
                      checked={selectedVideos.has(video.video_id)}
                      className="border-zinc-600 data-[state=checked]:bg-red-600"
                    />
                    <div className="relative">
                      <img 
                        src={video.thumbnail_url} 
                        alt={video.title}
                        className="w-28 h-16 object-cover rounded"
                      />
                      {index < 5 && (
                        <Badge className="absolute -top-1 -right-1 bg-amber-600 text-xs px-1">
                          NEW
                        </Badge>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white text-sm truncate">{video.title}</h4>
                      <div className="flex items-center gap-4 text-xs text-zinc-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {formatNumber(video.view_count)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {formatNumber(video.like_count)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {formatNumber(video.comment_count)}
                        </span>
                        <span>{formatDate(video.published_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <Button
              variant="outline"
              onClick={() => setShowVideoModal(false)}
              className="bg-zinc-800 border-zinc-700 text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={analyzeSelectedVideos}
              disabled={selectedVideos.size === 0 || analyzingVideos}
              className="bg-red-600 hover:bg-red-700"
            >
              {analyzingVideos ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-2" />
              )}
              Analizar {selectedVideos.size} video{selectedVideos.size !== 1 ? "s" : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
