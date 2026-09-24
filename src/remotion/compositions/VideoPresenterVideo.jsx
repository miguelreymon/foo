import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Video, Img } from 'remotion';
import { Flame, Eye, MessageSquare, ThumbsUp, TrendingUp, TrendingDown } from 'lucide-react';

// Chroma Key Component - removes green background
const ChromaKeyVideo = ({ src, style, chromaKey = { color: '#00ff00', similarity: 0.4, smoothness: 0.1 } }) => {
  const canvasRef = React.useRef(null);
  const videoRef = React.useRef(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  React.useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const processFrame = () => {
      if (video.paused || video.ended) return;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Chroma key removal
      const keyColor = hexToRgb(chromaKey.color);
      const similarity = chromaKey.similarity * 255;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Check if pixel is close to green
        const diffR = Math.abs(r - keyColor.r);
        const diffG = Math.abs(g - keyColor.g);
        const diffB = Math.abs(b - keyColor.b);
        
        // Green screen detection (green is dominant)
        if (g > r && g > b && diffG < similarity && g > 80) {
          data[i + 3] = 0; // Make transparent
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      requestAnimationFrame(processFrame);
    };

    video.addEventListener('play', () => {
      setIsPlaying(true);
      processFrame();
    });

    // Sync video with Remotion frame
    const targetTime = frame / fps;
    if (Math.abs(video.currentTime - targetTime) > 0.1) {
      video.currentTime = targetTime;
    }
    if (video.paused && isPlaying) {
      video.play();
    }

  }, [frame, fps, chromaKey]);

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 255, b: 0 };
  };

  return (
    <div style={{ position: 'relative', ...style }}>
      <video
        ref={videoRef}
        src={src}
        style={{ display: 'none' }}
        muted
        playsInline
        loop
      />
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

// Simple animated presenter using CSS mix-blend-mode for green removal
const AnimatedPresenter = ({ visible, position = 'center', scale = 1, speaking = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Bounce animation
  const bounce = Math.sin(frame * 0.15) * 8;
  
  // Speaking animation - mouth movement simulation via scale
  const speakingScale = speaking ? 1 + Math.sin(frame * 0.5) * 0.03 : 1;
  
  // Entry/exit animation
  const opacity = visible ? 1 : 0;
  const slideY = visible ? 0 : 100;
  
  const positions = {
    left: { left: '5%', bottom: '15%' },
    center: { left: '50%', bottom: '15%', transform: 'translateX(-50%)' },
    right: { right: '5%', bottom: '15%' },
    'bottom-left': { left: '5%', bottom: '5%' },
    'bottom-right': { right: '5%', bottom: '5%' },
  };

  return (
    <div style={{
      position: 'absolute',
      ...positions[position],
      opacity,
      transform: `translateY(${slideY + bounce}px) scale(${scale * speakingScale})`,
      transition: 'opacity 0.3s, transform 0.3s',
      zIndex: 100,
    }}>
      {/* Video container with green screen removal via CSS */}
      <div style={{
        width: '280px',
        height: '280px',
        borderRadius: '20px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <Video
          src="/videos/presenter.mp4"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            // CSS-based green screen removal (works for bright green)
            mixBlendMode: 'multiply',
          }}
          muted
          loop
        />
        {/* Overlay to help with green removal */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
          mixBlendMode: 'screen',
        }} />
      </div>
      
      {/* Glow effect */}
      <div style={{
        position: 'absolute',
        inset: '-20px',
        background: 'radial-gradient(circle, #DC262640 0%, transparent 70%)',
        borderRadius: '50%',
        zIndex: -1,
        filter: 'blur(15px)',
      }} />
    </div>
  );
};

// Alternative: Simple overlay presenter with the video
const VideoPresenterOverlay = ({ visible, position = 'bottom-left', size = 250 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Bounce animation
  const bounce = Math.sin(frame * 0.12) * 6;
  const scaleBreath = 1 + Math.sin(frame * 0.08) * 0.02;
  
  // Slide in/out
  const slideX = interpolate(
    visible ? 1 : 0,
    [0, 1],
    [-300, 0]
  );
  
  const opacity = visible ? 1 : 0;

  const positionStyles = {
    'bottom-left': { left: 20, bottom: 200 },
    'bottom-right': { right: 20, bottom: 200 },
    'center-bottom': { left: '50%', bottom: 200, marginLeft: -size/2 },
  };

  return (
    <div style={{
      position: 'absolute',
      ...positionStyles[position],
      width: size,
      height: size,
      opacity,
      transform: `translateX(${slideX}px) translateY(${bounce}px) scale(${scaleBreath})`,
      transition: 'opacity 0.5s ease-out',
      zIndex: 50,
    }}>
      {/* Video with green screen - using CSS filter approach */}
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        overflow: 'hidden',
        border: '4px solid #DC2626',
        boxShadow: '0 0 40px #DC262660, 0 0 80px #DC262630',
        background: '#0A0A0A',
      }}>
        <Video
          src="/videos/presenter_web.webm"
          style={{
            width: '140%',
            height: '140%',
            objectFit: 'cover',
            marginLeft: '-20%',
            marginTop: '-10%',
          }}
          muted
          loop
          startFrom={0}
        />
      </div>
      
      {/* Fire particles around presenter */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 8,
            height: 12,
            background: `radial-gradient(ellipse, ${i % 2 === 0 ? '#F97316' : '#FBBF24'} 0%, transparent 70%)`,
            borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            left: `${50 + Math.cos((frame * 0.05 + i * 60) * Math.PI / 180) * 55}%`,
            top: `${50 + Math.sin((frame * 0.05 + i * 60) * Math.PI / 180) * 55}%`,
            opacity: 0.7 + Math.sin(frame * 0.1 + i) * 0.3,
            transform: `rotate(${frame * 2 + i * 60}deg)`,
          }}
        />
      ))}
    </div>
  );
};

