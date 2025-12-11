import React, { useState, useEffect } from 'react';
import { Crown, Clock, Sparkles, Check, Dumbbell, MessageCircle, BarChart2, Shield, ChevronRight } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';
import apiService from '../services/apiService';

interface PostOnboardingPaywallProps {
    onStartTrial: () => void;
    onContinueFree: () => void;
    userName?: string;
}

const PostOnboardingPaywall: React.FC<PostOnboardingPaywallProps> = ({
    onStartTrial,
    onContinueFree,
    userName
}) => {
    const [isStartingTrial, setIsStartingTrial] = useState(false);

    // Track impression on mount
    useEffect(() => {
        apiService.analytics.track('paywall_impression', {
            source: 'post_onboarding'
        }).catch(() => {});
    }, []);

    const handleStartTrial = async () => {
        apiService.analytics.track('paywall_cta_click', {
            source: 'post_onboarding',
            action: 'start_trial'
        }).catch(() => {});
        hapticFeedback.impactOccurred('medium');
        setIsStartingTrial(true);

        try {
            const result = await apiService.monetization.startTrial();
            if (result.success) {
                apiService.analytics.track('trial_started', {
                    source: 'post_onboarding'
                }).catch(() => {});
                hapticFeedback.notificationOccurred('success');
                onStartTrial();
            } else {
                hapticFeedback.notificationOccurred('error');
                // Still proceed but without trial
                onContinueFree();
            }
        } catch (error) {
            console.error('Start trial error:', error);
            hapticFeedback.notificationOccurred('error');
            onContinueFree();
        } finally {
            setIsStartingTrial(false);
        }
    };

    const handleContinueFree = () => {
        apiService.analytics.track('paywall_dismissed', {
            source: 'post_onboarding'
        }).catch(() => {});
        hapticFeedback.impactOccurred('light');
        onContinueFree();
    };

    const proFeatures = [
        { icon: Dumbbell, text: 'Безлимитные тренировки' },
        { icon: MessageCircle, text: 'AI-тренер в чате' },
        { icon: BarChart2, text: 'Детальная аналитика силы' },
        { icon: Shield, text: 'Сохранение серии (1 пропуск)' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
            <div className="w-full max-w-sm">
                {/* Success Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center border border-green-500/30">
                        <Check size={40} className="text-green-400" />
                    </div>
                    <h1 className="text-2xl font-black text-white mb-2">
                        {userName ? `${userName}, твой план готов!` : 'Твой план готов!'}
                    </h1>
                    <p className="text-gray-400">
                        Персональная программа создана под твои цели
                    </p>
                </div>

                {/* Trial Card - Primary CTA */}
                <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-3xl p-6 border border-indigo-500/30 mb-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                            <Crown size={24} className="text-yellow-400" fill="currentColor" />
                        </div>
                        <div>
                            <p className="font-bold text-white">14 дней Pro бесплатно</p>
                            <p className="text-sm text-indigo-300">Попробуй все возможности</p>
                        </div>
                    </div>

                    {/* Pro Features */}
                    <div className="space-y-2 mb-5">
                        {proFeatures.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <feature.icon size={14} className="text-indigo-400" />
                                <span className="text-sm text-white">{feature.text}</span>
                            </div>
                        ))}
                    </div>

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
                                Начать бесплатный триал
                            </>
                        )}
                    </button>

                    <p className="text-center text-[10px] text-indigo-300/60 mt-2">
                        Без оплаты. Отмена в любое время.
                    </p>
                </div>

                {/* Continue Free - Secondary */}
                <button
                    onClick={handleContinueFree}
                    className="w-full py-3 text-gray-500 text-sm font-medium flex items-center justify-center gap-1 hover:text-gray-400 transition-colors"
                >
                    Продолжить бесплатно (3 тренировки)
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
};

export default PostOnboardingPaywall;
