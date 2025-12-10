import React from 'react';
import { Target, Sparkles } from 'lucide-react';
import { WorkoutLog } from '../types';
import { pluralizeRu } from '../utils/progressUtils';

interface CalibrationCardProps {
    logs: WorkoutLog[];
}

const MIN_WORKOUTS = 5;

// Mini spider chart preview showing muscle groups
const SpiderPreview: React.FC = () => {
    // 6 points for hexagon shape
    const points = [
        { x: 60, y: 15, label: 'Грудь' },
        { x: 100, y: 40, label: 'Спина' },
        { x: 100, y: 80, label: 'Ноги' },
        { x: 60, y: 105, label: 'Плечи' },
        { x: 20, y: 80, label: 'Руки' },
        { x: 20, y: 40, label: 'Кор' },
    ];

    // Create path for outer hexagon
    const outerPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

    // Create path for inner data (preview - random values for visual)
    const innerPoints = points.map(p => ({
        x: 60 + (p.x - 60) * 0.6,
        y: 60 + (p.y - 60) * 0.6,
    }));
    const innerPath = innerPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

    return (
        <div className="relative w-[120px] h-[120px] flex-shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full">
                {/* Grid lines */}
                <path d={outerPath} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <path
                    d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${60 + (p.x - 60) * 0.66} ${60 + (p.y - 60) * 0.66}`).join(' ') + ' Z'}
                    fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"
                />
                <path
                    d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${60 + (p.x - 60) * 0.33} ${60 + (p.y - 60) * 0.33}`).join(' ') + ' Z'}
                    fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"
                />

                {/* Data area - blurred/preview */}
                <path
                    d={innerPath}
                    fill="rgba(99, 102, 241, 0.2)"
                    stroke="rgba(99, 102, 241, 0.5)"
                    strokeWidth="2"
                    className="blur-[2px]"
                />

                {/* Axis lines */}
                {points.map((p, i) => (
                    <line key={i} x1="60" y1="60" x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                ))}

                {/* Center dot */}
                <circle cx="60" cy="60" r="2" fill="rgba(255,255,255,0.2)" />
            </svg>

            {/* Question marks overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl text-gray-600 font-bold">?</span>
            </div>
        </div>
    );
};

const CalibrationCard: React.FC<CalibrationCardProps> = ({ logs }) => {
    const workoutCount = logs.length;
    const isCalibrated = workoutCount >= MIN_WORKOUTS;
    const progress = Math.min((workoutCount / MIN_WORKOUTS) * 100, 100);
    const remaining = Math.max(MIN_WORKOUTS - workoutCount, 0);

    if (isCalibrated) {
        // После калибровки - показать что анализ готов
        return (
            <div className="bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 rounded-3xl p-5 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-500/30 rounded-xl flex items-center justify-center">
                        <Sparkles size={24} className="text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold">Калибровка завершена!</h3>
                        <p className="text-indigo-300 text-sm">Данные о твоей силе собраны</p>
                    </div>
                </div>
            </div>
        );
    }

    // До калибровки - показать прогресс с превью паутинки
    return (
        <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
            <div className="flex gap-4">
                {/* Spider Preview */}
                <SpiderPreview />

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-3">
                        <Target size={18} className="text-indigo-400" />
                        <h3 className="text-white font-bold text-sm">Анализ силы</h3>
                    </div>

                    {/* Progress */}
                    <div className="mb-2">
                        <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-gray-500">Тренировок</span>
                            <span className="text-white font-bold">{workoutCount} / {MIN_WORKOUTS}</span>
                        </div>
                        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-gray-500 text-[10px] leading-relaxed">
                        Ещё {remaining} {pluralizeRu(remaining, 'тренировка', 'тренировки', 'тренировок')} — и мы покажем твои сильные и отстающие группы мышц
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CalibrationCard;
