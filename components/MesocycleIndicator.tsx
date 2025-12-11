import React from 'react';
import { Calendar, TrendingUp, Zap, Coffee, RefreshCw, Info } from 'lucide-react';
import { MesocycleState, getMesocycleSummary, PHASE_DESCRIPTIONS } from '../services/mesocycleService';
import { MesocyclePhase } from '../types/training';

interface MesocycleIndicatorProps {
  mesocycleState: MesocycleState | null;
  compact?: boolean;
}

const PHASE_ICONS: { [key in MesocyclePhase]: React.ReactNode } = {
  intro: <RefreshCw size={14} className="text-blue-400" />,
  accumulation: <TrendingUp size={14} className="text-green-400" />,
  overreaching: <Zap size={14} className="text-orange-400" />,
  deload: <Coffee size={14} className="text-purple-400" />,
};

const PHASE_COLORS: { [key in MesocyclePhase]: string } = {
  intro: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
  accumulation: 'bg-green-500/20 border-green-500/30 text-green-400',
  overreaching: 'bg-orange-500/20 border-orange-500/30 text-orange-400',
  deload: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
};

const PHASE_PROGRESS_COLORS: { [key in MesocyclePhase]: string } = {
  intro: 'bg-blue-500',
  accumulation: 'bg-green-500',
  overreaching: 'bg-orange-500',
  deload: 'bg-purple-500',
};

const MesocycleIndicator: React.FC<MesocycleIndicatorProps> = ({ mesocycleState, compact = false }) => {
  // Handle null state
  if (!mesocycleState) {
    return null;
  }

  const summary = getMesocycleSummary(mesocycleState);
  const { weekNumber, totalWeeks, phase, phaseInfo, progressPercent, isDeloadWeek, volumeMultiplier } = summary;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${PHASE_COLORS[phase]}`}>
        {PHASE_ICONS[phase]}
        <span className="text-xs font-medium">
          {phaseInfo.title} · {weekNumber}/{totalWeeks}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Мезоцикл</span>
        </div>
        <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border ${PHASE_COLORS[phase]}`}>
          {PHASE_ICONS[phase]}
          <span className="text-xs font-medium">{phaseInfo.title}</span>
        </div>
      </div>

      {/* Week Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Неделя {weekNumber} из {totalWeeks}</span>
          <span>{Math.round(volumeMultiplier * 100)}% объёма</span>
        </div>

        {/* Progress Bar with Week Indicators */}
        <div className="relative h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 ${PHASE_PROGRESS_COLORS[phase]} transition-all duration-500`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Week Dots */}
        <div className="flex justify-between gap-1 px-0.5">
          {Array.from({ length: totalWeeks }, (_, i) => {
            const weekNum = i + 1;
            const weekPhase = getPhaseForWeekNum(weekNum);
            const isCurrentWeek = weekNum === weekNumber;
            const isPastWeek = weekNum < weekNumber;

            return (
              <div
                key={weekNum}
                className={`flex-1 h-1 rounded-full transition-all ${
                  isCurrentWeek
                    ? PHASE_PROGRESS_COLORS[weekPhase]
                    : isPastWeek
                    ? `${PHASE_PROGRESS_COLORS[weekPhase]} opacity-50`
                    : 'bg-neutral-700'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Phase Description */}
      <div className="flex items-start gap-2 p-2.5 bg-black/30 rounded-xl">
        <Info size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-400 leading-relaxed">{phaseInfo.description}</p>
      </div>

      {/* Deload Countdown */}
      {!isDeloadWeek && summary.daysUntilDeload > 0 && summary.daysUntilDeload <= 14 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">До разгрузки</span>
          <span className="text-purple-400 font-medium">{summary.daysUntilDeload} дней</span>
        </div>
      )}

      {/* Special Deload Banner */}
      {isDeloadWeek && (
        <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <Coffee size={18} className="text-purple-400" />
          <div>
            <p className="text-sm font-medium text-purple-300">Неделя восстановления</p>
            <p className="text-xs text-purple-400/70">Сниженный объём для суперкомпенсации</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to get phase for a specific week number
function getPhaseForWeekNum(weekNum: number): MesocyclePhase {
  if (weekNum === 1) return 'intro';
  if (weekNum <= 3) return 'accumulation';
  if (weekNum <= 5) return 'overreaching';
  return 'deload';
}

export default MesocycleIndicator;
