import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const ChannelEvolutionVideo = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const fadeIn = spring({ frame, fps, config: { damping: 100 } });

  // Calculate chart dimensions
  const chartWidth = width * 0.8;
  const chartHeight = 300;
  const chartMargin = 60;

  // Get max value for scaling
  const maxHate = Math.max(...data.analyses.map(a => a.hate_percentage));
  const scale = (chartHeight - 40) / Math.max(maxHate, 50);

  // Animation: draw line progressively
  const lineProgress = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 60 },
  });

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

      {/* Title */}
      <div style={{
        marginBottom: '50px',
        opacity: interpolate(frame, [0, 20], [0, 1]),
      }}>
        <h1 style={{
          fontSize: '40px',
          fontWeight: 900,
          color: 'white',
          margin: 0,
          marginBottom: '8px',
        }}>
          EVOLUCIÓN DEL HATE
        </h1>
        <p style={{
          fontSize: '24px',
          color: '#71717A',
          margin: 0,
          fontWeight: 600,
        }}>
          {data.channel_name}
        </p>
      </div>

      {/* Stats Summary */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginBottom: '40px',
      }}>
        <div style={{
          flex: 1,
          backgroundColor: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '12px',
          padding: '24px',
          opacity: interpolate(frame, [10, 30], [0, 1]),
        }}>
          <div style={{ fontSize: '16px', color: '#71717A', marginBottom: '8px', fontWeight: 600 }}>
            Videos Analizados
          </div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: 'white' }}>
            {data.analyses.length}
          </div>
        </div>

        <div style={{
          flex: 1,
          backgroundColor: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '12px',
          padding: '24px',
          opacity: interpolate(frame, [20, 40], [0, 1]),
        }}>
          <div style={{ fontSize: '16px', color: '#71717A', marginBottom: '8px', fontWeight: 600 }}>
            Hate Promedio
          </div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: '#DC2626' }}>
            {Math.round(data.avg_hate)}%
          </div>
        </div>

        <div style={{
          flex: 1,
          backgroundColor: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '12px',
          padding: '24px',
          opacity: interpolate(frame, [30, 50], [0, 1]),
        }}>
          <div style={{ fontSize: '16px', color: '#71717A', marginBottom: '8px', fontWeight: 600 }}>
            Tendencia
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            fontSize: '48px',
            fontWeight: 900,
            color: data.trend > 0 ? '#DC2626' : data.trend < 0 ? '#10B981' : '#71717A'
          }}>
            {data.trend > 0 ? <TrendingUp size={48} strokeWidth={2.5} /> : 
             data.trend < 0 ? <TrendingDown size={48} strokeWidth={2.5} /> : 
             <Minus size={48} strokeWidth={2.5} />}
            {Math.abs(data.trend)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: interpolate(frame, [40, 60], [0, 1]),
      }}>
        <svg width={chartWidth} height={chartHeight + chartMargin} style={{ overflow: 'visible' }}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((value, i) => {
            const y = chartHeight - (value * scale);
            return (
              <g key={i}>
                <line
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#27272A"
                  strokeWidth={1}
                />
                <text
                  x={-10}
                  y={y + 5}
                  fill="#52525B"
                  fontSize="14"
                  textAnchor="end"
                >
                  {value}%
                </text>
              </g>
            );
          })}

          {/* Line path */}
          <polyline
            points={data.analyses.map((analysis, i) => {
              const x = (i / (data.analyses.length - 1)) * chartWidth;
              const y = chartHeight - (analysis.hate_percentage * scale);
              return `${x},${y}`;
            }).join(' ')}
            fill="none"
            stroke="#DC2626"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${chartWidth * 2}`}
            strokeDashoffset={chartWidth * 2 * (1 - lineProgress)}
          />

          {/* Points */}
          {data.analyses.map((analysis, i) => {
            const x = (i / (data.analyses.length - 1)) * chartWidth;
            const y = chartHeight - (analysis.hate_percentage * scale);
            const pointDelay = i * 8;
            const pointOpacity = interpolate(
              frame - 30,
              [pointDelay, pointDelay + 15],
              [0, 1],
              { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
            );

            return (
              <g key={i} opacity={pointOpacity}>
                <circle
                  cx={x}
                  cy={y}
                  r={8}
                  fill="#DC2626"
                  stroke="#09090B"
                  strokeWidth={3}
                />
                <text
                  x={x}
                  y={chartHeight + 25}
                  fill="#71717A"
                  fontSize="12"
                  textAnchor="middle"
                >
                  V{i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        fontSize: '16px',
        color: '#52525B',
        opacity: interpolate(frame, [120, 140], [0, 1]),
      }}>
        Análisis realizado con IA • socialhate.com
      </div>
    </AbsoluteFill>
  );
};