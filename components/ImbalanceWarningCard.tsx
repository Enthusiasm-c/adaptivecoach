/**
 * ImbalanceWarningCard Component
 *
 * Shows muscle imbalance warnings on the Dashboard.
 * Available to both Free and Pro users with different CTAs.
 */

import React from 'react';
import { ImbalanceReport } from '../types';
import { getImbalanceDisplay } from '../utils/strengthAnalysisUtils';
import { AlertTriangle, Scale, ChevronRight, Info, Sparkles } from 'lucide-react';

interface ImbalanceWarningCardProps {
  imbalances: ImbalanceReport[];
  onLearnMore: (imbalance: ImbalanceReport) => void;
  onViewDetails: () => void;
  isPro: boolean;
}

const ImbalanceWarningCard: React.FC<ImbalanceWarningCardProps> = ({
  imbalances,
  onLearnMore,
  onViewDetails,
  isPro,
}) => {
  if (imbalances.length === 0) {
    return null;
  }

  return (
    <div className="bg-neutral-800/80 rounded-2xl border border-amber-500/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-400" />
        <span className="text-sm font-medium text-amber-300">
          Обнаружен дисбаланс
        </span>
      </div>

      {/* Imbalances List */}
      <div className="p-4 space-y-3">
        {imbalances.map((imbalance, index) => (
          <ImbalanceItem
            key={index}
            imbalance={imbalance}
            onLearnMore={() => onLearnMore(imbalance)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-neutral-800/50 border-t border-neutral-700/50 flex gap-2">
        <button
          onClick={onViewDetails}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
            isPro
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white'
          }`}
        >
          {isPro ? (
            <>
              <Scale size={14} />
              Анализ силы
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Полный анализ
              <ChevronRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

interface ImbalanceItemProps {
  imbalance: ImbalanceReport;
  onLearnMore: () => void;
}

const ImbalanceItem: React.FC<ImbalanceItemProps> = ({ imbalance, onLearnMore }) => {
  const display = getImbalanceDisplay(imbalance.type, imbalance.severity);

  const severityLabel = {
    severe: 'Серьёзный',
    moderate: 'Умеренный',
    minor: 'Небольшой',
  }[imbalance.severity];

  return (
    <div className={`rounded-xl p-3 ${display.bgColor}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${display.bgColor}`}>
          <Scale size={18} className={display.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${display.color}`}>
              {display.title}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${display.bgColor} ${display.color}`}>
              {severityLabel}
            </span>
          </div>
          <p className="text-sm text-gray-300 line-clamp-2">
            {imbalance.description}
          </p>
          {imbalance.recommendation && (
            <button
              onClick={onLearnMore}
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <Info size={12} />
              Подробнее
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImbalanceWarningCard;
