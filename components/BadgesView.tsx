import React, { useState, useEffect } from 'react';
import { X, Lock, Loader2, Crown, Sparkles } from 'lucide-react';
import { apiService, Badge } from '../services/apiService';
import { hapticFeedback } from '../utils/hapticUtils';

interface BadgesViewProps {
  onClose: () => void;
}

// Premium badge codes
const PREMIUM_BADGES = ['pro_member', 'supporter'];

const isPremiumBadge = (code: string) => PREMIUM_BADGES.includes(code);

const tierColors: Record<string, { bg: string; border: string; text: string }> = {
  bronze: { bg: 'bg-amber-900/20', border: 'border-amber-700/50', text: 'text-amber-400' },
  silver: { bg: 'bg-gray-500/20', border: 'border-gray-400/50', text: 'text-gray-300' },
  gold: { bg: 'bg-yellow-500/20', border: 'border-yellow-400/50', text: 'text-yellow-400' },
  diamond: { bg: 'bg-cyan-500/20', border: 'border-cyan-400/50', text: 'text-cyan-400' },
};

// Special premium badge styling
const premiumBadgeStyle = {
  bg: 'bg-gradient-to-br from-amber-500/20 to-yellow-500/10',
  border: 'border-amber-500/50',
  text: 'text-amber-300',
  glow: 'shadow-[0_0_15px_rgba(251,191,36,0.3)]'
};

const categoryLabels: Record<string, string> = {
  streak: 'Streak',
  volume: 'Volume',
  pr: 'PRs',
  social: 'Social',
  milestone: 'Milestones',
};

const BadgesView: React.FC<BadgesViewProps> = ({ onClose }) => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const response = await apiService.badges.getAll();
        setBadges(response.badges || []);
      } catch (e) {
        console.error('Failed to fetch badges:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchBadges();
  }, []);

  const handleBadgeClick = (badge: Badge) => {
    hapticFeedback.impactOccurred('light');
    setSelectedBadge(badge);
  };

  const earnedCount = badges.filter(b => b.earned).length;
  const totalCount = badges.length;

  // Group badges by category
  const badgesByCategory = badges.reduce((acc, badge) => {
    if (!acc[badge.category]) {
      acc[badge.category] = [];
    }
    acc[badge.category].push(badge);
    return acc;
  }, {} as Record<string, Badge[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111] border border-white/10 w-full max-w-lg h-[85vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">Достижения</h2>
            <p className="text-xs text-gray-500">{earnedCount} из {totalCount} получено</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 rounded-full text-gray-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-2">
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: totalCount > 0 ? `${(earnedCount / totalCount) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
          ) : (
            Object.entries(badgesByCategory).map(([category, categoryBadges]: [string, Badge[]]) => (
              <div key={category}>
                <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">
                  {categoryLabels[category] || category}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {categoryBadges.map((badge) => {
                    const isPremium = isPremiumBadge(badge.code);
                    const tier = isPremium && badge.earned
                      ? { bg: premiumBadgeStyle.bg, border: premiumBadgeStyle.border, text: premiumBadgeStyle.text }
                      : (tierColors[badge.tier] || tierColors.bronze);

                    return (
                      <button
                        key={badge.id}
                        onClick={() => handleBadgeClick(badge)}
                        className={`relative aspect-square rounded-2xl border ${tier.border} ${tier.bg}
                          flex flex-col items-center justify-center p-2 transition-all
                          ${badge.earned
                            ? `opacity-100 hover:scale-105 ${isPremium ? premiumBadgeStyle.glow : ''}`
                            : 'opacity-40 grayscale'
                          }`}
                      >
                        {/* Premium badge crown indicator */}
                        {isPremium && badge.earned && (
                          <div className="absolute -top-1 -left-1">
                            <Crown size={14} className="text-amber-400 fill-amber-400" />
                          </div>
                        )}

                        <span className={`text-3xl mb-1 ${isPremium && badge.earned ? 'animate-pulse' : ''}`}>{badge.icon}</span>
                        <span className={`text-[10px] font-bold text-center leading-tight ${tier.text}`}>
                          {badge.name_ru || badge.name_en || 'Достижение'}
                        </span>
                        {!badge.earned && (
                          <div className="absolute top-1 right-1">
                            <Lock size={12} className="text-gray-500" />
                          </div>
                        )}
                        {badge.earned && !isPremium && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-[10px]">✓</span>
                          </div>
                        )}
                        {badge.earned && isPremium && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-full flex items-center justify-center">
                            <Sparkles size={10} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Badge detail modal */}
        {selectedBadge && (
          <div
            className="absolute inset-0 bg-black/90 flex items-center justify-center p-6 animate-fade-in"
            onClick={() => setSelectedBadge(null)}
          >
            <div
              className="bg-neutral-900 rounded-3xl p-6 max-w-xs w-full text-center border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <div className={`w-24 h-24 mx-auto mb-4 rounded-2xl
                ${tierColors[selectedBadge.tier]?.bg || tierColors.bronze.bg}
                ${tierColors[selectedBadge.tier]?.border || tierColors.bronze.border}
                border-2 flex items-center justify-center
                ${selectedBadge.earned ? '' : 'grayscale opacity-50'}`}
              >
                <span className="text-5xl">{selectedBadge.icon}</span>
              </div>

              <h3 className="text-xl font-bold text-white mb-1">{selectedBadge.name_ru || selectedBadge.name_en || 'Достижение'}</h3>
              <p className="text-sm text-gray-400 mb-4">{selectedBadge.description_ru || selectedBadge.description_en || ''}</p>

              <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                ${tierColors[selectedBadge.tier]?.bg || tierColors.bronze.bg}
                ${tierColors[selectedBadge.tier]?.text || tierColors.bronze.text}`}
              >
                {selectedBadge.tier}
              </div>

              {selectedBadge.earned && selectedBadge.earned_at && (
                <p className="text-xs text-gray-500 mt-3">
                  Получено: {new Date(selectedBadge.earned_at).toLocaleDateString('ru-RU')}
                </p>
              )}

              {!selectedBadge.earned && selectedBadge.threshold && (
                <p className="text-xs text-gray-500 mt-3">
                  Цель: {selectedBadge.threshold}
                </p>
              )}

              <button
                onClick={() => setSelectedBadge(null)}
                className="mt-6 w-full py-3 bg-white/10 rounded-xl font-bold text-white hover:bg-white/20 transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BadgesView;
