
import React, { useState, useEffect } from 'react';
import { OnboardingProfile, TelegramUser, Goal, Location } from '../types';
import { Trash2, Save, User, LogOut, Target, Calendar, Clock, Award, Loader2, MessageCircle, MapPin, AlertTriangle, Activity, ExternalLink, Unlink } from 'lucide-react';
import { apiService, Badge } from '../services/apiService';

interface SettingsViewProps {
    profile: OnboardingProfile;
    telegramUser: TelegramUser | null;
    onUpdateProfile: (newProfile: OnboardingProfile) => void;
    onResetAccount: () => void;
}

const tierColors: Record<string, string> = {
    bronze: 'from-amber-700 to-amber-500',
    silver: 'from-gray-400 to-gray-200',
    gold: 'from-yellow-500 to-amber-300',
    diamond: 'from-cyan-400 to-blue-300',
};

const tierBgColors: Record<string, string> = {
    bronze: 'bg-amber-900/30 border-amber-700/50',
    silver: 'bg-gray-700/30 border-gray-500/50',
    gold: 'bg-yellow-900/30 border-yellow-600/50',
    diamond: 'bg-cyan-900/30 border-cyan-500/50',
};

// Helper components for consistent design
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <h3 className="text-gray-500 text-xs font-bold mb-3 mt-6 ml-1">
        {title}
    </h3>
);

