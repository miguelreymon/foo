import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HateLegend, HateBadge } from "@/components/HateLegend";
import LanguageToggle from "@/components/LanguageToggle";
import Footer from "@/components/Footer";
import { useLanguage } from "@/context/LanguageContext";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend
} from "recharts";
import {
  Flame,
  ArrowLeft,
  Eye,
  ThumbsUp,
  MessageSquare,
  TrendingUp,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Heart,
  Meh,
  ThumbsDown,
  Users,
  BarChart3,
  Zap,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  Ban,
  Star,
  Skull,
  Activity,
  Download,
  Flag,
  CheckCircle
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLORS = {
  hate: "#DC2626",
  positive: "#10B981",
  negative: "#F59E0B",
  neutral: "#6B7280"
};

const EMOTION_COLORS = {
  joy: "#10B981",
  anger: "#DC2626",
  sadness: "#3B82F6",
  fear: "#8B5CF6",
  surprise: "#F59E0B",
  disgust: "#EC4899"
};

// Función para anonimizar nombres de usuario
const anonymizeUsername = (username) => {
  if (!username) return "Anon***";
  const firstChars = username.slice(0, 5);
  return `${firstChars}***`;
};

const AnalysisDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [complaintsSummary, setComplaintsSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [reportingComment, setReportingComment] = useState(null);

  const handleReportComment = async (comment) => {
    try {
      await axios.post(`${API}/reports`, {
        comment_id: comment.comment_id,
        comment_text: comment.text,
        comment_author: comment.author,
        video_id: analysis.video_id,
        video_title: analysis.video_title,
        current_sentiment: comment.sentiment_label,
        current_is_hate: comment.is_hate,
        hate_score: comment.hate_score
      });
      setShowReviewPopup(true);
    } catch (error) {
      console.error("Error reporting comment:", error);
    }
  };

  const fetchAnalysis = async () => {
    try {
      const response = await axios.get(`${API}/analysis/${id}`);
      setAnalysis(response.data);
      setError(null);
      
      // Load complaints summary if analysis is completed and has negative comments
      if (response.data.status === "completed" && response.data.hate_percentage > 0) {
        fetchComplaintsSummary();
      }
    } catch (err) {
      setError("Failed to load analysis");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComplaintsSummary = async () => {
    setLoadingSummary(true);
    try {
      const response = await axios.get(`${API}/analysis/${id}/complaints-summary?lang=${language}`);
      setComplaintsSummary(response.data.summary);
    } catch (err) {
      console.error("Failed to load complaints summary:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
    const interval = setInterval(() => {
      if (analysis?.status === "processing") {
        fetchAnalysis();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, analysis?.status]);

  // Re-fetch complaints summary when language changes
  useEffect(() => {
    if (analysis?.status === "completed" && analysis?.hate_percentage > 0) {
      fetchComplaintsSummary();
    }
  }, [language]);

  const sentimentData = analysis ? [
    { name: "Positive", value: analysis.positive_percentage, color: COLORS.positive },
    { name: "Negative", value: analysis.negative_percentage, color: COLORS.negative },
    { name: "Neutral", value: analysis.neutral_percentage, color: COLORS.neutral }
  ] : [];

  const emotionData = analysis?.emotion_breakdown ? Object.entries(analysis.emotion_breakdown).map(([key, value]) => ({
    emotion: t[key] || key.charAt(0).toUpperCase() + key.slice(1),
    value: value,
    fullMark: 100
  })) : [];

  const getToxicityColor = (level) => {
    switch(level) {
      case "severe": return "text-red-500 bg-red-500/20 border-red-500/50";
      case "high": return "text-orange-500 bg-orange-500/20 border-orange-500/50";
      case "moderate": return "text-amber-500 bg-amber-500/20 border-amber-500/50";
      default: return "text-green-500 bg-green-500/20 border-green-500/50";
    }
  };

  const getSentimentIcon = (label) => {
    switch (label) {
      case "positive": return <Heart className="w-4 h-4 text-green-500" />;
      case "negative": return <ThumbsDown className="w-4 h-4 text-amber-500" />;
      default: return <Meh className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getCommentClass = (comment) => {
    if (comment.is_hate) return "comment-hate";
    switch (comment.sentiment_label) {
      case "positive": return "comment-positive";
      case "negative": return "comment-negative";
      default: return "comment-neutral";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin mx-auto" />
          <p className="text-zinc-400 mt-4">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <Card className="p-8 bg-zinc-900/50 border-zinc-800 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-heading text-xl font-bold text-white mb-2">{error}</h3>
          <p className="text-zinc-400 text-sm mb-4">
            This could be due to an invalid YouTube API key or the analysis not being found.
          </p>
          <Button onClick={() => navigate("/dashboard")} className="btn-primary mt-4">
            Back to Dashboard
          </Button>
        </Card>
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
              onClick={() => navigate("/dashboard")}
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
            <Button
              data-testid="download-pdf-btn"
              variant="outline"
              onClick={() => {
                const link = document.createElement('a');
                link.href = `${API}/analysis/${id}/pdf`;
                link.download = `socialhate_${analysis?.video_title?.slice(0,30) || 'analysis'}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="hidden md:flex bg-red-600/20 border-red-600/50 hover:bg-red-600/30 text-red-500 hover:text-red-400"
            >
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* Processing Banner */}
      {analysis?.status === "processing" && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            <span className="text-amber-500">Analysis in progress... This may take a minute.</span>
          </div>
        </div>
      )}

      {/* Info Banner - Sample Analysis */}
      <div className="bg-blue-500/10 border-b border-blue-500/30 px-6 py-2">
        <p className="text-blue-300/80 text-xs text-center">
          Analizamos 200 comentarios aleatorios por vídeo, una muestra estadísticamente representativa del contenido.
        </p>
      </div>

      {/* Content */}
      <main className="px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Video Info */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-64 aspect-video rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
              {analysis?.thumbnail_url ? (
                <img
                  src={analysis.thumbnail_url}
                  alt={analysis.video_title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <MessageSquare className="w-12 h-12 text-zinc-600" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {analysis?.hate_percentage !== undefined && (
                  <HateBadge percentage={analysis.hate_percentage} />
                )}
                {analysis?.toxicity_level && (
                  <Badge className={getToxicityColor(analysis.toxicity_level)}>
                    <Skull className="w-3 h-3 mr-1" />
                    Toxicity: {analysis.toxicity_level}
                  </Badge>
                )}
              </div>
              <h1 className="font-heading text-2xl md:text-3xl font-black text-white">
                {analysis?.video_title || "Loading..."}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-zinc-400">{analysis?.channel_name}</p>
              </div>
            </div>
          </div>

          {/* Mobile PDF Button */}
          <Button
            data-testid="download-pdf-btn-mobile"
            variant="outline"
            onClick={() => {
              const link = document.createElement('a');
              link.href = `${API}/analysis/${id}/pdf`;
              link.download = `socialhate_${analysis?.video_title?.slice(0,30) || 'analysis'}.pdf`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="md:hidden w-full bg-red-600/20 border-red-600/50 hover:bg-red-600/30 text-red-500 hover:text-red-400"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>

          {/* Hate Scale Legend */}
          <HateLegend />

          {/* Stats Grid - Bento Style */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card data-testid="views-stat" className="stat-card p-4">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">
                <Eye className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{t('views')}</span>
              </div>
              <p className="font-mono text-2xl font-bold text-white">
                {(analysis?.views || analysis?.view_count)?.toLocaleString() || "0"}
              </p>
            </Card>
            <Card data-testid="likes-stat" className="stat-card p-4">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">
                <ThumbsUp className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{t('likes')}</span>
              </div>
              <p className="font-mono text-2xl font-bold text-white">
                {(analysis?.likes || analysis?.like_count)?.toLocaleString() || "0"}
              </p>
            </Card>
            <Card data-testid="comments-stat" className="stat-card p-4">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{t('analyzed')}</span>
              </div>
              <p className="font-mono text-2xl font-bold text-white">
                {analysis?.total_comments_analyzed || "0"}
              </p>
            </Card>
            <Card data-testid="hate-stat" className="stat-card p-4 border-red-900/50">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <Flame className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{t('hateRate')}</span>
              </div>
              <p className="font-mono text-2xl font-bold text-red-500 glow-red">
                {analysis?.hate_percentage || "0"}%
              </p>
            </Card>
            <Card data-testid="engagement-stat" className="stat-card p-4">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{t('engagement')}</span>
              </div>
              <p className="font-mono text-2xl font-bold text-green-500">
                {(analysis?.engagement_metrics?.engagement_rate || 0).toFixed(1)}%
              </p>
            </Card>
            <Card data-testid="weighted-sentiment-stat" className="stat-card p-4 col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{t('weightedSentiment')}</span>
              </div>
              <p className={`font-mono text-2xl font-bold ${
                (analysis?.engagement_metrics?.weighted_sentiment || 0) >= 50 ? 'text-green-500' :
                (analysis?.engagement_metrics?.weighted_sentiment || 0) >= 30 ? 'text-amber-500' : 'text-red-500'
              }`}>
                {analysis?.engagement_metrics?.weighted_sentiment || "0"}%
              </p>
            </Card>
          </div>

          {/* Analysis Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-zinc-900 border border-zinc-800 flex-wrap h-auto p-1">
              <TabsTrigger data-testid="tab-overview" value="overview" className="data-[state=active]:bg-zinc-800">{t('overview')}</TabsTrigger>
              <TabsTrigger data-testid="tab-emotions" value="emotions" className="data-[state=active]:bg-zinc-800">{t('emotions')}</TabsTrigger>
              <TabsTrigger data-testid="tab-insights" value="insights" className="data-[state=active]:bg-zinc-800">{t('insights')}</TabsTrigger>
              <TabsTrigger data-testid="tab-comments" value="comments" className="data-[state=active]:bg-zinc-800">{t('analyzedComments')}</TabsTrigger>
              <TabsTrigger data-testid="tab-words" value="words" className="data-[state=active]:bg-zinc-800">{t('words')}</TabsTrigger>
              <TabsTrigger data-testid="tab-topics" value="topics" className="data-[state=active]:bg-zinc-800">{t('topics')}</TabsTrigger>
              <TabsTrigger data-testid="tab-people" value="people" className="data-[state=active]:bg-zinc-800">{t('people')}</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Sentiment Distribution */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="font-heading text-white">{t('sentimentDistribution')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sentimentData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {sentimentData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "#18181B",
                              border: "1px solid #27272A",
                              borderRadius: "8px"
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-4">
                      {sentimentData.map((item) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-zinc-400">{item.name}: {item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Sentiment Breakdown */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="font-heading text-white">{t('sentimentBreakdown')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-green-500 flex items-center gap-1">
                          <Heart className="w-4 h-4" /> {t('positive')}
                        </span>
                        <span className="font-mono text-green-500">{analysis?.positive_percentage}%</span>
                      </div>
                      <Progress value={analysis?.positive_percentage} className="h-2 bg-zinc-800 [&>div]:bg-green-500" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-amber-500 flex items-center gap-1">
                          <ThumbsDown className="w-4 h-4" /> {t('negative')}
                        </span>
                        <span className="font-mono text-amber-500">{analysis?.negative_percentage}%</span>
                      </div>
                      <Progress value={analysis?.negative_percentage} className="h-2 bg-zinc-800 [&>div]:bg-amber-500" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-zinc-400 flex items-center gap-1">
                          <Meh className="w-4 h-4" /> {t('neutral')}
                        </span>
                        <span className="font-mono text-zinc-400">{analysis?.neutral_percentage}%</span>
                      </div>
                      <Progress value={analysis?.neutral_percentage} className="h-2 bg-zinc-800 [&>div]:bg-zinc-500" />
                    </div>
                    <div className="pt-4 border-t border-zinc-800">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-red-500 flex items-center gap-1">
                          <Flame className="w-4 h-4" /> {t('hateSpeech')}
                        </span>
                        <span className="font-mono text-red-500">{analysis?.hate_percentage}%</span>
                      </div>
                      <Progress value={analysis?.hate_percentage} className="h-2 bg-zinc-800 [&>div]:bg-red-600" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-purple-500 flex items-center gap-1">
                          <Ban className="w-4 h-4" /> {t('spam')}
                        </span>
                        <span className="font-mono text-purple-500">{analysis?.spam_percentage || 0}%</span>
                      </div>
                      <Progress value={analysis?.spam_percentage || 0} className="h-2 bg-zinc-800 [&>div]:bg-purple-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Complaints Summary */}
              {(analysis?.hate_percentage > 0 || analysis?.negative_percentage > 5) && (
                <Card className="bg-gradient-to-r from-red-900/20 to-amber-900/20 border-red-800/50">
                  <CardHeader>
                    <CardTitle className="font-heading text-white flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      {t('whatsFailing')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingSummary ? (
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('analyzingNegative')}
                      </div>
                    ) : complaintsSummary ? (
                      <p className="text-zinc-300 text-lg leading-relaxed">
                        {complaintsSummary}
                      </p>
                    ) : (
                      <p className="text-zinc-500">{t('noSignificantComplaints')}</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Emotions Tab */}
            <TabsContent value="emotions" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="font-heading text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      {t('emotionRadar')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={emotionData}>
                          <PolarGrid stroke="#27272A" />
                          <PolarAngleAxis dataKey="emotion" tick={{ fill: '#A1A1AA', fontSize: 12 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#52525B' }} />
                          <Radar
                            name="Emotions"
                            dataKey="value"
                            stroke="#DC2626"
                            fill="#DC2626"
                            fillOpacity={0.3}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#18181B",
                              border: "1px solid #27272A",
                              borderRadius: "8px"
                            }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="font-heading text-white">{t('emotionBreakdown')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {emotionData.map((item) => {
                      const emotionKey = item.emotion.toLowerCase();
                      const color = EMOTION_COLORS[emotionKey] || '#A1A1AA';
                      const colorClass = {
                        'joy': '[&>div]:bg-green-500',
                        'anger': '[&>div]:bg-red-600',
                        'sadness': '[&>div]:bg-blue-500',
                        'fear': '[&>div]:bg-purple-500',
                        'surprise': '[&>div]:bg-amber-500',
                        'disgust': '[&>div]:bg-pink-500'
                      }[emotionKey] || '[&>div]:bg-zinc-500';
                      
                      return (
                        <div key={item.emotion}>
                          <div className="flex justify-between text-sm mb-2">
                            <span style={{ color }}>{item.emotion}</span>
                            <span className="font-mono" style={{ color }}>
                              {item.value?.toFixed(1)}%
                            </span>
                          </div>
                          <Progress 
                            value={item.value} 
                            className={`h-2 bg-zinc-800 ${colorClass}`}
                          />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Content Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Comment Types */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="font-heading text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      {t('commentTypes')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                      <span className="flex items-center gap-2 text-green-500">
                        <Star className="w-4 h-4" /> {t('praise')}
                      </span>
                      <span className="font-mono text-white">{analysis?.content_insights?.praise_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                      <span className="flex items-center gap-2 text-amber-500">
                        <AlertCircle className="w-4 h-4" /> {t('complaints')}
                      </span>
                      <span className="font-mono text-white">{analysis?.content_insights?.complaints_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                      <span className="flex items-center gap-2 text-blue-500">
                        <HelpCircle className="w-4 h-4" /> {t('questions')}
                      </span>
                      <span className="font-mono text-white">{analysis?.content_insights?.questions_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                      <span className="flex items-center gap-2 text-cyan-500">
                        <Lightbulb className="w-4 h-4" /> {t('suggestions')}
                      </span>
                      <span className="font-mono text-white">{analysis?.content_insights?.suggestions_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                      <span className="flex items-center gap-2 text-purple-500">
                        <Ban className="w-4 h-4" /> {t('spam')}
                      </span>
                      <span className="font-mono text-white">{analysis?.content_insights?.spam_count || 0}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Key Themes */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="font-heading text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      {t('keyThemes')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysis?.content_insights?.key_themes?.map((theme, i) => (
                        <Badge key={i} className="bg-zinc-800 text-zinc-300 border-zinc-700">
                          {theme}
                        </Badge>
                      )) || <span className="text-zinc-500">{t('noThemesDetected')}</span>}
                    </div>
                  </CardContent>
                </Card>

                {/* Audience Requests */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="font-heading text-white flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      {t('audienceRequests')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysis?.content_insights?.audience_requests?.map((req, i) => (
                        <div key={i} className="p-2 bg-zinc-800/50 rounded text-sm text-zinc-300">
                          {req}
                        </div>
                      )) || <span className="text-zinc-500">{t('noRequestsDetected')}</span>}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Engagement Metrics */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="font-heading text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-500" />
                    {t('engagementMetrics')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{t('engagementRate')}</p>
                      <p className="font-mono text-2xl text-green-500">{(analysis?.engagement_metrics?.engagement_rate || 0).toFixed(1)}%</p>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{t('likeViewRatio')}</p>
                      <p className="font-mono text-2xl text-white">{(analysis?.engagement_metrics?.like_to_view_ratio || 0).toFixed(1)}%</p>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{t('commentViewRatio')}</p>
                      <p className="font-mono text-2xl text-white">{(analysis?.engagement_metrics?.comment_to_view_ratio || 0).toFixed(1)}%</p>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{t('avgCommentLength')}</p>
                      <p className="font-mono text-2xl text-white">{analysis?.engagement_metrics?.avg_comment_length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Comments Tab */}
            <TabsContent value="comments">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="font-heading text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    {t('analyzedComments')} ({analysis?.comments?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-3 pr-4">
                      {analysis?.comments?.map((comment, index) => (
                        <div
                          key={comment.comment_id}
                          data-testid={`comment-${index}`}
                          className={`comment-card p-4 rounded-lg ${getCommentClass(comment)}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="font-medium text-white">{anonymizeUsername(comment.author)}</span>
                                {comment.is_hate && (
                                  <Badge className="badge-hate text-xs">HATE</Badge>
                                )}
                                {comment.is_spam && (
                                  <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-xs">SPAM</Badge>
                                )}
                                <Badge className={`badge-${comment.sentiment_label} text-xs`}>
                                  {comment.sentiment_label}
                                </Badge>
                                {comment.emotion && comment.emotion !== "neutral" && (
                                  <Badge className="bg-zinc-700 text-zinc-300 text-xs">
                                    {comment.emotion}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-zinc-300 text-sm">{comment.text}</p>
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-4 text-xs text-zinc-500">
                                  <span className="flex items-center gap-1">
                                    <ThumbsUp className="w-3 h-3" /> {comment.likes}
                                  </span>
                                  <span className={comment.hate_score >= 0.5 ? "text-red-500" : ""}>
                                    Hate: {(comment.hate_score * 100).toFixed(1)}%
                                  </span>
                                  <span>Sentiment: {(comment.sentiment_score * 100).toFixed(1)}%</span>
                                </div>
                                <button
                                  onClick={() => handleReportComment(comment)}
                                  className="text-xs text-zinc-500 hover:text-amber-500 transition-colors flex items-center gap-1"
                                >
                                  <Flag className="w-3 h-3" />
                                  Revisar
                                </button>
                              </div>
                            </div>
                            {getSentimentIcon(comment.sentiment_label)}
                          </div>
                        </div>
                      ))}
                      {(!analysis?.comments || analysis.comments.length === 0) && (
                        <div className="text-center py-12 text-zinc-500">
                          {t('noCommentsYet')}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Word Rankings Tab */}
            <TabsContent value="words">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="font-heading text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    {t('wordRankings')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysis?.word_rankings?.length > 0 ? (
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analysis.word_rankings.slice(0, 15)}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                        >
                          <XAxis type="number" stroke="#52525B" />
                          <YAxis
                            type="category"
                            dataKey="word"
                            stroke="#A1A1AA"
                            tick={{ fill: "#A1A1AA", fontSize: 12 }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#18181B",
                              border: "1px solid #27272A",
                              borderRadius: "8px"
                            }}
                          />
                          <Bar dataKey="count">
                            {analysis.word_rankings.slice(0, 15).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[entry.category] || COLORS.neutral} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-zinc-500">
                      {t('noWordRankings')}
                    </div>
                  )}
                  
                  {/* Word Cloud Display */}
                  <div className="mt-6 flex flex-wrap gap-3 justify-center">
                    {analysis?.word_rankings?.map((word, index) => (
                      <span
                        key={index}
                        className={`px-3 py-1 rounded-full text-sm font-mono word-${word.category} bg-zinc-800`}
                        style={{
                          fontSize: `${Math.max(12, Math.min(24, 12 + word.count))}px`,
                          color: COLORS[word.category] || COLORS.neutral
                        }}
                      >
                        {word.word}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Topics Tab */}
            <TabsContent value="topics">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="font-heading text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    {t('trendingTopicsTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysis?.trending_topics?.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {analysis.trending_topics.map((topic, index) => (
                        <Card
                          key={index}
                          data-testid={`topic-${index}`}
                          className="p-4 bg-zinc-800/50 border-zinc-700"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-heading font-bold text-white">{topic.topic}</h4>
                              <p className="text-sm text-zinc-500">{topic.mentions} {t('mentions')}</p>
                            </div>
                            <Badge className={`badge-${topic.sentiment}`}>
                              {topic.sentiment}
                            </Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-zinc-500">
                      {t('noTopics')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* People Tab */}
            <TabsContent value="people" className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Top Supporters */}
                <Card className="bg-zinc-900/50 border-zinc-800 border-l-4 border-l-green-500">
                  <CardHeader>
                    <CardTitle className="font-heading text-white flex items-center gap-2">
                      <Heart className="w-5 h-5 text-green-500" />
                      {t('topSupporters')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {analysis?.top_supporters?.map((comment, i) => (
                          <div key={i} className="p-3 bg-zinc-800/50 rounded-lg">
                            <p className="font-medium text-green-500 text-sm">{anonymizeUsername(comment.author)}</p>
                            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{comment.text}</p>
                          </div>
                        )) || <span className="text-zinc-500">{t('noSupporters')}</span>}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Top Critics */}
                <Card className="bg-zinc-900/50 border-zinc-800 border-l-4 border-l-amber-500">
                  <CardHeader>
                    <CardTitle className="font-heading text-white flex items-center gap-2">
                      <ThumbsDown className="w-5 h-5 text-amber-500" />
                      {t('topCritics')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {analysis?.top_critics?.map((comment, i) => (
                          <div key={i} className="p-3 bg-zinc-800/50 rounded-lg">
                            <p className="font-medium text-amber-500 text-sm">{anonymizeUsername(comment.author)}</p>
                            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{comment.text}</p>
                          </div>
                        )) || <span className="text-zinc-500">{t('noCritics')}</span>}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Most Active */}
                <Card className="bg-zinc-900/50 border-zinc-800 border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="font-heading text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-500" />
                      {t('mostActive')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {analysis?.engagement_metrics?.most_active_commenters?.map((user, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                            <span className="text-zinc-300 text-sm">{anonymizeUsername(user.author)}</span>
                            <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
                              {user.comments} {t('comments_label')}
                            </Badge>
                          </div>
                        )) || <span className="text-zinc-500">{t('noDataAvailable')}</span>}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Controversial Comments */}
              <Card className="bg-zinc-900/50 border-zinc-800 border-t-4 border-t-red-500">
                <CardHeader>
                  <CardTitle className="font-heading text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    {t('controversialComments')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {analysis?.controversial_comments?.map((comment, i) => (
                        <div key={i} className="p-3 bg-zinc-800/50 rounded-lg border-l-2 border-red-500">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-red-500 text-sm">{anonymizeUsername(comment.author)}</span>
                            <span className="text-xs text-zinc-500">Hate: {(comment.hate_score * 100).toFixed(1)}%</span>
                          </div>
                          <p className="text-sm text-zinc-300">{comment.text}</p>
                        </div>
                      )) || <span className="text-zinc-500">{t('noControversial')}</span>}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Review Popup */}
      <Dialog open={showReviewPopup} onOpenChange={setShowReviewPopup}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-white flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              ¡Gracias por informarnos!
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-zinc-300">
              Hemos recibido tu reporte. Nuestro equipo revisará este comentario manualmente lo antes posible para verificar la clasificación.
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => setShowReviewPopup(false)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Premium CTA */}
      <section className="px-6 py-8 border-t border-zinc-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-r from-amber-900/20 via-zinc-900/50 to-amber-900/20 border border-amber-700/30 rounded-xl p-6 md:p-8">
            <h3 className="font-heading text-xl md:text-2xl font-bold text-amber-500 mb-2">
              ¿Quieres el análisis completo?
            </h3>
            <p className="text-zinc-400 text-sm md:text-base mb-6 max-w-lg mx-auto">
              Accede a datos exhaustivos, análisis ilimitados de comentarios, exportación avanzada y funciones exclusivas con el plan Premium.
            </p>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white px-6">
              Próximamente
            </Button>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default AnalysisDetail;
