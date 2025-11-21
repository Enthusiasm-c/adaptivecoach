
import React from 'react';
import { WorkoutSession } from '../types';
import { X, Dumbbell, Repeat, Timer } from 'lucide-react';

interface WorkoutPreviewModalProps {
  session: WorkoutSession;
  onClose: () => void;
  onStart: () => void;
}

const WorkoutPreviewModal: React.FC<WorkoutPreviewModalProps> = ({ session, onClose, onStart }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-md space-y-4 text-white animate-fade-in-up flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-indigo-300">{session.name}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto pr-2 space-y-3">
          {session.exercises.map((ex, index) => (
            <div key={index} className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-white">{ex.name}</h3>
              <div className="flex items-center gap-4 text-gray-400 text-sm mt-2">
                <span className="flex items-center gap-1.5"><Repeat size={14}/> {ex.sets} подх. x {ex.reps} повт.</span>
                <span className="flex items-center gap-1.5"><Timer size={14}/> {ex.rest}с отдых</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="pt-2">
            <button 
                onClick={onStart}
                className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-500 transition-all duration-300"
            >
                Начать Тренировку
            </button>
        </div>

      </div>
    </div>
  );
};

export default WorkoutPreviewModal;
