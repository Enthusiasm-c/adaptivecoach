import React from 'react';
import { Dumbbell, Target, TrendingUp, ChevronRight, Zap, Star } from 'lucide-react';
import { WorkoutSession, OnboardingProfile, WorkoutLog } from '../types';
import { calculateStreaks } from '../utils/progressUtils';
import { hapticFeedback } from '../utils/hapticUtils';

interface WorkoutIntroModalProps {
    session: WorkoutSession;
    profile: OnboardingProfile;
    logs: WorkoutLog[];
    onContinue: () => void;
    onCancel: () => void;
}

const WorkoutIntroModal: React.FC<WorkoutIntroModalProps> = ({
    session,
    profile,
    logs,
    onContinue,
    onCancel
}) => {
    const { currentStreak } = calculateStreaks(logs, undefined, profile.preferredDays);
    const workoutNumber = logs.length + 1;
    const exerciseCount = session.exercises.length;

    // Get motivational message based on context
    const getMotivationalMessage = () => {
        if (workoutNumber === 1) {
            return "Первый шаг — самый важный. Ты уже здесь, а значит готов стать лучше!";
        }
        if (currentStreak >= 7) {
            return `${currentStreak} дней подряд! Ты на волне — не останавливайся!`;
        }
        if (currentStreak >= 3) {
            return "Отличный темп! Каждая тренировка приближает тебя к цели.";
        }
        if (workoutNumber <= 3) {
            return "Формируем привычку! Регулярность важнее интенсивности.";
        }
        return "Штурмуем новые высоты! Сегодня ты станешь сильнее.";
    };

    // Get goal-specific tip
    const getGoalTip = () => {
        const goal = profile.goals?.primary || '';
        if (goal.includes('масс') || goal.includes('мышц')) {
            return "Фокус на технику и контроль веса";
        }
        if (goal.includes('похуд') || goal.includes('рельеф')) {
            return "Держи темп и минимальный отдых";
        }
        if (goal.includes('сил')) {
            return "Максимальная концентрация на каждом подходе";
        }
        return "Слушай своё тело, работай осознанно";
    };

    const handleContinue = () => {
        hapticFeedback.impactOccurred('medium');
        onContinue();
    };

    return (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col animate-fade-in">
            {/* Close button */}
            <button
                onClick={onCancel}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition p-2"
            >
                ✕
            </button>

            {/* Main content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                {/* Icon */}
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-full flex items-center justify-center mb-6 relative">
                    <Dumbbell size={48} className="text-indigo-400" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-black text-black">#{workoutNumber}</span>
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-black text-white mb-2">
                    {session.name}
                </h1>

                {/* Workout info */}
                <div className="flex items-center gap-3 mb-6">
                    <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm font-bold">
                        {exerciseCount} упражнений
                    </span>
                    <span className="px-3 py-1 bg-white/5 text-gray-400 rounded-full text-sm font-bold">
                        ~{profile.timePerWorkout || 45} мин
                    </span>
                </div>

                {/* Motivational message */}
                <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 rounded-2xl p-5 max-w-sm mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap size={18} className="text-amber-400" />
                        <span className="text-amber-400 font-bold text-sm">Сегодня</span>
                    </div>
                    <p className="text-white text-lg leading-relaxed">
                        {getMotivationalMessage()}
                    </p>
                </div>

                {/* Goal tip */}
                <div className="flex items-center gap-3 bg-neutral-900/50 border border-white/5 rounded-xl p-4 max-w-sm">
                    <Target size={20} className="text-emerald-400 flex-shrink-0" />
                    <div className="text-left">
                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">Твоя цель: {profile.goals?.primary}</p>
                        <p className="text-gray-300 text-sm">{getGoalTip()}</p>
                    </div>
                </div>

                {/* Streak indicator */}
                {currentStreak > 0 && (
                    <div className="mt-6 flex items-center gap-2 text-orange-400">
                        <Star size={16} fill="currentColor" />
                        <span className="text-sm font-bold">{currentStreak} дней подряд</span>
                    </div>
                )}
            </div>

            {/* Bottom action */}
            <div className="p-6 pb-8 safe-area-inset-bottom">
                <button
                    onClick={handleContinue}
                    className="w-full py-4 bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-black text-lg rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-xl shadow-indigo-500/30"
                >
                    Поехали!
                    <ChevronRight size={24} strokeWidth={3} />
                </button>
                <p className="text-center text-gray-600 text-xs mt-3">
                    Далее: быстрая проверка готовности
                </p>
            </div>
        </div>
    );
};

export default WorkoutIntroModal;
