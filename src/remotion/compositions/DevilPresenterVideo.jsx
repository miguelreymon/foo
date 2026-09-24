import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Sequence, staticFile } from 'remotion';
import { Flame, MessageSquare, ThumbsUp, ThumbsDown, Eye, AlertTriangle, TrendingUp } from 'lucide-react';

// Devil Mascot Character with animations
const DevilMascot = ({ expression = 'happy', speaking = false, size = 400 }) => {
  const frame = useCurrentFrame();
  
  // Bounce animation
  const bounce = Math.sin(frame * 0.15) * 8;
  
  // Tilt animation
  const tilt = Math.sin(frame * 0.1) * 3;
  
  // Blink every ~90 frames
  const blinkCycle = frame % 90;
  const isBlinking = blinkCycle > 85 && blinkCycle < 90;
  
  // Speaking mouth animation
  const mouthOpen = speaking ? Math.abs(Math.sin(frame * 0.5)) * 15 : 0;
  
  // Expression-based eye scale
  const eyeScale = expression === 'shocked' ? 1.3 : expression === 'angry' ? 0.8 : 1;
  
  return (
    <div style={{
      position: 'relative',
      width: size,
      height: size,
      transform: `translateY(${bounce}px) rotate(${tilt}deg)`,
    }}>
      {/* Mascot Image */}
      <img
        src={staticFile('images/devil-mascot.png')}
        alt="Devil Mascot"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 20px 40px rgba(220, 38, 38, 0.5))',
        }}
      />
      
      {/* Animated Eyes Overlay (optional blink effect) */}
      {isBlinking && (
        <div style={{
          position: 'absolute',
          top: '32%',
          left: '25%',
          right: '25%',
          height: '8%',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 15%',
        }}>
          <div style={{ width: '20%', height: '100%', backgroundColor: '#DC2626', borderRadius: '50%' }} />
          <div style={{ width: '20%', height: '100%', backgroundColor: '#DC2626', borderRadius: '50%' }} />
        </div>
      )}
      
      {/* Speech indicator when talking */}
      {speaking && (
        <div style={{
          position: 'absolute',
          bottom: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '6px',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: '12px',
              height: `${12 + Math.sin(frame * 0.3 + i) * 8}px`,
              backgroundColor: '#DC2626',
              borderRadius: '6px',
            }} />
          ))}
        </div>
      )}
    </div>
  );
};

// Speech Bubble Component
const SpeechBubble = ({ text, position = 'right' }) => {
  const frame = useCurrentFrame();
  const scale = spring({ frame, fps: 30, config: { damping: 12 } });
  
  return (
    <div style={{
      position: 'relative',
      maxWidth: '500px',
      padding: '24px 30px',
      backgroundColor: 'white',
      borderRadius: '24px',
      transform: `scale(${scale})`,
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
    }}>
      {/* Tail */}
      <div style={{
        position: 'absolute',
        [position]: '-20px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: 0,
        height: 0,
        borderTop: '15px solid transparent',
        borderBottom: '15px solid transparent',
        [position === 'left' ? 'borderRight' : 'borderLeft']: '25px solid white',
      }} />
      
      <p style={{
        margin: 0,
        fontSize: '24px',
        fontWeight: 700,
        color: '#1a1a1a',
        lineHeight: 1.4,
      }}>
        {text}
      </p>
    </div>
  );
};

