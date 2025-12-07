import React, { useState, useEffect } from 'react';
import { X, Check, Crown, Clock, Lock, Star, Sparkles } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';
import { paymentService } from '../services/paymentService';
import { apiService } from '../services/apiService';

interface PremiumModalProps {
    onClose: () => void;
    onSuccess?: () => void;
    isPro?: boolean;
    trialEndsAt?: string | null;
    isInTrial?: boolean;
    trialDaysLeft?: number;
}

interface PricingPlan {
    id: string;
    label: string;
    price: number;
    monthlyPrice: number;
    days: number;
    discount?: string;
    popular?: boolean;
}

const PRICING_PLANS: PricingPlan[] = [
    {
        id: 'pro_annual',
        label: '1 год',
        price: 3000,
        monthlyPrice: 250,
        days: 365,
        discount: '-50%',
        popular: true
    },
    {
        id: 'pro_6month',
        label: '6 месяцев',
        price: 2000,
        monthlyPrice: 333,
        days: 180,
        discount: '-33%'
    },
    {
        id: 'pro_monthly',
        label: '1 месяц',
        price: 500,
        monthlyPrice: 500,
        days: 30
    }
];

const PremiumModal: React.FC<PremiumModalProps> = ({
    onClose,
    onSuccess,
    isPro = false,
    trialEndsAt,
    isInTrial: isInTrialProp,
    trialDaysLeft: trialDaysLeftProp
}) => {
    const [selectedPlan, setSelectedPlan] = useState<string>('pro_annual');
    const [isLoading, setIsLoading] = useState(false);

    // Calculate trial days remaining
    const getTrialDaysRemaining = () => {
        if (trialDaysLeftProp !== undefined) return trialDaysLeftProp;
        if (!trialEndsAt) return null;
        const endDate = new Date(trialEndsAt);
        const now = new Date();
        const diffTime = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    const trialDays = getTrialDaysRemaining();
    const isInTrial = isInTrialProp !== undefined ? isInTrialProp : (trialDays !== null && trialDays > 0);

    // Track impression on mount
    useEffect(() => {
        apiService.analytics.track('paywall_impression', {
            source: 'premium_modal',
            isInTrial,
            isPro
        }).catch(() => {});
    }, [isInTrial, isPro]);

    const handleClose = () => {
        apiService.analytics.track('paywall_dismissed', {
            source: 'premium_modal',
            selectedPlan
        }).catch(() => {});
        onClose();
    };

    const handleSubscribe = async (planId: string) => {
        apiService.analytics.track('paywall_cta_click', {
            source: 'premium_modal',
            plan: planId
        }).catch(() => {});
        hapticFeedback.impactOccurred('medium');
        setIsLoading(true);

        try {
            const invoiceUrl = await paymentService.createInvoice(planId);

            if (window.Telegram?.WebApp?.openInvoice) {
                window.Telegram.WebApp.openInvoice(invoiceUrl, (status) => {
                    setIsLoading(false);
                    if (status === 'paid') {
                        hapticFeedback.notificationOccurred('success');
                        const plan = PRICING_PLANS.find(p => p.id === planId);
                        window.Telegram.WebApp.showAlert(`Pro активирован на ${plan?.label || '30 дней'}!`);
                        onSuccess?.();
                        onClose();
                    } else if (status === 'cancelled') {
                        hapticFeedback.notificationOccurred('error');
                    } else if (status === 'failed') {
                        hapticFeedback.notificationOccurred('error');
                        window.Telegram.WebApp.showAlert("Ошибка оплаты.");
                    }
                });
            } else {
                setIsLoading(false);
                console.log('[DEV] Opening invoice URL:', invoiceUrl);
                alert(`[DEV] Telegram Invoice would open here.\nURL: ${invoiceUrl}`);
                onClose();
            }
        } catch (e) {
            setIsLoading(false);
            console.error("Payment error:", e);
            hapticFeedback.notificationOccurred('error');
            window.Telegram?.WebApp?.showAlert("Не удалось создать инвойс.");
        }
    };

    const features = [
        { name: "Персональный план", free: true, pro: true },
        { name: "Безлимитные тренировки", free: "3 шт", pro: true },
        { name: "AI-тренер в чате", free: false, pro: true },
        { name: "Детальный анализ силы", free: false, pro: true },
        { name: "Защита стрика", free: false, pro: true },
        { name: "Команды и лидерборды", free: false, pro: true },
    ];

    const selectedPlanData = PRICING_PLANS.find(p => p.id === selectedPlan);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-3xl overflow-hidden relative shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-gray-400 hover:text-white z-10"
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="h-28 bg-gradient-to-br from-indigo-900 via-purple-900 to-neutral-900 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-indigo-500 rounded-full blur-[60px] opacity-50"></div>

                    <div className="relative z-10 flex flex-col items-center">
                        <Crown size={40} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] mb-1" fill="currentColor" />
                        <h2 className="text-xl font-black text-white tracking-tight uppercase">Sensei Pro</h2>
                        {isInTrial && (
                            <div className="mt-1 px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded-full flex items-center gap-1">
                                <Clock size={10} className="text-green-400" />
                                <span className="text-[10px] font-bold text-green-400">Триал: {trialDays} дней</span>
                            </div>
                        )}
                        {isPro && !isInTrial && (
                            <div className="mt-1 px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded-full flex items-center gap-1">
                                <Check size={10} className="text-yellow-400" />
                                <span className="text-[10px] font-bold text-yellow-400">Pro активен</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-5">
                    {/* Pricing Plans */}
                    <div className="mb-4">
                        <p className="text-gray-400 text-center text-xs mb-3">Выбери свой план</p>
                        <div className="grid grid-cols-3 gap-2">
                            {PRICING_PLANS.map((plan) => (
                                <button
                                    key={plan.id}
                                    onClick={() => {
                                        hapticFeedback.selectionChanged();
                                        setSelectedPlan(plan.id);
                                    }}
                                    className={`relative p-3 rounded-xl border-2 transition-all ${
                                        selectedPlan === plan.id
                                            ? 'border-indigo-500 bg-indigo-500/10'
                                            : 'border-white/10 bg-neutral-900/50'
                                    }`}
                                >
                                    {plan.popular && (
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-yellow-500 rounded-full">
                                            <span className="text-[8px] font-black text-black uppercase">Хит</span>
                                        </div>
                                    )}
                                    {plan.discount && (
                                        <div className="absolute -top-2 -right-1 px-1.5 py-0.5 bg-green-500 rounded-full">
                                            <span className="text-[8px] font-bold text-white">{plan.discount}</span>
                                        </div>
                                    )}
                                    <div className="text-center">
                                        <p className="text-[10px] text-gray-400 font-medium mb-1">{plan.label}</p>
                                        <p className="text-lg font-black text-white">{plan.price}</p>
                                        <div className="flex items-center justify-center gap-0.5">
                                            <Star size={8} className="text-yellow-400" fill="currentColor" />
                                            <span className="text-[9px] text-gray-500">Stars</span>
                                        </div>
                                        <p className="text-[9px] text-gray-500 mt-1">{plan.monthlyPrice}/мес</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Feature Comparison */}
                    <div className="bg-neutral-900/50 rounded-xl border border-white/5 overflow-hidden mb-4">
                        <div className="grid grid-cols-3 gap-2 p-2 border-b border-white/5 bg-neutral-900">
                            <div className="text-[10px] font-bold text-gray-400">Функция</div>
                            <div className="text-[10px] font-bold text-gray-500 text-center">Free</div>
                            <div className="text-[10px] font-bold text-yellow-400 text-center">Pro</div>
                        </div>
                        <div className="divide-y divide-white/5">
                            {features.map((feature, idx) => (
                                <div key={idx} className="grid grid-cols-3 gap-2 p-2 items-center">
                                    <div className="text-[10px] text-white">{feature.name}</div>
                                    <div className="text-center">
                                        {feature.free === true ? (
                                            <Check size={12} className="text-green-500 mx-auto" />
                                        ) : feature.free === false ? (
                                            <Lock size={12} className="text-gray-600 mx-auto" />
                                        ) : (
                                            <span className="text-[9px] text-gray-500">{feature.free}</span>
                                        )}
                                    </div>
                                    <div className="text-center">
                                        {feature.pro === true ? (
                                            <Check size={12} className="text-yellow-400 mx-auto" />
                                        ) : (
                                            <span className="text-[9px] text-yellow-400">{feature.pro}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Selected Plan Summary */}
                    <div className="bg-neutral-900/50 rounded-xl p-3 border border-white/5 text-center mb-3">
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-2xl font-black text-white">{selectedPlanData?.price}</span>
                            <div className="flex items-center gap-0.5 bg-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-300 text-[10px] font-bold">
                                <Star size={10} fill="currentColor" /> Stars
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-500">
                            {selectedPlanData?.label} • {selectedPlanData?.monthlyPrice} Stars/мес
                        </p>
                    </div>

                    <button
                        onClick={() => handleSubscribe(selectedPlan)}
                        disabled={isLoading}
                        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl font-bold text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <span className="animate-pulse">Загрузка...</span>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                Подключить Pro
                            </>
                        )}
                    </button>

                    <p className="text-[9px] text-gray-600 text-center mt-2">
                        Отмена в любое время. Гарантия возврата.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PremiumModal;
