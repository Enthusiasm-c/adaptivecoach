
import React, { useState } from 'react';
import { ReadinessData } from '../types';
import { calculateReadinessScore } from '../utils/progressUtils';
import { Battery, Utensils, Brain, Activity } from 'lucide-react';

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

  const renderDiagnosticBar = (
    label: string, 
    icon: React.ReactNode, 
    value: number, 
    setValue: (v: number) => void, 
    colorClass: string
  ) => (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <label className="flex items-center gap-2 text-gray-300 font-semibold tracking-wide">
          {icon} {label}
        </label>
        <span className={`text-lg font-black ${colorClass}`}>
            {value}/5
        </span>
      </div>
      
      <div className="relative h-8 bg-neutral-800 rounded-lg overflow-hidden border border-white/5">
          <div 
            className={`absolute top-0 left-0 bottom-0 transition-all duration-300 ${colorClass.replace('text-', 'bg-')}`} 
            style={{ width: `${(value / 5) * 100}%` }}
          ></div>
          
          {/* Interaction Click Areas */}
          <div className="absolute inset-0 grid grid-cols-5">
              {[1, 2, 3, 4, 5].map(num => (
                  <button 
                    key={num} 
                    onClick={() => setValue(num)}
                    className="h-full w-full hover:bg-white/10 transition-colors border-r border-black/10 last:border-0"
                  ></button>
              ))}
          </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-white/10 rounded-3xl shadow-2xl p-8 w-full max-w-md space-y-8 animate-scale-in">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Самочувствие</h2>
          <p className="text-gray-400 text-sm">Оценим состояние для коррекции нагрузки.</p>
        </div>

        <div className="space-y-6">
            {renderDiagnosticBar("Сон", <Battery size={18}/>, sleep, setSleep, "text-indigo-400")}
            {renderDiagnosticBar("Питание", <Utensils size={18}/>, food, setFood, "text-emerald-400")}
            {renderDiagnosticBar("Стресс", <Brain size={18}/>, stress, setStress, "text-violet-400")}
            {renderDiagnosticBar("Мышцы", <Activity size={18}/>, soreness, setSoreness, "text-rose-400")}
        </div>

        <div className="pt-4 flex gap-4">
            <button onClick={onCancel} className="w-1/3 px-4 py-4 text-gray-400 font-bold hover:text-white transition">
                Отмена
            </button>
            <button onClick={handleConfirm} className="w-2/3 px-4 py-4 bg-white text-black rounded-2xl hover:bg-gray-200 transition font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                Готово
            </button>
        </div>
      </div>
    </div>
  );
};

export default ReadinessModal;