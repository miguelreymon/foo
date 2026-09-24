import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import {
  Youtube,
  Search,
  Loader2,
  Download,
  BarChart3,
  Video,
  MessageSquare,
  Flame,
  ArrowLeft,
  Calendar,
  FileText,
  Play,
  Users,
  TrendingUp,
  ThumbsUp,
  Skull,
  Heart,
  Meh,
  Eye,
  Share2
} from "lucide-react";

// TikTok icon
const TikTokIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6b7280'];

export default function MedusaPanel() {
  const navigate = useNavigate();
  
  // Form state
  const [youtubeEnabled, setYoutubeEnabled] = useState(true);
  const [tiktokEnabled, setTiktokEnabled] = useState(false);
  const [youtubeChannel, setYoutubeChannel] = useState("");
  const [tiktokChannel, setTiktokChannel] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  // Loading states
  const [searching, setSearching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Preview data
  const [preview, setPreview] = useState(null);
  
  // Analysis result
  const [analysisId, setAnalysisId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [progress, setProgress] = useState(0);

  // Search and preview
  const searchChannels = async () => {
    if (!youtubeEnabled && !tiktokEnabled) {
      toast.error("Selecciona al menos una plataforma");
      return;
    }
    if (youtubeEnabled && !youtubeChannel.trim()) {
      toast.error("Introduce el canal de YouTube");
      return;
    }
    if (tiktokEnabled && !tiktokChannel.trim()) {
      toast.error("Introduce el canal de TikTok");
      return;
    }
    if (!dateFrom || !dateTo) {
      toast.error("Selecciona el rango de fechas");
      return;
    }

    setSearching(true);
    setPreview(null);

    try {
      const res = await axios.post(`${API}/medusa/preview-multi`, {
        youtube_enabled: youtubeEnabled,
        youtube_channel: youtubeChannel.trim(),
        tiktok_enabled: tiktokEnabled,
        tiktok_channel: tiktokChannel.trim(),
        date_from: dateFrom,
        date_to: dateTo
      });
      setPreview(res.data);
      toast.success(`${res.data.total_videos} videos encontrados`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al buscar canales");
    } finally {
      setSearching(false);
    }
  };

  // Start analysis
  const startAnalysis = async () => {
    if (!preview) return;

    setAnalyzing(true);
    setProgress(0);
    setAnalysis(null);

    try {
      const res = await axios.post(`${API}/medusa/analyze-multi`, {
        youtube_enabled: youtubeEnabled,
        youtube_channel: youtubeChannel.trim(),
        tiktok_enabled: tiktokEnabled,
        tiktok_channel: tiktokChannel.trim(),
        date_from: dateFrom,
        date_to: dateTo
      });
      
      setAnalysisId(res.data.analysis_id);
      pollAnalysis(res.data.analysis_id);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al iniciar análisis");
      setAnalyzing(false);
    }
  };

  // Poll for analysis completion
  const pollAnalysis = async (id) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/medusa/analysis/${id}`);
        setProgress(res.data.progress || 0);
        
        if (res.data.status === "completed") {
          clearInterval(interval);
          setAnalysis(res.data);
          setAnalyzing(false);
          toast.success("Análisis completado");
        } else if (res.data.status === "error") {
          clearInterval(interval);
          setAnalyzing(false);
          toast.error(res.data.error || "Error en el análisis");
        }
      } catch (err) {
        clearInterval(interval);
        setAnalyzing(false);
        toast.error("Error obteniendo estado del análisis");
      }
    }, 3000);
  };

  // Download PDF - same format as video analysis
  const downloadPDF = async () => {
    if (!analysis) return;
    
    try {
      // Use same PDF generation as normal analysis
      const res = await axios.post(`${API}/medusa/generate-pdf`, {
        analysis_id: analysisId
      }, { responseType: 'blob' });
      
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medusa-report-${analysisId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Informe descargado");
    } catch (err) {
      // Fallback to HTML
      downloadHTMLReport();
    }
  };

  const downloadHTMLReport = () => {
    if (!analysis) return;
    
    const sentimentData = [
      { name: 'Positivo', value: analysis.positive_percentage || 0 },
      { name: 'Negativo', value: analysis.negative_percentage || 0 },
      { name: 'Neutral', value: analysis.neutral_percentage || 0 }
    ];

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Informe MEDUSA - Análisis de Hate</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #fafafa; padding: 40px; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; padding: 30px; background: linear-gradient(135deg, #7c3aed20, #dc262620); border-radius: 16px; border: 1px solid #27272a; }
    .header h1 { font-size: 2.5em; margin-bottom: 8px; }
    .header .subtitle { color: #a1a1aa; }
    .section { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .section-title { font-size: 1.2em; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .stat-card { background: #27272a; border-radius: 8px; padding: 20px; text-align: center; }
    .stat-value { font-size: 2.2em; font-weight: 700; }
    .stat-value.hate { color: #ef4444; }
    .stat-value.positive { color: #22c55e; }
    .stat-value.negative { color: #f59e0b; }
    .stat-label { color: #71717a; font-size: 0.85em; margin-top: 4px; }
    .progress-bar { height: 12px; background: #27272a; border-radius: 6px; overflow: hidden; margin: 8px 0; }
    .progress-fill { height: 100%; border-radius: 6px; transition: width 0.3s; }
    .progress-fill.positive { background: #22c55e; }
    .progress-fill.negative { background: #f59e0b; }
    .progress-fill.hate { background: #ef4444; }
    .flex-between { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { background: #27272a; padding: 6px 14px; border-radius: 20px; font-size: 0.9em; }
    .tag.topic { background: #7c3aed20; color: #a78bfa; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #27272a; }
    th { color: #71717a; font-weight: 500; background: #27272a; }
    .comment { background: #27272a; padding: 16px; border-radius: 8px; margin-bottom: 12px; }
    .comment-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .comment-author { font-weight: 600; }
    .comment-text { color: #d4d4d8; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; }
    .badge.hate { background: #ef444420; color: #ef4444; }
    .badge.positive { background: #22c55e20; color: #22c55e; }
    .badge.negative { background: #f59e0b20; color: #f59e0b; }
    .footer { text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #27272a; color: #52525b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐍 Informe MEDUSA</h1>
      <p class="subtitle">Análisis Avanzado de Hate Speech</p>
      <p style="margin-top: 12px; color: #a1a1aa;">
        ${analysis.youtube_channel ? `YouTube: ${analysis.youtube_channel}` : ''} 
        ${analysis.youtube_channel && analysis.tiktok_channel ? ' | ' : ''}
        ${analysis.tiktok_channel ? `TikTok: @${analysis.tiktok_channel}` : ''}
      </p>
      <p style="color: #71717a; font-size: 0.9em;">${analysis.date_from} a ${analysis.date_to}</p>
    </div>

    <div class="section">
      <div class="section-title">📊 Resumen General</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${analysis.total_videos || 0}</div>
          <div class="stat-label">Videos Analizados</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${(analysis.total_comments || 0).toLocaleString()}</div>
          <div class="stat-label">Comentarios</div>
        </div>
        <div class="stat-card">
          <div class="stat-value hate">${(analysis.hate_percentage || 0).toFixed(1)}%</div>
          <div class="stat-label">Hate Speech</div>
        </div>
        <div class="stat-card">
          <div class="stat-value positive">${(analysis.positive_percentage || 0).toFixed(1)}%</div>
          <div class="stat-label">Positivo</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">📈 Distribución de Sentimientos</div>
      <div style="margin-bottom: 20px;">
        <div class="flex-between">
          <span style="color: #22c55e;">● Positivo</span>
          <span style="color: #22c55e; font-weight: 600;">${(analysis.positive_percentage || 0).toFixed(1)}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill positive" style="width: ${analysis.positive_percentage || 0}%"></div></div>
      </div>
      <div style="margin-bottom: 20px;">
        <div class="flex-between">
          <span style="color: #f59e0b;">● Negativo</span>
          <span style="color: #f59e0b; font-weight: 600;">${(analysis.negative_percentage || 0).toFixed(1)}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill negative" style="width: ${analysis.negative_percentage || 0}%"></div></div>
      </div>
      <div>
        <div class="flex-between">
          <span style="color: #ef4444;">● Hate Speech</span>
          <span style="color: #ef4444; font-weight: 600;">${(analysis.hate_percentage || 0).toFixed(1)}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill hate" style="width: ${analysis.hate_percentage || 0}%"></div></div>
      </div>
    </div>

    ${analysis.word_rankings?.length > 0 ? `
    <div class="section">
      <div class="section-title">🔤 Palabras Más Frecuentes</div>
      <div class="tags">
        ${analysis.word_rankings.slice(0, 20).map(w => `<span class="tag">${w.word} (${w.count})</span>`).join('')}
      </div>
    </div>
    ` : ''}

    ${analysis.trending_topics?.length > 0 ? `
    <div class="section">
      <div class="section-title">🏷️ Temas Principales</div>
      <div class="tags">
        ${analysis.trending_topics.map(t => `<span class="tag topic">${t}</span>`).join('')}
      </div>
    </div>
    ` : ''}

    ${analysis.top_hate_videos?.length > 0 ? `
    <div class="section">
      <div class="section-title">🔥 Videos con Más Hate</div>
      <table>
        <tr><th>Video</th><th>Comentarios</th><th>Hate %</th></tr>
        ${analysis.top_hate_videos.slice(0, 10).map(v => `
          <tr>
            <td>${(v.title || '').slice(0, 50)}...</td>
            <td>${v.comments || 0}</td>
            <td style="color: ${v.hate_percentage >= 20 ? '#ef4444' : v.hate_percentage >= 10 ? '#f59e0b' : '#22c55e'}; font-weight: 600;">${(v.hate_percentage || 0).toFixed(1)}%</td>
          </tr>
        `).join('')}
      </table>
    </div>
    ` : ''}

    ${analysis.top_hate_comments?.length > 0 ? `
    <div class="section">
      <div class="section-title">💀 Comentarios con Más Hate</div>
      ${analysis.top_hate_comments.slice(0, 10).map(c => `
        <div class="comment">
          <div class="comment-header">
            <span class="comment-author">${c.author || 'Anónimo'}</span>
            <span class="badge hate">${(c.hate_score * 100 || 0).toFixed(0)}% hate</span>
          </div>
          <div class="comment-text">"${(c.text || '').slice(0, 200)}${(c.text || '').length > 200 ? '...' : ''}"</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${analysis.top_supporters?.length > 0 ? `
    <div class="section">
      <div class="section-title">💚 Top Supporters</div>
      ${analysis.top_supporters.slice(0, 5).map(c => `
        <div class="comment">
          <div class="comment-header">
            <span class="comment-author">${c.author || 'Anónimo'}</span>
            <span class="badge positive">Positivo</span>
          </div>
          <div class="comment-text">"${(c.text || '').slice(0, 200)}${(c.text || '').length > 200 ? '...' : ''}"</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="footer">
      <p>🐍 Generado por MEDUSA - Social Hate Analyzer</p>
      <p style="font-size: 0.85em; margin-top: 8px;">${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medusa-report-${analysisId?.slice(0, 8) || 'report'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Informe descargado");
  };

  // Sentiment chart data
  const sentimentData = analysis ? [
    { name: 'Positivo', value: analysis.positive_percentage || 0, color: '#22c55e' },
    { name: 'Negativo', value: analysis.negative_percentage || 0, color: '#f59e0b' },
    { name: 'Neutral', value: analysis.neutral_percentage || 0, color: '#6b7280' }
  ] : [];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐍</span>
            <h1 className="font-heading text-xl font-bold">MEDUSA</h1>
            <Badge className="bg-purple-500/20 text-purple-400">Advanced Analysis</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Search Form */}
        <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-500" />
              Configurar Análisis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Platform Selection - Both can be enabled */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* YouTube */}
              <div className={`p-4 rounded-lg border ${youtubeEnabled ? 'border-red-500 bg-red-500/10' : 'border-zinc-700 bg-zinc-800/50'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <Checkbox 
                    id="youtube" 
                    checked={youtubeEnabled} 
                    onCheckedChange={setYoutubeEnabled}
                    className="data-[state=checked]:bg-red-600"
                  />
                  <Label htmlFor="youtube" className="flex items-center gap-2 cursor-pointer text-lg">
                    <Youtube className="w-5 h-5 text-red-500" /> YouTube
                  </Label>
                </div>
                <Input
                  placeholder="Nombre del canal (ej: Ibai)"
                  value={youtubeChannel}
                  onChange={(e) => setYoutubeChannel(e.target.value)}
                  disabled={!youtubeEnabled}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>

              {/* TikTok */}
              <div className={`p-4 rounded-lg border ${tiktokEnabled ? 'border-white bg-white/10' : 'border-zinc-700 bg-zinc-800/50'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <Checkbox 
                    id="tiktok" 
                    checked={tiktokEnabled} 
                    onCheckedChange={setTiktokEnabled}
                    className="data-[state=checked]:bg-white data-[state=checked]:text-black"
                  />
                  <Label htmlFor="tiktok" className="flex items-center gap-2 cursor-pointer text-lg">
                    <TikTokIcon className="w-5 h-5" /> TikTok
                  </Label>
                </div>
                <Input
                  placeholder="Username (ej: cenandoconpablo)"
                  value={tiktokChannel}
                  onChange={(e) => setTiktokChannel(e.target.value)}
                  disabled={!tiktokEnabled}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-3">
              <Label className="text-zinc-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Rango de Fechas
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 flex-1"
                />
                <span className="text-zinc-500">hasta</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 flex-1"
                />
              </div>
            </div>

            {/* Search Button */}
            <Button 
              onClick={searchChannels} 
              disabled={searching}
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              {searching ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Buscando...</>
              ) : (
                <><Search className="w-4 h-4 mr-2" /> Buscar y Previsualizar</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        {preview && (
          <Card className="bg-zinc-900/50 border-zinc-800 border-purple-500/30 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-500" />
                Previsualización
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Channel Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {preview.youtube && (
                  <div className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg">
                    <Youtube className="w-8 h-8 text-red-500" />
                    <div>
                      <h3 className="font-bold text-white">{preview.youtube.channel_name}</h3>
                      <p className="text-sm text-zinc-400">{preview.youtube.video_count} videos</p>
                    </div>
                  </div>
                )}
                {preview.tiktok && (
                  <div className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg">
                    <TikTokIcon className="w-8 h-8" />
                    <div>
                      <h3 className="font-bold text-white">{preview.tiktok.channel_name}</h3>
                      <p className="text-sm text-zinc-400">{preview.tiktok.video_count} videos</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-zinc-800 rounded-lg">
                  <Video className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                  <p className="text-2xl font-bold text-white">{preview.total_videos}</p>
                  <p className="text-sm text-zinc-400">Videos</p>
                </div>
                <div className="text-center p-4 bg-zinc-800 rounded-lg">
                  <MessageSquare className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold text-white">{(preview.estimated_comments || 0).toLocaleString()}</p>
                  <p className="text-sm text-zinc-400">Comentarios Est.</p>
                </div>
                <div className="text-center p-4 bg-zinc-800 rounded-lg">
                  <Calendar className="w-6 h-6 mx-auto mb-2 text-green-500" />
                  <p className="text-lg font-bold text-white">{dateFrom}</p>
                  <p className="text-sm text-zinc-400">a {dateTo}</p>
                </div>
              </div>

              <Button 
                onClick={startAnalysis} 
                disabled={analyzing || preview.total_videos === 0}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {analyzing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analizando... {progress}%</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Comenzar Análisis de {preview.total_videos} Videos</>
                )}
              </Button>

              {analyzing && (
                <div className="mt-4">
                  <Progress value={progress} className="h-2" />
                  <p className="text-center text-sm text-zinc-400 mt-2">
                    Analizando videos y comentarios con IA...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Analysis Results - Same format as AnalysisDetail */}
        {analysis && analysis.status === "completed" && (
          <div className="space-y-6">
            {/* Header with Download */}
            <Card className="bg-zinc-900/50 border-zinc-800 border-green-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <FileText className="w-6 h-6 text-green-500" />
                      Resultados del Análisis
                    </h2>
                    <p className="text-zinc-400">
                      {analysis.total_videos} videos • {(analysis.total_comments || 0).toLocaleString()} comentarios
                    </p>
                  </div>
                  <Button onClick={downloadHTMLReport} className="bg-purple-600 hover:bg-purple-700">
                    <Download className="w-4 h-4 mr-2" /> Descargar PDF
                  </Button>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-zinc-800 rounded-lg">
                    <Skull className="w-6 h-6 mx-auto mb-2 text-red-500" />
                    <p className="text-3xl font-bold text-red-500">{(analysis.hate_percentage || 0).toFixed(1)}%</p>
                    <p className="text-sm text-zinc-400">Hate Speech</p>
                  </div>
                  <div className="text-center p-4 bg-zinc-800 rounded-lg">
                    <Heart className="w-6 h-6 mx-auto mb-2 text-green-500" />
                    <p className="text-3xl font-bold text-green-500">{(analysis.positive_percentage || 0).toFixed(1)}%</p>
                    <p className="text-sm text-zinc-400">Positivo</p>
                  </div>
                  <div className="text-center p-4 bg-zinc-800 rounded-lg">
                    <Meh className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                    <p className="text-3xl font-bold text-amber-500">{(analysis.negative_percentage || 0).toFixed(1)}%</p>
                    <p className="text-sm text-zinc-400">Negativo</p>
                  </div>
                  <div className="text-center p-4 bg-zinc-800 rounded-lg">
                    <MessageSquare className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                    <p className="text-3xl font-bold text-white">{(analysis.total_comments || 0).toLocaleString()}</p>
                    <p className="text-sm text-zinc-400">Comentarios</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sentiment Distribution */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" /> Distribución de Sentimientos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-2"><Heart className="w-4 h-4 text-green-500" /> Positivo</span>
                      <span className="text-green-500 font-bold">{(analysis.positive_percentage || 0).toFixed(1)}%</span>
                    </div>
                    <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${analysis.positive_percentage || 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-2"><Meh className="w-4 h-4 text-amber-500" /> Negativo</span>
                      <span className="text-amber-500 font-bold">{(analysis.negative_percentage || 0).toFixed(1)}%</span>
                    </div>
                    <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${analysis.negative_percentage || 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-2"><Skull className="w-4 h-4 text-red-500" /> Hate Speech</span>
                      <span className="text-red-500 font-bold">{(analysis.hate_percentage || 0).toFixed(1)}%</span>
                    </div>
                    <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${analysis.hate_percentage || 0}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Word Rankings & Topics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {analysis.word_rankings?.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white">🔤 Palabras Más Frecuentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysis.word_rankings.slice(0, 15).map((w, i) => (
                        <span key={i} className="px-3 py-1 bg-zinc-800 rounded-full text-sm">
                          {w.word} <span className="text-zinc-500">({w.count})</span>
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {analysis.trending_topics?.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white">🏷️ Temas Principales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysis.trending_topics.map((topic, i) => (
                        <span key={i} className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Top Hate Videos */}
            {analysis.top_hate_videos?.length > 0 && (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-red-500" /> Videos con Más Hate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.top_hate_videos.slice(0, 5).map((v, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-zinc-500 font-mono">#{i + 1}</span>
                          <span className="truncate">{v.title}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-zinc-400">{v.comments} com.</span>
                          <span className={`font-mono font-bold ${v.hate_percentage >= 20 ? 'text-red-500' : v.hate_percentage >= 10 ? 'text-amber-500' : 'text-green-500'}`}>
                            {(v.hate_percentage || 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Hate Comments */}
            {analysis.top_hate_comments?.length > 0 && (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Skull className="w-5 h-5 text-red-500" /> Comentarios con Más Hate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.top_hate_comments.slice(0, 5).map((c, i) => (
                      <div key={i} className="p-4 bg-zinc-800 rounded-lg border-l-4 border-red-500">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-white">{c.author || 'Anónimo'}</span>
                          <Badge className="bg-red-500/20 text-red-500">
                            {((c.hate_score || 0) * 100).toFixed(0)}% hate
                          </Badge>
                        </div>
                        <p className="text-zinc-300 text-sm">"{c.text?.slice(0, 200)}{c.text?.length > 200 ? '...' : ''}"</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
