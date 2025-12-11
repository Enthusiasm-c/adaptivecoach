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
                    className="w-full py-5 text-white rounded-full font-bold text-xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2 group"
                    style={{
                        background: 'linear-gradient(90deg, #7F00FF 0%, #9F00FF 100%)',
                        boxShadow: '0px 0px 20px rgba(127, 0, 255, 0.6)'
                    }}
                >
                    Начать тренировку
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" size={22} />
                </button>
            </div>
        </div>
    );
};

export default FitCubeWelcome;
