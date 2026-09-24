import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Sequence } from 'remotion';
import { Flame, MessageSquare, ThumbsUp, TrendingDown, Eye, Heart, AlertTriangle, Hash, Zap, Target } from 'lucide-react';

// Fixed Header Component - Always visible at top
const FixedHeader = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const titleOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' });
  const statsOpacity = interpolate(frame, [40, 70], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '45px 50px 25px 50px',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        marginBottom: '28px',
        opacity,
      }}>
        <Flame color="#DC2626" size={48} strokeWidth={2.5} />
        <div style={{ fontSize: '38px', fontWeight: 900, color: 'white', fontFamily: 'Inter, sans-serif' }}>
          SOCIAL<span style={{ color: '#DC2626' }}>HATE</span>
        </div>
      </div>

      {/* Thumbnail */}
      <div style={{
        width: '100%',
        maxWidth: '900px',
        aspectRatio: '16/9',
        borderRadius: '20px',
        overflow: 'hidden',
        marginBottom: '22px',
        opacity,
        boxShadow: '0 20px 60px rgba(220, 38, 38, 0.35)',
        border: '4px solid #DC2626',
        backgroundColor: '#18181B',
      }}>
        {data.thumbnail_url && (
          <img
            src={data.thumbnail_url}
            alt={data.video_title || 'Video thumbnail'}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            crossOrigin="anonymous"
          />
        )}
      </div>

      {/* Title */}
      <div style={{
        opacity: titleOpacity,
        textAlign: 'center',
        marginBottom: '18px',
        padding: '0 30px',
        width: '100%',
      }}>
        <h1 style={{
          fontSize: '42px',
          fontWeight: 900,
          color: 'white',
          margin: 0,
          lineHeight: 1.15,
          fontFamily: 'Inter, sans-serif',
        }}>
          {data.video_title?.substring(0, 40)}{data.video_title?.length > 40 ? '...' : ''}
        </h1>
        <p style={{
          fontSize: '24px',
          color: '#71717A',
          marginTop: '10px',
          fontFamily: 'Inter, sans-serif',
        }}>
          {data.channel_name}
        </p>
      </div>

      {/* Quick Stats Row */}
      <div style={{
        display: 'flex',
        gap: '50px',
        opacity: statsOpacity,
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <Eye color="#3B82F6" size={30} />
          <div style={{ color: 'white', fontSize: '24px', fontWeight: 700, marginTop: '6px' }}>
            {(data.view_count || 0).toLocaleString()}
          </div>
          <div style={{ color: '#52525B', fontSize: '14px' }}>vistas</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Heart color="#EC4899" size={30} />
          <div style={{ color: 'white', fontSize: '24px', fontWeight: 700, marginTop: '6px' }}>
            {(data.like_count || 0).toLocaleString()}
          </div>
          <div style={{ color: '#52525B', fontSize: '14px' }}>likes</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <MessageSquare color="#10B981" size={30} />
          <div style={{ color: 'white', fontSize: '24px', fontWeight: 700, marginTop: '6px' }}>
            {(data.comment_count || 0).toLocaleString()}
          </div>
          <div style={{ color: '#52525B', fontSize: '14px' }}>comentarios</div>
        </div>
      </div>
    </div>
  );
};

