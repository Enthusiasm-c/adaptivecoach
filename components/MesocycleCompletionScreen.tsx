import React from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Dumbbell, Flame, Star, ChevronRight, Calendar, Zap } from 'lucide-react';
import { MesocycleCompletionData } from '../services/mesocycleService';
import { formatKg } from '../utils/progressUtils';
import { hapticFeedback } from '../utils/hapticUtils';

interface MesocycleCompletionScreenProps {
  data: MesocycleCompletionData;
  onStartNewMesocycle: () => void;
}

const MesocycleCompletionScreen: React.FC<MesocycleCompletionScreenProps> = ({
  data,
  onStartNewMesocycle,
}) => {
  const handleStart = () => {
    hapticFeedback.impactOccurred('heavy');
    onStartNewMesocycle();
  };

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    if (trend === 'up') return <TrendingUp size={14} className="text-green-400" />;
    if (trend === 'down') return <TrendingDown size={14} className="text-red-400" />;
    return <Minus size={14} className="text-gray-400" />;
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col animate-fade-in">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="flex flex-col items-center p-6 pt-12">
          {/* Header */}
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-full flex items-center justify-center mb-4">
            <Trophy size={40} className="text-amber-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-1">
            Мезоцикл завершён!
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            {data.mesocycleDurationDays} дней тренировок позади
          </p>

          {/* Stats grid 2x2 */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-6">
            <div className="bg-neutral-900/80 border border-white/5 rounded-2xl p-4 text-center">
              <Dumbbell size={20} className="text-indigo-400 mx-auto mb-2" />
              <p className="text-2xl font-black text-white">{data.totalWorkouts}</p>
              <p className="text-xs text-gray-500 font-bold">тренировок</p>
            </div>
            <div className="bg-neutral-900/80 border border-white/5 rounded-2xl p-4 text-center">
              <Zap size={20} className="text-violet-400 mx-auto mb-2" />
              <p className="text-2xl font-black text-white">{formatKg(data.totalVolumeKg)}</p>
              <p className="text-xs text-gray-500 font-bold">общий объём</p>
            </div>
            <div className="bg-neutral-900/80 border border-white/5 rounded-2xl p-4 text-center">
              <Calendar size={20} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-black text-white">{data.mesocycleDurationDays}</p>
              <p className="text-xs text-gray-500 font-bold">дней</p>
            </div>
            <div className="bg-neutral-900/80 border border-white/5 rounded-2xl p-4 text-center">
              <Flame size={20} className="text-orange-400 mx-auto mb-2" />
              <p className="text-2xl font-black text-white">{data.streakMaintained}</p>
              <p className="text-xs text-gray-500 font-bold">серия</p>
            </div>
          </div>

          {/* Volume growth */}
          {data.volumeGrowthPercent !== 0 && (
            <div className="w-full max-w-sm bg-neutral-900/80 border border-white/5 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Рост объёма</p>
                  <p className="text-lg font-black text-white">
                    {data.volumeGrowthPercent > 0 ? '+' : ''}{data.volumeGrowthPercent}%
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${data.volumeGrowthPercent > 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  {data.volumeGrowthPercent > 0 ? (
                    <TrendingUp size={20} className="text-green-400" />
                  ) : (
                    <TrendingDown size={20} className="text-red-400" />
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Сравнение первых и последних тренировок
              </p>
            </div>
          )}

          {/* New PRs */}
          {data.newPRs.length > 0 && (
            <div className="w-full max-w-sm bg-neutral-900/80 border border-white/5 rounded-2xl p-4 mb-4">
              <p className="text-xs text-gray-500 font-bold uppercase mb-3">Новые рекорды</p>
              <div className="space-y-2">
                {data.newPRs.slice(0, 5).map((pr, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star size={14} className="text-amber-400" fill="currentColor" />
                      <span className="text-sm text-white font-medium">{pr.exerciseName}</span>
                    </div>
                    <span className="text-sm text-amber-400 font-bold">{pr.weight} кг</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weight progression */}
          {data.weightProgression.length > 0 && (
            <div className="w-full max-w-sm bg-neutral-900/80 border border-white/5 rounded-2xl p-4 mb-4">
              <p className="text-xs text-gray-500 font-bold uppercase mb-3">Прогресс весов</p>
              <div className="space-y-3">
                {data.weightProgression.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendIcon trend={entry.trend} />
                      <span className="text-sm text-white font-medium">{entry.exerciseNameRu}</span>
                    </div>
                    <span className={`text-sm font-bold ${entry.changeFromFirst > 0 ? 'text-green-400' : entry.changeFromFirst < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {entry.changeFromFirst > 0 ? '+' : ''}{entry.changeFromFirst} кг
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Level */}
          {data.xpGained > 0 && (
            <div className="w-full max-w-sm bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 rounded-2xl p-4 mb-4">
              <p className="text-xs text-gray-500 font-bold uppercase mb-2">Уровень</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-indigo-300">Lv.{data.levelBefore}</span>
                  <ChevronRight size={16} className="text-gray-500" />
                  <span className="text-2xl font-black text-indigo-400">Lv.{data.levelAfter}</span>
                </div>
                <span className="text-sm text-violet-400 font-bold">+{data.xpGained} XP</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-6 pb-8 bg-gradient-to-t from-black via-black/95 to-transparent safe-area-inset-bottom">
        <button
          onClick={handleStart}
          className="w-full py-4 bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-black text-lg rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-xl shadow-indigo-500/30"
        >
          Начать новый мезоцикл
          <ChevronRight size={24} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};

export default MesocycleCompletionScreen;
