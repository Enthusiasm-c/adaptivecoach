import React, { useState } from 'react';
import { Dumbbell, Brain, Sparkles, ChevronRight, Check } from 'lucide-react';

interface FitCubeWelcomeProps {
    onComplete: () => void;
}

interface Screen {
    logos?: boolean;
    icon?: React.FC<{ size?: number; className?: string }>;
    title: string;
    subtitle?: string;
    description?: string;
    features?: string[];
    buttonText: string;
    gradient: string;
}

const FitCubeWelcome: React.FC<FitCubeWelcomeProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0);

    const screens: Screen[] = [
        {
            // Screen 1: Collaboration
            logos: true,
            title: "Добро пожаловать в FitCube!",
            subtitle: "Коллаборация Sensei AI и FitCube",
            description: "Мы подберём персональную 45-минутную тренировку специально под оборудование этого куба и твои цели.",
            buttonText: "Узнать больше",
            gradient: "from-indigo-600 to-violet-600"
        },
        {
            // Screen 2: What is Sensei
            icon: Brain,
            title: "Sensei AI — твой персональный тренер",
            features: [
                "Подбирает упражнения под твои цели",
                "Адаптирует нагрузку по ощущениям",
                "Работает в FitCube, зале или дома"
            ],
            buttonText: "Начать",
            gradient: "from-emerald-600 to-teal-600"
        }
    ];

    const current = screens[step];

    return (
        <div className={`min-h-screen bg-gradient-to-br ${current.gradient} flex flex-col`}>
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                {current.logos && (
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                            <Sparkles size={32} className="text-white" />
                        </div>
                        <span className="text-white/60 text-2xl font-light">×</span>
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                            <Dumbbell size={32} className="text-white" />
                        </div>
                    </div>
                )}

                {current.icon && (
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-6 shadow-lg">
                        <current.icon size={40} className="text-white" />
                    </div>
                )}

                <h1 className="text-3xl font-black text-white mb-2">{current.title}</h1>

                {current.subtitle && (
                    <p className="text-white/80 text-lg mb-4">{current.subtitle}</p>
                )}

                {current.description && (
                    <p className="text-white/70 max-w-sm leading-relaxed">{current.description}</p>
                )}

                {current.features && (
                    <div className="mt-6 space-y-3 text-left">
                        {current.features.map((feature, i) => (
                            <div key={i} className="flex items-center gap-3 text-white/90">
                                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Check size={14} className="text-white" />
                                </div>
                                <span>{feature}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-6 pb-8">
                <button
                    onClick={() => step < screens.length - 1 ? setStep(step + 1) : onComplete()}
                    className="w-full py-4 bg-white text-gray-900 font-bold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                    {current.buttonText}
                    <ChevronRight size={20} />
                </button>

                {/* Progress dots */}
                <div className="flex justify-center gap-2 mt-4">
                    {screens.map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-white w-6' : 'bg-white/30'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FitCubeWelcome;
