
import React, { useState } from 'react';
import { Bot, ThumbsUp, XCircle } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader';

interface CoachFeedbackModalProps {
  isLoading: boolean;
  feedback: string | null;
  onClose: () => void;
}

const CoachFeedbackModal: React.FC<CoachFeedbackModalProps> = ({ isLoading, feedback, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-md space-y-6 text-white animate-fade-in-up">
        <div className="text-center space-y-4">
          <Bot className="mx-auto text-indigo-400" size={48} />
          <h2 className="text-2xl font-bold">Заметки Тренера</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-mono mb-2">
              <Bot size={16} className="animate-pulse" />
              <span>АНАЛИЗ ДАННЫХ...</span>
            </div>
            <SkeletonLoader className="h-4 w-full" />
            <SkeletonLoader className="h-4 w-5/6" />
            <SkeletonLoader className="h-4 w-4/6" />
          </div>
        ) : (
          <p className="text-center text-gray-300 leading-relaxed">{feedback}</p>
        )}

        <div className="space-y-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 rounded-lg transition font-bold ${isLoading ? 'hidden' : 'hover:bg-indigo-500'}`}
          >
            <ThumbsUp size={18} /> Понял!
          </button>

          {isLoading && (
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition font-bold text-gray-300"
            >
              <XCircle size={18} /> Пропустить
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoachFeedbackModal;
