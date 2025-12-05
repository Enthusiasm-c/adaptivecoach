import React, { useState, useEffect } from 'react';
import { Users, Zap, Trophy, Crown, Share2, Activity, UserPlus, X, Search, Heart, Clock } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';
import { TelegramUser, FriendProfile, ActivityFeedItem } from '../types';
import { socialService } from '../services/socialService';
import SkeletonLoader from './SkeletonLoader';
import FriendProfileModal from './FriendProfileModal';

interface SquadViewProps {
    telegramUser: TelegramUser | null;
}

const SquadView: React.FC<SquadViewProps> = ({ telegramUser }) => {
    const [squadName] = useState("Моя Команда");
    const [friends, setFriends] = useState<FriendProfile[]>([]);
    const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Add Friend Modal State
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<FriendProfile | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [squadData, feedData] = await Promise.all([
                socialService.getSquad(),
                socialService.getFeed()
            ]);

            // Add current user to the list for leaderboard if not present
            const currentUser: FriendProfile = {
                id: 'me',
                name: telegramUser?.first_name || "Вы",
                level: 7, // Mock level for current user, should come from props/state
                streak: 5, // Mock streak
                totalVolume: 125000, // Mock volume
                lastActive: new Date().toISOString(),
                isOnline: true,
                photoUrl: telegramUser?.photo_url
            };

            setFriends([currentUser, ...squadData]);
            setFeed(feedData);
        } catch (e) {
            console.error("Failed to load squad data", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        hapticFeedback.selectionChanged();
        try {
            const result = await socialService.searchUser(searchQuery);
            setSearchResult(result);
            if (!result) {
                hapticFeedback.notificationOccurred('error');
            } else {
                hapticFeedback.notificationOccurred('success');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddFriend = async () => {
        if (!searchResult) return;
        hapticFeedback.impactOccurred('medium');
        await socialService.addFriend(searchResult);
        setShowAddFriend(false);
        setSearchQuery('');
        setSearchResult(null);
        loadData(); // Reload list

        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showAlert(`${searchResult.name} добавлен в отряд!`);
        } else {
            alert(`${searchResult.name} добавлен в отряд!`);
        }
    };

    const handleNudge = async (memberId: string, memberName: string) => {
        hapticFeedback.impactOccurred('medium');
        await socialService.nudgeFriend(memberId);

        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showAlert(`Вы пнули ${memberName}! ⚡`);
        } else {
            alert(`Вы пнули ${memberName}! ⚡`);
        }
    };

    const handleInvite = () => {
        hapticFeedback.impactOccurred('light');
        const inviteLink = "https://t.me/AdaptiveCoachBot?start=squad_123";
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${inviteLink}&text=Вступай в мой отряд в Adaptive Coach!`);
        } else {
            navigator.clipboard.writeText(inviteLink);
            alert("Ссылка скопирована!");
        }
    };

    // Sort members by Total Volume (as a proxy for progress score for now)
    const sortedMembers = [...friends].sort((a, b) => b.totalVolume - a.totalVolume);

    // Friend Profile Modal State
    const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);

    const handleFriendClick = (friend: FriendProfile) => {
        if (friend.id === 'me') return; // Don't open for self (or maybe open own profile later)
        hapticFeedback.selectionChanged();
        setSelectedFriend(friend);
    };

    return (
        <div className="pb-32 animate-fade-in px-4 pt-[env(safe-area-inset-top)] relative">

            {/* Squad Header */}
            <div className="flex justify-between items-center mb-6 mt-2">
                <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Ваш отряд</p>
                    <h1 className="text-2xl font-black text-white flex items-center gap-2">
                        {squadName}
                        <Users size={20} className="text-indigo-500" />
                    </h1>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAddFriend(true)}
                        className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center text-indigo-400 border border-indigo-500/30 hover:bg-neutral-700 transition active:scale-95"
                    >
                        <UserPlus size={18} />
                    </button>
                    <button
                        onClick={handleInvite}
                        className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition active:scale-95"
                    >
                        <Share2 size={18} />
                    </button>
                </div>
            </div>

            {/* Leaderboard Card */}
            <div className="bg-neutral-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl mb-6">
                <div className="p-5 border-b border-white/5 bg-gradient-to-r from-neutral-900 to-neutral-800">
                    <div className="flex items-center gap-2 text-yellow-500 font-bold">
                        <Trophy size={18} />
                        <span>Лидерборд (Объем)</span>
                    </div>
                </div>

                <div className="divide-y divide-white/5">
                    {isLoading ? (
                        <div className="p-4 space-y-3">
                            <SkeletonLoader className="h-12 w-full rounded-xl" />
                            <SkeletonLoader className="h-12 w-full rounded-xl" />
                            <SkeletonLoader className="h-12 w-full rounded-xl" />
                        </div>
                    ) : (
                        sortedMembers.map((member, index) => (
                            <div
                                key={member.id}
                                onClick={() => handleFriendClick(member)}
                                className={`p-4 flex items-center gap-4 hover:bg-white/5 transition ${member.id !== 'me' ? 'cursor-pointer active:bg-white/10' : ''}`}
                            >
                                {/* Rank */}
                                <div className={`w-6 text-center font-black text-lg ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-700' : 'text-gray-600'}`}>
                                    {index + 1}
                                </div>

                                {/* Avatar */}
                                <div className="relative">
                                    {member.photoUrl ? (
                                        <img src={member.photoUrl} alt={member.name} className="w-10 h-10 rounded-full border border-white/10" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-gray-400 font-bold border border-white/10">
                                            {member.name[0]}
                                        </div>
                                    )}
                                    {member.isOnline && (
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-neutral-900"></div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className={`font-bold ${member.id === 'me' ? 'text-indigo-400' : 'text-white'}`}>
                                            {member.name} {member.id === 'me' && '(Вы)'}
                                        </h3>
                                        {index === 0 && <Crown size={14} className="text-yellow-500 fill-yellow-500" />}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                                        <span className="flex items-center gap-1">
                                            <Activity size={10} /> {(member.totalVolume / 1000).toFixed(1)}т
                                        </span>
                                        <span>•</span>
                                        <span>Lvl {member.level}</span>
                                    </div>
                                </div>

                                {/* Action (Nudge) */}
                                {member.id !== 'me' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent opening modal
                                            handleNudge(member.id, member.name);
                                        }}
                                        className="p-2 rounded-full bg-neutral-800 text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10 transition active:scale-95"
                                        title="Пнуть!"
                                    >
                                        <Zap size={18} />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Activity Feed */}
            <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-3 px-1">Активность</h3>
                <div className="space-y-3">
                    {isLoading ? (
                        <>
                            <SkeletonLoader className="h-24 w-full rounded-2xl" />
                            <SkeletonLoader className="h-24 w-full rounded-2xl" />
                        </>
                    ) : feed.length > 0 ? (
                        feed.map(item => (
                            <div
                                key={item.id}
                                onClick={() => {
                                    const friend = friends.find(f => f.id === item.userId);
                                    if (friend) handleFriendClick(friend);
                                }}
                                className="bg-neutral-900/50 border border-white/5 rounded-2xl p-4 flex gap-3 cursor-pointer hover:bg-neutral-800 transition active:scale-[0.98]"
                            >
                                <div className="shrink-0">
                                    <div className="w-10 h-10 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-lg">
                                        {item.type === 'workout_finish' ? '💪' : item.type === 'level_up' ? '🆙' : '🏆'}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm font-bold text-white">
                                            <span className="text-indigo-400">{item.userName}</span> {item.title}
                                        </p>
                                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                            <Clock size={10} />
                                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">{item.description}</p>

                                    <div className="flex items-center gap-4 mt-3">
                                        <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-pink-500 transition">
                                            <Heart size={14} /> {item.likes}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-500 text-sm bg-neutral-900/30 rounded-2xl border border-white/5 border-dashed">
                            Пока тишина... Добавьте друзей!
                        </div>
                    )}
                </div>
            </div>

            {/* Add Friend Modal */}
            {showAddFriend && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl transform transition-all scale-100">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-white text-lg">Добавить друга</h3>
                            <button
                                onClick={() => setShowAddFriend(false)}
                                className="p-1 rounded-full bg-neutral-800 text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5">
                            <p className="text-sm text-gray-400 mb-4">
                                Введите ID пользователя (например: <span className="text-indigo-400 font-mono">alex_fit</span>, <span className="text-indigo-400 font-mono">kate_strong</span>)
                            </p>

                            <div className="flex gap-2 mb-4">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Telegram ID / Username"
                                        className="w-full bg-neutral-800 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"
                                    />
                                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                                </div>
                                <button
                                    onClick={handleSearch}
                                    disabled={isSearching || !searchQuery}
                                    className="bg-indigo-600 text-white rounded-xl px-4 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSearching ? <Activity size={20} className="animate-spin" /> : 'Найти'}
                                </button>
                            </div>

                            {/* Search Result */}
                            {searchResult ? (
                                <div
                                    onClick={handleAddFriend}
                                    className="bg-neutral-800/50 rounded-xl p-3 border border-white/10 flex items-center justify-between animate-fade-in cursor-pointer hover:bg-neutral-800 transition active:scale-95"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                                            {searchResult.name[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{searchResult.name}</p>
                                            <p className="text-xs text-gray-400">Lvl {searchResult.level}</p>
                                        </div>
                                    </div>
                                    <button
                                        className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-500 transition"
                                    >
                                        <UserPlus size={18} />
                                    </button>
                                </div>
                            ) : searchQuery && !isSearching && (
                                <div className="text-center text-gray-500 text-sm py-2">
                                    Пользователь не найден
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Friend Profile Modal */}
            {selectedFriend && (
                <FriendProfileModal
                    friend={selectedFriend}
                    feed={feed}
                    onClose={() => setSelectedFriend(null)}
                    onNudge={handleNudge}
                    onRemove={(id) => {
                        setFriends(prev => prev.filter(f => f.id !== id));
                        loadData(); // Reload to ensure sync
                    }}
                />
            )}

        </div>
    );
};

export default SquadView;
