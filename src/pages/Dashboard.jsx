import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/context/LanguageContext";
import { HateLegend, HateBadge } from "@/components/HateLegend";
import LanguageToggle from "@/components/LanguageToggle";
import Footer from "@/components/Footer";
import axios from "axios";
import { 
  Flame, 
  ArrowLeft, 
  Clock, 
  MessageSquare,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Users,
  Video
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalyses = async () => {
    try {
      const response = await axios.get(`${API}/analyses`);
      setAnalyses(response.data);
    } catch (error) {
      console.error("Failed to fetch analyses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "completed": return "text-green-500 bg-green-500/10 border-green-500/30";
      case "processing": return "text-amber-500 bg-amber-500/10 border-amber-500/30";
      case "error": return "text-red-500 bg-red-500/10 border-red-500/30";
      default: return "text-zinc-500 bg-zinc-500/10 border-zinc-500/30";
    }
  };

  const getHateColor = (percentage) => {
    if (percentage >= 30) return "text-red-500";
    if (percentage >= 15) return "text-amber-500";
    return "text-green-500";
  };

  return (
    <div className="min-h-screen bg-[#09090B]">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              data-testid="back-home-btn"
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

      {/* Content */}
      <main className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl md:text-3xl font-black text-white">{t('analysisHistory')}</h1>
              <p className="text-zinc-500 mt-1 text-sm md:text-base">{t('manageAnalyses')}</p>
              <HateLegend className="mt-4" />
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <Button 
                data-testid="video-generator-btn"
                onClick={() => navigate("/videos")}
                className="bg-red-600 hover:bg-red-700 text-white w-full md:w-auto"
              >
                <Video className="w-4 h-4 mr-2" />
                Generar Videos
              </Button>
              <Button 
                data-testid="channels-btn"
                variant="outline"
                onClick={() => navigate("/channels")}
                className="bg-zinc-800/50 border-zinc-700 hover:bg-zinc-700 text-white w-full md:w-auto"
              >
                <Users className="w-4 h-4 mr-2" />
                {t('channels')}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="p-4 bg-zinc-900/50 border-zinc-800">
                  <div className="flex gap-4">
                    <Skeleton className="w-32 h-20 rounded bg-zinc-800" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4 bg-zinc-800" />
                      <Skeleton className="h-4 w-1/2 bg-zinc-800" />
                      <Skeleton className="h-4 w-1/4 bg-zinc-800" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : analyses.length === 0 ? (
            <Card className="p-12 bg-zinc-900/50 border-zinc-800 text-center">
              <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="font-heading text-xl font-bold text-white mb-2">No analyses yet</h3>
              <p className="text-zinc-500 mb-6">Start by analyzing your first YouTube video</p>
              <Button 
                data-testid="start-analysis-btn"
                onClick={() => navigate("/")}
                className="btn-primary"
              >
                Analyze a Video
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {analyses.map((analysis, index) => (
                <Card 
                  key={analysis.id}
                  data-testid={`analysis-card-${index}`}
                  onClick={() => navigate(`/analysis/${analysis.id}`)}
                  className="p-3 md:p-4 bg-zinc-900/50 border-zinc-800 hover:border-red-900/50 transition-all cursor-pointer group"
                >
                  <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:items-center">
                    {/* Thumbnail */}
                    <div className="w-full md:w-32 aspect-video rounded overflow-hidden bg-zinc-800 flex-shrink-0">
                      {analysis.thumbnail_url ? (
                        <img 
                          src={analysis.thumbnail_url} 
                          alt={analysis.video_title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MessageSquare className="w-8 h-8 text-zinc-600" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-heading font-bold text-white text-sm md:text-base line-clamp-2 md:truncate group-hover:text-red-500 transition-colors">
                            {analysis.video_title || "Processing..."}
                          </h3>
                          <p className="text-xs md:text-sm text-zinc-500">{analysis.channel_name}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            data-testid={`view-analysis-${index}`}
                            variant="ghost"
                            size="icon"
                            className="text-zinc-400 hover:text-white h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/analysis/${analysis.id}`);
                            }}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2">
                        <div className="flex items-center gap-1 text-xs md:text-sm">
                          <MessageSquare className="w-3 h-3 md:w-4 md:h-4 text-zinc-500" />
                          <span className="text-zinc-400">{analysis.comment_count}</span>
                        </div>
                        {analysis.status === "completed" && (
                          <HateBadge percentage={analysis.hate_percentage || 0} />
                        )}
                        <div className="flex items-center gap-1 text-xs md:text-sm text-zinc-500">
                          <Clock className="w-3 h-3 md:w-4 md:h-4" />
                          {new Date(analysis.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
