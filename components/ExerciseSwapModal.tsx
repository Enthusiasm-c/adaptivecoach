
import React, { useState, useEffect } from 'react';
import { Exercise, OnboardingProfile, WorkoutSession } from '../types';
import { getExerciseAlternatives } from '../services/geminiService';
import { Dumbbell, Replace, X } from 'lucide-react';

interface ExerciseSwapModalProps {
  exercise: Exercise;
  session: WorkoutSession;
  profile: OnboardingProfile;
  onSwap: (newExercise: Exercise) => void;
  onClose: () => void;
}

const ExerciseSwapModal: React.FC<ExerciseSwapModalProps> = ({ exercise, session, profile, onSwap, onClose }) => {
  const [alternatives, setAlternatives] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlternatives = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getExerciseAlternatives(exercise, session, profile);
        setAlternatives(result);
      } catch (e) {
        console.error("Failed to fetch alternatives", e);
        setError("Не удалось найти альтернативы. Попробуйте позже.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlternatives();
  }, [exercise, session, profile]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-8">
            <div className="flex items-center gap-2 text-gray-400">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                <span>Ищем варианты...</span>
            </div>
        </div>
      );
    }

    if (error) {
      return <p className="text-center text-amber-400 py-8">{error}</p>;
    }

    if (alternatives.length === 0) {
      return <p className="text-center text-gray-400 py-8">Подходящих альтернатив не найдено.</p>;
    }

    return (
      <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
        {alternatives.map((alt, index) => (
          <button 
            key={index}
            onClick={() => onSwap(alt)}
            className="w-full flex items-center justify-between p-4 bg-gray-700 rounded-lg text-left hover:bg-indigo-600 transition group"
          >
            <div>
              <p className="font-semibold">{alt.name}</p>
              <p className="text-sm text-gray-400 group-hover:text-white">{alt.sets}x{alt.reps} повторов</p>
            </div>
            <Replace size={20} className="text-indigo-400 group-hover:text-white" />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 pb-28">
      <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-md space-y-4 text-white animate-fade-in-up">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Заменить упражнение</h2>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                <X size={20}/>
            </button>
        </div>
        <p className="text-gray-400">
            Меняем: <span className="font-semibold text-gray-200">{exercise.name}</span>
        </p>
        
        {renderContent()}

      </div>
    </div>
  );
};

export default ExerciseSwapModal;
