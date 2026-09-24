import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Sequence } from 'remotion';
import { Flame, TrendingUp, Eye, MessageSquare } from 'lucide-react';

// ============================================
// STYLE 1: SCROLL CLÁSICO (9:16 Vertical)
// ============================================
export const HateRankingScroll = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scrollProgress = interpolate(frame, [60, 840], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090B', fontFamily: 'Inter, sans-serif' }}>
      {/* Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.05,
        backgroundImage: 'radial-gradient(circle, #DC2626 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }} />

      {/* Header */}
      <div style={{
        padding: '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Flame color="#DC2626" size={36} strokeWidth={2.5} />
          <div style={{ fontSize: '28px', fontWeight: 900, color: 'white' }}>
            SOCIAL<span style={{ color: '#DC2626' }}>HATE</span>
          </div>
        </div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#DC2626' }}>
          TOP 10 HATE RANKING
        </div>
      </div>

      {/* Scrolling List */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        padding: '0 20px',
      }}>
        <div style={{
          transform: `translateY(${-scrollProgress * 1200}px)`,
        }}>
          {data.slice(0, 10).map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '16px',
              marginBottom: '12px',
              backgroundColor: i === 0 ? '#DC262620' : '#18181B',
              borderRadius: '16px',
              border: i === 0 ? '2px solid #DC2626' : '1px solid #27272A',
            }}>
              {/* Top Row: Rank + Thumbnail */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                {/* Rank */}
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '10px',
                  backgroundColor: i === 0 ? '#DC2626' : '#27272A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 900,
                  color: 'white',
                  flexShrink: 0,
                }}>
                  #{i + 1}
                </div>

                {/* Thumbnail - 16:9 */}
                <div style={{
                  flex: 1,
                  aspectRatio: '16/9',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: '#27272A',
                }}>
                  {item.thumbnail_url && (
                    <img src={item.thumbnail_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>

                {/* Hate % */}
                <div style={{
                  fontSize: '32px',
                  fontWeight: 900,
                  color: '#DC2626',
                  flexShrink: 0,
                }}>
                  {Math.round(item.hate_percentage || 0)}%
                </div>
              </div>

              {/* Bottom Row: Info */}
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
                  {item.video_title?.substring(0, 45)}...
                </div>
                <div style={{ fontSize: '12px', color: '#71717A' }}>
                  {item.channel_name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '20px', textAlign: 'center', color: '#52525B', fontSize: '14px' }}>
        socialhate.com
      </div>
    </AbsoluteFill>
  );
};


