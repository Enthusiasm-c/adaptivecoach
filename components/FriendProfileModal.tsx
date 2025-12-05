import React from 'react';
import { X, Trophy, Flame, Activity, Zap, Clock, Heart, Crown } from 'lucide-react';
import { FriendProfile, ActivityFeedItem } from '../types';
import { hapticFeedback } from '../utils/hapticUtils';
import SkeletonLoader from './SkeletonLoader';

interface FriendProfileModalProps {
    friend: FriendProfile;
    feed: ActivityFeedItem[]; // Full feed, we'll filter it
    onClose: () => void;
    onNudge: (id: string, name: string) => void;
}

const FriendProfileModal: React.FC<FriendProfileModalProps> = ({ friend, feed, onClose, onNudge }) => {
    // Filter feed for this user
    const userActivity = feed.filter(item => item.userId === friend.id);

    const handleNudgeClick = () => {
        onNudge(friend.id, friend.name);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-[#111] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-slide-up max-h-[90vh] flex flex-col">

                {/* Header / Cover */}
                <div className="relative h-32 bg-gradient-to-r from-indigo-900 to-violet-900">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-black/20 rounded-full text-white hover:bg-black/40 transition backdrop-blur-md z-10"
                    >
                        <X size={20} />
                    </button>

                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-20">
                        <svg width="100%" height="100%">
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
                            </pattern>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>
                    </div>
                </div>

                {/* Profile Info */}
                <div className="px-6 pb-6 -mt-12 flex flex-col items-center relative z-10">
                    {/* Avatar */}
                    <div className="relative mb-3">
                        <div className="w-24 h-24 rounded-full bg-neutral-800 border-4 border-[#111] flex items-center justify-center text-3xl font-bold text-gray-400 shadow-xl">
                            {friend.photoUrl ? (
                                <img src={friend.photoUrl} alt={friend.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                friend.name[0]
                            )}
                        </div>
                        {friend.isOnline && (
                            <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-[#111]"></div>
                        )}
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border-2 border-[#111]">
                            Lvl {friend.level}
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-white mb-1 flex items-center gap-2">
                        {friend.name}
                        {friend.level >= 10 && <Crown size={18} className="text-yellow-500 fill-yellow-500" />}
                    </h2>
                    <p className="text-gray-400 text-xs font-medium mb-6">
                        {friend.isOnline ? 'В сети' : `Был(а) ${new Date(friend.lastActive).toLocaleDateString()}`}
                    </p>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 w-full mb-6">
                        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center text-center">
                            <Flame size={20} className="text-orange-500 mb-1" fill="currentColor" fillOpacity={0.2} />
                            <span className="text-lg font-black text-white">{friend.streak}</span>
                            <span className="text-[10px] text-gray-500 uppercase font-bold">Стрик (дней)</span>
                        </div>
                        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center text-center">
                            <Activity size={20} className="text-indigo-500 mb-1" />
                            <span className="text-lg font-black text-white">{(friend.totalVolume / 1000).toFixed(1)}т</span>
                            <span className="text-[10px] text-gray-500 uppercase font-bold">Объем</span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleNudgeClick}
                        className="w-full py-3 bg-neutral-800 text-white rounded-xl font-bold text-sm hover:bg-neutral-700 transition flex items-center justify-center gap-2 border border-white/5 active:scale-95 mb-6"
                    >
                        <Zap size={16} className="text-yellow-400" fill="currentColor" />
                        Пнуть (Nudge)
                    </button>

                    {/* Recent Activity */}
                    <div className="w-full">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">История активности</h3>
                        <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                            {userActivity.length > 0 ? (
                                userActivity.map(item => (
                                    <div key={item.id} className="bg-neutral-900/30 border border-white/5 rounded-xl p-3 flex gap-3">
                                        <div className="shrink-0 mt-1">
                                            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-sm">
                                                {item.type === 'workout_finish' ? '💪' : item.type === 'level_up' ? '🆙' : '🏆'}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white">{item.title}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">{item.description}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] text-gray-600 flex items-center gap-1">
                                                    <Clock size={8} />
                                                    {new Date(item.timestamp).toLocaleDateString()}
                                                </span>
                                                <span className="text-[10px] text-gray-600 flex items-center gap-1">
                                                    <Heart size={8} /> {item.likes}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 text-gray-500 text-xs">
                                    Пока нет активности
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FriendProfileModal;
