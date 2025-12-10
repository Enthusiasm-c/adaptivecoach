import React from 'react';
import { Target, ChevronRight, Sparkles } from 'lucide-react';
import { WorkoutLog } from '../types';
import { hapticFeedback } from '../utils/hapticUtils';

interface CalibrationCardProps {
    logs: WorkoutLog[];
    onViewAnalysis?: () => void;
}

const MIN_WORKOUTS = 5;

const CalibrationCard: React.FC<CalibrationCardProps> = ({ logs, onViewAnalysis }) => {
    const workoutCount = logs.length;
    const isCalibrated = workoutCount >= MIN_WORKOUTS;
    const progress = Math.min((workoutCount / MIN_WORKOUTS) * 100, 100);
    const remaining = Math.max(MIN_WORKOUTS - workoutCount, 0);

    const handleClick = () => {
        if (isCalibrated && onViewAnalysis) {
            hapticFeedback.impactOccurred('light');
            onViewAnalysis();
        }
    };

    if (isCalibrated) {
        // После калибровки - показать что анализ готов
        return (
            <div
                onClick={handleClick}
                className="bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 rounded-3xl p-5 shadow-lg cursor-pointer active:scale-[0.98] transition-transform"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-500/30 rounded-xl flex items-center justify-center">
                            <Sparkles size={24} className="text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold">Анализ силы готов</h3>
                            <p className="text-indigo-300 text-sm">Посмотри свои показатели</p>
                        </div>
                    </div>
                    <ChevronRight size={20} className="text-indigo-400" />
                </div>
            </div>
        );
    }

    // До калибровки - показать прогресс
    return (
        <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center">
                    <Target size={24} className="text-gray-400" />
                </div>
                <div>
                    <h3 className="text-white font-bold">Калибровка силы</h3>
                    <p className="text-gray-500 text-sm">Идёт сбор данных</p>
                </div>
            </div>

            {/* Progress */}
            <div className="mb-3">
                <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-400">Выполнено тренировок</span>
                    <span className="text-white font-bold">{workoutCount} из {MIN_WORKOUTS}</span>
                </div>
                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Message */}
            <p className="text-gray-500 text-xs text-center">
                Ещё {remaining} {remaining === 1 ? 'тренировка' : remaining < 5 ? 'тренировки' : 'тренировок'} для анализа силовых показателей
            </p>
        </div>
    );
};

export default CalibrationCard;
