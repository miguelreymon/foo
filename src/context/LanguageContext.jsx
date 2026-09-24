import { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    // Header
    viewAnalyses: "View Analyses",
    
    // Hero
    heroTitle1: "Expose the",
    heroTitle2: "HATE",
    heroTitle3: "in Your Comments",
    heroSubtitle: "AI-driven analysis that detects toxic comments and sentiment patterns in YouTube, Instagram and TikTok content.",
    
    // Quick Analysis
    quickAnalysis: "Quick Analysis",
    pasteUrl: "YouTube, Instagram or TikTok URL...",
    analyze: "Analyze",
    analyzing: "Analyzing...",
    
    // Features
    hateDetection: "Hate Detection",
    hateDetectionDesc: "AI detects toxic comments",
    sentiment: "Sentiment",
    sentimentDesc: "Positive/negative analysis",
    trendingTopics: "Trending Topics",
    trendingTopicsDesc: "What your audience talks about",
    rankings: "Rankings",
    rankingsDesc: "Compare channels",
    
    // Analyzed Channels
    analyzedChannels: "Analyzed Channels",
    viewAll: "View All",
    noChannelsYet: "No channels yet",
    analyzeToSee: "Analyze a video to see channels here",
    videos: "videos",
    comments: "comments",
    hate: "hate",
    
    // Add Channel Dialog
    searchYoutubeChannel: "Search YouTube Channel",
    searchChannel: "Search channel",
    channelName: "Channel name...",
    search: "Search",
    results: "Results:",
    selected: "Selected",
    category: "Category",
    addChannelBtn: "Add Channel",
    
    // Categories
    foodies: "Foodies",
    gaming: "Gaming", 
    tech: "Tech",
    lifestyle: "Lifestyle",
    
    // Analyze Video Dialog
    analyzeVideo: "Analyze Video",
    videoUrl: "Video URL",
    startAnalysis: "Analyze",
    
    // Empty states
    noChannels: "No channels",
    addFirstChannel: "Add your first channel",
    
    // Toasts
    analysisStarted: "Analysis started!",
    channelAdded: "Channel added!",
    errorAnalysis: "Error starting analysis",
    errorAddChannel: "Error adding channel",
    errorSearching: "Error searching channels",
    enterUrl: "Enter a YouTube URL",
    enterVideoUrl: "Enter video URL",
    selectChannel: "Select a YouTube channel",
    minChars: "Enter at least 2 characters",
    noChannelsFound: "No channels found",
    loadingChannels: "Loading...",
    
    // Toxicity levels
    low: "low",
    moderate: "moderate",
    high: "high",
    severe: "severe",
    
    // Footer
    copyright: "© 2025 SocialHate",
    poweredBy: "GPT-5.2 + YouTube API",
    
    // Common
    channels: "Channels",
    
    // Analysis Detail
    backToDashboard: "Back",
    refresh: "Refresh",
    processing: "Analysis in progress... This may take a minute.",
    views: "Views",
    likes: "Likes",
    analyzed: "Analyzed",
    hateRate: "Hate Rate",
    engagement: "Engagement",
    
    // Tabs
    overview: "Overview",
    emotions: "Emotions",
    insights: "Insights",
    words: "Words",
    topics: "Topics",
    people: "People",
    
    // Sentiment
    sentimentDistribution: "Sentiment Distribution",
    sentimentBreakdown: "Sentiment Breakdown",
    positive: "Positive",
    negative: "Negative",
    neutral: "Neutral",
    hateSpeech: "Hate Speech",
    spam: "Spam",
    
    // Emotions
    emotionRadar: "Emotion Radar",
    emotionBreakdown: "Emotion Breakdown",
    anger: "Anger",
    joy: "Joy",
    sadness: "Sadness",
    fear: "Fear",
    surprise: "Surprise",
    disgust: "Disgust",
    
    // Insights
    commentTypes: "Comment Types",
    praise: "Praise",
    complaints: "Complaints",
    questions: "Questions",
    suggestions: "Suggestions",
    keyThemes: "Key Themes",
    audienceRequests: "Audience Requests",
    engagementMetrics: "Engagement Metrics",
    engagementRate: "Engagement Rate",
    likeViewRatio: "Like/View Ratio",
    commentViewRatio: "Comment/View Ratio",
    avgCommentLength: "Avg Comment Length",
    noThemesDetected: "No themes detected",
    noRequestsDetected: "No requests detected",
    
    // Comments
    analyzedComments: "Analyzed Comments",
    noCommentsYet: "No comments analyzed yet",
    
    // Word Rankings
    wordRankings: "Word Rankings",
    noWordRankings: "No word rankings available",
    
    // Topics
    trendingTopicsTitle: "Trending Topics",
    noTopics: "No trending topics detected",
    mentions: "mentions",
    
    // People
    topSupporters: "Top Supporters",
    topCritics: "Top Critics",
    mostActive: "Most Active",
    controversialComments: "Controversial Comments",
    noSupporters: "No supporters identified",
    noCritics: "No critics identified",
    noDataAvailable: "No data available",
    noControversial: "No controversial comments detected",
    
    // Dashboard
    analysisHistory: "Analysis History",
    manageAnalyses: "View and manage your YouTube comment analyses",
    noAnalysesYet: "No analyses yet",
    startAnalyzing: "Start by analyzing your first YouTube video",
    analyzeVideo2: "Analyze a Video",
    
    // Channel Detail
    channelNotFound: "Channel not found",
    deleteChannel: "Delete",
    videosAnalyzed: "Videos Analyzed",
    totalViews: "Total Views",
    avgHateRate: "Avg Hate Rate",
    averageSentiment: "Average Sentiment",
    analyzedVideos: "Analyzed Videos",
    noVideosYet: "No videos analyzed yet",
    analyzeFirstVideo: "Analyze First Video",
    analyzeNewVideo: "Analyze New Video",
    noDescription: "No description",
    comments_label: "Comments",
    hate_label: "Hate",
    avgHate: "Avg Hate",
    positiveLabel: "Positive",
    negativeLabel: "Negative",
    neutralLabel: "Neutral",
    evolution: "Channel Evolution",
    
    // Toxicity levels
    lowToxicity: "low toxicity",
    moderateToxicity: "moderate toxicity",
    highToxicity: "high toxicity",
    
    // Status
    completed: "completed",
    processing: "processing",
    failed: "failed",
    
    // Stats section
    videosAnalyzed: "Videos Analyzed",
    commentsProcessed: "Comments Processed",
    analysesToday: "Today's Analyses",
    hateComments: "Hate Comments",
    
    // About section
    aboutParagraph1: "SocialHate is a platform that automatically analyzes public video comments to detect overall sentiment, hate levels, and audience behavior patterns. Our goal is not to judge creators or content, but to transform thousands of comments into clear, visual, and easy-to-understand information.",
    aboutParagraph2: "Creators can use SocialHate to understand how their community really reacts, identify negativity spikes, detect trends over time, and check if the perception of hate matches the actual data. Brands and agencies can use the platform to analyze channels and videos before a collaboration, assess reputational risks, and make data-driven decisions instead of assumptions.",
    aboutParagraph3: "How it works is simple: the user enters a public video link and SocialHate analyzes the available comments, classifying them as positive, neutral, and negative, and automatically generating statistics, charts, and insights. All analysis is performed exclusively on public information.",
    aboutParagraph4: "It's important to note that the system is based on automatic language analysis models, so there may be a margin of error. Elements such as sarcasm, irony, cultural context, or jokes can affect the classification of some comments. The results should be understood as statistical indicators and not as absolute truths.",
    aboutParagraph5: "SocialHate is an analysis and observation tool. It does not intend to point out, accuse, or encourage harassment, but to provide context, transparency, and data to better understand the conversations generated around online content.",
    
    // Analysis Detail - What's Failing
    whatsFailing: "What's Failing?",
    analyzingNegative: "Analyzing negative comments...",
    noSignificantComplaints: "No significant complaints detected",
    
    // Analysis Detail - Sections
    hateScale: "Hate Scale",
    hateScaleLow: "Low",
    hateScaleModerate: "Moderate", 
    hateScaleHigh: "High",
    weightedSentiment: "Weighted Sentiment",
    downloadPdf: "Download PDF",
    downloadCsv: "Download CSV"
  },
  es: {
    // Header
    viewAnalyses: "Ver Análisis",
    
    // Hero
    heroTitle1: "Descubre el",
    heroTitle2: "HATE",
    heroTitle3: "en tus Comentarios",
    heroSubtitle: "Análisis con IA que detecta comentarios tóxicos y patrones de sentimiento en YouTube, Instagram y TikTok.",
    
    // Quick Analysis
    quickAnalysis: "Análisis Rápido",
    pasteUrl: "URL de YouTube, Instagram o TikTok...",
    analyze: "Analizar",
    analyzing: "Analizando...",
    
    // Features
    hateDetection: "Detección de Hate",
    hateDetectionDesc: "IA detecta comentarios tóxicos",
    sentiment: "Sentimiento",
    sentimentDesc: "Análisis positivo/negativo",
    trendingTopics: "Temas Trending",
    trendingTopicsDesc: "De qué habla tu audiencia",
    rankings: "Rankings",
    rankingsDesc: "Compara canales",
    
    // Analyzed Channels
    analyzedChannels: "Canales Analizados",
    viewAll: "Ver Todos",
    noChannelsYet: "Sin canales aún",
    analyzeToSee: "Analiza un video para ver canales aquí",
    videos: "videos",
    comments: "comentarios",
    hate: "hate",
    
    // Add Channel Dialog
    searchYoutubeChannel: "Buscar Canal de YouTube",
    searchChannel: "Buscar canal",
    channelName: "Nombre del canal...",
    search: "Buscar",
    results: "Resultados:",
    selected: "Seleccionado",
    category: "Categoría",
    addChannelBtn: "Añadir Canal",
    
    // Categories
    foodies: "Foodies",
    gaming: "Gaming",
    tech: "Tech",
    lifestyle: "Lifestyle",
    
    // Analyze Video Dialog
    analyzeVideo: "Analizar Video",
    videoUrl: "URL del Video",
    startAnalysis: "Analizar",
    
    // Empty states
    noChannels: "Sin canales",
    addFirstChannel: "Añade tu primer canal",
    
    // Toasts
    analysisStarted: "¡Análisis iniciado!",
    channelAdded: "¡Canal añadido!",
    errorAnalysis: "Error al iniciar análisis",
    errorAddChannel: "Error al añadir canal",
    errorSearching: "Error buscando canales",
    enterUrl: "Introduce una URL de YouTube",
    enterVideoUrl: "Introduce la URL del video",
    selectChannel: "Selecciona un canal de YouTube",
    minChars: "Escribe al menos 2 caracteres",
    noChannelsFound: "No se encontraron canales",
    loadingChannels: "Cargando...",
    
    // Toxicity levels
    low: "bajo",
    moderate: "moderado",
    high: "alto",
    severe: "severo",
    
    // Footer
    copyright: "© 2025 SocialHate",
    poweredBy: "GPT-5.2 + YouTube API",
    
    // Common
    channels: "Canales",
    
    // Analysis Detail
    backToDashboard: "Volver",
    refresh: "Actualizar",
    processing: "Análisis en progreso... Puede tardar un minuto.",
    views: "Vistas",
    likes: "Likes",
    analyzed: "Analizados",
    hateRate: "Tasa de Hate",
    engagement: "Engagement",
    
    // Tabs
    overview: "Resumen",
    emotions: "Emociones",
    insights: "Insights",
    words: "Palabras",
    topics: "Temas",
    people: "Personas",
    
    // Sentiment
    sentimentDistribution: "Distribución de Sentimiento",
    sentimentBreakdown: "Desglose de Sentimiento",
    positive: "Positivo",
    negative: "Negativo",
    neutral: "Neutro",
    hateSpeech: "Hate Speech",
    spam: "Spam",
    
    // Emotions
    emotionRadar: "Radar de Emociones",
    emotionBreakdown: "Desglose de Emociones",
    anger: "Ira",
    joy: "Alegría",
    sadness: "Tristeza",
    fear: "Miedo",
    surprise: "Sorpresa",
    disgust: "Asco",
    
    // Insights
    commentTypes: "Tipos de Comentarios",
    praise: "Elogios",
    complaints: "Quejas",
    questions: "Preguntas",
    suggestions: "Sugerencias",
    keyThemes: "Temas Clave",
    audienceRequests: "Peticiones de Audiencia",
    engagementMetrics: "Métricas de Engagement",
    engagementRate: "Tasa de Engagement",
    likeViewRatio: "Ratio Like/Vista",
    commentViewRatio: "Ratio Comentario/Vista",
    avgCommentLength: "Long. Media Comentario",
    noThemesDetected: "No se detectaron temas",
    noRequestsDetected: "No se detectaron peticiones",
    
    // Comments
    analyzedComments: "Comentarios Analizados",
    noCommentsYet: "Sin comentarios analizados",
    
    // Word Rankings
    wordRankings: "Ranking de Palabras",
    noWordRankings: "Sin ranking de palabras",
    
    // Topics
    trendingTopicsTitle: "Temas Trending",
    noTopics: "No se detectaron temas trending",
    mentions: "menciones",
    
    // People
    topSupporters: "Top Supporters",
    topCritics: "Top Críticos",
    mostActive: "Más Activos",
    controversialComments: "Comentarios Controversiales",
    noSupporters: "Sin supporters identificados",
    noCritics: "Sin críticos identificados",
    noDataAvailable: "Sin datos disponibles",
    noControversial: "Sin comentarios controversiales",
    
    // Dashboard
    analysisHistory: "Historial de Análisis",
    manageAnalyses: "Ver y gestionar tus análisis de comentarios",
    noAnalysesYet: "Sin análisis aún",
    startAnalyzing: "Comienza analizando tu primer video",
    analyzeVideo2: "Analizar Video",
    
    // Channel Detail
    channelNotFound: "Canal no encontrado",
    deleteChannel: "Eliminar",
    videosAnalyzed: "Videos Analizados",
    totalViews: "Vistas Totales",
    avgHateRate: "Avg Hate",
    averageSentiment: "Sentimiento Promedio",
    analyzedVideos: "Videos Analizados",
    noVideosYet: "Sin videos analizados",
    analyzeFirstVideo: "Analizar Primer Video",
    analyzeNewVideo: "Analizar Nuevo Video",
    noDescription: "Sin descripción",
    comments_label: "Comentarios",
    hate_label: "Hate",
    avgHate: "Avg Hate",
    positiveLabel: "Positivo",
    negativeLabel: "Negativo",
    neutralLabel: "Neutro",
    evolution: "Evolución del Canal",
    
    // Toxicity levels
    lowToxicity: "baja toxicidad",
    moderateToxicity: "toxicidad moderada",
    highToxicity: "alta toxicidad",
    
    // Status
    completed: "completado",
    processing: "procesando",
    failed: "fallido",
    
    // Stats section
    videosAnalyzed: "Vídeos Analizados",
    commentsProcessed: "Comentarios Procesados",
    analysesToday: "Análisis Hoy",
    hateComments: "Comentarios con Hate",
    
    // About section
    aboutParagraph1: "SocialHate es una plataforma que analiza automáticamente los comentarios públicos de los vídeos para detectar el sentimiento general, el nivel de hate y los patrones de comportamiento de la audiencia. Nuestro objetivo no es juzgar a creadores ni contenidos, sino transformar miles de comentarios en información clara, visual y fácil de entender.",
    aboutParagraph2: "Los creadores pueden usar SocialHate para comprender cómo reacciona realmente su comunidad, identificar picos de negatividad, detectar tendencias a lo largo del tiempo y comprobar si la percepción de hate coincide con los datos reales. Las marcas y agencias pueden utilizar la plataforma para analizar canales y vídeos antes de una colaboración, evaluar riesgos reputacionales y tomar decisiones basadas en datos y no en suposiciones.",
    aboutParagraph3: "El funcionamiento es sencillo: el usuario introduce el enlace de un vídeo público y SocialHate analiza los comentarios disponibles, clasificándolos en positivos, neutros y negativos, y generando estadísticas, gráficas e insights de forma automática. Todo el análisis se realiza exclusivamente sobre información pública.",
    aboutParagraph4: "Es importante tener en cuenta que el sistema se basa en modelos automáticos de análisis de lenguaje, por lo que puede existir un margen de error. Elementos como el sarcasmo, la ironía, el contexto cultural o las bromas pueden afectar a la clasificación de algunos comentarios. Los resultados deben entenderse como indicadores estadísticos y no como verdades absolutas.",
    aboutParagraph5: "SocialHate es una herramienta de análisis y observación. No pretende señalar, acusar ni fomentar el acoso, sino aportar contexto, transparencia y datos para entender mejor las conversaciones que se generan en torno a los contenidos online.",
    
    // Analysis Detail - What's Failing
    whatsFailing: "¿Qué está fallando?",
    analyzingNegative: "Analizando comentarios negativos...",
    noSignificantComplaints: "No se detectaron quejas significativas",
    
    // Analysis Detail - Sections
    hateScale: "Escala de Hate",
    hateScaleLow: "Bajo",
    hateScaleModerate: "Moderado",
    hateScaleHigh: "Alto",
    weightedSentiment: "Sentimiento Ponderado",
    downloadPdf: "Descargar PDF",
    downloadCsv: "Descargar CSV"
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('socialhate-lang');
    return saved || 'es'; // ESPAÑOL POR DEFECTO
  });

  useEffect(() => {
    localStorage.setItem('socialhate-lang', language);
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'es' : 'en');
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