// Speech bubble component
const SpeechBubble = ({ text, visible, position = 'right' }) => {
  const frame = useCurrentFrame();
  const opacity = visible ? 1 : 0;
  const scale = visible ? 1 : 0.8;
  
  const positionStyles = {
    right: { left: 280, top: 20 },
    left: { right: 280, top: 20 },
    top: { left: '50%', bottom: '100%', marginLeft: -150, marginBottom: 20 },
  };

  return (
    <div style={{
      position: 'absolute',
      ...positionStyles[position],
      background: 'white',
      padding: '16px 24px',
      borderRadius: '20px',
      maxWidth: 300,
      opacity,
      transform: `scale(${scale})`,
      transition: 'all 0.3s ease-out',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
    }}>
      <p style={{
        margin: 0,
        fontSize: 20,
        fontWeight: 700,
        color: '#18181B',
        lineHeight: 1.3,
      }}>
        {text}
      </p>
      {/* Bubble tail */}
      <div style={{
        position: 'absolute',
        left: position === 'right' ? -15 : 'auto',
        right: position === 'left' ? -15 : 'auto',
        top: 30,
        width: 0,
        height: 0,
        borderTop: '10px solid transparent',
        borderBottom: '10px solid transparent',
        borderRight: position === 'right' ? '15px solid white' : 'none',
        borderLeft: position === 'left' ? '15px solid white' : 'none',
      }} />
    </div>
  );
};

