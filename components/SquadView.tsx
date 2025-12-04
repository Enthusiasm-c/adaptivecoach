import React, { useState } from 'react';
import { Users, Zap, Trophy, Crown, ArrowRight, Share2, Activity } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';
import { TelegramUser } from '../types';

interface SquadViewProps {
    telegramUser: TelegramUser | null;
}

interface SquadMember {
    id: number;
    name: string;
    level: number;
    progressScore: number; // Relative progress score
    isOnline: boolean;
    lastWorkout: string;
    avatarUrl?: string;
    isCurrentUser?: boolean;
}

const SquadView: React.FC<SquadViewProps> = ({ telegramUser }) => {
    const [squadName] = useState("Titan Gym Bros");

    // Mock Data for Squad Members
    const [members, setMembers] = useState<SquadMember[]>([
        {
            id: 1,
            name: telegramUser?.first_name || "Вы",
            level: 7,
            progressScore: 1250,
            isOnline: true,
            lastWorkout: "Сегодня",
            isCurrentUser: true,
            avatarUrl: telegramUser?.photo_url
        },
        {
            id: 2,
            name: "Алекс",
            level: 12,
            progressScore: 1420,
            isOnline: false,
            lastWorkout: "Вчера"
        },
        {
            id: 3,
            name: "Мария",
            level: 5,
            progressScore: 980,
            isOnline: true,
            lastWorkout: "2 дня назад"
        },
        {
            id: 4,
            name: "Дмитрий",
            level: 9,
            progressScore: 850,
            isOnline: false,
            lastWorkout: "4 дня назад" // Needs a nudge!
        }
    ]);

    const handleNudge = (memberId: number, memberName: string) => {
        hapticFeedback.impactMedium();
        // In a real app, this would send a notification via backend
        // For now, we simulate it with a Telegram alert or just a UI change
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showAlert(`Вы пнули ${memberName}! ⚡`);
        } else {
            alert(`Вы пнули ${memberName}! ⚡`);
        }
    };

    const handleInvite = () => {
        hapticFeedback.impactLight();
        const inviteLink = "https://t.me/AdaptiveCoachBot?start=squad_123";
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${inviteLink}&text=Вступай в мой отряд в Adaptive Coach!`);
        } else {
            navigator.clipboard.writeText(inviteLink);
            alert("Ссылка скопирована!");
        }
    };

    // Sort members by Progress Score
    const sortedMembers = [...members].sort((a, b) => b.progressScore - a.progressScore);

    return (
        <div className="pb-32 animate-fade-in px-4 pt-[env(safe-area-inset-top)]">

            {/* Squad Header */}
            <div className="flex justify-between items-center mb-6 mt-2">
                <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Ваш отряд</p>
                    <h1 className="text-2xl font-black text-white flex items-center gap-2">
                        {squadName}
                        <Users size={20} className="text-indigo-500" />
                    </h1>
                </div>
                <button
                    onClick={handleInvite}
                    className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition active:scale-95"
                >
                    <Share2 size={18} />
                </button>
            </div>

            {/* Leaderboard Card */}
            <div className="bg-neutral-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl mb-6">
                <div className="p-5 border-b border-white/5 bg-gradient-to-r from-neutral-900 to-neutral-800">
                    <div className="flex items-center gap-2 text-yellow-500 font-bold">
                        <Trophy size={18} />
                        <span>Лидерборд (Progress Score)</span>
                    </div>
                </div>

                <div className="divide-y divide-white/5">
                    {sortedMembers.map((member, index) => (
                        <div key={member.id} className="p-4 flex items-center gap-4 hover:bg-white/5 transition">
                            {/* Rank */}
                            <div className={`w-6 text-center font-black text-lg ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-700' : 'text-gray-600'}`}>
                                {index + 1}
                            </div>

                            {/* Avatar */}
                            <div className="relative">
                                {member.avatarUrl ? (
                                    <img src={member.avatarUrl} alt={member.name} className="w-10 h-10 rounded-full border border-white/10" />
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
                                    <h3 className={`font-bold ${member.isCurrentUser ? 'text-indigo-400' : 'text-white'}`}>
                                        {member.name} {member.isCurrentUser && '(Вы)'}
                                    </h3>
                                    {index === 0 && <Crown size={14} className="text-yellow-500 fill-yellow-500" />}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                                    <span className="flex items-center gap-1">
                                        <Activity size={10} /> {member.progressScore} pts
                                    </span>
                                    <span>•</span>
                                    <span>Lvl {member.level}</span>
                                </div>
                            </div>

                            {/* Action (Nudge) */}
                            {!member.isCurrentUser && (
                                <button
                                    onClick={() => handleNudge(member.id, member.name)}
                                    className="p-2 rounded-full bg-neutral-800 text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10 transition active:scale-95"
                                    title="Пнуть!"
                                >
                                    <Zap size={18} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Weekly Challenge Banner */}
            <div className="bg-gradient-to-br from-indigo-900/50 to-violet-900/50 border border-indigo-500/30 rounded-3xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2">
                        <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20">
                            Челлендж недели
                        </span>
                        <span className="text-xs text-indigo-200 font-mono">2 дня до конца</span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-1">Командный объем</h3>
                    <p className="text-sm text-indigo-200 mb-4">Наберите 50 тонн объема всем отрядом.</p>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-indigo-300">
                            <span>38.5т / 50т</span>
                            <span>77%</span>
                        </div>
                        <div className="h-2 bg-neutral-900/50 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 w-[77%] rounded-full shadow-[0_0_10px_rgba(129,140,248,0.5)]"></div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default SquadView;
