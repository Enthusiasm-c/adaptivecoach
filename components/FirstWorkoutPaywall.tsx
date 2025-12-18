import React, { useEffect } from 'react';
import { Trophy, Sparkles, BarChart2, MessageCircle, X } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';
import apiService from '../services/apiService';

interface FirstWorkoutPaywallProps {
    onClose: () => void;
    onStartTrial: () => void;
}

const FirstWorkoutPaywall: React.FC<FirstWorkoutPaywallProps> = ({
    onClose,
    onStartTrial
}) => {
    const [isStartingTrial, setIsStartingTrial] = React.useState(false);

    // Track impression on mount
    useEffect(() => {
        apiService.analytics.track('paywall_impression', {
            source: 'first_workout'
        }).catch(() => {});
    }, []);

    const handleStartTrial = async () => {
        apiService.analytics.track('paywall_cta_click', {
            source: 'first_workout',
            action: 'start_trial'
        }).catch(() => {});
        hapticFeedback.impactOccurred('medium');
        setIsStartingTrial(true);

        try {
            const result = await apiService.monetization.startTrial();
            if (result.success) {
                apiService.analytics.track('trial_started', {
                    source: 'first_workout'
                }).catch(() => {});
                hapticFeedback.notificationOccurred('success');
                onStartTrial();
            } else {
                hapticFeedback.notificationOccurred('error');
                onClose();
            }
        } catch (error) {
            console.error('Start trial error:', error);
            hapticFeedback.notificationOccurred('error');
            onClose();
        } finally {
            setIsStartingTrial(false);
        }
    };

    const handleClose = () => {
        apiService.analytics.track('paywall_dismissed', {
            source: 'first_workout'
        }).catch(() => {});
        hapticFeedback.impactOccurred('light');
        onClose();
    };

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
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-500/20 to-green-400/20 rounded-full flex items-center justify-center border border-green-500/30 animate-bounce-slow">
                        <Trophy size={40} className="text-green-400" />
                    </div>

                    <h2 className="text-2xl font-black text-white mb-2">
                        Первая тренировка!
                    </h2>

                    <p className="text-gray-400 text-sm">
                        Отличное начало! Разблокируй AI-анализ своей тренировки
                    </p>
                </div>

                {/* Benefits */}
                <div className="px-6 pb-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                            <BarChart2 size={20} className="text-indigo-400" />
                            <div>
                                <p className="text-white font-bold text-sm">Анализ силы</p>
                                <p className="text-gray-400 text-xs">Отслеживай прогресс в ключевых упражнениях</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                            <MessageCircle size={20} className="text-violet-400" />
                            <div>
                                <p className="text-white font-bold text-sm">AI-тренер</p>
                                <p className="text-gray-400 text-xs">Персональные рекомендации после тренировки</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CTA */}
                <div className="px-6 pb-6">
                    <button
                        onClick={handleStartTrial}
                        disabled={isStartingTrial}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl font-bold text-white shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isStartingTrial ? (
                            <span className="animate-pulse">Активация...</span>
                        ) : (
                            <>
                                <Sparkles size={18} />
                                14 дней Pro бесплатно
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleClose}
                        className="w-full py-3 mt-2 text-gray-500 text-sm font-medium"
                    >
                        Позже
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FirstWorkoutPaywall;