// ============================================
// MAIN COMPOSITION: Video Presenter
// ============================================
export const VideoPresenterVideo = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Scene configuration (45 seconds total = 1350 frames at 30fps)
  const scenes = [
    { name: 'intro', start: 0, end: 180, text: '¡Hola! Vamos a ver el análisis de este video...' },
    { name: 'videoInfo', start: 180, end: 360, text: '¡Mira estos datos!' },
    { name: 'hateReveal', start: 360, end: 540, text: '¿Cuánto hate tiene?' },
    { name: 'stats', start: 540, end: 750, text: '¡Aquí están las estadísticas!' },
    { name: 'topWords', start: 750, end: 960, text: 'Las palabras más usadas...' },
    { name: 'conclusion', start: 960, end: 1200, text: '¡Eso es todo! ¿Te sorprendió?' },
    { name: 'outro', start: 1200, end: 1350, text: '¡Hasta la próxima!' },
  ];

  const getCurrentScene = () => {
    return scenes.find(s => frame >= s.start && frame < s.end) || scenes[0];
  };

  const currentScene = getCurrentScene();
  const sceneProgress = (frame - currentScene.start) / (currentScene.end - currentScene.start);

  // Data extraction
  const hatePercentage = data?.hate_percentage || 0;
  const videoTitle = data?.video_title || 'Video de prueba';
  const channelName = data?.channel_name || 'Canal';
  const viewCount = data?.view_count || 0;
  const likeCount = data?.like_count || 0;
  const commentCount = data?.total_comments_analyzed || 0;
  const thumbnailUrl = data?.thumbnail_url;
  const topWords = data?.top_negative_words || data?.word_frequency?.slice(0, 5) || [];

  // Presenter visibility per scene
  const presenterVisible = ['intro', 'hateReveal', 'conclusion', 'outro'].includes(currentScene.name);
  const bubbleVisible = sceneProgress > 0.1 && sceneProgress < 0.9;

  return (
    <AbsoluteFill style={{
      backgroundColor: '#0A0A0A',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Animated background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 30%, #DC262615 0%, transparent 50%)`,
      }} />

      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        textAlign: 'center',
        zIndex: 10,
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 28px',
          background: 'linear-gradient(90deg, transparent, #DC262620, transparent)',
          borderRadius: 50,
        }}>
          <Flame color="#DC2626" size={28} />
          <span style={{
            fontSize: 24,
            fontWeight: 900,
            color: 'white',
          }}>
            SOCIAL<span style={{ color: '#DC2626' }}>HATE</span>
          </span>
        </div>
      </div>

      {/* INTRO SCENE */}
      <Sequence from={0} durationInFrames={180}>
        <div style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 48,
            fontWeight: 900,
            color: 'white',
            opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `translateY(${interpolate(frame, [0, 30], [30, 0], { extrapolateRight: 'clamp' })}px)`,
          }}>
            ¡Análisis de Video!
          </div>
        </div>
      </Sequence>

      {/* VIDEO INFO SCENE */}
      <Sequence from={180} durationInFrames={180}>
        <div style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          transform: 'translate(-50%, 0)',
          width: '85%',
          maxWidth: 450,
        }}>
          {/* Thumbnail */}
          <div style={{
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            opacity: interpolate(frame - 180, [0, 30], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `scale(${interpolate(frame - 180, [0, 30], [0.9, 1], { extrapolateRight: 'clamp' })})`,
          }}>
            {thumbnailUrl ? (
              <Img src={thumbnailUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#27272A' }} />
            )}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 24,
            fontWeight: 800,
            color: 'white',
            textAlign: 'center',
            marginBottom: 8,
            opacity: interpolate(frame - 180, [20, 50], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            {videoTitle.substring(0, 50)}...
          </div>

          {/* Channel */}
          <div style={{
            fontSize: 18,
            color: '#DC2626',
            textAlign: 'center',
            opacity: interpolate(frame - 180, [30, 60], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            {channelName}
          </div>
        </div>
      </Sequence>

      {/* HATE REVEAL SCENE */}
      <Sequence from={360} durationInFrames={180}>
        <div style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          {/* Big hate percentage */}
          <div style={{
            fontSize: interpolate(frame - 360, [30, 90], [0, 140], { extrapolateRight: 'clamp' }),
            fontWeight: 900,
            background: hatePercentage > 20 
              ? 'linear-gradient(180deg, #FBBF24, #DC2626)' 
              : hatePercentage > 10 
              ? 'linear-gradient(180deg, #FBBF24, #F97316)'
              : 'linear-gradient(180deg, #10B981, #059669)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: `drop-shadow(0 0 ${40 + Math.sin(frame * 0.1) * 10}px ${hatePercentage > 20 ? '#DC2626' : '#F97316'})`,
          }}>
            {Math.round(hatePercentage)}%
          </div>
          <div style={{
            fontSize: 28,
            color: '#F97316',
            fontWeight: 700,
            marginTop: 10,
            letterSpacing: 4,
            opacity: interpolate(frame - 360, [60, 90], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            🔥 HATE DETECTADO 🔥
          </div>
        </div>
      </Sequence>

      {/* STATS SCENE */}
      <Sequence from={540} durationInFrames={210}>
        <div style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          transform: 'translate(-50%, 0)',
          width: '85%',
        }}>
          <div style={{
            fontSize: 28,
            fontWeight: 800,
            color: 'white',
            textAlign: 'center',
            marginBottom: 30,
            opacity: interpolate(frame - 540, [0, 30], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            Estadísticas
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: Eye, label: 'Vistas', value: viewCount.toLocaleString(), delay: 0 },
              { icon: ThumbsUp, label: 'Likes', value: likeCount.toLocaleString(), delay: 15 },
              { icon: MessageSquare, label: 'Comentarios', value: commentCount.toLocaleString(), delay: 30 },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 24px',
                  background: '#18181B',
                  borderRadius: 16,
                  opacity: interpolate(frame - 540, [stat.delay, stat.delay + 30], [0, 1], { extrapolateRight: 'clamp' }),
                  transform: `translateX(${interpolate(frame - 540, [stat.delay, stat.delay + 30], [-50, 0], { extrapolateRight: 'clamp' })}px)`,
                }}
              >
                <stat.icon color="#DC2626" size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#71717A' }}>{stat.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'white' }}>{stat.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Sequence>

      {/* TOP WORDS SCENE */}
      <Sequence from={750} durationInFrames={210}>
        <div style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          transform: 'translate(-50%, 0)',
          width: '85%',
        }}>
          <div style={{
            fontSize: 28,
            fontWeight: 800,
            color: 'white',
            textAlign: 'center',
            marginBottom: 30,
          }}>
            Palabras más usadas
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {(topWords.length > 0 ? topWords : ['ejemplo', 'palabra', 'test', 'hate', 'comentario']).slice(0, 8).map((word, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 24px',
                  background: i < 3 ? '#DC262630' : '#27272A',
                  border: i < 3 ? '2px solid #DC2626' : '1px solid #3F3F46',
                  borderRadius: 50,
                  fontSize: 18,
                  fontWeight: 600,
                  color: i < 3 ? '#DC2626' : '#A1A1AA',
                  opacity: interpolate(frame - 750, [i * 10, i * 10 + 30], [0, 1], { extrapolateRight: 'clamp' }),
                  transform: `scale(${interpolate(frame - 750, [i * 10, i * 10 + 30], [0.5, 1], { extrapolateRight: 'clamp' })})`,
                }}
              >
                {typeof word === 'object' ? word.word : word}
              </div>
            ))}
          </div>
        </div>
      </Sequence>

      {/* CONCLUSION SCENE */}
      <Sequence from={960} durationInFrames={240}>
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 36,
            fontWeight: 900,
            color: 'white',
            marginBottom: 20,
            opacity: interpolate(frame - 960, [0, 30], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            {hatePercentage > 20 ? '¡Comunidad tóxica!' : hatePercentage > 10 ? 'Comunidad moderada' : '¡Buena comunidad!'}
          </div>
          
          {/* Trend indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            opacity: interpolate(frame - 960, [30, 60], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            {hatePercentage > 15 ? (
              <TrendingUp color="#DC2626" size={40} />
            ) : (
              <TrendingDown color="#10B981" size={40} />
            )}
            <span style={{
              fontSize: 24,
              color: hatePercentage > 15 ? '#DC2626' : '#10B981',
              fontWeight: 700,
            }}>
              {hatePercentage > 15 ? 'Alto nivel de hate' : 'Nivel saludable'}
            </span>
          </div>
        </div>
      </Sequence>

      {/* OUTRO SCENE */}
      <Sequence from={1200} durationInFrames={150}>
        <div style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 40,
            fontWeight: 900,
            color: 'white',
            opacity: interpolate(frame - 1200, [0, 30], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            ¡Gracias por ver!
          </div>
          <div style={{
            fontSize: 24,
            color: '#DC2626',
            marginTop: 16,
            opacity: interpolate(frame - 1200, [30, 60], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            @socialhate
          </div>
        </div>
      </Sequence>

      {/* VIDEO PRESENTER - appears in certain scenes */}
      <VideoPresenterOverlay 
        visible={presenterVisible}
        position="bottom-left"
        size={220}
      />

      {/* Speech bubble */}
      {presenterVisible && bubbleVisible && (
        <div style={{
          position: 'absolute',
          left: 250,
          bottom: 350,
          zIndex: 60,
        }}>
          <SpeechBubble 
            text={currentScene.text}
            visible={bubbleVisible}
            position="right"
          />
        </div>
      )}

      {/* Bottom bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 6,
        background: `linear-gradient(90deg, #DC2626 ${(frame / durationInFrames) * 100}%, #27272A ${(frame / durationInFrames) * 100}%)`,
      }} />

      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom: 180,
        left: 0,
        right: 120,
        textAlign: 'center',
        color: '#52525B',
        fontSize: 14,
      }}>
        socialhate.com
      </div>
    </AbsoluteFill>
  );
};
