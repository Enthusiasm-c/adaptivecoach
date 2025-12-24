
import React, { useState, useEffect } from 'react';
import { OnboardingProfile, TelegramUser, Goal, Location, WhoopReadinessData } from '../types';
import { Trash2, Save, User, LogOut, Target, Calendar, Clock, Award, Loader2, MessageCircle, MapPin, AlertTriangle, Activity, ExternalLink, Unlink, Moon, Zap, ThumbsUp, AlertCircle, Heart, Wind, Thermometer, TrendingDown, TrendingUp } from 'lucide-react';
import { apiService, Badge } from '../services/apiService';
import { generateInsight, calculateAdaptation, getInsightColors } from '../services/whoopInsights';

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

            {/* WHOOP Coach Analysis Modal */}
            {showWhoopDebug && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
                    <div className="bg-surface border border-subtle rounded-3xl max-w-md w-full max-h-[90vh] overflow-hidden animate-scale-in">
                        {whoopDebugLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 px-6">
                                <div className="relative">
                                    <Activity className="text-primary animate-pulse" size={48} />
                                    <div className="absolute inset-0 animate-ping">
                                        <Activity className="text-primary/30" size={48} />
                                    </div>
                                </div>
                                <p className="text-gray-400 font-display font-bold mt-4">Анализирую данные WHOOP...</p>
                            </div>
                        ) : whoopDebugData?.error ? (
                            <div className="p-6">
                                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                                    <p className="text-red-400 font-bold text-sm">Ошибка подключения</p>
                                    <p className="text-red-300 text-xs mt-1">{whoopDebugData.error}</p>
                                </div>
                                <button
                                    onClick={() => setShowWhoopDebug(false)}
                                    className="mt-4 w-full py-3 bg-subtle text-white rounded-xl font-display font-bold text-sm"
                                >
                                    Закрыть
                                </button>
                            </div>
                        ) : whoopDebugData?.hasRealData ? (() => {
                            // Generate coach insight
                            const whoopData: WhoopReadinessData = {
                                recoveryScore: whoopDebugData.recoveryScore || 0,
                                sleepPerformance: whoopDebugData.sleepPerformance || 0,
                                sleepHours: whoopDebugData.sleepHours || 0,
                                hrv: whoopDebugData.hrv || 0,
                                rhr: whoopDebugData.rhr || 0,
                                sleepScore: whoopDebugData.sleepScore || 3,
                                stressScore: whoopDebugData.stressScore || 3,
                                sorenessScore: whoopDebugData.sorenessScore || 3,
                            };
                            const insight = generateInsight(whoopData);
                            const adaptation = calculateAdaptation(whoopData);
                            const colors = getInsightColors(insight.type);

                            const InsightIcon = insight.icon === 'moon' ? Moon
                                : insight.icon === 'zap' ? Zap
                                : insight.icon === 'thumbs-up' ? ThumbsUp
                                : AlertCircle;

                            const getRecoveryColor = (score: number) => {
                                if (score >= 67) return 'text-success';
                                if (score >= 34) return 'text-yellow-400';
                                return 'text-red-400';
                            };

                            const getHrvInterpretation = (hrv: number) => {
                                if (hrv >= 60) return { text: 'Высокая адаптация', color: 'text-success' };
                                if (hrv >= 40) return { text: 'Умеренная нагрузка', color: 'text-yellow-400' };
                                return { text: 'Высокая нагрузка на НС', color: 'text-red-400' };
                            };

                            const hrvInfo = getHrvInterpretation(whoopData.hrv);

                            return (
                                <div className="overflow-y-auto max-h-[90vh]">
                                    {/* Header with Recovery Score */}
                                    <div className={`${colors.bg} border-b ${colors.border} p-6`}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center`}>
                                                    <InsightIcon className={colors.icon} size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Твоё состояние</p>
                                                    <p className={`${colors.text} font-display font-bold text-lg leading-tight`}>{insight.title}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setShowWhoopDebug(false)}
                                                className="text-gray-500 hover:text-white transition text-2xl leading-none"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                        {insight.subtitle && (
                                            <p className="text-gray-400 text-sm mt-3 ml-15">{insight.subtitle}</p>
                                        )}
                                    </div>

                                    {/* Key Metrics */}
                                    <div className="p-4 space-y-3">
                                        {/* Recovery Score - Big Display */}
                                        <div className="bg-black/50 rounded-2xl p-4 border border-white/5">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Recovery Score</span>
                                                <span className={`font-display font-black text-4xl ${getRecoveryColor(whoopData.recoveryScore)}`}>
                                                    {whoopData.recoveryScore}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${
                                                        whoopData.recoveryScore >= 67 ? 'bg-success' :
                                                        whoopData.recoveryScore >= 34 ? 'bg-yellow-400' : 'bg-red-400'
                                                    }`}
                                                    style={{ width: `${whoopData.recoveryScore}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-1 text-[10px] text-gray-600">
                                                <span>Восстановление</span>
                                                <span>Нагрузка</span>
                                                <span>Пик</span>
                                            </div>
                                        </div>

                                        {/* HRV Analysis */}
                                        <div className="bg-black/50 rounded-2xl p-4 border border-white/5">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Heart className="text-primary" size={18} />
                                                <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Вариабельность пульса (HRV)</span>
                                            </div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-display font-black text-2xl text-white">{Math.round(whoopData.hrv)}</span>
                                                <span className="text-gray-500 text-sm">мс</span>
                                                <span className={`ml-auto text-xs font-bold ${hrvInfo.color}`}>{hrvInfo.text}</span>
                                            </div>
                                            <p className="text-gray-600 text-[10px] mt-2">
                                                HRV отражает способность нервной системы адаптироваться к нагрузке.
                                                {whoopData.hrv < 40 ? ' Низкий показатель указывает на накопленную усталость.' :
                                                 whoopData.hrv > 60 ? ' Отличный показатель — организм готов к интенсивной работе.' :
                                                 ' Нормальный уровень для тренировки.'}
                                            </p>
                                        </div>

                                        {/* Sleep & Vitals Grid */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-black/50 rounded-xl p-3 border border-white/5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Moon className="text-info" size={14} />
                                                    <span className="text-gray-600 text-[10px] font-bold">СОН</span>
                                                </div>
                                                <p className="font-display font-bold text-xl text-white">{whoopData.sleepHours}ч</p>
                                                <p className="text-gray-500 text-[10px]">Эффективность {Math.round(whoopDebugData.sleepEfficiency || 0)}%</p>
                                            </div>
                                            <div className="bg-black/50 rounded-xl p-3 border border-white/5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Heart className="text-red-400" size={14} />
                                                    <span className="text-gray-600 text-[10px] font-bold">ПУЛЬС ПОКОЯ</span>
                                                </div>
                                                <p className="font-display font-bold text-xl text-white">{whoopData.rhr}</p>
                                                <p className="text-gray-500 text-[10px]">уд/мин</p>
                                            </div>
                                            <div className="bg-black/50 rounded-xl p-3 border border-white/5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Wind className="text-blue-400" size={14} />
                                                    <span className="text-gray-600 text-[10px] font-bold">SpO2</span>
                                                </div>
                                                <p className="font-display font-bold text-xl text-white">{whoopDebugData.spo2 || 0}%</p>
                                                <p className="text-gray-500 text-[10px]">Насыщение O2</p>
                                            </div>
                                            <div className="bg-black/50 rounded-xl p-3 border border-white/5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Thermometer className="text-orange-400" size={14} />
                                                    <span className="text-gray-600 text-[10px] font-bold">ТЕМПЕРАТУРА</span>
                                                </div>
                                                <p className="font-display font-bold text-xl text-white">{Math.round((whoopDebugData.skinTemp || 0) * 10) / 10}°</p>
                                                <p className="text-gray-500 text-[10px]">Кожи</p>
                                            </div>
                                        </div>

                                        {/* Workout Adaptation */}
                                        {adaptation.reason !== 'good_recovery' && (
                                            <div className={`${colors.bg} border ${colors.border} rounded-2xl p-4`}>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <TrendingDown className={colors.icon} size={18} />
                                                    <span className={`text-xs font-bold ${colors.text}`}>АДАПТАЦИЯ ТРЕНИРОВКИ</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {insight.adaptations.map((a, i) => (
                                                        <div key={i} className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${colors.icon.replace('text-', 'bg-')}`} />
                                                            <span className="text-gray-300 text-sm">{a}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-gray-500 text-[10px] mt-3">
                                                    {adaptation.reason === 'low_recovery'
                                                        ? 'Главное сегодня — не откатиться назад. Сделаем меньше, но качественно. Завтра наверстаем.'
                                                        : 'Чуть скорректируем нагрузку. Ты всё равно получишь хороший стимул для роста.'}
                                                </p>
                                            </div>
                                        )}

                                        {adaptation.reason === 'good_recovery' && (
                                            <div className="bg-success/10 border border-success/30 rounded-2xl p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <TrendingUp className="text-success" size={18} />
                                                    <span className="text-xs font-bold text-success">РАБОТАЕМ ПО ПЛАНУ</span>
                                                </div>
                                                <p className="text-gray-400 text-sm">
                                                    {whoopData.recoveryScore > 80
                                                        ? 'Отличное восстановление. Если последний подход пойдёт легко — можно попробовать добавить вес.'
                                                        : 'Организм в норме. Выполняем тренировку как запланировано.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="p-4 pt-0">
                                        <button
                                            onClick={() => setShowWhoopDebug(false)}
                                            className="w-full py-4 bg-white text-black rounded-xl font-display font-bold hover:bg-gray-200 transition"
                                        >
                                            Понятно
                                        </button>
                                    </div>
                                </div>
                            );
                        })() : (
                            <div className="p-6">
                                <div className="text-center py-8">
                                    <Moon className="text-gray-600 mx-auto mb-4" size={48} />
                                    <p className="text-white font-display font-bold text-lg mb-2">Нет данных о сне</p>
                                    <p className="text-gray-500 text-sm">
                                        WHOOP рассчитывает Recovery после фиксации сна.
                                        Убедись что браслет был надет ночью и данные синхронизированы.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowWhoopDebug(false)}
                                    className="w-full py-3 bg-subtle text-white rounded-xl font-display font-bold text-sm"
                                >
                                    Закрыть
                                </button>
                            </div>
                        )}
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
