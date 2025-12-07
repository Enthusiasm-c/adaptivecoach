import React from 'react';
import { Clock, Sparkles } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';

interface TrialBannerProps {
    daysLeft: number;
    onUpgrade: () => void;
}

const TrialBanner: React.FC<TrialBannerProps> = ({ daysLeft, onUpgrade }) => {
    if (daysLeft <= 0) return null;

    const isUrgent = daysLeft <= 3;

    const handleUpgrade = () => {
        hapticFeedback.impactOccurred('medium');
        onUpgrade();
    };

    const getDaysText = (days: number) => {
        if (days === 1) return 'день';
        if (days >= 2 && days <= 4) return 'дня';
        return 'дней';
    };

    return (
        <div className={`col-span-2 p-4 rounded-2xl border ${
            isUrgent
                ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30'
                : 'bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border-indigo-500/30'
        }`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isUrgent ? 'bg-amber-500/20' : 'bg-indigo-500/20'
                    }`}>
                        <Clock size={20} className={isUrgent ? 'text-amber-400' : 'text-indigo-400'} />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm">
                            Pro триал: {daysLeft} {getDaysText(daysLeft)}
                        </p>
                        <p className="text-gray-400 text-xs">
                            {isUrgent ? 'Успей продлить со скидкой!' : 'Все Pro-функции доступны'}
                        </p>
                    </div>
                </div>
                {isUrgent && (
                    <button
                        onClick={handleUpgrade}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs rounded-xl flex items-center gap-1 shadow-lg shadow-amber-500/20 active:scale-95 transition-transform"
                    >
                        <Sparkles size={14} />
                        -50%
                    </button>
                )}
            </div>
        </div>
    );
};

export default TrialBanner;
