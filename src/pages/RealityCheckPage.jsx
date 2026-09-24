import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Search, Utensils, Youtube, AlertTriangle, CheckCircle, XCircle, TrendingUp, TrendingDown, Minus, ArrowLeft, Info, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function RealityCheckPage() {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantLocation, setRestaurantLocation] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisId, setAnalysisId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pollingCount, setPollingCount] = useState(0);

  // Poll for results
  useEffect(() => {
    if (!analysisId || result?.status === 'completed' || result?.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/reality-check/${analysisId}`);
        const data = await response.json();
        setResult(data);
        setPollingCount(prev => prev + 1);

        if (data.status === 'completed' || data.status === 'failed') {
          setIsAnalyzing(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [analysisId, result?.status]);

  const handleAnalyze = async () => {
    if (!videoUrl || !restaurantName) {
      setError('Por favor, introduce la URL del video y el nombre del restaurante');
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    setResult(null);
    setPollingCount(0);

    try {
      const response = await fetch(`${API_URL}/api/reality-check/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: videoUrl,
          restaurant_name: restaurantName,
          restaurant_location: restaurantLocation
        })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Error de servidor. Inténtalo de nuevo.');
      }
      
      if (!response.ok) {
        throw new Error(data.detail || 'Error al iniciar el análisis');
      }

      setAnalysisId(data.id);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Error desconocido');
      setIsAnalyzing(false);
    }
  };

  const getCoherenceColor = (index) => {
    if (index >= 70) return 'text-green-400';
    if (index >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCoherenceLabel = (index) => {
    if (index >= 70) return { text: 'Alta coherencia', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' };
    if (index >= 40) return { text: 'Coherencia media', icon: Minus, color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    return { text: 'Baja coherencia', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20' };
  };

  const getGapIcon = (gap) => {
    if (gap === 'bajo' || gap === 'low') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (gap === 'medio' || gap === 'medium') return <Minus className="w-4 h-4 text-yellow-400" />;
    return <TrendingDown className="w-4 h-4 text-red-400" />;
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/')}
              className="text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <div className="h-6 w-px bg-zinc-700" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Utensils className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">Reality Check</span>
              <span className="text-xs text-zinc-500 hidden sm:inline">by SocialHate</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Reality Check
            </span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            ¿Coincide la opinión del influencer con la experiencia real de los clientes?
          </p>
          <p className="text-sm text-zinc-500 mt-2">
            Comparamos percepción vs realidad. Tú decides.
          </p>
        </div>

        {/* Input Form */}
        <Card className="bg-zinc-900/50 border-zinc-800 mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5 text-emerald-400" />
              Analizar video de influencer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">URL del video de YouTube</label>
              <div className="relative">
                <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  disabled={isAnalyzing}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Nombre del restaurante *</label>
                <div className="relative">
                  <Utensils className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <Input
                    placeholder="Ej: La Barraca"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    disabled={isAnalyzing}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Ubicación (opcional)</label>
                <Input
                  placeholder="Ej: Madrid, Valencia..."
                  value={restaurantLocation}
                  onChange={(e) => setRestaurantLocation(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  disabled={isAnalyzing}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400">
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !videoUrl || !restaurantName}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-6"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Verificar coherencia
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Processing State */}
        {isAnalyzing && result?.status === 'processing' && (
          <Card className="bg-zinc-900/50 border-zinc-800 mb-8">
            <CardContent className="py-8">
              <div className="text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-emerald-400" />
                <h3 className="text-lg font-semibold mb-2">Analizando contenido...</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Comparando la opinión del influencer con experiencias reales
                </p>
                <Progress value={Math.min(pollingCount * 15, 90)} className="max-w-xs mx-auto" />
                <div className="mt-4 text-xs text-zinc-500 space-y-1">
                  <p>📺 Extrayendo contenido del video...</p>
                  <p>🔍 Buscando opiniones de clientes...</p>
                  <p>🤖 Comparando percepciones con IA...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result?.status === 'completed' && (
          <div className="space-y-6">
            {/* Video Info */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="py-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {result.thumbnail_url && (
                    <img
                      src={result.thumbnail_url}
                      alt={result.video_title}
                      className="w-full md:w-48 h-32 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1 line-clamp-2">{result.video_title}</h3>
                    <p className="text-zinc-400 text-sm mb-2">{result.channel_name}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Utensils className="w-4 h-4 text-emerald-400" />
                      <span className="text-zinc-300">{result.restaurant_name}</span>
                      {result.restaurant_location && (
                        <span className="text-zinc-500">• {result.restaurant_location}</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Coherence Index - Main Result */}
            <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
              <div className={`h-1 ${result.coherence_index >= 70 ? 'bg-green-500' : result.coherence_index >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} />
              <CardContent className="py-8">
                <div className="text-center">
                  <h3 className="text-zinc-400 text-sm uppercase tracking-wider mb-2">Índice de Coherencia</h3>
                  <div className={`text-6xl md:text-7xl font-bold mb-4 ${getCoherenceColor(result.coherence_index)}`}>
                    {result.coherence_index}%
                  </div>
                  {(() => {
                    const label = getCoherenceLabel(result.coherence_index);
                    const Icon = label.icon;
                    return (
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${label.bg}`}>
                        <Icon className={`w-5 h-5 ${label.color}`} />
                        <span className={label.color}>{label.text}</span>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Influencer Says */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Youtube className="w-5 h-5 text-red-400" />
                    Lo que dice el influencer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.influencer_sentiment && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-sm">Tono general:</span>
                        <span className="font-medium capitalize">{result.influencer_sentiment.overall_tone || 'N/A'}</span>
                      </div>
                      
                      {result.influencer_sentiment.key_claims?.length > 0 && (
                        <div>
                          <span className="text-zinc-400 text-sm block mb-2">Claims principales:</span>
                          <div className="flex flex-wrap gap-2">
                            {result.influencer_sentiment.key_claims.slice(0, 5).map((claim, i) => (
                              <span key={i} className="text-xs bg-zinc-800 px-2 py-1 rounded-full">
                                "{claim}"
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.influencer_sentiment.suspicious_patterns?.length > 0 && (
                        <div>
                          <span className="text-zinc-400 text-sm block mb-2">Patrones detectados:</span>
                          <ul className="text-sm text-yellow-400/80 space-y-1">
                            {result.influencer_sentiment.suspicious_patterns.slice(0, 3).map((pattern, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <AlertTriangle className="w-3 h-3 mt-1 flex-shrink-0" />
                                {pattern}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Community Says */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="text-xl">👥</span>
                    Experiencia típica de clientes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.community_sentiment && (
                    <>
                      {result.community_sentiment.estimated_rating > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-sm">Rating estimado:</span>
                          <span className="font-medium">⭐ {result.community_sentiment.estimated_rating}/5</span>
                        </div>
                      )}

                      {result.community_sentiment.common_positives?.length > 0 && (
                        <div>
                          <span className="text-zinc-400 text-sm block mb-2">Lo positivo:</span>
                          <div className="flex flex-wrap gap-2">
                            {result.community_sentiment.common_positives.slice(0, 4).map((item, i) => (
                              <span key={i} className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.community_sentiment.common_complaints?.length > 0 && (
                        <div>
                          <span className="text-zinc-400 text-sm block mb-2">Quejas comunes:</span>
                          <div className="flex flex-wrap gap-2">
                            {result.community_sentiment.common_complaints.slice(0, 4).map((item, i) => (
                              <span key={i} className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.community_sentiment.typical_experience && (
                        <p className="text-sm text-zinc-400 italic">
                          "{result.community_sentiment.typical_experience}"
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Gap Analysis */}
            {result.gap_analysis && (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {getGapIcon(result.gap_analysis.perception_gap)}
                    Análisis de discrepancias
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.gap_analysis.main_discrepancies?.length > 0 && (
                    <div>
                      <span className="text-zinc-400 text-sm block mb-2">Diferencias encontradas:</span>
                      <ul className="space-y-2">
                        {result.gap_analysis.main_discrepancies.map((disc, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                            <span>{disc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.gap_analysis.aligned_points?.length > 0 && (
                    <div>
                      <span className="text-zinc-400 text-sm block mb-2">Puntos que coinciden:</span>
                      <ul className="space-y-2">
                        {result.gap_analysis.aligned_points.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            {result.analysis_summary && (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-400" />
                    Resumen del análisis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-zinc-300 leading-relaxed">{result.analysis_summary}</p>
                  
                  {result.disclaimer && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <p className="text-xs text-zinc-500 italic flex items-start gap-2">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {result.disclaimer}
                      </p>
                    </div>
                  )}

                  {result.confidence_level && (
                    <div className="mt-2">
                      <span className="text-xs text-zinc-500">
                        Nivel de confianza del análisis: <span className="capitalize">{result.confidence_level}</span>
                      </span>
                    </div>
                  )}

                  {/* Data sources info */}
                  <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={result.transcription_source === 'whisper' ? 'text-green-400' : 'text-yellow-400'}>
                        {result.transcription_source === 'whisper' ? '✓' : '⚠'}
                      </span>
                      <span className="text-zinc-500">
                        Audio: {result.transcription_source === 'whisper' ? 'Transcrito con IA' : 
                               result.transcription_source === 'fallback' ? 'Solo descripción' : 'No disponible'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={result.reviews_count > 0 ? 'text-green-400' : 'text-yellow-400'}>
                        {result.reviews_count > 0 ? '✓' : '⚠'}
                      </span>
                      <span className="text-zinc-500">
                        Reseñas: {result.reviews_count > 0 ? `${result.reviews_count} encontradas` : 'Estimación IA'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* New Analysis Button */}
            <div className="text-center pt-4">
              <Button
                onClick={() => {
                  setResult(null);
                  setAnalysisId(null);
                  setVideoUrl('');
                  setRestaurantName('');
                  setRestaurantLocation('');
                }}
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Analizar otro video
              </Button>
            </div>
          </div>
        )}

        {/* Error State */}
        {result?.status === 'failed' && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="py-8">
              <div className="text-center">
                <XCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                <h3 className="text-lg font-semibold mb-2 text-red-400">Error en el análisis</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  {result.error || 'No se pudo completar el análisis. Por favor, inténtalo de nuevo.'}
                </p>
                <Button
                  onClick={() => {
                    setResult(null);
                    setAnalysisId(null);
                  }}
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  Intentar de nuevo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Section */}
        {!result && !isAnalyzing && (
          <Card className="bg-zinc-900/30 border-zinc-800/50">
            <CardContent className="py-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-emerald-400" />
                ¿Cómo funciona?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div>
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                    <span className="text-emerald-400 font-bold">1</span>
                  </div>
                  <h4 className="font-medium mb-1">Analizamos el video</h4>
                  <p className="text-zinc-500">Extraemos el contenido y el tono del influencer sobre el restaurante.</p>
                </div>
                <div>
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                    <span className="text-emerald-400 font-bold">2</span>
                  </div>
                  <h4 className="font-medium mb-1">Comparamos con la realidad</h4>
                  <p className="text-zinc-500">Contrastamos con opiniones y experiencias típicas de clientes reales.</p>
                </div>
                <div>
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                    <span className="text-emerald-400 font-bold">3</span>
                  </div>
                  <h4 className="font-medium mb-1">Índice de coherencia</h4>
                  <p className="text-zinc-500">Te mostramos cuánto coincide la opinión del influencer con la realidad.</p>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 text-center">
                  ⚠️ Este análisis es orientativo. No afirmamos si alguien miente o dice la verdad. 
                  Mostramos datos para que tú decidas.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
