import React from 'react';
import { ArrowRight } from 'lucide-react';

interface FitCubeWelcomeProps {
    onComplete: () => void;
}

const FitCubeWelcome: React.FC<FitCubeWelcomeProps> = ({ onComplete }) => {
    return (
        <div
            className="min-h-screen flex flex-col relative"
            style={{
                backgroundImage: `url('/fitcube-bg.jpeg')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}
        >
            {/* Spacer — фото занимает весь экран */}
            <div className="flex-1" />

            {/* Только кнопка внизу */}
            <div className="relative z-10 p-6 pb-8">
                <button
                    onClick={onComplete}
                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-xl shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 group"
                >
                    Начать тренировку
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" size={22} />
                </button>
            </div>
        </div>
    );
};

export default FitCubeWelcome;
