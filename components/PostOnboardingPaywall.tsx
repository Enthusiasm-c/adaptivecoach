import React, { useEffect } from 'react';
import { Crown, Sparkles, Check, Dumbbell, MessageCircle, BarChart2, Shield, ChevronRight } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';
import apiService from '../services/apiService';

interface PostOnboardingPaywallProps {
    onContinue: () => void;
    userName?: string;
}

const PostOnboardingPaywall: React.FC<PostOnboardingPaywallProps> = ({
    onContinue,
    userName
}) => {
    // Track impression on mount
    useEffect(() => {
        apiService.analytics.track('trial_info_shown', {
            source: 'post_onboarding'
        }).catch(() => {});
    }, []);

    const handleContinue = () => {
        apiService.analytics.track('trial_acknowledged', {
            source: 'post_onboarding'
        }).catch(() => {});
        hapticFeedback.impactOccurred('medium');
        onContinue();
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
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-500/20 to-green-400/20 rounded-full flex items-center justify-center border border-green-500/30">
                        <Check size={40} className="text-green-400" />
                    </div>
                    <h1 className="text-2xl font-black text-white mb-2">
                        {userName ? `${userName}, твой план готов!` : 'Твой план готов!'}
                    </h1>
                    <p className="text-gray-400">
                        Персональная программа создана под твои цели
                    </p>
                </div>

                {/* Trial Info Card */}
                <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-3xl p-6 border border-indigo-500/30 mb-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                            <Crown size={24} className="text-yellow-400" fill="currentColor" />
                        </div>
                        <div>
                            <p className="font-bold text-white">Пробный период Pro активирован!</p>
                            <p className="text-sm text-indigo-300">14 дней ИЛИ 5 тренировок</p>
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

                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 mb-4">
                        <p className="text-xs text-indigo-200">
                            Триал закончится когда наступит первое из двух условий. Используйте все возможности!
                        </p>
                    </div>

                    <button
                        onClick={handleContinue}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl font-bold text-white shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    >
                        <Sparkles size={18} />
                        Начать тренировки
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PostOnboardingPaywall;