const SettingRow: React.FC<{ label: string; value: string; onClick?: () => void; icon?: React.ReactNode }> = ({ label, value, onClick, icon }) => (
    <div
        onClick={onClick}
        className={`p-4 flex items-center justify-between ${onClick ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
    >
        <span className="text-gray-200 font-bold text-sm">{label}</span>
        <div className="flex items-center gap-2">
            <span className="font-display font-bold text-white text-lg">{value}</span>
            {icon}
        </div>
    </div>
);

const SettingsView: React.FC<SettingsViewProps> = ({ profile, telegramUser, onUpdateProfile, onResetAccount }) => {
    const [weight, setWeight] = useState(profile.weight);
    const [daysPerWeek, setDaysPerWeek] = useState(profile.daysPerWeek);
    const [timePerWorkout, setTimePerWorkout] = useState(profile.timePerWorkout);
    const [primaryGoal, setPrimaryGoal] = useState(profile.goals.primary);
    const [selectedLocation, setSelectedLocation] = useState<Location>(profile.location);
    const [pendingLocation, setPendingLocation] = useState<Location | null>(null);
    const [isChangingLocation, setIsChangingLocation] = useState(false);

    const [isConfirmingReset, setIsConfirmingReset] = useState(false);

    // Badges state
    const [allBadges, setAllBadges] = useState<Badge[]>([]);
    const [myBadges, setMyBadges] = useState<Badge[]>([]);
    const [loadingBadges, setLoadingBadges] = useState(true);

    // WHOOP state
    const [whoopConnected, setWhoopConnected] = useState(false);
    const [whoopLoading, setWhoopLoading] = useState(true);
    const [whoopConnecting, setWhoopConnecting] = useState(false);
    const [showWhoopDebug, setShowWhoopDebug] = useState(false);
    const [whoopDebugData, setWhoopDebugData] = useState<any>(null);
    const [whoopDebugLoading, setWhoopDebugLoading] = useState(false);

    // Load WHOOP status
    useEffect(() => {
        const checkWhoop = async () => {
            try {
                const status = await apiService.whoop.getStatus();
                setWhoopConnected(status.connected);
            } catch (error) {
                console.error('Failed to check WHOOP status:', error);
            } finally {
                setWhoopLoading(false);
            }
        };
        checkWhoop();
    }, []);

    // Load Badges
    useEffect(() => {
        const fetchBadges = async () => {
            try {
                const [all, mine] = await Promise.all([
                    apiService.badges.getAll(),
                    apiService.badges.getUserBadges(telegramUser?.id || 0)
                ]);
                setAllBadges(all);
                setMyBadges(mine);
            } catch (error) {
                console.error("Failed to load badges", error);
            } finally {
                setLoadingBadges(false);
            }
        };
        fetchBadges();
    }, []);

    const handleSave = () => {
        onUpdateProfile({
            ...profile,
            weight,
            daysPerWeek,
            timePerWorkout,
            goals: { ...profile.goals, primary: primaryGoal },
            location: selectedLocation
        });
    };

    const handleConnectWhoop = async () => {
        setWhoopConnecting(true);
        try {
            const { authUrl } = await apiService.whoop.getAuthUrl();
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.openLink(authUrl);
            } else {
                window.open(authUrl, '_blank');
            }
        } catch (error) {
            console.error('Failed to get WHOOP auth URL:', error);
        } finally {
            setWhoopConnecting(false);
        }
    };

    const handleDisconnectWhoop = async () => {
        setWhoopConnecting(true);
        try {
            await apiService.whoop.disconnect();
            setWhoopConnected(false);
        } catch (error) {
            console.error('Failed to disconnect WHOOP:', error);
        } finally {
            setWhoopConnecting(false);
        }
    };

    const handleTestWhoop = async () => {
        setWhoopDebugLoading(true);
        setShowWhoopDebug(true);
        try {
            const data = await apiService.whoop.getReadiness();
            setWhoopDebugData(data);
        } catch (error: any) {
            setWhoopDebugData({ error: error.message || 'Failed to fetch WHOOP data' });
        } finally {
            setWhoopDebugLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-white p-2 pb-24 font-sans selection:bg-primary/30">
            {/* Header */}
            <header className="flex items-center justify-between mb-8 px-2 pt-2">
                <h1 className="text-4xl font-display font-black tracking-tighter italic">
                    Профиль
                </h1>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-white text-black px-6 py-2 rounded-full font-display font-bold hover:bg-gray-200 transition active:scale-95"
                >
                    <Save size={16} /> Сохранить
                </button>
            </header>

            <div className="space-y-6 mx-auto">

                {/* Athlete Card */}
                <div className="bg-surface border border-subtle rounded-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4">
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${whoopConnected ? 'bg-green-900/20 border-green-500/30 text-green-500' : 'bg-neutral-800 border-white/5 text-gray-500'}`}>
                            <Activity size={12} className={whoopConnected ? "animate-pulse" : ""} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">{whoopConnected ? 'LIVE' : 'OFFLINE'}</span>
                        </div>
                    </div>

                    <div className="p-6 pt-8">
                        <div className="flex items-center gap-5">
                            <div className="relative">
                                {telegramUser?.photo_url ? (
                                    <img
                                        src={telegramUser.photo_url}
                                        alt="Athlete"
                                        className="w-20 h-20 rounded-full border-2 border-white/10"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-full bg-neutral-800 border-2 border-white/10 flex items-center justify-center">
                                        <User size={32} className="text-gray-400" />
                                    </div>
                                )}
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-black rounded-full flex items-center justify-center border border-subtle">
                                    <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(233,61,61,0.8)] animate-pulse"></div>
                                </div>
                            </div>
                            <div>
                                <h2 className="text-2xl font-display font-bold text-white leading-none mb-1">
                                    {telegramUser?.first_name || "Атлет"}
                                </h2>
                                <p className="text-gray-500 text-xs font-mono">
                                    @{telegramUser?.username || "unknown"}
                                </p>
                                <div className="mt-3 flex gap-4">
                                    <div>
                                        <p className="text-[10px] text-gray-600 font-bold">Уровень</p>
                                        <p className="text-sm font-display font-bold text-white">PRO</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-600 font-bold">Серия</p>
                                        <p className="text-sm font-display font-bold text-white">0 дней</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <SectionHeader title="Метрики тела" />
                <div className="bg-surface border border-subtle rounded-xl overflow-hidden">
                    <div className="p-4 flex items-center justify-between">
                        <span className="text-gray-200 font-bold text-sm">Вес</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={weight}
                                onChange={(e) => setWeight(parseFloat(e.target.value))}
                                className="bg-transparent text-right font-display text-2xl font-bold text-white w-20 outline-none focus:text-primary transition-colors"
                            />
                            <span className="text-gray-500 font-display text-sm font-bold pt-2">кг</span>
                        </div>
                    </div>
                </div>

                <SectionHeader title="Расписание тренировок" />
                <div className="bg-surface border border-subtle rounded-xl overflow-hidden divide-y divide-subtle">
                    {/* Days Picker as a simplified segmented control */}
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-gray-200 font-bold text-sm">Дней в неделю</span>
                        </div>
                        <div className="flex bg-black/50 p-1 rounded-lg">
                            {[2, 3, 4, 5, 6].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDaysPerWeek(d)}
                                    className={`flex-1 py-3 rounded-md font-display font-bold text-lg transition-all ${daysPerWeek === d
                                        ? 'bg-subtle text-white shadow-sm border border-white/5'
                                        : 'text-gray-600 hover:text-gray-400'
                                        }`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Time Picker */}
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-gray-200 font-bold text-sm">Длительность (Мин)</span>
                        </div>
                        <div className="flex bg-black/50 p-1 rounded-lg">
                            {[30, 45, 60, 75].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTimePerWorkout(t)}
                                    className={`flex-1 py-3 rounded-md font-display font-bold text-lg transition-all ${timePerWorkout === t
                                        ? 'bg-subtle text-white shadow-sm border border-white/5'
                                        : 'text-gray-600 hover:text-gray-400'
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <SectionHeader title="Цели и Локация" />
                <div className="bg-surface border border-subtle rounded-xl overflow-hidden divide-y divide-subtle">
                    {/* Goal Selector */}
                    <div className="p-1">
                        {Object.values(Goal).map(g => (
                            <button
                                key={g}
                                onClick={() => setPrimaryGoal(g)}
                                className={`w-full flex items-center justify-between p-4 transition-colors ${primaryGoal === g ? 'bg-white/5' : 'hover:bg-white/5'}`}
                            >
                                <span className={`font-bold text-sm ${primaryGoal === g ? 'text-white' : 'text-gray-400'}`}>
                                    {g}
                                </span>
                                {primaryGoal === g && <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(233,61,61,0.8)]" />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-2 bg-surface border border-subtle rounded-xl overflow-hidden divide-y divide-subtle">
                    {/* Location Selector */}
                    <div className="p-1">
                        {Object.values(Location).map(loc => (
                            <button
                                key={loc}
                                onClick={() => {
                                    if (loc !== selectedLocation) setPendingLocation(loc);
                                }}
                                className={`w-full flex items-center justify-between p-4 transition-colors ${selectedLocation === loc ? 'bg-white/5' : 'hover:bg-white/5'}`}
                            >
                                <span className={`font-bold text-sm ${selectedLocation === loc ? 'text-white' : 'text-gray-400'}`}>
                                    {loc}
                                </span>
                                {selectedLocation === loc && <MapPin size={14} className="text-primary" />}
                            </button>
                        ))}
                    </div>
                </div>
                {selectedLocation !== profile.location && (
                    <div className="mt-2 text-center">
                        <span className="text-primary font-display text-xs font-bold animate-pulse">
                            Требуется адаптация плана
                        </span>
                    </div>
                )}


                {/* WHOOP Integration - Redesigned */}
                <SectionHeader title="Устройства" />
                <div className="bg-surface border border-subtle rounded-xl overflow-hidden p-6 relative">
                    <div className="flex items-start justify-between">
                        <div>
                            {/* Official Whoop Logo - Text Replacement for Clarity */}
                            <h3 className="font-display font-black text-3xl italic tracking-tighter text-white mb-2">WHOOP</h3>
                            <p className="text-gray-500 text-xs font-bold leading-relaxed max-w-[200px]">
                                {whoopConnected
                                    ? "Данные синхронизируются автоматически в течение цикла восстановления."
                                    : "Подключите браслет Whoop для автоматической синхронизации восстановления, нагрузки и сна."
                                }
                            </p>
                        </div>
                        <div className={`w-3 h-3 rounded-full mt-2 ${whoopConnected ? 'bg-success shadow-[0_0_10px_rgba(76,199,109,0.5)]' : 'bg-gray-700'}`} />
                    </div>

                    <div className="mt-6 flex gap-2">
                        <button
                            onClick={whoopConnected ? handleDisconnectWhoop : handleConnectWhoop}
                            disabled={whoopConnecting}
                            className={`flex-1 py-3 rounded-lg font-display font-bold text-sm transition-all ${whoopConnected
                                ? 'bg-red-900/20 text-red-500 border border-red-500/30 hover:bg-red-900/30'
                                : 'bg-white text-black hover:bg-gray-200'
                                }`}
                        >
                            {whoopConnecting ? (
                                <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={14} /> Подключение</span>
                            ) : whoopConnected ? (
                                'Отключить'
                            ) : (
                                'Подключить'
                            )}
                        </button>
                        {whoopConnected && (
                            <button
                                onClick={handleTestWhoop}
                                disabled={whoopDebugLoading}
                                className="px-4 py-3 rounded-lg font-display font-bold text-sm bg-info/20 text-info border border-info/30 hover:bg-info/30 transition-all"
                            >
                                {whoopDebugLoading ? <Loader2 className="animate-spin" size={14} /> : 'Тест'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Account Actions */}
                <div className="pt-8">
                    {!isConfirmingReset ? (
                        <button
                            onClick={() => setIsConfirmingReset(true)}
                            className="w-full py-3 flex items-center justify-center gap-2 text-gray-600 font-bold hover:text-red-500 transition text-xs"
                        >
                            Сбросить данные аккаунта
                        </button>
                    ) : (
                        <div className="bg-red-900/10 border border-red-900/50 rounded-xl p-4 text-center space-y-4 animate-scale-in">
                            <p className="text-red-300 font-display font-bold">Опасная зона</p>
                            <p className="text-red-200/70 text-xs">Это действие безвозвратно удалит все данные ваших тренировок.</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsConfirmingReset(false)}
                                    className="flex-1 py-3 bg-surface text-gray-400 rounded-lg font-bold text-xs hover:bg-subtle"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={onResetAccount}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold text-xs hover:bg-red-500"
                                >
                                    Удалить
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* WHOOP Debug Modal */}
            {showWhoopDebug && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
                    <div className="bg-surface border border-subtle rounded-3xl p-6 max-w-md w-full max-h-[80vh] overflow-hidden animate-scale-in">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-display font-bold text-white">WHOOP Data</h3>
                            <button
                                onClick={() => setShowWhoopDebug(false)}
                                className="text-gray-500 hover:text-white transition"
                            >
                                &times;
                            </button>
                        </div>

                        {whoopDebugLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="animate-spin text-info" size={32} />
                            </div>
                        ) : whoopDebugData ? (
                            <div className="overflow-y-auto max-h-[60vh] space-y-3">
                                {whoopDebugData.error ? (
                                    <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                                        <p className="text-red-400 font-bold text-sm">Error</p>
                                        <p className="text-red-300 text-xs mt-1">{whoopDebugData.error}</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Status */}
                                        <div className="bg-black/50 rounded-xl p-4 border border-white/5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-500 text-xs font-bold">Connected</span>
                                                <span className={`text-sm font-bold ${whoopDebugData.connected ? 'text-success' : 'text-red-500'}`}>
                                                    {whoopDebugData.connected ? 'Yes' : 'No'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-gray-500 text-xs font-bold">Has Real Data</span>
                                                <span className={`text-sm font-bold ${whoopDebugData.hasRealData ? 'text-success' : 'text-yellow-500'}`}>
                                                    {whoopDebugData.hasRealData ? 'Yes' : 'No'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Warning when no data */}
                                        {!whoopDebugData.hasRealData && (
                                            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
                                                <p className="text-yellow-400 font-bold text-sm mb-1">Нет данных о сне</p>
                                                <p className="text-yellow-300/70 text-xs">
                                                    WHOOP рассчитывает Recovery только после фиксации сна.
                                                    Убедитесь что браслет надет во время сна и данные синхронизированы.
                                                </p>
                                            </div>
                                        )}

                                        {/* Recovery */}
                                        <div className="bg-black/50 rounded-xl p-4 border border-white/5">
                                            <p className="text-gray-500 text-xs font-bold mb-2">Recovery</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-gray-600 text-[10px]">Score</p>
                                                    <p className="text-white font-display font-bold text-lg">{whoopDebugData.recoveryScore || 0}%</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-600 text-[10px]">HRV</p>
                                                    <p className="text-white font-display font-bold text-lg">{whoopDebugData.hrv || 0} ms</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-600 text-[10px]">Resting HR</p>
                                                    <p className="text-white font-display font-bold text-lg">{whoopDebugData.rhr || 0} bpm</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sleep */}
                                        <div className="bg-black/50 rounded-xl p-4 border border-white/5">
                                            <p className="text-gray-500 text-xs font-bold mb-2">Sleep</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-gray-600 text-[10px]">Hours</p>
                                                    <p className="text-white font-display font-bold text-lg">{whoopDebugData.sleepHours || 0}h</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-600 text-[10px]">Performance</p>
                                                    <p className="text-white font-display font-bold text-lg">{whoopDebugData.sleepPerformance || 0}%</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Calculated Scores */}
                                        <div className="bg-black/50 rounded-xl p-4 border border-white/5">
                                            <p className="text-gray-500 text-xs font-bold mb-2">Calculated Scores (1-5)</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="text-center">
                                                    <p className="text-gray-600 text-[10px]">Sleep</p>
                                                    <p className="text-info font-display font-bold text-2xl">{whoopDebugData.sleepScore || 3}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-gray-600 text-[10px]">Stress</p>
                                                    <p className="text-primary font-display font-bold text-2xl">{whoopDebugData.stressScore || 3}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-gray-600 text-[10px]">Soreness</p>
                                                    <p className="text-success font-display font-bold text-2xl">{whoopDebugData.sorenessScore || 3}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Raw JSON */}
                                        <div className="bg-black/50 rounded-xl p-4 border border-white/5">
                                            <p className="text-gray-500 text-xs font-bold mb-2">Raw Response</p>
                                            <pre className="text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap font-mono">
                                                {JSON.stringify(whoopDebugData, null, 2)}
                                            </pre>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : null}

                        <button
                            onClick={() => setShowWhoopDebug(false)}
                            className="mt-4 w-full py-3 bg-subtle text-white rounded-xl font-display font-bold text-sm hover:bg-white/10 transition"
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            )}

            {/* Location Change Confirmation Modal */}
            {pendingLocation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
                    <div className="bg-surface border border-subtle rounded-3xl p-8 max-w-sm w-full animate-scale-in">
                        <div className="text-center mb-6">
                            <MapPin size={48} className="text-primary mx-auto mb-4" />
                            <h3 className="text-2xl font-display font-bold text-white tracking-tight">Сменить локацию?</h3>
                            <p className="text-gray-400 text-sm mt-2">Ваша программа будет полностью адаптирована.</p>
                        </div>

                        <div className="bg-black rounded-xl p-4 mb-8 text-center border border-white/5">
                            <p className="text-gray-500 text-xs mb-1">Новая локация</p>
                            <p className="text-white font-display text-3xl font-bold">{pendingLocation}</p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setSelectedLocation(pendingLocation);
                                    setPendingLocation(null);
                                }}
                                className="w-full py-4 bg-white text-black rounded-xl font-display font-bold text-lg hover:bg-gray-200 transition"
                            >
                                Подтвердить
                            </button>
                            <button
                                onClick={() => setPendingLocation(null)}
                                className="w-full py-4 text-gray-500 font-bold text-xs hover:text-white transition"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsView;
