```javascript
import React, { useState, useEffect } from 'react';
import { OnboardingProfile, TrainingProgram, WorkoutLog, WorkoutSession, ReadinessData, TelegramUser, ActiveWorkoutState } from '../types';
import WorkoutView from './WorkoutView';
import ProgressView from './ProgressView';
import SettingsView from './SettingsView';
import SquadView from './SquadView'; // New import
import { Play, Calendar, Check, ChevronLeft, ChevronRight, BarChart2, Settings, LayoutGrid, Dumbbell, Bot, Crown, Users, MessageCircle, Flame, Activity, Zap, Clock, TrendingUp, Sparkles, MessageSquarePlus, HelpCircle, Coffee, Sun, Moon } from 'lucide-react'; // Updated imports
import WorkoutPreviewModal from './WorkoutPreviewModal';
import ReadinessModal from './ReadinessModal';
import { calculateStreaks, calculateWorkoutVolume, calculateWeeklyProgress, getMuscleFocus, calculateLevel } from '../utils/progressUtils';
import { getDashboardInsight } from '../services/geminiService';
import { hapticFeedback } from '../utils/hapticUtils';
import SkeletonLoader from './SkeletonLoader';


interface DashboardProps {
    profile: OnboardingProfile;
    program: TrainingProgram;
    logs: WorkoutLog[];
    telegramUser: TelegramUser | null;
    onWorkoutComplete: (log: WorkoutLog) => void;
    onUpdateProfile: (newProfile: OnboardingProfile) => void;
    onResetAccount: () => void;
    onOpenChat: () => void;
}

type View = 'today' | 'squad' | 'progress' | 'settings'; // Changed 'plan' to 'squad'

const Dashboard: React.FC<DashboardProps> = ({ profile, program, logs, telegramUser, onWorkoutComplete, onUpdateProfile, onResetAccount, onOpenChat }) => {
    const [activeView, setActiveView] = useState<View>('today');
    const [activeWorkout, setActiveWorkout] = useState<string | null>(null);
    const [workoutToPreview, setWorkoutToPreview] = useState<WorkoutSession | null>(null);
    const [restoredState, setRestoredState] = useState<ActiveWorkoutState | null>(null);

    // Readiness State
    const [showReadinessModal, setShowReadinessModal] = useState(false);
    const [pendingSessionName, setPendingSessionName] = useState<string | null>(null);
    const [currentReadiness, setCurrentReadiness] = useState<ReadinessData | null>(null);

    // AI Insight State
    const [coachInsight, setCoachInsight] = useState<string | null>(null);
    const [isInsightLoading, setIsInsightLoading] = useState(false);

    // Calendar State (Removed calendarDate, isEditingSchedule, selectedDateToMove, scheduleOverrides)

    useEffect(() => {
        // Check for first login
        // Removed Welcome Guide as per user request
    }, []);

    useEffect(() => {
        // Load overrides (Removed scheduleOverrides loading)

        // Restore active workout state
        try {
            const savedState = localStorage.getItem('activeWorkoutState');
            if (savedState) {
                const parsedState: ActiveWorkoutState = JSON.parse(savedState);
                // Verify if session still exists in program
                const sessionExists = program.sessions.some(s => s.name === parsedState.session.name);
                if (sessionExists) {
                    setRestoredState(parsedState);
                    setActiveWorkout(parsedState.session.name);
                    setCurrentReadiness(parsedState.readiness);
                } else {
                    localStorage.removeItem('activeWorkoutState');
                }
            }
        } catch (e) {
            console.error("Failed to restore state", e);
        }
    }, []);

    // Removed saveOverrides function


    useEffect(() => {
        // Check local storage for cached insight
        const cached = localStorage.getItem('lastCoachInsight');
        const lastLogCount = logs.length;

        let shouldFetch = true;

        if (cached) {
            const parsed = JSON.parse(cached);
            // Fetch if logs count changed OR it's been > 6 hours
            const now = new Date().getTime();
            const isStale = (now - parsed.timestamp) > 6 * 60 * 60 * 1000;

            if (parsed.logCount === lastLogCount && !isStale) {
                setCoachInsight(parsed.text);
                shouldFetch = false;
            }
        }

        if (shouldFetch) {
            const fetchInsight = async () => {
                setIsInsightLoading(true);
                try {
                    const text = await getDashboardInsight(profile, logs);
                    setCoachInsight(text);
                    localStorage.setItem('lastCoachInsight', JSON.stringify({
                        timestamp: new Date().getTime(),
                        logCount: lastLogCount,
                        text: text
                    }));
                } catch (e) {
                    console.error("Failed to fetch insight", e);
                } finally {
                    setIsInsightLoading(false);
                }
            }
            fetchInsight();
        }
    }, [logs.length]); // Re-run only if workout count changes


    if (!program || !Array.isArray(program.sessions) || program.sessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[100dvh] text-center p-4">
                <h2 className="text-2xl font-bold text-red-400">Ошибка плана</h2>
                <button onClick={onResetAccount} className="mt-4 px-6 py-3 bg-white text-black rounded-full font-bold">
                    Сбросить план
                </button>
            </div>
        );
    }

    // --- Logic for "What is the next workout?" ---
    // The next workout in the sequence is always based on total logs.
    // const nextWorkoutIndex = logs.length % program.sessions.length;
    // const nextWorkout = program.sessions[nextWorkoutIndex];

    // --- Logic for "Is today a workout day?" ---
    const getIsTodayWorkoutDay = () => {
        const today = new Date();
        const dateStr = today.toDateString();

        // 1. Check completed logs (Did we already work out today?)
        const hasLogToday = logs.some(l => new Date(l.date).toDateString() === dateStr);
        if (hasLogToday) return false; // Already done, so "no workout pending"

        // 2. Check Schedule Preference
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
        // Fix: Ensure we strictly follow preferred days
        return (profile.preferredDays || []).includes(dayOfWeek);
    };

    const isTodayWorkoutDay = getIsTodayWorkoutDay();

    // --- Logic for "What is the next workout?" ---
    // Fix: Align next workout with the actual day of week if possible, or just next in sequence
    const getNextWorkout = () => {
        const dayOfWeek = new Date().getDay();
        // If today is a preferred day, find which workout corresponds to this day in the cycle
        // This is a heuristic: map preferred days to session indices
        const sortedDays = [...(profile.preferredDays || [])].sort();
        const dayIndex = sortedDays.indexOf(dayOfWeek);

        if (dayIndex !== -1) {
            // Today is a workout day. Which one?
            // We can try to map it to the session index modulo length
            // But we also need to respect the "next in sequence" from logs
            // Let's stick to the sequence from logs to ensure progression, 
            // BUT if the user missed a day, we might want to skip? 
            // No, skipping workouts is bad. Stick to sequence.
            return program.sessions[logs.length % program.sessions.length];
        } else {
            // Today is rest. Show the NEXT planned workout.
            return program.sessions[logs.length % program.sessions.length];
        }
    };

    const nextWorkout = getNextWorkout();

    const { currentStreak } = calculateStreaks(logs);
    const lastWorkoutVolume = logs.length > 0 ? calculateWorkoutVolume(logs[logs.length - 1]) : 0;
    const weeklyProgress = calculateWeeklyProgress(logs);
    const userLevel = calculateLevel(logs);

    // Calculate muscle focus based on the *next* workout, even if not today
    const muscleFocus = getMuscleFocus(nextWorkout);


    if (activeWorkout) {
        const workout = program.sessions.find(s => s.name === activeWorkout);
        if (workout) {
            return (
                <WorkoutView
                    session={workout}
                    profile={profile}
                    readiness={currentReadiness}
                    initialState={restoredState && restoredState.session.name === workout.name ? {
                        completedExercises: restoredState.completedExercises,
                        startTime: restoredState.startTime
                    } : undefined}
                    onProgress={(state) => {
                        const activeState: ActiveWorkoutState = {
                            session: workout,
                            completedExercises: state.completedExercises,
                            startTime: state.startTime,
                            readiness: currentReadiness
                        };
                        localStorage.setItem('activeWorkoutState', JSON.stringify(activeState));
                    }}
                    onFinish={(log) => {
                        onWorkoutComplete(log);
                        setActiveWorkout(null);
                        setCurrentReadiness(null);
                        setRestoredState(null);
                        localStorage.removeItem('activeWorkoutState');
                    }}
                    onBack={() => {
                        // If backing out, we might want to KEEP the state so they can resume?
                        // Or warn them? For now, let's keep it in storage but clear UI state
                        // actually, if they press back, they might expect to cancel.
                        // But "Telegram app" rules say persistence is key.
                        // Let's NOT clear storage on back, just UI.
                        setActiveWorkout(null);
                        setCurrentReadiness(null);
                    }}
                />
            );
        }
    }

    const initiateWorkoutStart = (sessionName: string) => {
        // Check readiness first
        setPendingSessionName(sessionName);
        setShowReadinessModal(true);
        hapticFeedback.impactOccurred('heavy');
    };

    // Called when user clicks "Start" on a future workout in the calendar or preview
    // This effectively "moves" it to today by starting it now.
    const forceStartWorkout = (sessionName: string) => {
        initiateWorkoutStart(sessionName);
    }

    const handleReadinessConfirm = (data: ReadinessData) => {
        setCurrentReadiness(data);
        setShowReadinessModal(false);
        if (pendingSessionName) {
            setActiveWorkout(pendingSessionName);
            setPendingSessionName(null);
        }
    };

    // --- Calendar Logic --- (Removed all calendar-related functions)

    const handleUpdateProgram = (updatedProgram: TrainingProgram) => {
        // Placeholder for future update logic
    };

    const renderContent = () => {
        if (activeView === 'squad') { // New 'squad' view
            return <SquadView telegramUser={telegramUser} />;
        }

        if (activeView === 'progress') {
            return <ProgressView logs={logs} program={program} />;
        }

        if (activeView === 'settings') {
            return (
                <div className="pb-32 animate-fade-in">
                    <SettingsView
                        profile={profile}
                        telegramUser={telegramUser}
                        onUpdateProfile={onUpdateProfile}
                        onResetAccount={onResetAccount}
                    />
                </div>
            );
        }

        // Default 'today' view
        return (
            <div className="grid grid-cols-2 gap-4 pb-32 animate-fade-in">
                {/* Header with Weekly Progress Ring */}
                <div className="col-span-2 flex justify-between items-center py-2 px-1 pt-[env(safe-area-inset-top)]">
                    <div className="flex items-center gap-3">
                        {telegramUser?.photo_url ? (
                            <img
                                src={telegramUser.photo_url}
                                alt="User"
                                className="w-12 h-12 rounded-full border border-white/20"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center">
                                <Bot size={20} className="text-gray-400" />
                            </div>
                        )}
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">
                                Добрый день,
                            </p>
                            <h1 className="text-xl font-bold text-white leading-none mt-0.5">
                                {telegramUser?.first_name || "Спортсмен"}
                            </h1>
                        </div>
                    </div>

                    {/* Weekly Goal Widget */}
                    <div className="flex items-center gap-3 bg-neutral-900 border border-white/10 rounded-full pl-4 pr-1.5 py-1.5">
                        <div className="text-right mr-1">
                            <p className="text-[10px] text-gray-400 font-bold uppercase">План на неделю</p>
                            <p className="text-sm font-black text-white leading-none">{weeklyProgress} <span className="text-gray-500">/ {profile.daysPerWeek}</span></p>
                        </div>
                        <div className="relative w-10 h-10 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="20" cy="20" r="16" stroke="#333" strokeWidth="4" fill="none" />
                                <circle
                                    cx="20" cy="20" r="16"
                                    stroke={weeklyProgress >= profile.daysPerWeek ? '#10B981' : '#6366f1'}
                                    strokeWidth="4"
                                    fill="none"
                                    strokeDasharray={100}
                                    strokeDashoffset={100 - (100 * Math.min(weeklyProgress, profile.daysPerWeek) / profile.daysPerWeek)}
                                    className="transition-all duration-1000 ease-out"
                                    strokeLinecap="round"
                                />
                            </svg>
                            {weeklyProgress >= profile.daysPerWeek && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Check size={14} className="text-green-500" strokeWidth={4} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Action Grid (New Feature for Richness) */}
                <div className="col-span-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
                    <div className="flex gap-3 w-max">
                        <button
                            onClick={onOpenChat}
                            className="flex items-center gap-2 bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 whitespace-nowrap active:scale-95 transition"
                        >
                            <MessageSquarePlus size={16} className="text-indigo-400" />
                            <span className="text-xs font-bold text-gray-300">Чат с тренером</span>
                        </button>

                        <button
                            onClick={() => setActiveView('plan')}
                            className="flex items-center gap-2 bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 whitespace-nowrap active:scale-95 transition"
                        >
                            <Calendar size={16} className="text-violet-400" />
                            <span className="text-xs font-bold text-gray-300">Изменить график</span>
                        </button>
                        {isTodayWorkoutDay && (
                            <button
                                onClick={() => setWorkoutToPreview(nextWorkout)}
                                className="flex items-center gap-2 bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 whitespace-nowrap active:scale-95 transition"
                            >
                                <Dumbbell size={16} className="text-emerald-400" />
                                <span className="text-xs font-bold text-gray-300">Обзор тренировки</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* AI Insight & Body Status Combined Widget */}
                <div
                    onClick={onOpenChat}
                    className="col-span-2 bg-neutral-900/80 border border-white/10 rounded-3xl p-4 flex items-start gap-4 cursor-pointer hover:bg-neutral-800 transition active:scale-[0.99] relative overflow-hidden group"
                >
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

                    <div className="shrink-0 pt-1">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 relative">
                            <MessageCircle size={20} />
                            {!coachInsight && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-neutral-900 animate-pulse"></div>}
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold text-white text-sm">Статус восстановления</h3>
                            <div className="px-2 py-0.5 bg-green-500/10 rounded text-[10px] font-bold text-green-400 uppercase tracking-wide">
                                {isTodayWorkoutDay ? "Готов к бою" : "Активный отдых"}
                            </div>
                        </div>

                        {/* Visual Battery Bar */}
                        <div className="flex gap-1 mb-2 h-1.5 w-full max-w-[120px]">
                            <div className="flex-1 bg-green-500 rounded-full"></div>
                            <div className="flex-1 bg-green-500 rounded-full"></div>
                            <div className="flex-1 bg-green-500 rounded-full"></div>
                            <div className={`flex - 1 rounded - full ${ isTodayWorkoutDay ? 'bg-neutral-700' : 'bg-green-500' } `}></div>
                        </div>

                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                            {coachInsight || (isTodayWorkoutDay
                                ? "Твое тело восстановилось. Сегодня отличный день, чтобы увеличить нагрузку."
                                : "Сегодня день восстановления. Легкая прогулка или растяжка помогут мышцам расти.")}
                        </p>
                    </div>
                </div>

                {/* CONDITIONAL MAIN CARD: Workout OR Rest */}
                {isTodayWorkoutDay ? (
                    /* WORKOUT CARD */
                    <div className="col-span-2 relative group mt-2">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-[2rem] blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
                        <div className="relative bg-[#111] border border-white/10 rounded-[2rem] p-6 overflow-hidden">

                            {/* Background Pattern */}
                            <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
                                <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
                                    <path d="M100 0L200 100L100 200L0 100L100 0Z" fill="white" />
                                </svg>
                            </div>

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider">
                                                <Calendar size={10} /> Сегодня
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                                <Clock size={10} /> ~{profile.timePerWorkout} мин
                                            </span>
                                        </div>
                                        <h2 className="text-3xl font-black text-white leading-tight mb-2">{nextWorkout.name}</h2>
                                    </div>
                                </div>

                                {/* Muscle Focus Tags */}
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {muscleFocus.map(muscle => (
                                        <span key={muscle} className="px-3 py-1 rounded-full border border-indigo-500/30 text-indigo-300 text-xs font-bold bg-indigo-500/10">
                                            {muscle}
                                        </span>
                                    ))}
                                    <span className="px-3 py-1 rounded-full border border-white/5 text-gray-500 text-xs font-bold">
                                        +{Math.max(0, nextWorkout.exercises.length - muscleFocus.length)} упр.
                                    </span>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => initiateWorkoutStart(nextWorkout.name)}
                                        className="flex-1 bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200 transition active:scale-95 shadow-xl shadow-white/5"
                                    >
                                        <Play size={20} fill="currentColor" /> Начать
                                    </button>
                                    <button
                                        onClick={() => setWorkoutToPreview(nextWorkout)}
                                        className="px-5 bg-white/5 text-white font-semibold rounded-2xl border border-white/10 hover:bg-white/10 transition active:scale-95"
                                    >
                                        Обзор
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* REST DAY CARD */
                    <div className="col-span-2 relative group mt-2">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-[2rem] blur-xl opacity-20"></div>
                        <div className="relative bg-[#111] border border-white/10 rounded-[2rem] p-6 overflow-hidden">

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                                                <Moon size={10} /> День Отдыха
                                            </span>
                                        </div>
                                        <h2 className="text-3xl font-black text-white leading-tight mb-2">Восстановление</h2>
                                        <p className="text-gray-400 text-sm mb-4">
                                            Сегодня по плану отдых. Мышцы растут именно сейчас.
                                        </p>
                                    </div>
                                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                                        <Coffee size={32} className="text-emerald-500" />
                                    </div>
                                </div>

                                <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
                                    <div className="bg-neutral-900 border border-white/5 rounded-xl p-3 min-w-[120px]">
                                        <Sun size={16} className="text-yellow-400 mb-2" />
                                        <p className="text-xs font-bold text-white">Прогулка</p>
                                        <p className="text-[10px] text-gray-500">30-40 мин</p>
                                    </div>
                                    <div className="bg-neutral-900 border border-white/5 rounded-xl p-3 min-w-[120px]">
                                        <Activity size={16} className="text-blue-400 mb-2" />
                                        <p className="text-xs font-bold text-white">Растяжка</p>
                                        <p className="text-[10px] text-gray-500">Легкая йога</p>
                                    </div>
                                </div>
                                {/* Coach Insight */}
                                <div className="mb-6 bg-neutral-900/50 border border-white/5 rounded-3xl overflow-hidden">
                                    <div className="p-5">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                                                <Bot size={20} className="text-indigo-400" />
                                            </div>
                                            <h3 className="font-bold text-lg text-white">Тренер на связи</h3>
                                        </div>

                                        <div className="bg-neutral-900/50 rounded-xl p-4 border border-white/5 relative">
                                            {isInsightLoading ? (
                                                <div className="space-y-2">
                                                    <SkeletonLoader className="h-4 w-3/4" />
                                                    <SkeletonLoader className="h-4 w-full" />
                                                    <SkeletonLoader className="h-4 w-5/6" />
                                                </div>
                                            ) : (
                                                <p className="text-gray-300 text-sm leading-relaxed">
                                                    {coachInsight || "Анализирую твой прогресс..."}
                                                </p>
                                            )}

                                            <div className="absolute -bottom-3 -right-3 opacity-10">
                                                <MessageCircle size={64} />
                                            </div>
                                        </div>

                                        <button
                                            onClick={onOpenChat}
                                            className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-500 transition shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                                        >
                                            <MessageSquarePlus size={16} />
                                            Написать тренеру
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={() => initiateWorkoutStart(nextWorkout.name)}
                                    className="w-full bg-neutral-800 text-gray-400 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-neutral-700 hover:text-white transition active:scale-95 text-sm border border-white/5"
                                >
                                    <Play size={14} /> Начать "{nextWorkout.name}" досрочно
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Grid - Gamification */}
                <div className="col-span-2 grid grid-cols-3 gap-3 mt-2">

                    {/* Streak */}
                    <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1">
                        <Flame size={20} className="text-orange-500 mb-1" fill="currentColor" fillOpacity={0.2} />
                        <span className="text-xl font-black text-white leading-none">{currentStreak}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Дней подряд</span>
                    </div>

                    {/* Level */}
                    <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1 relative overflow-hidden">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-neutral-800">
                            <div className="h-full bg-yellow-500" style={{ width: `${ userLevel.levelProgress }% ` }}></div>
                        </div>
                        <Crown size={20} className="text-yellow-500 mb-1" fill="currentColor" fillOpacity={0.2} />
                        <span className="text-xl font-black text-white leading-none">{userLevel.level}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Уровень</span>
                    </div>

                    {/* Last Volume */}
                    <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1">
                        <Dumbbell size={20} className="text-emerald-500 mb-1" />
                        <span className="text-xl font-black text-white leading-none">{(lastWorkoutVolume / 1000).toFixed(1)}т</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Поднято</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full max-w-md mx-auto min-h-[100dvh] p-4 font-sans text-gray-100 relative">
            <main className="py-2">
                {renderContent()}
            </main>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 w-full bg-neutral-950/90 backdrop-blur-md border-t border-white/5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3 flex justify-around items-center z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                <NavButton
                    icon={<LayoutGrid size={24} strokeWidth={activeView === 'today' ? 2.5 : 2} />}
                    label="Главная"
                    isActive={activeView === 'today'}
                    onClick={() => { setActiveView('today'); hapticFeedback.selectionChanged(); }}
                />
                <NavButton
                    icon={<Users size={24} strokeWidth={activeView === 'squad' ? 2.5 : 2} />}
                    label="Squad"
                    isActive={activeView === 'squad'}
                    onClick={() => { setActiveView('squad'); hapticFeedback.selectionChanged(); }}
                />
                <NavButton
                    icon={<BarChart2 size={24} strokeWidth={activeView === 'progress' ? 2.5 : 2} />}
                    label="Прогресс"
                    isActive={activeView === 'progress'}
                    onClick={() => { setActiveView('progress'); hapticFeedback.selectionChanged(); }}
                />
                <NavButton
                    icon={<Settings size={24} strokeWidth={activeView === 'settings' ? 2.5 : 2} />}
                    label="Настройки"
                    isActive={activeView === 'settings'}
                    onClick={() => { setActiveView('settings'); hapticFeedback.selectionChanged(); }}
                />
            </nav>

            {workoutToPreview && (
                <WorkoutPreviewModal
                    session={workoutToPreview}
                    onClose={() => setWorkoutToPreview(null)}
                    onStart={() => forceStartWorkout(workoutToPreview.name)}
                />
            )}

            {showReadinessModal && (
                <ReadinessModal
                    onConfirm={handleReadinessConfirm}
                    onCancel={() => setShowReadinessModal(false)}
                />
            )}
        </div>
    );
};

const NavButton = ({ icon, label, isActive, onClick }: any) => (
    <button
        onClick={onClick}
        className={`relative flex flex - col items - center justify - center gap - 1 w - 16 py - 1 transition - all duration - 300 group ${ isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300' } `}
    >
        <div className={`relative p - 1 transition - transform duration - 300 ${ isActive ? '-translate-y-1' : '' } `}>
            {icon}
            {isActive && (
                <div className="absolute inset-0 bg-indigo-500/30 blur-lg rounded-full opacity-60"></div>
            )}
        </div>
        <span className={`text - [10px] font - medium tracking - wider transition - opacity duration - 300 ${ isActive ? 'opacity-100 text-indigo-300' : 'opacity-70' } `}>
            {label}
        </span>

        {/* Top indicator line for active state */}
        {isActive && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-indigo-500 rounded-b-full shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>
        )}
    </button>
)

export default Dashboard;
