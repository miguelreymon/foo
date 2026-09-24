import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { Flame, MessageSquare, ThumbsUp, TrendingUp, Users } from 'lucide-react';

export const VideoAnalysisStats = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({ frame, fps, config: { damping: 100 } });

  // Animate stats counters
  const statsProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 80 },
  });

  const animateNumber = (target, progress) => {
    return Math.floor(target * progress);
  };

  return (
    <AbsoluteFill style={{
      backgroundColor: '#09090B',
      padding: '60px',
      fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.03,
        backgroundImage: 'radial-gradient(circle, #DC2626 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '40px',
        opacity: fadeIn,
      }}>
        <Flame color="#DC2626" size={36} strokeWidth={2.5} />
        <div style={{ fontSize: '28px', fontWeight: 900, color: 'white' }}>
          SOCIAL<span style={{ color: '#DC2626' }}>HATE</span>
        </div>
      </div>

      {/* Video Title */}
      <div style={{
        marginBottom: '50px',
        opacity: interpolate(frame, [0, 20], [0, 1]),
      }}>
        <h1 style={{
          fontSize: '40px',
          fontWeight: 900,
          color: 'white',
          margin: 0,
          marginBottom: '12px',
          lineHeight: 1.2,
        }}>
          {data.video_title}
        </h1>
        <p style={{
          fontSize: '20px',
          color: '#71717A',
          margin: 0,
        }}>
          {data.channel_name}
        </p>
      </div>

      {/* Main Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '24px',
        marginBottom: '40px',
      }}>
        {/* Hate Percentage - BIG */}
        <div style={{
          gridColumn: 'span 2',
          background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
          borderRadius: '16px',
          padding: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: interpolate(frame, [20, 40], [0, 1]),
          transform: `scale(${interpolate(frame, [20, 40], [0.9, 1])})`,
        }}>
          <div>
            <div style={{ fontSize: '24px', color: 'rgba(255,255,255,0.9)', marginBottom: '8px', fontWeight: 600 }}>
              Hate Detectado
            </div>
            <div style={{ fontSize: '80px', fontWeight: 900, color: 'white' }}>
              {animateNumber(data.hate_percentage, statsProgress)}%
            </div>
          </div>
          <Flame color="white" size={80} strokeWidth={2.5} />
        </div>

        {/* Total Comments */}
        <div style={{
          backgroundColor: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '16px',
          padding: '30px',
          opacity: interpolate(frame, [30, 50], [0, 1]),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <MessageSquare color="#10B981" size={32} strokeWidth={2.5} />
            <div style={{ fontSize: '18px', color: '#71717A', fontWeight: 600 }}>
              Comentarios
            </div>
          </div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: 'white' }}>
            {animateNumber(data.total_comments_analyzed, statsProgress).toLocaleString()}
          </div>
        </div>

        {/* Views */}
        <div style={{
          backgroundColor: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '16px',
          padding: '30px',
          opacity: interpolate(frame, [40, 60], [0, 1]),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Users color="#3B82F6" size={32} strokeWidth={2.5} />
            <div style={{ fontSize: '18px', color: '#71717A', fontWeight: 600 }}>
              Vistas
            </div>
          </div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: 'white' }}>
            {animateNumber(data.view_count, statsProgress).toLocaleString()}
          </div>
        </div>

        {/* Positive */}
        <div style={{
          backgroundColor: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '16px',
          padding: '30px',
          opacity: interpolate(frame, [50, 70], [0, 1]),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <ThumbsUp color="#10B981" size={32} strokeWidth={2.5} />
            <div style={{ fontSize: '18px', color: '#71717A', fontWeight: 600 }}>
              Positivo
            </div>
          </div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: '#10B981' }}>
            {animateNumber(data.positive_percentage, statsProgress)}%
          </div>
        </div>

        {/* Negative */}
        <div style={{
          backgroundColor: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '16px',
          padding: '30px',
          opacity: interpolate(frame, [60, 80], [0, 1]),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <TrendingUp color="#F59E0B" size={32} strokeWidth={2.5} />
            <div style={{ fontSize: '18px', color: '#71717A', fontWeight: 600 }}>
              Negativo
            </div>
          </div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: '#F59E0B' }}>
            {animateNumber(data.negative_percentage, statsProgress)}%
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        textAlign: 'center',
        fontSize: '16px',
        color: '#52525B',
        opacity: interpolate(frame, [100, 120], [0, 1]),
      }}>
        Análisis realizado con IA • socialhate.com
      </div>
    </AbsoluteFill>
  );
};