// Animated Stat Card
const StatCard = ({ label, value, color, icon: Icon, delay = 0 }) => {
  const frame = useCurrentFrame();
  const scale = spring({ frame: Math.max(0, frame - delay), fps: 30, config: { damping: 10 } });
  const displayValue = Math.round(value * Math.min(1, (frame - delay) / 30));
  
  return (
    <div style={{
      backgroundColor: '#18181B',
      borderRadius: '20px',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      transform: `scale(${scale})`,
      border: `2px solid ${color}40`,
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        borderRadius: '12px',
        backgroundColor: `${color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon color={color} size={28} />
      </div>
      <div>
        <div style={{ fontSize: '14px', color: '#71717A', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '36px', fontWeight: 900, color }}>
          {typeof value === 'number' && value <= 100 ? `${displayValue}%` : displayValue.toLocaleString()}
        </div>
      </div>
    </div>
  );
};

// Scene 1: Intro with Devil
const IntroScene = ({ data }) => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [30, 60], [0, 1]);
  
  return (
    <AbsoluteFill style={{
      backgroundColor: '#09090B',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, #DC262630 0%, transparent 70%)',
        borderRadius: '50%',
      }} />
      
      {/* Devil enters */}
      <div style={{
        transform: `translateY(${interpolate(frame, [0, 30], [200, 0])}px)`,
        opacity: interpolate(frame, [0, 20], [0, 1]),
      }}>
        <DevilMascot expression="happy" speaking={frame > 60} size={350} />
      </div>
      
      {/* Title */}
      <div style={{
        marginTop: '30px',
        textAlign: 'center',
        opacity: titleOpacity,
      }}>
        <h1 style={{
          fontSize: '42px',
          fontWeight: 900,
          color: 'white',
          margin: 0,
        }}>
          ¡Hola haters! 👋
        </h1>
        <p style={{
          fontSize: '24px',
          color: '#DC2626',
          marginTop: '12px',
        }}>
          Vamos a ver cuánto odio tiene este video...
        </p>
      </div>
    </AbsoluteFill>
  );
};

// Scene 2: Show Video Info
const VideoInfoScene = ({ data }) => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill style={{
      backgroundColor: '#09090B',
      padding: '40px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <Flame color="#DC2626" size={32} />
        <span style={{ fontSize: '24px', fontWeight: 900, color: 'white' }}>
          SOCIAL<span style={{ color: '#DC2626' }}>HATE</span>
        </span>
      </div>

      {/* Video Thumbnail */}
      <div style={{
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: '20px',
        overflow: 'hidden',
        marginBottom: '20px',
        border: '4px solid #DC2626',
        opacity: interpolate(frame, [0, 20], [0, 1]),
        transform: `scale(${interpolate(frame, [0, 20], [0.9, 1])})`,
      }}>
        {data.thumbnail_url && (
          <img src={data.thumbnail_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>

      {/* Title */}
      <h2 style={{
        fontSize: '28px',
        fontWeight: 800,
        color: 'white',
        marginBottom: '8px',
        opacity: interpolate(frame, [20, 40], [0, 1]),
      }}>
        {data.video_title?.substring(0, 40)}...
      </h2>
      <p style={{
        fontSize: '18px',
        color: '#71717A',
        marginBottom: '20px',
        opacity: interpolate(frame, [30, 50], [0, 1]),
      }}>
        {data.channel_name}
      </p>

      {/* Devil peeking from corner */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '-50px',
        transform: `translateX(${interpolate(frame, [40, 70], [150, 0])}px)`,
      }}>
        <DevilMascot size={250} speaking={frame > 80} />
      </div>

      {/* Speech bubble */}
      {frame > 80 && (
        <div style={{
          position: 'absolute',
          bottom: '200px',
          right: '200px',
        }}>
          <SpeechBubble text="¡Veamos los datos! 📊" position="right" />
        </div>
      )}
    </AbsoluteFill>
  );
};

// Scene 3: Hate Reveal (dramatic)
const HateRevealScene = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const hateValue = data.hate_percentage || 0;
  const countUp = Math.min(hateValue, Math.round(hateValue * (frame / 60)));
  
  const shakeX = frame < 60 ? Math.sin(frame * 0.8) * 5 : 0;
  const shakeY = frame < 60 ? Math.cos(frame * 0.6) * 3 : 0;
  
  const isHighHate = hateValue >= 40;
  
  return (
    <AbsoluteFill style={{
      backgroundColor: '#09090B',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `translate(${shakeX}px, ${shakeY}px)`,
    }}>
      {/* Explosion effect for high hate */}
      {isHighHate && frame > 50 && (
        <div style={{
          position: 'absolute',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, #DC262650 0%, transparent 60%)',
          borderRadius: '50%',
          transform: `scale(${interpolate(frame, [50, 80], [0.5, 1.5])})`,
          opacity: interpolate(frame, [50, 100], [1, 0]),
        }} />
      )}

      {/* Devil reacting */}
      <div style={{
        marginBottom: '30px',
        transform: isHighHate && frame > 60 ? `scale(${1 + Math.sin(frame * 0.3) * 0.1})` : 'scale(1)',
      }}>
        <DevilMascot expression={isHighHate ? 'happy' : 'neutral'} speaking={frame > 70} size={280} />
      </div>

      {/* HATE label */}
      <div style={{
        fontSize: '32px',
        fontWeight: 700,
        color: '#DC2626',
        marginBottom: '10px',
        opacity: interpolate(frame, [10, 30], [0, 1]),
      }}>
        🔥 HATE DETECTADO 🔥
      </div>

      {/* Big Number */}
      <div style={{
        fontSize: '180px',
        fontWeight: 900,
        color: isHighHate ? '#DC2626' : '#F59E0B',
        lineHeight: 1,
        textShadow: `0 0 60px ${isHighHate ? '#DC2626' : '#F59E0B'}80`,
      }}>
        {countUp}%
      </div>

      {/* Reaction text */}
      {frame > 80 && (
        <div style={{
          fontSize: '28px',
          fontWeight: 700,
          color: 'white',
          marginTop: '20px',
          textAlign: 'center',
        }}>
          {isHighHate ? '¡BRUTAL! 🤯' : hateValue >= 20 ? '¡Bastante calentito! 🌶️' : 'Tranquilito... 😴'}
        </div>
      )}
    </AbsoluteFill>
  );
};

// Scene 4: Stats Breakdown
const StatsBreakdownScene = ({ data }) => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill style={{
      backgroundColor: '#09090B',
      padding: '40px',
    }}>
      {/* Devil as host */}
      <div style={{
        position: 'absolute',
        top: '30px',
        left: '30px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
      }}>
        <DevilMascot size={120} speaking={true} />
        <SpeechBubble text="Los números no mienten..." position="left" />
      </div>

      {/* Stats Grid */}
      <div style={{
        marginTop: '200px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <StatCard 
          label="Positivo" 
          value={data.positive_percentage || 0} 
          color="#10B981" 
          icon={ThumbsUp}
          delay={20}
        />
        <StatCard 
          label="Negativo" 
          value={data.negative_percentage || 0} 
          color="#F59E0B" 
          icon={ThumbsDown}
          delay={40}
        />
        <StatCard 
          label="Comentarios" 
          value={data.total_comments_analyzed || 0} 
          color="#3B82F6" 
          icon={MessageSquare}
          delay={60}
        />
        <StatCard 
          label="Vistas" 
          value={data.view_count || 0} 
          color="#8B5CF6" 
          icon={Eye}
          delay={80}
        />
      </div>
    </AbsoluteFill>
  );
};

// Scene 5: Top Words with Devil commentary
const TopWordsScene = ({ data }) => {
  const frame = useCurrentFrame();
  const words = (data.word_rankings || []).slice(0, 5);
  
  return (
    <AbsoluteFill style={{
      backgroundColor: '#09090B',
      padding: '40px',
    }}>
      {/* Title */}
      <div style={{
        fontSize: '28px',
        fontWeight: 900,
        color: 'white',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{ fontSize: '36px' }}>🗣️</span>
        Lo que más dicen...
      </div>

      {/* Words */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
        {words.map((word, i) => {
          const delay = i * 15;
          const opacity = interpolate(frame, [delay, delay + 20], [0, 1]);
          const slideX = interpolate(frame, [delay, delay + 20], [-50, 0]);
          
          return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              backgroundColor: '#18181B',
              padding: '16px 20px',
              borderRadius: '16px',
              opacity,
              transform: `translateX(${slideX}px)`,
            }}>
              <span style={{ fontSize: '32px', fontWeight: 900, color: '#DC2626' }}>#{i + 1}</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'white', flex: 1 }}>{word.word}</span>
              <span style={{ 
                backgroundColor: '#DC2626',
                color: 'white',
                padding: '6px 14px',
                borderRadius: '20px',
                fontWeight: 800,
              }}>
                x{word.count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Devil reaction */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        right: '30px',
      }}>
        <DevilMascot size={180} speaking={frame > 60} />
      </div>
    </AbsoluteFill>
  );
};

// Scene 6: Outro
const OutroScene = ({ data }) => {
  const frame = useCurrentFrame();
  const bounceY = Math.sin(frame * 0.2) * 10;
  
  return (
    <AbsoluteFill style={{
      backgroundColor: '#09090B',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Glow */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, #DC262640 0%, transparent 70%)',
        borderRadius: '50%',
      }} />

      {/* Devil waving */}
      <div style={{ transform: `translateY(${bounceY}px)` }}>
        <DevilMascot size={350} expression="happy" />
      </div>

      {/* Outro text */}
      <div style={{
        marginTop: '30px',
        textAlign: 'center',
        opacity: interpolate(frame, [20, 50], [0, 1]),
      }}>
        <h2 style={{
          fontSize: '36px',
          fontWeight: 900,
          color: 'white',
          marginBottom: '16px',
        }}>
          ¡Hasta la próxima! 👋
        </h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}>
          <Flame color="#DC2626" size={32} />
          <span style={{ fontSize: '28px', fontWeight: 800, color: 'white' }}>
            SOCIAL<span style={{ color: '#DC2626' }}>HATE</span>
          </span>
        </div>
        <p style={{ color: '#71717A', marginTop: '12px', fontSize: '18px' }}>
          Sígueme para más análisis 🔥
        </p>
      </div>
    </AbsoluteFill>
  );
};

// Main Devil Presenter Video - 45 seconds at 30fps = 1350 frames
export const DevilPresenterVideo = ({ data }) => {
  return (
    <AbsoluteFill style={{ 
      backgroundColor: '#09090B',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Background pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.03,
        backgroundImage: 'radial-gradient(circle, #DC2626 1px, transparent 1px)',
        backgroundSize: '25px 25px',
      }} />

      {/* Scene 1: Intro (0-5s = 0-150 frames) */}
      <Sequence from={0} durationInFrames={150}>
        <IntroScene data={data} />
      </Sequence>

      {/* Scene 2: Video Info (5-12s = 150-360 frames) */}
      <Sequence from={150} durationInFrames={210}>
        <VideoInfoScene data={data} />
      </Sequence>

      {/* Scene 3: Hate Reveal (12-20s = 360-600 frames) */}
      <Sequence from={360} durationInFrames={240}>
        <HateRevealScene data={data} />
      </Sequence>

      {/* Scene 4: Stats Breakdown (20-30s = 600-900 frames) */}
      <Sequence from={600} durationInFrames={300}>
        <StatsBreakdownScene data={data} />
      </Sequence>

      {/* Scene 5: Top Words (30-40s = 900-1200 frames) */}
      <Sequence from={900} durationInFrames={300}>
        <TopWordsScene data={data} />
      </Sequence>

      {/* Scene 6: Outro (40-45s = 1200-1350 frames) */}
      <Sequence from={1200} durationInFrames={150}>
        <OutroScene data={data} />
      </Sequence>
    </AbsoluteFill>
  );
};
