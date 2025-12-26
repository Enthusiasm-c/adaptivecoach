
import React, { useState, useEffect } from 'react';
import { ReadinessData, WhoopReadinessData } from '../types';
import { calculateReadinessScore } from '../utils/progressUtils';
import { Battery, Utensils, Brain, Activity, X, Loader2, Heart, Moon, Zap, RefreshCw } from 'lucide-react';
import { apiService } from '../services/apiService';

interface ReadinessModalProps {
  onConfirm: (data: ReadinessData) => void;
  onCancel: () => void;
}

const ReadinessModal: React.FC<ReadinessModalProps> = ({ onConfirm, onCancel }) => {
  // Manual mode state
  const [sleep, setSleep] = useState(3);
  const [food, setFood] = useState(3);
  const [stress, setStress] = useState(3);
  const [soreness, setSoreness] = useState(3);

  // WHOOP state
  const [whoopConnected, setWhoopConnected] = useState(false);
  const [whoopData, setWhoopData] = useState<WhoopReadinessData | null>(null);
  const [whoopLoading, setWhoopLoading] = useState(true);
  const [whoopError, setWhoopError] = useState<string | null>(null);

  // Load WHOOP status and data
  useEffect(() => {
    const loadWhoopData = async () => {
      try {
        const status = await apiService.whoop.getStatus();
        setWhoopConnected(status.connected);

        if (status.connected) {
          try {
            const readiness = await apiService.whoop.getReadiness();
            setWhoopData({
              recoveryScore: readiness.recoveryScore,
              sleepPerformance: readiness.sleepPerformance,
              sleepHours: readiness.sleepHours,
              hrv: readiness.hrv,
              rhr: readiness.rhr,
              sleepScore: readiness.sleepScore,
              stressScore: readiness.stressScore,
              sorenessScore: readiness.sorenessScore,
            });
          } catch (e) {
            console.error('Failed to load WHOOP readiness:', e);
            setWhoopError('Не удалось загрузить данные WHOOP');
          }
        }
      } catch (e) {
        console.error('Failed to check WHOOP status:', e);
      } finally {
        setWhoopLoading(false);
      }
    };
    loadWhoopData();
  }, []);

  const handleConfirm = () => {
    if (whoopConnected && whoopData) {
      // Use WHOOP data + manual food
      const data = calculateReadinessScore(
        whoopData.sleepScore,
        food,
        whoopData.stressScore,
        whoopData.sorenessScore
      );
      onConfirm(data);
    } else {
      // Full manual mode
      const data = calculateReadinessScore(sleep, food, stress, soreness);
      onConfirm(data);
    }
  };

  const renderScaleButton = (val: number, currentVal: number, setVal: (v: number) => void, colorClass: string) => {
    const isSelected = val === currentVal;
    const baseColor = colorClass.replace('text-', 'bg-');

    return (
      <button
        key={val}
        onClick={() => setVal(val)}
        className={`flex-1 h-12 rounded-lg font-bold text-lg transition-all duration-200 border border-white/5 ${
          isSelected
            ? `${baseColor} text-black scale-105 shadow-lg shadow-white/5`
            : 'bg-neutral-800 text-gray-500 hover:bg-neutral-700'
        }`}
      >
        {val}
      </button>
    );
  };

  const getLabelForValue = (val: number, type: 'sleep' | 'food' | 'stress' | 'soreness') => {
    const labels: Record<string, string[]> = {
      sleep: ['Ужасно (0-4ч)', 'Плохо', 'Норм', 'Хорошо', 'Отлично (8ч+)'],
      food: ['Голоден', 'Мало ел', 'Норма', 'Сыт', 'Идеально'],
      stress: ['На пределе', 'Высокий', 'Средний', 'Низкий', 'Спокоен'],
      soreness: ['Всё болит', 'Сильно', 'Есть', 'Свеж', 'Полон сил'],
    };
    return labels[type][val - 1];
  };

  const renderQuestionBlock = (
    question: string,
    icon: React.ReactNode,
    value: number,
    setValue: (v: number) => void,
    type: 'sleep' | 'food' | 'stress' | 'soreness',
    colorClass: string
  ) => (
    <div className="space-y-3 animate-fade-in">
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg bg-neutral-800 ${colorClass}`}>
            {icon}
          </div>
          <span className="font-bold text-white">{question}</span>
        </div>
        <span className={`text-xs font-bold uppercase tracking-wider ${colorClass}`}>
          {getLabelForValue(value, type)}
        </span>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(num => renderScaleButton(num, value, setValue, colorClass))}
      </div>
    </div>
  );

  const getRecoveryColor = (score: number) => {
    if (score >= 67) return 'text-green-400';
    if (score >= 34) return 'text-yellow-400';
    return 'text-amber-400';
  };

  const getRecoveryBgColor = (score: number) => {
    if (score >= 67) return 'bg-green-900/30 border-green-500/30';
    if (score >= 34) return 'bg-yellow-900/30 border-yellow-500/30';
    return 'bg-amber-900/30 border-amber-500/30';
  };

  // WHOOP Hybrid Mode
  if (whoopLoading) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50">
        <div className="bg-neutral-900 border border-white/10 rounded-3xl p-8 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-white font-medium">Загружаем данные...</p>
          <p className="text-gray-500 text-sm">Проверяем WHOOP</p>
        </div>
      </div>
    );
  }

  // WHOOP connected and data available
  if (whoopConnected && whoopData && !whoopError) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-end sm:items-center justify-center z-50 sm:p-4">
        <div className="bg-neutral-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 w-full max-w-md space-y-6 animate-slide-up max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-none mb-1">Готовность</h2>
              <p className="text-gray-400 text-sm">Данные синхронизированы с WHOOP</p>
            </div>
            <button onClick={onCancel} className="p-2 bg-neutral-800 rounded-full text-gray-400 hover:text-white">
              <X size={20}/>
            </button>
          </div>

          {/* WHOOP Data Display */}
          <div className={`rounded-2xl p-4 border ${getRecoveryBgColor(whoopData.recoveryScore)}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                <Activity size={18} className="text-green-400" />
              </div>
              <span className="text-green-400 font-bold text-sm uppercase tracking-wide">WHOOP Recovery</span>
            </div>

            {/* Main Recovery Score */}
            <div className="text-center mb-4">
              <div className={`text-5xl font-black ${getRecoveryColor(whoopData.recoveryScore)}`}>
                {whoopData.recoveryScore}%
              </div>
              <div className="text-gray-400 text-sm">Recovery Score</div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-black/30 rounded-xl p-3 text-center">
                <Moon size={16} className="text-indigo-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-white">{whoopData.sleepHours.toFixed(1)}ч</div>
                <div className="text-[10px] text-gray-500 uppercase">Сон</div>
              </div>
              <div className="bg-black/30 rounded-xl p-3 text-center">
                <Heart size={16} className="text-amber-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-white">{whoopData.hrv}</div>
                <div className="text-[10px] text-gray-500 uppercase">HRV</div>
              </div>
              <div className="bg-black/30 rounded-xl p-3 text-center">
                <Zap size={16} className="text-yellow-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-white">{whoopData.rhr}</div>
                <div className="text-[10px] text-gray-500 uppercase">ЧСС покоя</div>
              </div>
            </div>

            {/* Auto-calculated scores preview */}
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-indigo-400">{whoopData.sleepScore}/5</div>
                <div className="text-[10px] text-gray-500">Сон</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-violet-400">{whoopData.stressScore}/5</div>
                <div className="text-[10px] text-gray-500">Стресс</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-violet-400">{whoopData.sorenessScore}/5</div>
                <div className="text-[10px] text-gray-500">Мышцы</div>
              </div>
            </div>
          </div>

          {/* Manual Food Input */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-neutral-800 text-green-400">
                  <Utensils size={18}/>
                </div>
                <span className="font-bold text-white">Как питание?</span>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-green-400">
                {getLabelForValue(food, 'food')}
              </span>
            </div>

            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(num => renderScaleButton(num, food, setFood, 'text-green-400'))}
            </div>

            <p className="text-gray-500 text-xs text-center">
              WHOOP не отслеживает питание, поэтому вводим вручную
            </p>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full py-4 bg-white text-black rounded-2xl hover:bg-gray-200 transition font-bold text-lg shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-[0.98]"
          >
            Начать тренировку
          </button>
        </div>
      </div>
    );
  }

  // Manual Mode (WHOOP not connected or error)
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-neutral-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 w-full max-w-md space-y-8 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-none mb-1">Готовность</h2>
            <p className="text-gray-400 text-sm">Как самочувствие перед стартом?</p>
          </div>
          <button onClick={onCancel} className="p-2 bg-neutral-800 rounded-full text-gray-400 hover:text-white">
            <X size={20}/>
          </button>
        </div>

        {/* WHOOP Error Banner */}
        {whoopConnected && whoopError && (
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-3 flex items-center gap-3">
            <RefreshCw size={18} className="text-yellow-400" />
            <div className="flex-1">
              <p className="text-yellow-300 text-sm font-medium">WHOOP недоступен</p>
              <p className="text-yellow-400/70 text-xs">Заполни данные вручную</p>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {renderQuestionBlock("Как ты спал?", <Battery size={18}/>, sleep, setSleep, 'sleep', "text-indigo-400")}
          {renderQuestionBlock("Как питание?", <Utensils size={18}/>, food, setFood, 'food', "text-green-400")}
          {renderQuestionBlock("Уровень стресса?", <Brain size={18}/>, stress, setStress, 'stress', "text-violet-400")}
          {renderQuestionBlock("Болят мышцы?", <Activity size={18}/>, soreness, setSoreness, 'soreness', "text-violet-400")}
        </div>

        <button
          onClick={handleConfirm}
          className="w-full py-4 bg-white text-black rounded-2xl hover:bg-gray-200 transition font-bold text-lg shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-[0.98]"
        >
          Начать тренировку
        </button>
      </div>
    </div>
  );
};

export default ReadinessModal;
