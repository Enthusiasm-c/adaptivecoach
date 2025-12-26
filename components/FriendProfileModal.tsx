import React, { useState, useEffect } from 'react';
import { X, Zap, Trash2, Award, TrendingUp, Dumbbell, Loader2 } from 'lucide-react';
import { FriendProfile, ActivityFeedItem } from '../types';
import { hapticFeedback } from '../utils/hapticUtils';
import { socialService } from '../services/socialService';
import { apiService, Badge, EnhancedUserProfile } from '../services/apiService';

interface FriendProfileModalProps {
    friend: FriendProfile;
    feed: ActivityFeedItem[];
    onClose: () => void;
    onNudge: (id: number, name: string) => void;
    onRemove?: (id: number) => void;
    myTotalVolume?: number;
    myStreak?: number;
}

const tierColors: Record<string, string> = {
    bronze: 'text-amber-400',
    silver: 'text-gray-300',
    gold: 'text-yellow-400',
    diamond: 'text-cyan-400',
};

const FriendProfileModal: React.FC<FriendProfileModalProps> = ({
    friend,
    feed,
    onClose,
    onNudge,
    onRemove,
    myTotalVolume = 0,
    myStreak = 0
}) => {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<EnhancedUserProfile | null>(null);
    const [activeTab, setActiveTab] = useState<'stats' | 'badges' | 'workouts'>('stats');

    useEffect(() => {
        const loadProfile = async () => {
            try {
                // Use telegramId if available, fallback to id
                const profileId = friend.telegramId || friend.id;
                const data = await apiService.social.getUserProfile(profileId);
                setProfile(data);
            } catch (e) {
                console.error('Failed to load enhanced profile:', e);
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, [friend.id, friend.telegramId]);

    const friendActivities = feed.filter(item => String(item.userId) === String(friend.id));

    const handleRemove = async () => {
        if (confirm(`Удалить ${friend.name} из друзей?`)) {
            hapticFeedback.notificationOccurred('warning');
            await socialService.removeFriend(friend.id);
            onRemove?.(friend.id);
            onClose();
        }
    };

    // Calculate comparison percentages
    const friendVolume = profile?.user?.total_volume || friend.totalVolume || 0;
    const friendStreak = profile?.user?.streak_days || friend.streak || 0;
    const maxVolume = Math.max(myTotalVolume, friendVolume) || 1;
    const maxStreak = Math.max(myStreak, friendStreak) || 1;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-surface border border-white/10 w-full max-w-sm rounded-3xl overflow-hidden relative shadow-2xl animate-slide-up max-h-[85vh] flex flex-col">

                {/* Header Image */}
                <div className="h-24 bg-gradient-to-r from-indigo-900 to-purple-900 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-black/20 rounded-full text-white hover:bg-black/40 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Profile Info */}
                <div className="px-6 -mt-10 mb-4">
                    <div className="relative inline-block">
                        <div className="w-20 h-20 rounded-full bg-neutral-800 border-4 border-surface flex items-center justify-center text-2xl font-bold text-gray-400 overflow-hidden">
                            {friend.photoUrl ? (
                                <img src={friend.photoUrl} alt={friend.name} className="w-full h-full object-cover" />
                            ) : (
                                friend.name[0]
                            )}
                        </div>
                        {friend.isOnline && (
                            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-surface"></div>
                        )}
                    </div>
                </div>

                <div className="px-6 mb-4">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-2xl font-black text-white">{friend.name}</h2>
                        <button
                            onClick={() => onNudge(friend.id, friend.name)}
                            className="px-3 py-2 bg-yellow-500 text-black font-bold rounded-xl text-sm flex items-center gap-1.5 hover:bg-yellow-400 transition active:scale-95"
                        >
                            <Zap size={14} fill="currentColor" /> Пнуть
                        </button>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span>Level {profile?.user?.level || friend.level}</span>
                        <span>•</span>
                        <span>{friendStreak} day streak</span>
                        {profile?.workoutCount && (
                            <>
                                <span>•</span>
                                <span>{profile.workoutCount} workouts</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="px-6 mb-4">
                    <div className="flex p-1 bg-neutral-900 rounded-xl border border-white/5">
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'stats' ? 'bg-neutral-800 text-white' : 'text-gray-500'}`}
                        >
                            <TrendingUp size={12} /> Сравнение
                        </button>
                        <button
                            onClick={() => setActiveTab('badges')}
                            className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'badges' ? 'bg-amber-600 text-white' : 'text-gray-500'}`}
                        >
                            <Award size={12} /> Бейджи
                        </button>
                        <button
                            onClick={() => setActiveTab('workouts')}
                            className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'workouts' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}
                        >
                            <Dumbbell size={12} /> Тренировки
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 flex-1 overflow-y-auto min-h-[280px] pb-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin text-indigo-500" size={24} />
                        </div>
                    ) : (
                        <>
                            {/* Stats Tab - Comparison */}
                            {activeTab === 'stats' && (
                                <div className="space-y-4 animate-fade-in">
                                    {/* Volume Comparison */}
                                    <div className="bg-neutral-900/50 border border-white/5 p-4 rounded-2xl">
                                        <div className="text-gray-500 text-xs font-bold uppercase mb-3">Total Volume</div>
                                        <div className="space-y-2">
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-indigo-400 font-bold">Вы</span>
                                                    <span className="text-white font-bold">{(myTotalVolume / 1000).toFixed(1)}t</span>
                                                </div>
                                                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-500 rounded-full transition-all"
                                                        style={{ width: `${(myTotalVolume / maxVolume) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-purple-400 font-bold">{friend.name}</span>
                                                    <span className="text-white font-bold">{(friendVolume / 1000).toFixed(1)}t</span>
                                                </div>
                                                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-purple-500 rounded-full transition-all"
                                                        style={{ width: `${(friendVolume / maxVolume) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Streak Comparison */}
                                    <div className="bg-neutral-900/50 border border-white/5 p-4 rounded-2xl">
                                        <div className="text-gray-500 text-xs font-bold uppercase mb-3">Серия тренировок</div>
                                        <div className="space-y-2">
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-indigo-400 font-bold">Вы</span>
                                                    <span className="text-white font-bold">{myStreak}</span>
                                                </div>
                                                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-orange-500 rounded-full transition-all"
                                                        style={{ width: `${(myStreak / maxStreak) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-purple-400 font-bold">{friend.name}</span>
                                                    <span className="text-white font-bold">{friendStreak}</span>
                                                </div>
                                                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-red-500 rounded-full transition-all"
                                                        style={{ width: `${(friendStreak / maxStreak) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            )}

                            {/* Badges Tab */}
                            {activeTab === 'badges' && (
                                <div className="animate-fade-in">
                                    {profile?.badges && profile.badges.length > 0 ? (
                                        <div className="grid grid-cols-4 gap-2">
                                            {profile.badges.map((badge) => (
                                                <div
                                                    key={badge.id}
                                                    className="aspect-square bg-neutral-900/50 border border-white/5 rounded-xl flex flex-col items-center justify-center p-1"
                                                    title={badge.name_ru}
                                                >
                                                    <span className="text-2xl">{badge.icon}</span>
                                                    <span className={`text-[8px] font-bold ${tierColors[badge.tier] || 'text-gray-400'}`}>
                                                        {badge.name_ru.split(' ')[0]}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500 text-sm">
                                            Пока нет бейджей
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Workouts Tab */}
                            {activeTab === 'workouts' && (
                                <div className="space-y-3 animate-fade-in">
                                    {profile?.recentWorkouts && profile.recentWorkouts.length > 0 ? (
                                        profile.recentWorkouts.map((workout) => (
                                            <div
                                                key={workout.id}
                                                className="bg-neutral-900/50 border border-white/5 p-3 rounded-xl flex gap-3 items-center"
                                            >
                                                <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                                                    <Dumbbell size={18} className="text-indigo-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-sm font-bold text-white">
                                                        {(workout.total_volume / 1000).toFixed(1)}t
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {new Date(workout.workout_date).toLocaleDateString('ru-RU')}
                                                        {workout.duration && ` • ${Math.round(workout.duration / 60)} мин`}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : friendActivities.length > 0 ? (
                                        friendActivities.map(item => (
                                            <div key={item.id} className="flex gap-3 items-start">
                                                <div className="mt-1 w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-sm border border-white/5 shrink-0">
                                                    {item.type === 'workout_finish' ? '💪' : '🏆'}
                                                </div>
                                                <div>
                                                    <p className="text-sm text-white font-medium">{item.title}</p>
                                                    <p className="text-xs text-gray-500">{item.description}</p>
                                                    <p className="text-[10px] text-gray-600 mt-1">
                                                        {new Date(item.timestamp).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-gray-500 text-sm">
                                            Нет данных о тренировках
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-white/5 mt-auto">
                    <button
                        onClick={handleRemove}
                        className="w-full py-3 rounded-xl border border-red-500/20 text-red-500 text-sm font-bold hover:bg-red-500/10 transition flex items-center justify-center gap-2"
                    >
                        <Trash2 size={16} /> Удалить из друзей
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FriendProfileModal;
