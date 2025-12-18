/**
 * MesocycleEducationModal Component
 *
 * Educational modal explaining what mesocycles are,
 * how phases work, and their effects on training.
 */

import React from 'react';
import { X, Calendar, RefreshCw, TrendingUp, Zap, Coffee, Info, Target } from 'lucide-react';
import { MesocyclePhase } from '../types/training';

interface MesocycleEducationModalProps {
  currentPhase: MesocyclePhase;
  currentWeek: number;
  totalWeeks: number;
  onClose: () => void;
}

interface PhaseInfo {
  title: string;
  description: string;
  volume: string;
  focus: string[];
  tips: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const PHASE_DETAILS: { [key in MesocyclePhase]: PhaseInfo } = {
  intro: {
    title: 'Вводная неделя',
    description: 'Адаптация организма к новым упражнениям и нагрузкам. Тело привыкает к движениям.',
    volume: '70%',
    focus: [
      'Освоение техники новых упражнений',
      'Поиск рабочих весов',
      'Запоминание последовательности',
    ],
    tips: 'Не гонись за весами — фокусируйся на технике и ощущении мышц.',
    icon: <RefreshCw size={20} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
  },
  accumulation: {
    title: 'Фаза накопления',
    description: 'Основная фаза роста. Постепенное увеличение объёма и нагрузки для стимуляции адаптации.',
    volume: '100%',
    focus: [
      'Прогрессия в весах каждую тренировку',
      'Достижение целевых повторений',
      'Качественное восстановление',
    ],
    tips: 'Главная задача — постепенно увеличивать нагрузку, не форсируя события.',
    icon: <TrendingUp size={20} />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/20',
  },
  overreaching: {
    title: 'Фаза интенсификации',
    description: 'Пиковая нагрузка. Максимальный тренировочный стимул перед восстановлением.',
    volume: '120%',
    focus: [
      'Максимальные рабочие веса',
      'Работа близко к отказу (RIR 0-1)',
      'Терпеть дискомфорт ради результата',
    ],
    tips: 'Будет тяжело — это нормально. Скоро разгрузка и суперкомпенсация!',
    icon: <Zap size={20} />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10 border-orange-500/20',
  },
  deload: {
    title: 'Неделя разгрузки',
    description: 'Восстановление и суперкомпенсация. Тело адаптируется к накопленной нагрузке.',
    volume: '50%',
    focus: [
      'Лёгкие веса, меньше подходов',
      'Качественный сон (8+ часов)',
      'Достаточное питание',
    ],
    tips: 'Не пропускай разгрузку! Именно сейчас происходит рост силы и мышц.',
    icon: <Coffee size={20} />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
  },
};

const MesocycleEducationModal: React.FC<MesocycleEducationModalProps> = ({
  currentPhase,
  currentWeek,
  totalWeeks,
  onClose,
}) => {
  const phases: MesocyclePhase[] = ['intro', 'accumulation', 'overreaching', 'deload'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 pb-28">
      <div className="bg-gray-800 rounded-2xl shadow-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="p-4 border-b border-neutral-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Что такое мезоцикл?</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-700 text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Overview */}
          <div className="bg-neutral-700/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Info size={14} className="text-indigo-400" />
              <h3 className="text-sm font-medium text-white">Периодизация тренировок</h3>
            </div>
            <p className="text-gray-300 text-sm">
              Мезоцикл — это {totalWeeks}-недельный план с волнообразной нагрузкой.
              Такой подход даёт лучший рост силы и мышц, чем монотонные тренировки.
            </p>
          </div>

          {/* Current Status */}
          <div className="flex items-center justify-between p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <span className="text-sm text-gray-300">Сейчас:</span>
            <span className="text-sm font-bold text-indigo-300">
              Неделя {currentWeek} · {PHASE_DETAILS[currentPhase].title}
            </span>
          </div>

          {/* All Phases */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Фазы мезоцикла
            </h3>

            {phases.map((phase) => {
              const info = PHASE_DETAILS[phase];
              const isCurrentPhase = phase === currentPhase;

              return (
                <div
                  key={phase}
                  className={`rounded-xl p-3 border transition-all ${
                    isCurrentPhase
                      ? info.bgColor + ' ring-2 ring-offset-2 ring-offset-gray-800 ring-' + info.color.replace('text-', '')
                      : 'bg-neutral-700/30 border-neutral-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${info.bgColor}`}>
                      <span className={info.color}>{info.icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${isCurrentPhase ? info.color : 'text-white'}`}>
                          {info.title}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${info.bgColor} ${info.color}`}>
                          {info.volume} объёма
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">{info.description}</p>

                      {isCurrentPhase && (
                        <div className="mt-2 p-2 bg-black/30 rounded-lg">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Target size={12} className={info.color} />
                            <span className="text-xs font-medium text-gray-300">Твой фокус:</span>
                          </div>
                          <ul className="space-y-1">
                            {info.focus.map((item, i) => (
                              <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                                <span className={info.color}>•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tip for current phase */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <span className="text-lg">💡</span>
              <div>
                <p className="text-sm font-medium text-amber-300 mb-1">Совет</p>
                <p className="text-xs text-gray-300">{PHASE_DETAILS[currentPhase].tips}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 pb-6 border-t border-neutral-700">
          <button
            onClick={onClose}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};

export default MesocycleEducationModal;
