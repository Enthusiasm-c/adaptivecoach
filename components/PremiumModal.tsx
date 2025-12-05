import React from 'react';
import { X, Check, Crown, Zap, MessageCircle, BarChart2, Users } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';

import { paymentService } from '../services/paymentService';

interface PremiumModalProps {
    onClose: () => void;
    onSuccess?: () => void;
}

const PremiumModal: React.FC<PremiumModalProps> = ({ onClose, onSuccess }) => {
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

    const benefits = [
        {
            icon: <Zap size={20} className="text-yellow-400" />,
            title: "Умная Адаптация",
            desc: "ИИ меняет план, если болит спина или нет сил."
        },
        {
            icon: <MessageCircle size={20} className="text-indigo-400" />,
            title: "Чат с Тренером",
            desc: "Безлимитные вопросы по технике и питанию."
        },
        {
            icon: <BarChart2 size={20} className="text-emerald-400" />,
            title: "Pro Аналитика",
            desc: "Прогноз рекордов, баланс мышц, тренды."
        },
        {
            icon: <Users size={20} className="text-pink-400" />,
            title: "Squads Pro",
            desc: "Полная история друзей и секретные бейджи."
        }
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
                        <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">Adaptive Pro</h2>
                    </div>
                </div>

                <div className="p-6">
                    <p className="text-gray-400 text-center text-sm mb-6">
                        Разблокируй полный потенциал ИИ-тренера и достигай целей в 2 раза быстрее.
                    </p>

                    <div className="space-y-4 mb-8">
                        {benefits.map((benefit, idx) => (
                            <div key={idx} className="flex items-start gap-3">
                                <div className="shrink-0 mt-0.5 bg-white/5 p-1.5 rounded-lg border border-white/5">
                                    {benefit.icon}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">{benefit.title}</h3>
                                    <p className="text-xs text-gray-500">{benefit.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Price & CTA */}
                    <div className="bg-neutral-900/50 rounded-2xl p-4 border border-white/5 text-center mb-4">
                        <p className="text-gray-400 text-xs uppercase font-bold mb-1">Специальная цена</p>
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-3xl font-black text-white">250</span>
                            <div className="flex items-center gap-1 bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300 text-xs font-bold">
                                <Crown size={12} fill="currentColor" /> Stars
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">~ $5.00 / месяц</p>
                    </div>

                    <button
                        onClick={handleSubscribe}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl font-bold text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                        <Crown size={18} fill="currentColor" />
                        Подключить Pro
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
