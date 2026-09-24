import { Skull, Shield, AlertTriangle, Flame } from "lucide-react";

export const HateLegend = ({ className = "", compact = false }) => {
  if (compact) {
    return (
      <div className={`flex items-center gap-4 text-xs ${className}`}>
        <div className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-green-500" />
          <span className="text-green-500">0-3%</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          <span className="text-amber-500">3-15%</span>
        </div>
        <div className="flex items-center gap-1">
          <Flame className="w-3 h-3 text-red-500" />
          <span className="text-red-500">+15%</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 ${className}`}>
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 font-medium">Escala de Hate</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex items-center gap-2 px-2 py-2 rounded bg-green-500/10 border border-green-500/30">
          <Shield className="w-4 h-4 text-green-500 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-green-500 font-bold text-xs">Low</span>
            <span className="text-green-400/70 text-xs">0-3%</span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 py-2 rounded bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-amber-500 font-bold text-xs">Moderate</span>
            <span className="text-amber-400/70 text-xs">3-15%</span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 py-2 rounded bg-red-500/10 border border-red-500/30">
          <Flame className="w-4 h-4 text-red-500 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-red-500 font-bold text-xs">High</span>
            <span className="text-red-400/70 text-xs">+15%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const HateBadge = ({ percentage }) => {
  const level = percentage <= 3 ? 'low' : percentage <= 15 ? 'moderate' : 'high';
  
  const config = {
    low: {
      icon: Shield,
      label: 'Low',
      bgClass: 'bg-green-500/20 border-green-500/50',
      textClass: 'text-green-500'
    },
    moderate: {
      icon: AlertTriangle,
      label: 'Moderate', 
      bgClass: 'bg-amber-500/20 border-amber-500/50',
      textClass: 'text-amber-500'
    },
    high: {
      icon: Flame,
      label: 'High',
      bgClass: 'bg-red-500/20 border-red-500/50',
      textClass: 'text-red-500'
    }
  };

  const { icon: Icon, label, bgClass, textClass } = config[level];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${bgClass}`}>
      <Icon className={`w-3.5 h-3.5 ${textClass}`} />
      <span className={`text-xs font-bold ${textClass}`}>{label}</span>
      <span className={`text-xs font-mono ${textClass}`}>{percentage.toFixed(1)}%</span>
    </div>
  );
};

export default HateLegend;
