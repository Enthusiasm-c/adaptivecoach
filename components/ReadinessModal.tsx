
import React, { useState } from 'react';
import { ReadinessData } from '../types';
import { calculateReadinessScore } from '../utils/progressUtils';
import { Battery, Utensils, Brain, Activity, X } from 'lucide-react';

interface ReadinessModalProps {
  onConfirm: (data: ReadinessData) => void;
  onCancel: () => void;
}

const ReadinessModal: React.FC<ReadinessModalProps> = ({ onConfirm, onCancel }) => {
  const [sleep, setSleep] = useState(3);
  const [food, setFood] = useState(3);
  const [stress, setStress] = useState(3);
  const [soreness, setSoreness] = useState(3);

  const handleConfirm = () => {
    const data = calculateReadinessScore(sleep, food, stress, soreness);
    onConfirm(data);
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
      const labels: any = {
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

        <div className="space-y-8">
            {renderQuestionBlock("Как ты спал?", <Battery size={18}/>, sleep, setSleep, 'sleep', "text-indigo-400")}
            {renderQuestionBlock("Как питание?", <Utensils size={18}/>, food, setFood, 'food', "text-emerald-400")}
            {renderQuestionBlock("Уровень стресса?", <Brain size={18}/>, stress, setStress, 'stress', "text-violet-400")}
            {renderQuestionBlock("Болят мышцы?", <Activity size={18}/>, soreness, setSoreness, 'soreness', "text-rose-400")}
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