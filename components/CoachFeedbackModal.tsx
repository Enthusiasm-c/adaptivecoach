
import React, { useState } from 'react';
import { Bot, ThumbsUp, XCircle } from 'lucide-react';

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
          <div className="flex justify-center items-center py-8">
            <div className="flex items-center gap-2 text-gray-400">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                <span>Тренер анализирует...</span>
            </div>
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
