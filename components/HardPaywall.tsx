import React, { useState, useEffect } from 'react';
import { Lock, Crown, Sparkles, X, Check, Clock, Zap } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';
import apiService from '../services/apiService';

interface HardPaywallProps {
    onClose: () => void;
    onOpenPremium: () => void;
    freeWorkoutsUsed: number;
    freeWorkoutsLimit: number;
}

const HardPaywall: React.FC<HardPaywallProps> = ({
    onClose,
    onOpenPremium,
    freeWorkoutsUsed,
    freeWorkoutsLimit
}) => {
    // Track impression and workout limit reached
    useEffect(() => {
        apiService.analytics.track('trial_ended', {
            freeWorkoutsUsed,
            freeWorkoutsLimit
        }).catch(() => {});
        apiService.analytics.track('paywall_impression', {
            source: 'hard_paywall',
            freeWorkoutsUsed,
            freeWorkoutsLimit
        }).catch(() => {});
    }, [freeWorkoutsUsed, freeWorkoutsLimit]);

    const handleOpenPremium = () => {
        apiService.analytics.track('paywall_cta_click', {
            source: 'hard_paywall',
            action: 'open_premium'
        }).catch(() => {});
        hapticFeedback.impactOccurred('light');
        onOpenPremium();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-surface border border-white/10 w-full max-w-sm rounded-3xl overflow-hidden relative shadow-2xl animate-scale-in">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-gray-400 hover:text-white z-10"
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="pt-8 pb-6 px-6 text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-full flex items-center justify-center border border-orange-500/30">
                        <Lock size={36} className="text-orange-400" />
                    </div>

                    <h2 className="text-xl font-black text-white mb-2">
                        Пробный период закончился
                    </h2>

                    <p className="text-gray-400 text-sm">
                        Ты использовал {freeWorkoutsUsed} из {freeWorkoutsLimit} тренировок пробного периода
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="px-6 mb-6">
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <p className="text-center text-[10px] text-gray-500 mt-1">
                        {freeWorkoutsUsed}/{freeWorkoutsLimit} тренировок
                    </p>
                </div>

                {/* Options */}
                <div className="px-6 pb-6 space-y-3">
                    {/* Premium Option - Primary */}
                    <button
                        onClick={handleOpenPremium}
                        className="w-full p-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl text-left relative overflow-hidden group active:scale-[0.98] transition-transform"
                    >
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative flex items-start gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Crown size={20} className="text-yellow-300" fill="currentColor" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-white mb-0.5">Подключить Pro</p>
                                <p className="text-indigo-200 text-xs">
                                    От 250 Stars/мес при годовой подписке
                                </p>
                            </div>
                            <Zap size={20} className="text-yellow-300 flex-shrink-0" />
                        </div>
                    </button>
                </div>

                {/* Pro Benefits */}
                <div className="px-6 pb-6">
                    <div className="bg-neutral-900/50 rounded-xl p-4 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">С Pro ты получишь:</p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                'Безлимитные тренировки',
                                'AI-тренер в чате',
                                'Сохранение серии',
                                'Детальная аналитика'
                            ].map((benefit, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                    <Check size={12} className="text-green-500" />
                                    <span className="text-[10px] text-gray-400">{benefit}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HardPaywall;
