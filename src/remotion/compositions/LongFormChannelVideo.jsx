import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Sequence, staticFile } from 'remotion';
import { Flame, Clock, Hash, MessageSquare, TrendingUp, TrendingDown, Eye, Trophy } from 'lucide-react';

// 10 minutes = 600s @ 30fps = 18000 frames
const FPS = 30;

// Section timings in seconds
const SECTION_TIMINGS = {
  hook:        { start: 0,    end: 60   },
  context:     { start: 60,   end: 150  },
  numbers:     { start: 150,  end: 270  },
  evolution:   { start: 270,  end: 390  },
  qualitative: { start: 390,  end: 510  },
  comparison:  { start: 510,  end: 570  },
  conclusion:  { start: 570,  end: 590  },
  cta:         { start: 590,  end: 600  },
};

// ====== Devil mascot (reused, simplified) ======
const Devil = ({ size = 360, mood = 'happy', talking = true }) => {
  const frame = useCurrentFrame();
  const bounce = Math.sin(frame * 0.18) * 10;
  const tilt = Math.sin(frame * 0.1) * 3;
  return (
    <div style={{
      width: size, height: size, position: 'relative',
      transform: `translateY(${bounce}px) rotate(${tilt}deg)`,
    }}>
      <img
        src={staticFile('images/devil-mascot.png')}
        alt="devil"
        style={{ width: '100%', height: '100%', objectFit: 'contain',
          filter: 'drop-shadow(0 30px 60px rgba(220,38,38,0.55))' }}
      />
      {talking && (
        <div style={{
          position: 'absolute', bottom: -18, left: '50%',
          transform: 'translateX(-50%)', display: 'flex', gap: 8,
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 14,
              height: 14 + Math.sin(frame * 0.35 + i) * 10,
              backgroundColor: '#DC2626',
              borderRadius: 7,
            }} />
          ))}
        </div>
      )}
    </div>
  );
};

// ====== Animated noise / grain background ======
const Background = ({ tint = '#0a0a0a' }) => {
  const frame = useCurrentFrame();
  const pulse = 0.5 + Math.sin(frame * 0.04) * 0.08;
  return (
    <AbsoluteFill style={{ background: tint }}>
      <AbsoluteFill style={{
        background: `radial-gradient(circle at 30% 40%, rgba(220,38,38,${0.18 * pulse}) 0%, transparent 55%),
                     radial-gradient(circle at 75% 70%, rgba(120,0,0,${0.14 * pulse}) 0%, transparent 55%)`,
      }} />
      {/* scanlines */}
      <AbsoluteFill style={{
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px)',
      }} />
    </AbsoluteFill>
  );
};

// ====== Speech bubble with current devil line ======
const SpeechBubble = ({ text }) => {
  const frame = useCurrentFrame();
  const scale = spring({ frame, fps: FPS, from: 0.85, to: 1, config: { damping: 12 } });
  return (
    <div style={{
      position: 'relative',
      maxWidth: 720,
      background: 'linear-gradient(135deg, #fff, #fee2e2)',
      borderRadius: 28,
      padding: '28px 36px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 0 4px #DC2626',
      transform: `scale(${scale})`,
    }}>
      <div style={{
        fontSize: 38,
        fontWeight: 900,
        color: '#0a0a0a',
        lineHeight: 1.2,
        fontFamily: 'Impact, "Bebas Neue", sans-serif',
        letterSpacing: 0.5,
      }}>
        “{text}”
      </div>
      {/* Tail */}
      <div style={{
        position: 'absolute', left: -28, bottom: 36,
        width: 0, height: 0,
        borderTop: '20px solid transparent',
        borderBottom: '20px solid transparent',
        borderRight: '34px solid #DC2626',
      }} />
    </div>
  );
};

