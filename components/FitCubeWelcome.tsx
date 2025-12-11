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
            {/* Градиент overlay снизу для текста */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

            {/* Верхняя часть — КОЛЛАБОРАЦИЯ */}
            <div className="pt-12 pb-6 text-center relative z-10">
                <p className="text-white/70 text-xs font-bold tracking-[0.3em] uppercase mb-4">
                    Коллаборация
                </p>
                <div className="flex items-center justify-center gap-6">
                    {/* Sensei.AI Logo */}
                    <img
                        src="/sensei-logo.jpeg"
                        alt="Sensei.AI"
                        className="h-8 w-auto object-contain"
                    />
                    {/* ФИТКУБ Logo — если есть, заменить на img */}
                    <div className="flex items-center gap-2 text-white font-black text-lg tracking-wide">
                        <span className="text-violet-400">⚡</span>
                        <span>ФИТКУБ</span>
                    </div>
                </div>
            </div>

            {/* Spacer — занимает место под фото */}
            <div className="flex-1" />

            {/* Нижняя часть — текст и кнопка */}
            <div className="relative z-10 p-6 pb-8">
                <h1 className="text-4xl font-black text-white mb-2 leading-tight tracking-tight">
                    ИНВЕНТАРЬ<br />СИНХРОНИЗИРОВАН
                </h1>

                <p className="text-white/60 text-lg mb-8 italic">
                    Персональная программа под этот зал готова
                </p>

                <button
                    onClick={onComplete}
                    className="w-full py-5 bg-white text-black rounded-2xl font-bold text-xl shadow-[0_0_40px_rgba(255,255,255,0.1)] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 group"
                >
                    Начать тренировку
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" size={22} />
                </button>
            </div>
        </div>
    );
};

export default FitCubeWelcome;