// ============================================
// STYLE 2: CUENTA ATRÁS NBA (9:16 Vertical)
// ============================================
export const HateRankingNBA = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Each reveal takes ~85 frames (2.8 seconds), starting from #10
  const getRevealFrame = (rank) => (10 - rank) * 85 + 30;

  // Current number being revealed
  const getCurrentRank = () => {
    for (let i = 10; i >= 1; i--) {
      if (frame >= getRevealFrame(i) && frame < getRevealFrame(i) + 85) {
        return i;
      }
    }
    return frame < getRevealFrame(10) ? null : 1;
  };

  const currentRank = getCurrentRank();
  const currentItem = currentRank ? data[10 - currentRank] : null;

  // Animation progress for current item
  const revealFrame = currentRank ? getRevealFrame(currentRank) : 0;
  const localFrame = frame - revealFrame;

  const numberScale = spring({ frame: localFrame, fps, config: { damping: 8, stiffness: 100 } });
  const contentOpacity = interpolate(localFrame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const slideIn = interpolate(localFrame, [15, 40], [150, 0], { extrapolateRight: 'clamp' });

  // Countdown effect
  const countdownNumber = currentRank || 10;
  const pulseScale = 1 + Math.sin(frame * 0.3) * 0.05;

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090B', fontFamily: 'Inter, sans-serif' }}>
      {/* Animated Background Gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 40%, #DC262620 0%, transparent 60%)`,
        opacity: 0.8,
      }} />

      {/* Spotlight Effect */}
      <div style={{
        position: 'absolute',
        top: '25%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, #DC262615 0%, transparent 70%)',
        borderRadius: '50%',
      }} />

      {/* Header */}
      <div style={{
        position: 'absolute',
        top: '40px',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
      }}>
        <Flame color="#DC2626" size={32} />
        <span style={{ fontSize: '22px', fontWeight: 900, color: 'white' }}>
          TOP 10 <span style={{ color: '#DC2626' }}>HATE</span> RANKING
        </span>
      </div>

      {/* Big Number */}
      <div style={{
        position: 'absolute',
        top: '38%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${numberScale * pulseScale})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Number */}
        <div style={{
          fontSize: currentRank === 1 ? '280px' : '220px',
          fontWeight: 900,
          color: currentRank === 1 ? '#DC2626' : 'white',
          lineHeight: 0.8,
          textShadow: currentRank === 1 ? '0 0 80px #DC262680' : '0 0 50px rgba(255,255,255,0.3)',
        }}>
          {countdownNumber}
        </div>

        {/* Position label */}
        {currentRank && (
          <div style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#DC2626',
            marginTop: '10px',
            opacity: contentOpacity,
          }}>
            {currentRank === 1 ? '🏆 #1 MOST HATED' : `#${currentRank}`}
          </div>
        )}
      </div>

      {/* Video Info Card */}
      {currentItem && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          left: '50%',
          transform: `translateX(-50%) translateY(${slideIn}px)`,
          opacity: contentOpacity,
          width: '90%',
          maxWidth: '400px',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            backgroundColor: '#18181B',
            padding: '20px',
            borderRadius: '20px',
            border: currentRank === 1 ? '3px solid #DC2626' : '1px solid #27272A',
            boxShadow: currentRank === 1 ? '0 0 40px #DC262640' : 'none',
          }}>
            {/* Thumbnail - 16:9 */}
            <div style={{
              width: '100%',
              aspectRatio: '16/9',
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: '#27272A',
            }}>
              {currentItem.thumbnail_url && (
                <img src={currentItem.thumbnail_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>

            {/* Info */}
            <div style={{ textAlign: 'center', width: '100%' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>
                {currentItem.video_title?.substring(0, 40)}...
              </div>
              <div style={{ fontSize: '14px', color: '#71717A', marginBottom: '10px' }}>
                {currentItem.channel_name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#71717A' }}>
                  <Eye size={14} />
                  <span style={{ fontSize: '12px' }}>{(currentItem.view_count || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#71717A' }}>
                  <MessageSquare size={14} />
                  <span style={{ fontSize: '12px' }}>{currentItem.comment_count || 0}</span>
                </div>
              </div>
            </div>

            {/* Hate % */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '48px',
                fontWeight: 900,
                color: '#DC2626',
                lineHeight: 1,
              }}>
                {Math.round(currentItem.hate_percentage || 0)}%
              </div>
              <div style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>HATE</div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#3F3F46',
        fontSize: '12px',
      }}>
        socialhate.com
      </div>
    </AbsoluteFill>
  );
};


// ============================================
// STYLE 3: INFERNO MODE - Fuego y explosiones (9:16 Vertical)
// ============================================
export const HateRankingInferno = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // TikTok safe zone margins (buttons on right, text at bottom)
  const SAFE_MARGIN_RIGHT = 120;
  const SAFE_MARGIN_BOTTOM = 180;
  const SAFE_MARGIN_SIDES = 40;

  // Fire particles animation
  const particles = Array.from({ length: 25 }, (_, i) => ({
    x: Math.sin(i * 0.5 + frame * 0.02) * 350 + 540,
    y: 1920 - ((frame * 4 + i * 60) % 2200),
    size: 10 + Math.random() * 20,
    opacity: Math.max(0, 1 - ((frame * 4 + i * 60) % 2200) / 2200),
  }));

  // Each video gets 90 frames (3 seconds) - countdown from 10 to 1
  const videoDuration = 90;
  const currentIndex = Math.min(Math.floor(frame / videoDuration), 9);
  const localFrame = frame % videoDuration;

  // Countdown from 10 to 1 (index 0 = rank 10, index 9 = rank 1)
  const currentRank = 10 - currentIndex;
  const currentItem = data[currentIndex];

  // Animation phases:
  // 0-25: Number appears big
  // 25-40: Number shrinks/fades, card starts appearing
  // 40-90: Card fully visible, number gone
  
  const numberScale = localFrame < 25 
    ? spring({ frame: localFrame, fps, config: { damping: 8, stiffness: 100 } })
    : interpolate(localFrame, [25, 40], [1, 0], { extrapolateRight: 'clamp' });
  
  const numberOpacity = interpolate(localFrame, [25, 40], [1, 0], { extrapolateRight: 'clamp' });
  
  const cardOpacity = interpolate(localFrame, [20, 35], [0, 1], { extrapolateRight: 'clamp' });
  const cardSlide = interpolate(localFrame, [20, 40], [200, 0], { extrapolateRight: 'clamp' });

  // Shake effect on number reveal
  const shakeX = localFrame < 15 ? Math.sin(localFrame * 0.8) * 6 : 0;
  const shakeY = localFrame < 15 ? Math.cos(localFrame * 1.1) * 4 : 0;

  // Flame wave animation
  const flameWave = Math.sin(frame * 0.1) * 15;

  return (
    <AbsoluteFill style={{ 
      backgroundColor: '#0A0A0A', 
      fontFamily: 'Inter, sans-serif',
      overflow: 'hidden',
      transform: `translate(${shakeX}px, ${shakeY}px)`,
    }}>
      {/* Animated Fire Background */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '70%',
        background: `linear-gradient(to top, 
          #DC2626 0%, 
          #F97316 ${30 + flameWave}%, 
          #FBBF24 ${60 + flameWave}%, 
          transparent 100%)`,
        opacity: 0.15,
        filter: 'blur(60px)',
      }} />

      {/* Fire Particles */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: p.x,
          top: p.y,
          width: p.size,
          height: p.size * 1.5,
          background: `radial-gradient(ellipse, #F97316 0%, #DC2626 50%, transparent 100%)`,
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          opacity: p.opacity * 0.6,
          filter: 'blur(2px)',
        }} />
      ))}

      {/* Glowing Orb */}
      <div style={{
        position: 'absolute',
        top: '35%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${1 + Math.sin(frame * 0.05) * 0.1})`,
        width: '700px',
        height: '700px',
        background: 'radial-gradient(circle, #DC262650 0%, #F9731630 30%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(50px)',
      }} />

      {/* Header with Fire Effect - Safe zone top */}
      <div style={{
        position: 'absolute',
        top: '80px',
        left: SAFE_MARGIN_SIDES,
        right: SAFE_MARGIN_SIDES + SAFE_MARGIN_RIGHT,
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 32px',
          background: 'linear-gradient(90deg, transparent, #DC262630, transparent)',
          borderRadius: '100px',
        }}>
          <Flame 
            color="#F97316" 
            size={36} 
            style={{ 
              filter: 'drop-shadow(0 0 20px #F97316)',
              transform: `rotate(${Math.sin(frame * 0.1) * 8}deg)`,
            }} 
          />
          <span style={{ 
            fontSize: '32px', 
            fontWeight: 900, 
            background: 'linear-gradient(90deg, #F97316, #DC2626, #F97316)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            INFERNO RANKING
          </span>
          <Flame 
            color="#F97316" 
            size={36} 
            style={{ 
              filter: 'drop-shadow(0 0 20px #F97316)',
              transform: `rotate(${-Math.sin(frame * 0.1) * 8}deg) scaleX(-1)`,
            }} 
          />
        </div>
      </div>

      {/* Big Number - appears first then fades */}
      {numberOpacity > 0 && (
        <div style={{
          position: 'absolute',
          top: '42%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${numberScale})`,
          opacity: numberOpacity,
          marginRight: SAFE_MARGIN_RIGHT / 2,
        }}>
          <div style={{
            fontSize: currentRank === 1 ? '400px' : '340px',
            fontWeight: 900,
            color: currentRank === 1 ? '#FBBF24' : '#DC2626',
            textShadow: `
              0 0 100px ${currentRank === 1 ? '#FBBF24' : '#DC2626'},
              0 0 200px ${currentRank === 1 ? '#F97316' : '#DC262680'}
            `,
            lineHeight: 0.8,
          }}>
            {currentRank}
          </div>
        </div>
      )}

      {/* Video Card - appears after number fades - Full width with safe margins */}
      {currentItem && cardOpacity > 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: SAFE_MARGIN_SIDES,
          right: SAFE_MARGIN_SIDES + SAFE_MARGIN_RIGHT,
          transform: `translateY(-50%) translateY(${cardSlide}px)`,
          opacity: cardOpacity,
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)',
            padding: '30px 24px',
            borderRadius: '24px',
            border: currentRank === 1 ? '4px solid #FBBF24' : '3px solid #DC262660',
            boxShadow: `
              0 0 80px ${currentRank === 1 ? '#FBBF2450' : '#DC262630'},
              0 20px 60px rgba(0,0,0,0.7)
            `,
          }}>
            {/* Rank badge - Bigger */}
            <div style={{
              position: 'absolute',
              top: '-28px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: currentRank === 1 
                ? 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)' 
                : 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
              padding: '10px 32px',
              borderRadius: '20px',
              fontSize: '28px',
              fontWeight: 900,
              color: 'white',
              boxShadow: `0 6px 25px ${currentRank === 1 ? '#FBBF2480' : '#DC262680'}`,
            }}>
              {currentRank === 1 ? '🏆 #1' : `#${currentRank}`}
            </div>

            {/* Thumbnail - 16:9 aspect ratio, full width */}
            <div style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16/9',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 0 40px #DC262650',
              marginTop: '24px',
            }}>
              {currentItem.thumbnail_url && (
                <img src={currentItem.thumbnail_url} style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover' 
                }} />
              )}
              {/* Fire overlay on thumbnail */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'linear-gradient(to top, #DC262690, transparent)',
              }} />
            </div>

            {/* Hate % - Big and prominent */}
            <div style={{
              marginTop: '24px',
              padding: '16px 50px',
              background: 'linear-gradient(135deg, #DC262620 0%, #F9731620 100%)',
              borderRadius: '16px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '80px',
                fontWeight: 900,
                background: 'linear-gradient(180deg, #FBBF24 0%, #F97316 50%, #DC2626 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1,
                filter: 'drop-shadow(0 0 20px #F97316)',
              }}>
                {Math.round(currentItem.hate_percentage || 0)}%
              </div>
              <div style={{ 
                fontSize: '16px', 
                color: '#F97316', 
                fontWeight: 700,
                marginTop: '4px',
                letterSpacing: '3px',
              }}>
                🔥 HATE 🔥
              </div>
            </div>

            {/* Info - Bigger text */}
            <div style={{ textAlign: 'center', width: '100%', marginTop: '20px' }}>
              <div style={{ 
                fontSize: '26px', 
                fontWeight: 800, 
                color: 'white', 
                marginBottom: '10px',
                lineHeight: 1.2,
                padding: '0 10px',
              }}>
                {currentItem.video_title?.substring(0, 45)}...
              </div>
              <div style={{ 
                fontSize: '20px', 
                color: '#F97316', 
                fontWeight: 600,
                marginBottom: '14px',
              }}>
                {currentItem.channel_name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#A1A1AA' }}>
                  <Eye size={20} />
                  <span style={{ fontWeight: 600, fontSize: '18px' }}>{(currentItem.view_count || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#A1A1AA' }}>
                  <MessageSquare size={20} />
                  <span style={{ fontWeight: 600, fontSize: '18px' }}>{currentItem.comment_count || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Fire Bar - Above safe zone */}
      <div style={{
        position: 'absolute',
        bottom: SAFE_MARGIN_BOTTOM,
        left: 0,
        right: 0,
        height: '6px',
        background: `linear-gradient(90deg, 
          #DC2626 ${frame % 100}%, 
          #F97316 ${(frame + 30) % 100}%, 
          #FBBF24 ${(frame + 60) % 100}%,
          #DC2626 100%)`,
        boxShadow: '0 0 30px #DC2626',
      }} />

      {/* Footer - In safe zone but visible */}
      <div style={{
        position: 'absolute',
        bottom: SAFE_MARGIN_BOTTOM + 20,
        left: SAFE_MARGIN_SIDES,
        right: SAFE_MARGIN_SIDES + SAFE_MARGIN_RIGHT,
        textAlign: 'center',
        color: '#52525B',
        fontSize: '14px',
      }}>
        socialhate.com
      </div>
    </AbsoluteFill>
  );
};


// Default export for backward compatibility
export const HateRankingVideo = HateRankingScroll;
