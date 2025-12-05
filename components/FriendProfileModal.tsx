import React from 'react';
import { X, Zap, Trash2 } from 'lucide-react';
import { FriendProfile, ActivityFeedItem } from '../types';
import { hapticFeedback } from '../utils/hapticUtils';
import { socialService } from '../services/socialService';

interface FriendProfileModalProps {
    friend: FriendProfile;
    feed: ActivityFeedItem[];
    onClose: () => void;
    onNudge: (id: string, name: string) => void;
    onRemove?: (id: string) => void;
}

const FriendProfileModal: React.FC<FriendProfileModalProps> = ({ friend, feed, onClose, onNudge, onRemove }) => {
    const friendActivities = feed.filter(item => item.userId === friend.id);

    const handleRemove = async () => {
        if (confirm(`Удалить ${friend.name} из друзей?`)) {
            hapticFeedback.notificationOccurred('warning');
            await socialService.removeFriend(friend.id);
            onRemove?.(friend.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-3xl overflow-hidden relative shadow-2xl animate-slide-up max-h-[85vh] flex flex-col">

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
                <div className="px-6 -mt-10 mb-6 flex justify-between items-end">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-neutral-800 border-4 border-[#111] flex items-center justify-center text-2xl font-bold text-gray-400 overflow-hidden">
                            {friend.photoUrl ? (
                                <img src={friend.photoUrl} alt={friend.name} className="w-full h-full object-cover" />
                            ) : (
                                friend.name[0]
                            )}
                        </div>
                        {friend.isOnline && (
                            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#111]"></div>
                        )}
                    </div>
                    <div className="flex gap-2 mb-1">
                        <button
                            onClick={() => onNudge(friend.id, friend.name)}
                            className="px-4 py-2 bg-yellow-500 text-black font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-yellow-400 transition active:scale-95"
                        >
                            <Zap size={16} fill="currentColor" /> Пнуть
                        </button>
                    </div>
                </div>

                <div className="px-6 mb-6">
                    <h2 className="text-2xl font-black text-white">{friend.name}</h2>
                    <p className="text-gray-400 text-sm">Level {friend.level} • {friend.streak} day streak</p>
                </div>

                {/* Stats Grid */}
                <div className="px-6 grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-neutral-900/50 border border-white/5 p-3 rounded-2xl">
                        <div className="text-gray-500 text-xs font-bold uppercase mb-1">Total Volume</div>
                        <div className="text-xl font-black text-white">{(friend.totalVolume / 1000).toFixed(1)}t</div>
                    </div>
                    <div className="bg-neutral-900/50 border border-white/5 p-3 rounded-2xl">
                        <div className="text-gray-500 text-xs font-bold uppercase mb-1">Last Active</div>
                        <div className="text-sm font-bold text-white">
                            {new Date(friend.lastActive).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="px-6 flex-1 overflow-y-auto min-h-0 pb-6">
                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Recent Activity</h3>
                    <div className="space-y-3">
                        {friendActivities.length > 0 ? (
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
                            <p className="text-gray-500 text-sm italic">No recent activity</p>
                        )}
                    </div>
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
