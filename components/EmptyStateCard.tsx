import React from 'react';
import { pluralizeRu } from '../utils/progressUtils';

interface EmptyStateCardProps {
  icon: React.ReactNode;
  title: string;
  currentCount: number;
  requiredCount: number;
  description: string;
  showProgress?: boolean;
  className?: string;
}

const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  icon,
  title,
  currentCount,
  requiredCount,
  description,
  showProgress = false,
  className = '',
}) => {
  const remaining = Math.max(requiredCount - currentCount, 0);
  const progress = Math.min((currentCount / requiredCount) * 100, 100);

  const getMessage = () => {
    if (remaining === 0) return 'Готово!';
    if (remaining === 1) return 'Ещё одна тренировка!';
    if (remaining === 2) return 'Почти готово — ещё 2 тренировки';
    return `Ещё ${remaining} ${pluralizeRu(remaining, 'тренировка', 'тренировки', 'тренировок')}`;
  };

  return (
    <div className={`bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg animate-fade-in ${className}`}>
      {/* Icon and Title */}
      <div className="flex flex-col items-center text-center mb-4">
        <div className="w-16 h-16 rounded-full bg-neutral-800 border border-white/5 flex items-center justify-center mb-3">
          {icon}
        </div>
        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <p className="text-sm text-gray-400">{getMessage()}</p>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 text-center mb-4">{description}</p>

      {/* Progress Bar (optional) */}
      {showProgress && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Прогресс</span>
            <span>{currentCount} / {requiredCount}</span>
          </div>
          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmptyStateCard;
