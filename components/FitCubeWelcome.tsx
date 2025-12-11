import React from 'react';
import { Dumbbell, ChevronRight } from 'lucide-react';

interface FitCubeWelcomeProps {
    onComplete: () => void;
}

const FitCubeWelcome: React.FC<FitCubeWelcomeProps> = ({ onComplete }) => {
    return (
        <div
            className="min-h-screen flex flex-col relative"
            style={{
                backgroundImage: `url('/fitcube-bg.jpg')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}
        >
            {/* Тёмный overlay для читаемости текста */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />

            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10">
                {/* Логотипы */}
                <div className="flex items-center gap-4 mb-8">
                    {/* Sensei.AI Logo */}
                    <img
                        src="/sensei-logo.jpeg"
                        alt="Sensei.AI"
                        className="h-20 w-auto object-contain drop-shadow-lg rounded-2xl"
                    />
                    <span className="text-white/60 text-2xl font-light">×</span>
                    {/* FitCube Icon */}
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                        <Dumbbell size={32} className="text-white" />
                    </div>
                </div>

                <h1 className="text-3xl font-black text-white mb-2 drop-shadow-lg">
                    Добро пожаловать в ФИТКУБ!
                </h1>

                <p className="text-white/90 text-lg mb-4 drop-shadow">
                    Коллаборация Sensei AI и ФИТКУБ
                </p>

                <p className="text-white/80 max-w-sm leading-relaxed drop-shadow">
                    Мы подберём персональную 45-минутную тренировку специально под оборудование этого куба и твои цели.
                </p>
            </div>

            <div className="p-6 pb-8 relative z-10">
                <button
                    onClick={onComplete}
                    className="w-full py-4 bg-white text-gray-900 font-bold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                    Начать
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    );
};

export default FitCubeWelcome;
