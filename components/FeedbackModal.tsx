
import React, { useState } from 'react';
import { WorkoutFeedback, WorkoutCompletion } from '../types';
import { Zap } from 'lucide-react';

// Pain location options
const PAIN_LOCATIONS = [
  'Поясница', 'Колени', 'Плечи', 'Шея',
  'Локти', 'Запястья', 'Спина (верх)', 'Другое'
];

// Pump quality labels
const PUMP_LABELS: { [key: number]: string } = {
  1: 'Не было',
  2: 'Слабый',
  3: 'Средний',
  4: 'Хороший',
  5: 'Отличный',
};

// Soreness labels (muscle soreness/DOMS)
const SORENESS_LABELS: { [key: number]: string } = {
  1: 'Свежий',
  2: 'Чуть чувствую',
  3: 'Умеренно',
  4: 'Больно',
  5: 'Очень больно',
};

interface InitialPain {
  hasPain: boolean;
  location?: string;
  details?: string;
}

interface FeedbackModalProps {
  onSubmit: (feedback: WorkoutFeedback) => void;
  onClose: () => void;
  initialPain?: InitialPain; // Pre-filled pain data from mid-workout reporting
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onSubmit, onClose, initialPain }) => {
  const [completion, setCompletion] = useState<WorkoutCompletion>(WorkoutCompletion.Yes);
  const [hasPain, setHasPain] = useState(initialPain?.hasPain ?? false);
  const [painLocation, setPainLocation] = useState<string>(initialPain?.location ?? '');
  const [painDetails, setPainDetails] = useState(initialPain?.details ?? '');

  // Autoregulation fields
  const [pumpQuality, setPumpQuality] = useState<1 | 2 | 3 | 4 | 5 | undefined>(undefined);
  const [soreness24h, setSoreness24h] = useState<1 | 2 | 3 | 4 | 5 | undefined>(undefined);

  const handleSubmit = () => {
    onSubmit({
      completion,
      pain: {
        hasPain,
        location: hasPain ? painLocation : undefined,
        details: hasPain ? painDetails : undefined,
      },
      pumpQuality,
      soreness24h,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 pb-28">
      <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-md space-y-5 text-white animate-fade-in-up max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-center">Отличная работа!</h2>
        <p className="text-center text-gray-400">Пара вопросов для корректировки плана.</p>

        {/* Completion */}
        <div className="space-y-2">
            <label className="font-medium">Все подходы выполнены?</label>
            <div className="grid grid-cols-3 gap-2">
                {Object.values(WorkoutCompletion).map(c => (
                    <button key={c} onClick={() => setCompletion(c)} className={`p-2 rounded-lg text-sm transition ${completion === c ? 'bg-indigo-600 font-bold' : 'bg-gray-700 hover:bg-gray-600'}`}>{c}</button>
                ))}
            </div>
        </div>

        {/* Pump Quality (Autoregulation) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-orange-400" />
            <label className="font-medium">Как пампинг в мышцах?</label>
          </div>
          <div className="flex gap-1.5">
            {([1, 2, 3, 4, 5] as const).map(level => (
              <button
                key={level}
                onClick={() => setPumpQuality(level)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition ${
                  pumpQuality === level
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          {pumpQuality && (
            <p className="text-xs text-gray-400 text-center animate-fade-in">
              {PUMP_LABELS[pumpQuality]}
            </p>
          )}
        </div>

        {/* Muscle Soreness (Autoregulation) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">💪</span>
            <label className="font-medium">Мышечная болезненность?</label>
          </div>
          <p className="text-xs text-gray-500">Как себя чувствуют мышцы с прошлой тренировки</p>
          <div className="flex gap-1.5">
            {([1, 2, 3, 4, 5] as const).map(level => (
              <button
                key={level}
                onClick={() => setSoreness24h(level)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition ${
                  soreness24h === level
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          {soreness24h && (
            <p className="text-xs text-gray-400 text-center animate-fade-in">
              {SORENESS_LABELS[soreness24h]}
            </p>
          )}
        </div>

        {/* Pain */}
        <div className="space-y-2">
            <label className="font-medium">Была боль или дискомфорт?</label>
            {initialPain?.hasPain && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm">
                <span className="text-amber-400">Уже указано: </span>
                <span className="text-white">{initialPain.location}</span>
                {initialPain.details && <span className="text-gray-400"> — {initialPain.details}</span>}
              </div>
            )}
             <div className="flex gap-4">
                <button onClick={() => setHasPain(false)} className={`w-full p-3 rounded-lg transition ${!hasPain ? 'bg-indigo-600 font-bold' : 'bg-gray-700 hover:bg-gray-600'}`}>Нет</button>
                <button onClick={() => setHasPain(true)} className={`w-full p-3 rounded-lg transition ${hasPain ? 'bg-indigo-600 font-bold' : 'bg-gray-700 hover:bg-gray-600'}`}>Да</button>
            </div>
             {hasPain && (
                <div className="animate-fade-in pt-2 space-y-3">
                    {/* Pain location chips */}
                    <div>
                        <label className="text-sm text-gray-400 block mb-2">Где именно?</label>
                        <div className="flex flex-wrap gap-2">
                            {PAIN_LOCATIONS.map(loc => (
                                <button
                                    key={loc}
                                    onClick={() => setPainLocation(loc)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                                        painLocation === loc
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-neutral-700 text-gray-300 hover:bg-neutral-600'
                                    }`}
                                >
                                    {loc}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Pain details textarea */}
                    <textarea
                        value={painDetails}
                        onChange={e => setPainDetails(e.target.value)}
                        className="w-full p-2 bg-gray-700 rounded-lg border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500 h-20"
                        placeholder="Опиши подробнее (необязательно)..."
                    />
                </div>
            )}
        </div>

        <div className="flex gap-4 pt-2">
          <button onClick={onClose} className="w-full px-4 py-3 bg-gray-600 rounded-lg hover:bg-gray-500 transition font-bold">Отмена</button>
          <button onClick={handleSubmit} className="w-full px-4 py-3 bg-green-600 rounded-lg hover:bg-green-500 transition font-bold">Сохранить</button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
