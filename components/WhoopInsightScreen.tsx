import React from 'react';
import { WhoopReadinessData, WorkoutSession } from '../types';
import { WhoopInsight, getInsightColors, needsAdaptation } from '../services/whoopInsights';
import { X, Activity, Moon, Heart, Check, ChevronRight } from 'lucide-react';

interface WhoopInsightScreenProps {
  whoopData: WhoopReadinessData;
  originalSession: WorkoutSession;
  adaptedSession: WorkoutSession;
  insight: WhoopInsight;
  onStartAdapted: () => void;
  onStartOriginal: () => void;
  onCancel: () => void;
}

const WhoopInsightScreen: React.FC<WhoopInsightScreenProps> = ({
  whoopData,
  originalSession,
  adaptedSession,
  insight,
  onStartAdapted,
  onStartOriginal,
  onCancel
}) => {
  const colors = getInsightColors(insight.type);
  const hasAdaptations = insight.adaptations.length > 0;
  const showOriginalOption = needsAdaptation(whoopData);

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-neutral-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
              <Activity size={20} className="text-green-400" />
            </div>
            <div>
              <p className="text-green-400 text-xs font-bold uppercase tracking-wider">WHOOP</p>
              <p className="text-gray-400 text-sm">Синхронизировано</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 bg-neutral-800 rounded-full text-gray-400 hover:text-white transition"
          >
            <X size={20}/>
          </button>
        </div>

        {/* Main Insight */}
        <div className="p-6">
          <div className={`rounded-2xl p-5 border ${colors.bg} ${colors.border}`}>
            {/* Icon + Title */}
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">{insight.icon}</div>
              <h2 className={`text-xl font-bold ${colors.text}`}>{insight.title}</h2>
              {insight.subtitle && (
                <p className="text-gray-400 text-sm mt-1">{insight.subtitle}</p>
              )}
            </div>

            {/* WHOOP Metrics */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-black/30 rounded-xl p-3 text-center">
                <Activity size={16} className="text-green-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-white">{whoopData.recoveryScore}%</div>
                <div className="text-[10px] text-gray-500 uppercase">Recovery</div>
              </div>
              <div className="bg-black/30 rounded-xl p-3 text-center">
                <Moon size={16} className="text-indigo-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-white">{whoopData.sleepHours.toFixed(1)}ч</div>
                <div className="text-[10px] text-gray-500 uppercase">Сон</div>
              </div>
              <div className="bg-black/30 rounded-xl p-3 text-center">
                <Heart size={16} className="text-red-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-white">{whoopData.hrv}</div>
                <div className="text-[10px] text-gray-500 uppercase">HRV</div>
              </div>
            </div>
          </div>

          {/* Adaptations Made */}
          {hasAdaptations && (
            <div className="mt-4 bg-neutral-800/50 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Check size={16} className="text-green-400" />
                <span className="text-white font-medium text-sm">Адаптировал тренировку:</span>
              </div>
              <ul className="space-y-2">
                {insight.adaptations.map((adaptation, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-gray-400 text-sm">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    {adaptation}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Workout Info */}
          <div className="mt-4 bg-neutral-800/30 rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{adaptedSession.name}</p>
                <p className="text-gray-500 text-sm">
                  {adaptedSession.exercises.filter(e => !e.isWarmup).length} упражнений
                </p>
              </div>
              <ChevronRight size={20} className="text-gray-500" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-0 space-y-3">
          {/* Primary: Start Adapted */}
          <button
            onClick={onStartAdapted}
            className="w-full py-4 bg-white text-black rounded-2xl font-bold text-lg
                       shadow-[0_0_30px_rgba(255,255,255,0.1)]
                       hover:bg-gray-200 transition active:scale-[0.98]"
          >
            {hasAdaptations ? 'Начать адаптированную' : 'Начать тренировку'}
          </button>

          {/* Secondary: Start Original (only if there were adaptations) */}
          {showOriginalOption && hasAdaptations && (
            <button
              onClick={onStartOriginal}
              className="w-full py-3 bg-transparent text-gray-400 rounded-xl font-medium
                         border border-white/10 hover:bg-white/5 transition"
            >
              Всё равно полную программу
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhoopInsightScreen;
