import React, { useEffect } from 'react';
import { Flame, Shield, Crown, X, Sparkles } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';
import { apiService } from '../services/apiService';

interface StreakMilestonePaywallProps {
    streakDays: number;
    onClose: () => void;
    onUpgrade: () => void;
}

const StreakMilestonePaywall: React.FC<StreakMilestonePaywallProps> = ({
    streakDays,
    onClose,
    onUpgrade
}) => {
    // Track impression on mount
    useEffect(() => {
        apiService.analytics.track('paywall_impression', {
            source: 'streak_milestone',
            streakDays
        }).catch(() => {});
    }, [streakDays]);

    const handleUpgrade = () => {
        apiService.analytics.track('paywall_cta_click', {
            source: 'streak_milestone',
            streakDays
        }).catch(() => {});
        hapticFeedback.impactOccurred('medium');
        onUpgrade();
    };

    const handleClose = () => {
        apiService.analytics.track('paywall_dismissed', {
            source: 'streak_milestone',
            streakDays
        }).catch(() => {});
        hapticFeedback.impactOccurred('light');
        onClose();
    };

    // Different messaging based on milestone
    const getMilestoneMessage = () => {
        if (streakDays >= 100) {
            return {
                title: '100 тренировок подряд!',
                subtitle: 'Ты - настоящая легенда!',
                emoji: '🏆',
                color: 'from-yellow-500/20 to-amber-500/20',
                borderColor: 'border-yellow-500/30',
                iconColor: 'text-yellow-400'
            };
        }
        if (streakDays >= 30) {
            return {
                title: '30 тренировок подряд!',
                subtitle: 'Невероятная дисциплина!',
                emoji: '💪',
                color: 'from-purple-500/20 to-violet-500/20',
                borderColor: 'border-purple-500/30',
                iconColor: 'text-purple-400'
            };
        }
        return {
            title: '7 тренировок подряд!',
            subtitle: 'Отличная стабильность!',
            emoji: '🔥',
            color: 'from-orange-500/20 to-red-500/20',
            borderColor: 'border-orange-500/30',
            iconColor: 'text-orange-400'
        };
    };

    const milestone = getMilestoneMessage();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-3xl overflow-hidden relative shadow-2xl animate-scale-in">
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-gray-400 hover:text-white z-10"
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="pt-8 pb-6 px-6 text-center">
                    <div className={`w-24 h-24 mx-auto mb-4 bg-gradient-to-br ${milestone.color} rounded-full flex items-center justify-center ${milestone.borderColor} border-2`}>
                        <span className="text-5xl">{milestone.emoji}</span>
                    </div>

                    <h2 className="text-2xl font-black text-white mb-2">
                        {milestone.title}
                    </h2>

                    <p className="text-gray-400 text-sm">
                        {milestone.subtitle}
                    </p>

                    {/* Streak Counter */}
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 rounded-full border border-white/10">
                        <Flame size={18} className="text-orange-500" fill="currentColor" />
                        <span className="text-white font-black">{streakDays} тренировок</span>
                    </div>
                </div>

                {/* Shield Benefit */}
                <div className="px-6 pb-4">
                    <div className="flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                            <Shield size={24} className="text-indigo-400" />
                        </div>
                        <div className="flex-1">
                            <p className="text-white font-bold text-sm">Сохранение серии</p>
                            <p className="text-gray-400 text-xs">
                                Можно пропустить 1 тренировку без потери серии
                            </p>
                        </div>
                    </div>
                </div>

                {/* CTA */}
                <div className="px-6 pb-6">
                    <button
                        onClick={handleUpgrade}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl font-bold text-white shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    >
                        <Crown size={18} className="text-yellow-300" />
                        Получить защиту стрика
                    </button>

                    <button
                        onClick={handleClose}
                        className="w-full py-3 mt-2 text-gray-500 text-sm font-medium"
                    >
                        Продолжить без защиты
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StreakMilestonePaywall;
