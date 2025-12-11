import React, { useMemo } from 'react';
import { WorkoutLog, ExperienceLevel } from '../types';
import { getVolumeSummary, MuscleVolumeData } from '../services/volumeTracker';
import { TrendingUp, TrendingDown, Minus, Info, ChevronDown, ChevronUp, Target } from 'lucide-react';

interface VolumeTrackingCardProps {
  logs: WorkoutLog[];
  experienceLevel?: string;
  isPro?: boolean;
  onOpenPremium?: () => void;
}

const MUSCLE_EMOJI: { [key: string]: string } = {
  chest: '💪',
  back: '🔙',
  shoulders: '🎯',
  quads: '🦵',
  hamstrings: '🦿',
  glutes: '🍑',
  biceps: '💪',
  triceps: '🦾',
  rear_delts: '🎯',
  calves: '🦶',
  core: '🎽',
  forearms: '🤝',
};

const VolumeBar: React.FC<{ data: MuscleVolumeData }> = ({ data }) => {
  const percent = Math.min(data.percentOfOptimal, 150);

  const getBarColor = () => {
    if (data.status === 'under') return 'bg-yellow-500';
    if (data.status === 'over') return 'bg-red-500';
    return 'bg-green-500';
  };

  const getStatusIcon = () => {
    if (data.status === 'under') return <TrendingDown size={12} className="text-yellow-400" />;
    if (data.status === 'over') return <TrendingUp size={12} className="text-red-400" />;
    return <Minus size={12} className="text-green-400" />;
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-300 flex items-center gap-1.5">
          <span>{MUSCLE_EMOJI[data.muscleId] || '🏋️'}</span>
          {data.muscleNameRu.split(' ')[0]}
        </span>
        <span className="flex items-center gap-1 text-gray-400">
          {getStatusIcon()}
          {data.totalSets}/{data.targetOptimal}
        </span>
      </div>
      <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor()} transition-all duration-500 rounded-full`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
};

const VolumeTrackingCard: React.FC<VolumeTrackingCardProps> = ({
  logs,
  experienceLevel = ExperienceLevel.Intermediate,
  isPro = false,
  onOpenPremium,
}) => {
  const [expanded, setExpanded] = React.useState(false);

  const summary = useMemo(() => {
    return getVolumeSummary(logs, experienceLevel as any);
  }, [logs, experienceLevel]);

  const getOverallStatusText = () => {
    switch (summary.status) {
      case 'excellent':
        return { text: 'Отлично!', color: 'text-green-400', bg: 'bg-green-500/20' };
      case 'good':
        return { text: 'Хорошо', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
      case 'needs_work':
        return { text: 'Нужно больше', color: 'text-orange-400', bg: 'bg-orange-500/20' };
      default:
        return { text: 'Нет данных', color: 'text-gray-400', bg: 'bg-gray-500/20' };
    }
  };

  const statusInfo = getOverallStatusText();

  // Get top 3 muscles needing work
  const musclesNeedingWork = [...summary.primaryMuscles, ...summary.secondaryMuscles]
    .filter(m => m.status === 'under')
    .slice(0, 3);

  if (summary.status === 'no_data') {
    return (
      <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-3 text-gray-300 font-bold text-sm">
          <Target size={16} className="text-indigo-400" />
          Объём по мышцам
        </div>
        <p className="text-gray-500 text-sm">
          Завершите несколько тренировок, чтобы увидеть статистику объёма.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-gray-300 font-bold text-sm">
          <Target size={16} className="text-indigo-400" />
          Объём за неделю
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
          {statusInfo.text}
        </div>
      </div>

      {/* Overall Score Circle */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-16 h-16">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="#262626"
              strokeWidth="6"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke={summary.overallScore >= 80 ? '#22c55e' : summary.overallScore >= 50 ? '#eab308' : '#f97316'}
              strokeWidth="6"
              strokeDasharray={`${(summary.overallScore / 100) * 176} 176`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{summary.overallScore}%</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-400 leading-relaxed">
            {summary.overallScore >= 80
              ? 'Объём тренировок на оптимальном уровне'
              : summary.overallScore >= 50
              ? 'Неплохо! Можно добавить немного объёма'
              : 'Добавь больше подходов для прогресса'}
          </p>
        </div>
      </div>

      {/* Muscles needing work */}
      {musclesNeedingWork.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <div className="flex items-center gap-2 text-yellow-400 text-xs font-medium mb-2">
            <Info size={12} />
            Мышцы, которым нужно больше внимания:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {musclesNeedingWork.map(m => (
              <span
                key={m.muscleId}
                className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-xs"
              >
                {MUSCLE_EMOJI[m.muscleId]} {m.muscleNameRu.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Primary Muscles */}
      <div className="space-y-2.5 mb-4">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Основные группы</p>
        {summary.primaryMuscles.slice(0, expanded ? undefined : 4).map(muscle => (
          <VolumeBar key={muscle.muscleId} data={muscle} />
        ))}
      </div>

      {/* Secondary Muscles (collapsible) */}
      {expanded && (
        <div className="space-y-2.5 mb-4 animate-fade-in">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Вспомогательные</p>
          {summary.secondaryMuscles.map(muscle => (
            <VolumeBar key={muscle.muscleId} data={muscle} />
          ))}
        </div>
      )}

      {/* Expand/Collapse button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-400 transition-colors py-2"
      >
        {expanded ? (
          <>
            <ChevronUp size={14} />
            Свернуть
          </>
        ) : (
          <>
            <ChevronDown size={14} />
            Показать все ({summary.primaryMuscles.length + summary.secondaryMuscles.length})
          </>
        )}
      </button>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-white/5 flex justify-center gap-4 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          Оптимально
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          Мало
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          Много
        </div>
      </div>
    </div>
  );
};

export default VolumeTrackingCard;
