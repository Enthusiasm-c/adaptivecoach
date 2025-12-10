import React from 'react';
import { Battery, Moon, Apple, Brain, Dumbbell } from 'lucide-react';
import { ReadinessData } from '../types';
import { getReadinessRecommendation } from '../utils/progressUtils';

interface ReadinessCardProps {
    readiness: ReadinessData | null;
}

const ReadinessCard: React.FC<ReadinessCardProps> = ({ readiness }) => {
    const recommendation = getReadinessRecommendation(readiness);

    const colorClasses = {
        green: {
            bg: 'bg-green-500/20',
            border: 'border-green-500/30',
            text: 'text-green-400',
            bar: 'bg-green-500'
        },
        yellow: {
            bg: 'bg-yellow-500/20',
            border: 'border-yellow-500/30',
            text: 'text-yellow-400',
            bar: 'bg-yellow-500'
        },
        red: {
            bg: 'bg-red-500/20',
            border: 'border-red-500/30',
            text: 'text-red-400',
            bar: 'bg-red-500'
        },
        gray: {
            bg: 'bg-gray-500/20',
            border: 'border-gray-500/30',
            text: 'text-gray-400',
            bar: 'bg-gray-500'
        }
    };

    const colors = colorClasses[recommendation.color as keyof typeof colorClasses];

    const metrics = [
        { icon: Moon, label: 'Сон', value: readiness?.sleep || 0, color: 'text-indigo-400' },
        { icon: Apple, label: 'Еда', value: readiness?.food || 0, color: 'text-green-400' },
        { icon: Brain, label: 'Стресс', value: readiness?.stress || 0, color: 'text-pink-400' },
        { icon: Dumbbell, label: 'Мышцы', value: readiness?.soreness || 0, color: 'text-orange-400' }
    ];

    return (
        <div className={`${colors.bg} border ${colors.border} rounded-3xl p-5 shadow-lg`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Battery size={18} className={colors.text} />
                    <span className="text-gray-300 font-bold text-sm">Готовность</span>
                </div>
                <span className={`text-2xl font-black ${colors.text}`}>
                    {recommendation.percentage}%
                </span>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-neutral-800 rounded-full overflow-hidden mb-4">
                <div
                    className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                    style={{ width: `${recommendation.percentage}%` }}
                />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
                {metrics.map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="bg-neutral-900/50 rounded-xl p-2 text-center">
                        <Icon size={16} className={`mx-auto mb-1 ${color}`} />
                        <div className="text-white font-bold text-sm">{value}/5</div>
                        <div className="text-gray-500 text-[10px]">{label}</div>
                    </div>
                ))}
            </div>

            {/* Recommendation */}
            <div className={`text-center text-sm font-medium ${colors.text}`}>
                {recommendation.message}
            </div>
        </div>
    );
};

export default ReadinessCard;
