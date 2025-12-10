
import React, { useState } from 'react';
import { WorkoutFeedback, WorkoutCompletion } from '../types';

// Pain location options
const PAIN_LOCATIONS = [
  'Поясница', 'Колени', 'Плечи', 'Шея',
  'Локти', 'Запястья', 'Спина (верх)', 'Другое'
];

interface FeedbackModalProps {
  onSubmit: (feedback: WorkoutFeedback) => void;
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onSubmit, onClose }) => {
  const [completion, setCompletion] = useState<WorkoutCompletion>(WorkoutCompletion.Yes);
  const [hasPain, setHasPain] = useState(false);
  const [painLocation, setPainLocation] = useState<string>('');
  const [painDetails, setPainDetails] = useState('');

  const handleSubmit = () => {
    onSubmit({
      completion,
      pain: {
        hasPain,
        location: hasPain ? painLocation : undefined,
        details: hasPain ? painDetails : undefined,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-md space-y-6 text-white animate-fade-in-up">
        <h2 className="text-2xl font-bold text-center">Отличная работа!</h2>
        <p className="text-center text-gray-400">Пара вопросов, чтобы скорректировать план.</p>
        
        <div className="space-y-2">
            <label className="font-medium">Все подходы выполнены?</label>
            <div className="grid grid-cols-3 gap-2">
                {Object.values(WorkoutCompletion).map(c => (
                    <button key={c} onClick={() => setCompletion(c)} className={`p-2 rounded-lg text-sm transition ${completion === c ? 'bg-indigo-600 font-bold' : 'bg-gray-700 hover:bg-gray-600'}`}>{c}</button>
                ))}
            </div>
        </div>

        <div className="space-y-2">
            <label className="font-medium">Была боль или дискомфорт?</label>
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
                                            ? 'bg-red-500 text-white'
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

        <div className="flex gap-4 pt-4">
          <button onClick={onClose} className="w-full px-4 py-3 bg-gray-600 rounded-lg hover:bg-gray-500 transition font-bold">Отмена</button>
          <button onClick={handleSubmit} className="w-full px-4 py-3 bg-green-600 rounded-lg hover:bg-green-500 transition font-bold">Сохранить</button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