// Stats Panel 1: Main Hate Stats
const StatsPanel1 = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const progress = spring({ frame, fps, config: { damping: 60 } });
  const animateNumber = (target) => Math.floor((target || 0) * progress);
  const opacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      padding: '25px 50px',
      width: '100%',
      boxSizing: 'border-box',
      opacity,
    }}>
      {/* Big Hate Card */}
      <div style={{
        background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
        borderRadius: '20px',
        padding: '30px 35px',
        marginBottom: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div>
          <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: '6px' }}>
            HATE DETECTADO
          </div>
          <div style={{ fontSize: '80px', fontWeight: 900, color: 'white', lineHeight: 1 }}>
            {animateNumber(data.hate_percentage)}%
          </div>
        </div>
        <Flame color="white" size={90} strokeWidth={1.5} style={{ opacity: 0.5 }} />
      </div>

      {/* Grid Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', width: '100%' }}>
        <div style={{
          backgroundColor: '#18181B',
          border: '2px solid #27272A',
          borderRadius: '18px',
          padding: '22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <ThumbsUp color="#10B981" size={24} />
            <span style={{ color: '#71717A', fontSize: '15px' }}>Positivo</span>
          </div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: '#10B981' }}>
            {animateNumber(data.positive_percentage)}%
          </div>
        </div>

        <div style={{
          backgroundColor: '#18181B',
          border: '2px solid #27272A',
          borderRadius: '18px',
          padding: '22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <TrendingDown color="#F59E0B" size={24} />
            <span style={{ color: '#71717A', fontSize: '15px' }}>Negativo</span>
          </div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: '#F59E0B' }}>
            {animateNumber(data.negative_percentage)}%
          </div>
        </div>

        <div style={{
          backgroundColor: '#18181B',
          border: '2px solid #27272A',
          borderRadius: '18px',
          padding: '22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <MessageSquare color="#3B82F6" size={24} />
            <span style={{ color: '#71717A', fontSize: '15px' }}>Analizados</span>
          </div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: 'white' }}>
            {animateNumber(data.total_comments_analyzed)}
          </div>
        </div>

        <div style={{
          backgroundColor: '#18181B',
          border: '2px solid #27272A',
          borderRadius: '18px',
          padding: '22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <AlertTriangle color="#EF4444" size={24} />
            <span style={{ color: '#71717A', fontSize: '15px' }}>Toxicidad</span>
          </div>
          <div style={{ 
            fontSize: '34px', 
            fontWeight: 900, 
            color: data.toxicity_level === 'severe' ? '#EF4444' : data.toxicity_level === 'moderate' ? '#F59E0B' : '#10B981',
            textTransform: 'uppercase'
          }}>
            {data.toxicity_level || 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
};

// Stats Panel 2: Sentiment Pie Chart
const StatsPanel2 = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const positive = data.positive_percentage || 0;
  const negative = data.negative_percentage || 0;
  const neutral = data.neutral_percentage || Math.max(0, 100 - positive - negative);
  const hate = data.hate_percentage || 0;

  const pieProgress = spring({ frame, fps, config: { damping: 40, stiffness: 80 } });
  const opacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  const createPieSlice = (startAngle, endAngle) => {
    const animatedEnd = startAngle + (endAngle - startAngle) * pieProgress;
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (animatedEnd - 90) * Math.PI / 180;
    const r = 130;
    const cx = 150;
    const cy = 150;
    
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    
    const largeArc = (animatedEnd - startAngle) > 180 ? 1 : 0;
    
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  let currentAngle = 0;
  const slices = [
    { value: positive, color: '#10B981' },
    { value: neutral, color: '#52525B' },
    { value: Math.max(0, negative - hate), color: '#F59E0B' },
    { value: hate, color: '#DC2626' },
  ].filter(s => s.value > 0);

  return (
    <div style={{
      padding: '25px 50px',
      width: '100%',
      boxSizing: 'border-box',
      opacity,
    }}>
      <div style={{ 
        fontSize: '20px', 
        fontWeight: 800, 
        color: 'white', 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <Flame color="#DC2626" size={26} />
        DESGLOSE DE SENTIMIENTOS
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '35px', justifyContent: 'center' }}>
        {/* Pie Chart */}
        <div style={{ position: 'relative', width: '300px', height: '300px', flexShrink: 0 }}>
          <svg width="300" height="300" viewBox="0 0 300 300">
            {slices.map((slice, i) => {
              const startAngle = currentAngle;
              const endAngle = currentAngle + (slice.value / 100) * 360;
              currentAngle = endAngle;
              return (
                <path
                  key={i}
                  d={createPieSlice(startAngle, endAngle)}
                  fill={slice.color}
                  stroke="#09090B"
                  strokeWidth="3"
                />
              );
            })}
            <circle cx="150" cy="150" r="65" fill="#09090B" />
            <text x="150" y="142" textAnchor="middle" fill="white" fontSize="44" fontWeight="900">
              {Math.round(hate * pieProgress)}%
            </text>
            <text x="150" y="175" textAnchor="middle" fill="#DC2626" fontSize="16" fontWeight="700">
              HATE
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          {[
            { label: 'Positivo', value: positive, color: '#10B981' },
            { label: 'Neutral', value: neutral, color: '#52525B' },
            { label: 'Negativo', value: negative, color: '#F59E0B' },
            { label: 'Hate', value: hate, color: '#DC2626' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: '#18181B',
              padding: '14px 18px',
              borderRadius: '12px',
            }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: item.color }} />
              <div style={{ flex: 1 }}>
                <span style={{ color: '#A1A1AA', fontSize: '14px' }}>{item.label}</span>
              </div>
              <span style={{ color: 'white', fontSize: '24px', fontWeight: 900 }}>{Math.round(item.value)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Stats Panel 3: Emotions
const StatsPanel3 = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const emotions = data.emotion_breakdown || {};
  const emotionData = [
    { name: 'Ira', value: emotions.anger || 0, color: '#EF4444' },
    { name: 'Asco', value: emotions.disgust || 0, color: '#A855F7' },
    { name: 'Alegría', value: emotions.joy || 0, color: '#10B981' },
    { name: 'Tristeza', value: emotions.sadness || 0, color: '#3B82F6' },
    { name: 'Sorpresa', value: emotions.surprise || 0, color: '#F59E0B' },
    { name: 'Miedo', value: emotions.fear || 0, color: '#6366F1' },
  ].sort((a, b) => b.value - a.value);

  const maxValue = Math.max(...emotionData.map(e => e.value), 1);
  const barProgress = spring({ frame, fps, config: { damping: 50 } });
  const opacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      padding: '25px 50px',
      width: '100%',
      boxSizing: 'border-box',
      opacity,
    }}>
      <div style={{ 
        fontSize: '20px', 
        fontWeight: 800, 
        color: 'white', 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <Flame color="#DC2626" size={26} />
        EMOCIONES DETECTADAS
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {emotionData.map((emotion, i) => (
          <div key={i}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '6px'
            }}>
              <span style={{ color: 'white', fontSize: '18px', fontWeight: 700 }}>{emotion.name}</span>
              <span style={{ color: emotion.color, fontSize: '22px', fontWeight: 900 }}>
                {Math.round(emotion.value * barProgress)}%
              </span>
            </div>
            <div style={{
              height: '32px',
              backgroundColor: '#27272A',
              borderRadius: '16px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${(emotion.value / maxValue) * 100 * barProgress}%`,
                background: `linear-gradient(90deg, ${emotion.color}99, ${emotion.color})`,
                borderRadius: '16px',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Stats Panel 4: Word Rankings - SIN ANIMACIONES DE ESCALA
const StatsPanel4 = ({ data }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  const words = (data.word_rankings || []).slice(0, 8);

  const getCategoryColor = (cat) => {
    const colors = {
      'hate': '#EF4444',
      'target': '#F59E0B',
      'criticism': '#F97316',
      'negative': '#A855F7',
      'positive': '#10B981',
      'support': '#3B82F6',
      'neutral': '#71717A',
    };
    return colors[cat] || '#71717A';
  };

  return (
    <div style={{
      padding: '25px 50px',
      width: '100%',
      boxSizing: 'border-box',
      opacity,
    }}>
      <div style={{ 
        fontSize: '20px', 
        fontWeight: 800, 
        color: 'white', 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <Hash color="#DC2626" size={26} />
        RANKING DE PALABRAS
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {words.map((word, i) => (
          <div key={i} style={{
            backgroundColor: '#18181B',
            border: `2px solid ${getCategoryColor(word.category)}44`,
            borderRadius: '14px',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ 
                color: getCategoryColor(word.category), 
                fontSize: '18px', 
                fontWeight: 800,
                marginBottom: '3px',
              }}>
                {word.word}
              </div>
              <div style={{ 
                color: '#52525B', 
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {word.category}
              </div>
            </div>
            <div style={{
              backgroundColor: getCategoryColor(word.category),
              color: 'white',
              padding: '6px 14px',
              borderRadius: '16px',
              fontSize: '18px',
              fontWeight: 900,
            }}>
              {word.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Stats Panel 5: Trending Topics - SIN ANIMACIONES DE ESCALA
const StatsPanel5 = ({ data }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  const topics = (data.trending_topics || []).slice(0, 5);

  const getSentimentColor = (sentiment) => {
    const colors = {
      'hostile': '#EF4444',
      'negative': '#F59E0B',
      'positive': '#10B981',
      'neutral': '#71717A',
    };
    return colors[sentiment] || '#71717A';
  };

  return (
    <div style={{
      padding: '25px 50px',
      width: '100%',
      boxSizing: 'border-box',
      opacity,
    }}>
      <div style={{ 
        fontSize: '20px', 
        fontWeight: 800, 
        color: 'white', 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <Zap color="#DC2626" size={26} />
        TEMAS TRENDING
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {topics.map((topic, i) => (
          <div key={i} style={{
            backgroundColor: '#18181B',
            borderLeft: `4px solid ${getSentimentColor(topic.sentiment)}`,
            borderRadius: '12px',
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ 
                color: 'white', 
                fontSize: '18px', 
                fontWeight: 700,
                marginBottom: '4px',
              }}>
                {topic.topic?.substring(0, 30)}{topic.topic?.length > 30 ? '...' : ''}
              </div>
              <div style={{ 
                color: getSentimentColor(topic.sentiment), 
                fontSize: '12px',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                {topic.sentiment}
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <MessageSquare size={18} color="#71717A" />
              <span style={{ fontSize: '24px', fontWeight: 900, color: 'white' }}>
                {topic.mentions}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Stats Panel 6: What's Failing - SIN ANIMACIONES DE ESCALA
const StatsPanel6 = ({ data }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  const insights = data.content_insights || {};
  const complaints = data.complaints_summary_es || '';

  return (
    <div style={{
      padding: '25px 50px',
      width: '100%',
      boxSizing: 'border-box',
      opacity,
    }}>
      <div style={{ 
        fontSize: '20px', 
        fontWeight: 800, 
        color: 'white', 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <Target color="#DC2626" size={26} />
        ¿QUÉ ESTÁ FALLANDO?
      </div>

      {/* Insight Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
        {[
          { label: 'Quejas', value: insights.complaints_count || 0, color: '#EF4444', icon: AlertTriangle },
          { label: 'Elogios', value: insights.praise_count || 0, color: '#10B981', icon: ThumbsUp },
          { label: 'Preguntas', value: insights.questions_count || 0, color: '#3B82F6', icon: MessageSquare },
          { label: 'Sugerencias', value: insights.suggestions_count || 0, color: '#F59E0B', icon: Zap },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} style={{
              backgroundColor: '#18181B',
              borderRadius: '14px',
              padding: '18px',
              textAlign: 'center',
            }}>
              <Icon color={card.color} size={28} style={{ marginBottom: '8px' }} />
              <div style={{ color: 'white', fontSize: '38px', fontWeight: 900 }}>{card.value}</div>
              <div style={{ color: '#71717A', fontSize: '13px' }}>{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{
        backgroundColor: '#DC262618',
        border: '2px solid #DC262650',
        borderRadius: '16px',
        padding: '20px',
      }}>
        <div style={{ 
          color: '#DC2626', 
          fontSize: '14px', 
          fontWeight: 700, 
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Resumen de Críticas
        </div>
        <div style={{ 
          color: 'white', 
          fontSize: '16px', 
          lineHeight: 1.5,
        }}>
          {complaints?.substring(0, 180) || 'Sin resumen disponible'}
        </div>
      </div>
    </div>
  );
};

// Main Composition - 60 seconds at 30fps = 1800 frames
export const VideoAnalysisVertical = ({ data }) => {
  return (
    <AbsoluteFill style={{ 
      backgroundColor: '#09090B',
      fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.03,
        backgroundImage: 'radial-gradient(circle, #DC2626 1px, transparent 1px)',
        backgroundSize: '30px 30px',
        pointerEvents: 'none',
      }} />

      {/* Fixed Header - Always visible */}
      <FixedHeader data={data} />

      {/* Divider line */}
      <div style={{
        height: '2px',
        background: 'linear-gradient(90deg, transparent 5%, #DC262660 50%, transparent 95%)',
        margin: '0 50px 8px 50px',
        flexShrink: 0,
      }} />

      {/* Stats Panels Area - Changes over time */}
      <div style={{ 
        flex: 1, 
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Panel 1: Main Stats (2-12s) */}
        <Sequence from={60} durationInFrames={300}>
          <StatsPanel1 data={data} />
        </Sequence>

        {/* Panel 2: Pie Chart (12-22s) */}
        <Sequence from={360} durationInFrames={300}>
          <StatsPanel2 data={data} />
        </Sequence>

        {/* Panel 3: Emotions (22-32s) */}
        <Sequence from={660} durationInFrames={300}>
          <StatsPanel3 data={data} />
        </Sequence>

        {/* Panel 4: Words (32-40s) */}
        <Sequence from={960} durationInFrames={240}>
          <StatsPanel4 data={data} />
        </Sequence>

        {/* Panel 5: Topics (40-48s) */}
        <Sequence from={1200} durationInFrames={240}>
          <StatsPanel5 data={data} />
        </Sequence>

        {/* Panel 6: Insights (48-60s) */}
        <Sequence from={1440} durationInFrames={360}>
          <StatsPanel6 data={data} />
        </Sequence>
      </div>

      {/* Footer watermark */}
      <div style={{
        padding: '18px',
        textAlign: 'center',
        color: '#3F3F46',
        fontSize: '14px',
        fontWeight: 600,
        flexShrink: 0,
      }}>
        socialhate.com
      </div>
    </AbsoluteFill>
  );
};