// ====== Section header (top of every sequence) ======
const SectionHeader = ({ index, total, name, headline, startTime, endTime }) => {
  const frame = useCurrentFrame();
  const slide = spring({ frame, fps: FPS, from: -200, to: 0, config: { damping: 14 } });
  return (
    <div style={{
      position: 'absolute', top: 50, left: 50, right: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      transform: `translateY(${slide}px)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{
          background: '#DC2626', color: 'white',
          padding: '14px 26px', borderRadius: 16,
          fontSize: 28, fontWeight: 900,
          fontFamily: 'Impact, "Bebas Neue", sans-serif',
          letterSpacing: 2,
        }}>
          PARTE {index}/{total}
        </div>
        <div>
          <div style={{
            color: '#fca5a5', fontSize: 22,
            fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase',
          }}>{name}</div>
          <div style={{
            color: 'white', fontSize: 56, fontWeight: 900,
            fontFamily: 'Impact, "Bebas Neue", sans-serif',
            letterSpacing: 1, lineHeight: 1,
          }}>{headline}</div>
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(0,0,0,0.5)', border: '2px solid #DC2626',
        padding: '12px 22px', borderRadius: 14,
        color: 'white', fontFamily: 'monospace', fontSize: 28, fontWeight: 800,
      }}>
        <Clock size={26} color="#DC2626" />
        {startTime} - {endTime}
      </div>
    </div>
  );
};

// ====== Bullets overlay ======
const Bullets = ({ items = [] }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {items.map((item, i) => {
        const appear = spring({ frame: frame - i * 12, fps: FPS, from: 0, to: 1, config: { damping: 14 } });
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 18,
            background: 'rgba(220,38,38,0.12)',
            border: '2px solid rgba(220,38,38,0.5)',
            padding: '16px 22px', borderRadius: 14,
            opacity: appear, transform: `translateX(${(1 - appear) * -30}px)`,
            maxWidth: 760,
          }}>
            <Flame size={28} color="#DC2626" />
            <span style={{ color: 'white', fontSize: 26, fontWeight: 600, lineHeight: 1.3 }}>
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ====== Big stat tile ======
const StatTile = ({ label, value, color = '#DC2626', icon: Icon = Hash }) => (
  <div style={{
    background: 'rgba(0,0,0,0.55)',
    border: `3px solid ${color}`,
    borderRadius: 22,
    padding: '28px 36px',
    minWidth: 240,
    textAlign: 'center',
    boxShadow: `0 0 40px ${color}55`,
  }}>
    <Icon size={32} color={color} style={{ marginBottom: 10 }} />
    <div style={{
      fontSize: 76, fontWeight: 900, color, lineHeight: 1,
      fontFamily: 'Impact, "Bebas Neue", sans-serif',
    }}>{value}</div>
    <div style={{ color: '#a1a1aa', fontSize: 18, marginTop: 8, letterSpacing: 2, textTransform: 'uppercase' }}>
      {label}
    </div>
  </div>
);

// ====== Master section renderer ======
const SectionScene = ({ section, index, total, channel, stats, accent = '#DC2626' }) => {
  const frame = useCurrentFrame();
  const sectionDuration = (section.duration_seconds || 60) * FPS;

  // Devil cycles through devil_lines
  const lines = section.devil_lines && section.devil_lines.length > 0
    ? section.devil_lines
    : [section.headline || section.name];
  const lineDuration = sectionDuration / lines.length;
  const currentLineIdx = Math.min(Math.floor(frame / lineDuration), lines.length - 1);
  const currentLine = lines[currentLineIdx];

  const tint = '#0a0a0a';

  return (
    <AbsoluteFill>
      <Background tint={tint} />

      <SectionHeader
        index={index}
        total={total}
        name={section.name || section.id}
        headline={section.headline || ''}
        startTime={section.start_time || ''}
        endTime={section.end_time || ''}
      />

      {/* Devil + speech bubble (left/center) */}
      <div style={{
        position: 'absolute',
        bottom: 80, left: 80,
        display: 'flex', alignItems: 'flex-end', gap: 30,
      }}>
        <Devil size={380} talking={true} />
        {currentLine && (
          <div style={{ marginBottom: 80 }}>
            <SpeechBubble key={currentLineIdx} text={currentLine} />
          </div>
        )}
      </div>

      {/* Bullets right side */}
      <div style={{ position: 'absolute', top: 220, right: 80, width: 800 }}>
        <Bullets items={section.bullets || []} />
      </div>

      {/* Special overlays per section */}
      {section.id === 'numbers' && (
        <div style={{
          position: 'absolute', top: 440, right: 80,
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <div style={{ display: 'flex', gap: 18 }}>
            <StatTile label="Hate medio" value={`${stats?.avg_hate_pct ?? 0}%`} color="#DC2626" icon={Flame} />
            <StatTile label="Vídeos" value={stats?.total_videos ?? 0} color="#fbbf24" icon={Eye} />
          </div>
          <div style={{ display: 'flex', gap: 18 }}>
            <StatTile label="Comentarios" value={(stats?.total_comments || 0).toLocaleString()} color="#a78bfa" icon={MessageSquare} />
            <StatTile label="Pico hate" value={`${stats?.max_hate_pct ?? 0}%`} color="#ef4444" icon={TrendingUp} />
          </div>
        </div>
      )}

      {section.id === 'evolution' && (
        <div style={{
          position: 'absolute', top: 460, right: 80,
          background: 'rgba(0,0,0,0.6)', border: '3px solid #fbbf24',
          padding: '30px 40px', borderRadius: 22, color: 'white',
          minWidth: 540,
        }}>
          <div style={{ color: '#fbbf24', fontSize: 22, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>
            TENDENCIA
          </div>
          <div style={{
            fontSize: 96, fontWeight: 900, lineHeight: 1,
            color: (stats?.trend_delta || 0) >= 0 ? '#ef4444' : '#10b981',
            fontFamily: 'Impact, "Bebas Neue", sans-serif',
            display: 'flex', alignItems: 'center', gap: 14, marginTop: 8,
          }}>
            {(stats?.trend_delta || 0) >= 0 ? <TrendingUp size={70} /> : <TrendingDown size={70} />}
            {(stats?.trend_delta || 0) >= 0 ? '+' : ''}{stats?.trend_delta ?? 0}%
          </div>
          <div style={{ color: '#a1a1aa', fontSize: 20, marginTop: 6 }}>
            recientes vs primeros vídeos
          </div>
        </div>
      )}

      {section.id === 'qualitative' && stats?.top_hate_videos?.length > 0 && (
        <div style={{
          position: 'absolute', top: 480, right: 80,
          width: 760, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ color: '#fca5a5', fontSize: 22, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>
            VÍDEO MÁS HATEADO
          </div>
          <div style={{
            background: 'rgba(0,0,0,0.6)', border: '2px solid #DC2626',
            padding: '20px 24px', borderRadius: 18, color: 'white',
          }}>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
              {stats.top_hate_videos[0].title}
            </div>
            <div style={{ color: '#DC2626', fontSize: 38, fontWeight: 900, fontFamily: 'Impact' }}>
              {stats.top_hate_videos[0].hate}% hate
            </div>
          </div>
        </div>
      )}

      {section.id === 'comparison' && (
        <div style={{
          position: 'absolute', top: 460, right: 80,
          display: 'flex', gap: 24,
        }}>
          <StatTile label={channel?.name || 'Este canal'} value={`${stats?.avg_hate_pct ?? 0}%`} color="#DC2626" icon={Flame} />
          <div style={{ alignSelf: 'center', color: 'white', fontSize: 56, fontWeight: 900 }}>VS</div>
          <StatTile label="Media España" value="9.2%" color="#10b981" icon={Hash} />
        </div>
      )}

      {section.id === 'cta' && (
        <div style={{
          position: 'absolute', bottom: 80, right: 80,
          background: 'linear-gradient(135deg, #DC2626, #7f1d1d)',
          padding: '32px 48px', borderRadius: 24,
          color: 'white', fontFamily: 'Impact, "Bebas Neue", sans-serif',
          fontSize: 56, fontWeight: 900, letterSpacing: 2,
          boxShadow: '0 30px 80px rgba(220,38,38,0.6)',
        }}>
          ¿QUÉ CANAL CAE LA PRÓXIMA?
        </div>
      )}
    </AbsoluteFill>
  );
};

// ====== Master video ======
export const LongFormChannelVideo = ({ data }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  if (!data || !data.sections || data.sections.length === 0) {
    return (
      <AbsoluteFill style={{ background: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <Flame size={120} color="#DC2626" />
        <div style={{ color: 'white', fontSize: 48, fontWeight: 900, marginTop: 30 }}>
          Genera el guión para previsualizar
        </div>
      </AbsoluteFill>
    );
  }

  const sections = data.sections;
  const total = sections.length;

  // Global progress bar
  const progress = Math.min(frame / durationInFrames, 1);
  const totalSeconds = Math.floor(frame / fps);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {sections.map((section, idx) => {
        const t = SECTION_TIMINGS[section.id] || { start: idx * 60, end: (idx + 1) * 60 };
        const from = t.start * fps;
        const dur = (t.end - t.start) * fps;
        return (
          <Sequence key={section.id || idx} from={from} durationInFrames={dur}>
            <SectionScene
              section={{ ...section, duration_seconds: t.end - t.start }}
              index={idx + 1}
              total={total}
              channel={data.channel}
              stats={data.stats}
            />
          </Sequence>
        );
      })}

      {/* Title overlay always visible (bottom center) */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)', border: '1px solid #444',
        padding: '8px 18px', borderRadius: 10,
        color: '#fff', fontSize: 18, fontFamily: 'monospace', fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <span style={{ color: '#DC2626' }}>● REC</span>
        <span>{mm}:{ss} / 10:00</span>
        <span style={{ color: '#a1a1aa' }}>{data.channel?.name}</span>
      </div>

      {/* Global progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 6, background: 'rgba(255,255,255,0.08)',
      }}>
        <div style={{
          width: `${progress * 100}%`, height: '100%',
          background: 'linear-gradient(90deg, #DC2626, #fbbf24)',
        }} />
      </div>
    </AbsoluteFill>
  );
};

export default LongFormChannelVideo;
