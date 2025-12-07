import React from 'react';
import { X, Check, Crown, Zap, MessageCircle, BarChart2, Users, Clock, Lock } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';

import { paymentService } from '../services/paymentService';

interface PremiumModalProps {
    onClose: () => void;
    onSuccess?: () => void;
    isPro?: boolean;
    trialEndsAt?: string | null;
}

const PremiumModal: React.FC<PremiumModalProps> = ({ onClose, onSuccess, isPro = false, trialEndsAt }) => {
    // Calculate trial days remaining
    const getTrialDaysRemaining = () => {
        if (!trialEndsAt) return null;
        const endDate = new Date(trialEndsAt);
        const now = new Date();
        const diffTime = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    const trialDays = getTrialDaysRemaining();
    const isInTrial = trialDays !== null && trialDays > 0;

    const handleSubscribe = async () => {
        hapticFeedback.impactOccurred('medium');

        try {
            // 1. Get invoice link (mock or real)
            const invoiceUrl = await paymentService.createInvoice('pro_monthly');

            // 2. Open Invoice in Telegram
            if (window.Telegram?.WebApp?.openInvoice) {
                window.Telegram.WebApp.openInvoice(invoiceUrl, (status) => {
                    if (status === 'paid') {
                        hapticFeedback.notificationOccurred('success');
                        window.Telegram.WebApp.showAlert("Оплата прошла успешно! Pro активирован.");
                        onSuccess?.();
                        onClose();
                    } else if (status === 'cancelled') {
                        hapticFeedback.notificationOccurred('error');
                        // User cancelled
                    } else if (status === 'failed') {
                        hapticFeedback.notificationOccurred('error');
                        window.Telegram.WebApp.showAlert("Ошибка оплаты.");
                    } else {
                        // Pending or other status
                    }
                });
            } else {
                // Fallback for testing outside Telegram
                console.log('[DEV] Opening invoice URL:', invoiceUrl);
                alert(`[DEV] Telegram Invoice would open here.\nURL: ${invoiceUrl}`);
                onClose();
            }
        } catch (e) {
            console.error("Payment error:", e);
            hapticFeedback.notificationOccurred('error');
            window.Telegram?.WebApp?.showAlert("Не удалось создать инвойс.");
        }
    };

    const features = [
        { name: "Персональный план", free: true, pro: true },
        { name: "Трекинг тренировок", free: true, pro: true },
        { name: "AI-тренер в чате", free: false, pro: true },
        { name: "Детальный анализ силы", free: false, pro: true },
        { name: "Команды и лидерборды", free: false, pro: true },
        { name: "Социальные функции", free: false, pro: true },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-3xl overflow-hidden relative shadow-2xl animate-slide-up">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-gray-400 hover:text-white z-10"
                >
                    <X size={20} />
                </button>

                {/* Header Image / Gradient */}
                <div className="h-32 bg-gradient-to-br from-indigo-900 via-purple-900 to-neutral-900 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-indigo-500 rounded-full blur-[60px] opacity-50"></div>

                    <div className="relative z-10 flex flex-col items-center">
                        <Crown size={48} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] mb-2" fill="currentColor" />
                        <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">Sensei Pro</h2>
                        {isInTrial && (
                            <div className="mt-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full flex items-center gap-1.5">
                                <Clock size={12} className="text-green-400" />
                                <span className="text-xs font-bold text-green-400">Триал: {trialDays} дней</span>
                            </div>
                        )}
                        {isPro && !isInTrial && (
                            <div className="mt-2 px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full flex items-center gap-1.5">
                                <Check size={12} className="text-yellow-400" />
                                <span className="text-xs font-bold text-yellow-400">Pro активен</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6">
                    <p className="text-gray-400 text-center text-sm mb-4">
                        Сравни возможности бесплатной и Pro версии
                    </p>

                    {/* Feature Comparison Table */}
                    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 overflow-hidden mb-6">
                        {/* Table Header */}
                        <div className="grid grid-cols-3 gap-2 p-3 border-b border-white/5 bg-neutral-900">
                            <div className="text-xs font-bold text-gray-400">Функция</div>
                            <div className="text-xs font-bold text-gray-500 text-center">Free</div>
                            <div className="text-xs font-bold text-yellow-400 text-center">Pro</div>
                        </div>
                        {/* Table Body */}
                        <div className="divide-y divide-white/5">
                            {features.map((feature, idx) => (
                                <div key={idx} className="grid grid-cols-3 gap-2 p-3 items-center">
                                    <div className="text-xs text-white">{feature.name}</div>
                                    <div className="text-center">
                                        {feature.free === true ? (
                                            <Check size={14} className="text-green-500 mx-auto" />
                                        ) : feature.free === false ? (
                                            <Lock size={14} className="text-gray-600 mx-auto" />
                                        ) : (
                                            <span className="text-[10px] text-gray-500">{feature.free}</span>
                                        )}
                                    </div>
                                    <div className="text-center">
                                        {feature.pro === true ? (
                                            <Check size={14} className="text-yellow-400 mx-auto" />
                                        ) : (
                                            <span className="text-[10px] text-yellow-400">{feature.pro}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Price & CTA */}
                    <div className="bg-neutral-900/50 rounded-2xl p-4 border border-white/5 text-center mb-4">
                        <p className="text-gray-400 text-xs uppercase font-bold mb-1">Специальная цена</p>
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-3xl font-black text-white">500</span>
                            <div className="flex items-center gap-1 bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300 text-xs font-bold">
                                <Crown size={12} fill="currentColor" /> Stars
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">за 30 дней</p>
                    </div>

                    <button
                        onClick={handleSubscribe}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl font-bold text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                        <Crown size={18} fill="currentColor" />
                        Подключить Pro на 30 дней
                    </button>

                    <p className="text-[10px] text-gray-600 text-center mt-3">
                        Отмена в любое время. 7 дней гарантии возврата.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PremiumModal;
