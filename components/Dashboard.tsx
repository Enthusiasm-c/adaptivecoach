import React, { useState, useEffect } from 'react';
import { OnboardingProfile, TrainingProgram, WorkoutLog, WorkoutSession, ReadinessData, ActiveWorkoutState, TelegramUser, WorkoutLimitStatus } from '../types';
import WorkoutView from './WorkoutView';
import ProgressView from './ProgressView';
import SettingsView from './SettingsView';
import SquadView from './SquadView';
import ChatInputBar from './ChatInputBar';
import { Dumbbell, Calendar as CalendarIcon, BarChart2, Settings, Play, ChevronRight, Info, Battery, Zap, Trophy, Users, Crown, Bot, MessageCircle, Flame, Activity, Clock, TrendingUp, Sparkles, MessageSquarePlus, HelpCircle, Coffee, Sun, Moon, Check, LayoutGrid, Shield, AlertTriangle } from 'lucide-react';
import WorkoutPreviewModal from './WorkoutPreviewModal';
import ReadinessModal from './ReadinessModal';
import PremiumModal from './PremiumModal';
import HardPaywall from './HardPaywall';
import TrialBanner from './TrialBanner';
import FirstWorkoutPaywall from './FirstWorkoutPaywall';
import StreakMilestonePaywall from './StreakMilestonePaywall';
import { calculateStreaks, calculateWorkoutVolume, calculateWeeklyProgress, getMuscleFocus, calculateLevel, pluralizeRu } from '../utils/progressUtils';
import { getDashboardInsight } from '../services/geminiService';
import { hapticFeedback } from '../utils/hapticUtils';
import SkeletonLoader from './SkeletonLoader';
import apiService from '../services/apiService';

interface DashboardProps {
    profile: OnboardingProfile;
    logs: WorkoutLog[];
    program: TrainingProgram | null;
    telegramUser: TelegramUser | null;
    onUpdateProgram: (program: TrainingProgram) => void;
    onUpdateProfile: (profile: OnboardingProfile) => void;
    onWorkoutComplete: (log: WorkoutLog) => void;
    onResetAccount: () => void;
    onOpenChat: () => void;
    onSendMessage: (message: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ profile, logs, program, telegramUser, onUpdateProgram, onUpdateProfile, onWorkoutComplete, onResetAccount, onOpenChat, onSendMessage }) => {
    const [activeView, setActiveView] = useState<'today' | 'squad' | 'progress' | 'settings'>('today');
    const [activeWorkout, setActiveWorkout] = useState<string | null>(null);
    const [workoutToPreview, setWorkoutToPreview] = useState<WorkoutSession | null>(null);
    const [insight, setInsight] = useState<string | null>(null); // Unified insight state
    const [isInsightLoading, setIsInsightLoading] = useState(false);
    const [showPremiumModal, setShowPremiumModal] = useState(false);
    const [showReadinessModal, setShowReadinessModal] = useState(false);
    const [pendingSessionName, setPendingSessionName] = useState<string | null>(null);
    const [currentReadiness, setCurrentReadiness] = useState<ReadinessData | null>(null);
    const [restoredState, setRestoredState] = useState<ActiveWorkoutState | null>(null);

    // Monetization state
    const [showHardPaywall, setShowHardPaywall] = useState(false);
    const [workoutLimitStatus, setWorkoutLimitStatus] = useState<WorkoutLimitStatus | null>(null);
    const [streakShieldAvailable, setStreakShieldAvailable] = useState(false);

    // Track page views for analytics
    useEffect(() => {
        apiService.analytics.track('page_view', { page: activeView }).catch(() => {});
    }, [activeView]);
    const [shieldNotification, setShieldNotification] = useState<string | null>(null);
    const [showFirstWorkoutPaywall, setShowFirstWorkoutPaywall] = useState(false);
    const [streakMilestone, setStreakMilestone] = useState<number | null>(null);
    const [isInputFocused, setIsInputFocused] = useState(false);

    // Calendar State (Removed calendarDate, isEditingSchedule, selectedDateToMove, scheduleOverrides)

    useEffect(() => {
        // Check for first login
        // Removed Welcome Guide as per user request
    }, []);

    // Fetch workout limit status on mount
    useEffect(() => {
        const fetchMonetizationStatus = async () => {
            try {
                const limitStatus = await apiService.monetization.getWorkoutLimit();
                setWorkoutLimitStatus(limitStatus);

                // Show notification if shield was auto-used
                if (limitStatus.shieldAutoUsed) {
                    setShieldNotification('Защита стрика активирована! Твой стрик сохранён.');
                    hapticFeedback.notificationOccurred('success');
                    // Auto-dismiss after 5 seconds
                    setTimeout(() => setShieldNotification(null), 5000);
                }

                // Also fetch streak shield status if user is Pro
                if (limitStatus.isPro) {
                    const shieldStatus = await apiService.monetization.getStreakShield();
                    setStreakShieldAvailable(shieldStatus.shieldAvailable);
                }
            } catch (error) {
                console.error('Failed to fetch monetization status:', error);
            }
        };

        fetchMonetizationStatus();
    }, []);

    useEffect(() => {
        // Load overrides (Removed scheduleOverrides loading)

        // Restore active workout state
        try {
            const savedState = localStorage.getItem('activeWorkoutState');
            if (savedState && program) {
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
    }, [program]);

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
                setInsight(parsed.text);
                shouldFetch = false;
            }
        }

        if (shouldFetch) {
            const fetchInsight = async () => {
                setIsInsightLoading(true);
                try {
                    const text = await getDashboardInsight(profile, logs);
                    setInsight(text);
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
    }, [logs.length, profile]);


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

    const { currentStreak } = calculateStreaks(logs, undefined, profile.preferredDays);
    const lastWorkoutVolume = logs.length > 0 ? calculateWorkoutVolume(logs[logs.length - 1]) : 0;
    const weeklyProgress = calculateWeeklyProgress(logs);
    const userLevel = calculateLevel(logs);

    // Check for streak milestones
    useEffect(() => {
        if (workoutLimitStatus?.isPro || workoutLimitStatus?.isInTrial) return;

        const milestones = [7, 30, 100];
        const shownMilestones = JSON.parse(
            localStorage.getItem('shownStreakMilestones') || '[]'
        );

        if (milestones.includes(currentStreak) &&
            !shownMilestones.includes(currentStreak)) {
            setStreakMilestone(currentStreak);
            localStorage.setItem(
                'shownStreakMilestones',
                JSON.stringify([...shownMilestones, currentStreak])
            );
        }
    }, [currentStreak, workoutLimitStatus?.isPro, workoutLimitStatus?.isInTrial]);

    // Calculate muscle focus based on the *next* workout, even if not today
    const muscleFocus = getMuscleFocus(nextWorkout);

    // Check if workout was completed today
    const todayStr = new Date().toDateString();
    const todaysWorkout = logs.find(l => new Date(l.date).toDateString() === todayStr);
    const hasCompletedToday = !!todaysWorkout;

    // Calculate improvements from today's workout
    const getTodayImprovements = () => {
        if (!todaysWorkout) return [];
        const improvements: string[] = [];

        // Compare with previous workouts to find PRs
        const prevLogs = logs.filter(l => new Date(l.date).toDateString() !== todayStr);

        todaysWorkout.completedExercises?.forEach(ex => {
            const maxWeightToday = Math.max(...(ex.completedSets?.map(s => s.weight || 0) || [0]));

            // Find previous max for this exercise
            let prevMax = 0;
            prevLogs.forEach(log => {
                log.completedExercises?.forEach(prevEx => {
                    if (prevEx.name === ex.name) {
                        const prevWeight = Math.max(...(prevEx.completedSets?.map(s => s.weight || 0) || [0]));
                        if (prevWeight > prevMax) prevMax = prevWeight;
                    }
                });
            });

            if (maxWeightToday > prevMax && prevMax > 0) {
                improvements.push(`${ex.name}: +${(maxWeightToday - prevMax).toFixed(1)} кг`);
            }
        });

        return improvements.slice(0, 3); // Max 3 improvements
    };

    const todayImprovements = getTodayImprovements();


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

                        // Show first workout paywall if this is the first workout and user is not Pro
                        const isFirstWorkout = logs.length === 0;
                        const notProOrTrial = !workoutLimitStatus?.isPro && !workoutLimitStatus?.isInTrial;
                        if (isFirstWorkout && notProOrTrial) {
                            setTimeout(() => setShowFirstWorkoutPaywall(true), 500);
                        }
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

    const initiateWorkoutStart = async (sessionName: string) => {
        // Check workout limit first
        try {
            const limitStatus = await apiService.monetization.getWorkoutLimit();
            setWorkoutLimitStatus(limitStatus);

            if (!limitStatus.canWorkout) {
                // Show hard paywall - user has used all free workouts
                hapticFeedback.notificationOccurred('warning');
                setShowHardPaywall(true);
                return;
            }

            // Show warning if this is the last free workout
            if (!limitStatus.isPro && !limitStatus.isInTrial) {
                const remaining = limitStatus.freeWorkoutsLimit - limitStatus.freeWorkoutsUsed;
                if (remaining === 1) {
                    // This is the last free workout - show soft warning
                    // (Optional: could show a toast notification here)
                }
            }
        } catch (error) {
            console.error('Failed to check workout limit:', error);
            // Continue anyway if check fails
        }

        // Check readiness
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
            return <SquadView telegramUser={telegramUser} logs={logs} isPro={workoutLimitStatus?.isPro || false} onOpenPremium={() => setShowPremiumModal(true)} />;
        }

        if (activeView === 'progress') {
            return <ProgressView logs={logs} program={program} preferredDays={profile.preferredDays} profile={profile} onOpenPremium={() => setShowPremiumModal(true)} />;
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
            <div className="grid grid-cols-2 gap-4 animate-fade-in">
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

                    {/* Weekly Goal Widget - Clickable to Progress */}
                    <button
                        onClick={() => handleViewChange('progress')}
                        className="flex items-center gap-3 bg-neutral-900 border border-white/10 rounded-full pl-4 pr-1.5 py-1.5 hover:bg-neutral-800 transition active:scale-95"
                    >
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
                    </button>
                </div>


                {/* Stats Grid */}
                <div className="col-span-2 grid grid-cols-3 gap-3">
                    {/* Streak */}
                    <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1 relative">
                        <div className="flex items-center gap-1">
                            <Flame size={20} className="text-orange-500" fill="currentColor" fillOpacity={0.2} />
                            {/* Streak Shield Indicator */}
                            {streakShieldAvailable && workoutLimitStatus?.isPro && (
                                <Shield size={12} className="text-indigo-400" fill="currentColor" fillOpacity={0.3} />
                            )}
                        </div>
                        <span className="text-xl font-black text-white leading-none">{currentStreak}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">
                            {streakShieldAvailable && workoutLimitStatus?.isPro
                                ? 'Защищён'
                                : pluralizeRu(currentStreak, 'день подряд', 'дня подряд', 'дней подряд')}
                        </span>
                    </div>

                    {/* Level */}
                    <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1 relative overflow-hidden">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-neutral-800">
                            <div className="h-full bg-yellow-500" style={{ width: `${userLevel.levelProgress}%` }}></div>
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

                {/* Trial Banner for users in trial */}
                {workoutLimitStatus?.isInTrial && workoutLimitStatus.trialDaysLeft > 0 && (
                    <TrialBanner
                        daysLeft={workoutLimitStatus.trialDaysLeft}
                        onUpgrade={() => setShowPremiumModal(true)}
                    />
                )}

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
                                                <CalendarIcon size={10} /> Сегодня
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                                <Clock size={10} /> ~{profile.timePerWorkout} мин
                                            </span>
                                        </div>
                                        <h2 className="text-3xl font-black text-white leading-tight mb-2">{nextWorkout.name}</h2>
                                    </div>
                                </div>

                                {/* Muscle Focus Tags */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {muscleFocus.map(muscle => (
                                        <span key={muscle} className="px-3 py-1 rounded-full border border-indigo-500/30 text-indigo-300 text-xs font-bold bg-indigo-500/10">
                                            {muscle}
                                        </span>
                                    ))}
                                    <span className="px-3 py-1 rounded-full border border-white/5 text-gray-500 text-xs font-bold">
                                        +{Math.max(0, nextWorkout.exercises.length - muscleFocus.length)} упр.
                                    </span>
                                </div>

                                {/* Free workouts remaining warning */}
                                {workoutLimitStatus && !workoutLimitStatus.isPro && !workoutLimitStatus.isInTrial && (
                                    <div className="flex items-center gap-2 mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                        <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                                        <span className="text-amber-300 text-sm">
                                            Осталось {workoutLimitStatus.freeWorkoutsLimit - workoutLimitStatus.freeWorkoutsUsed} бесплатных {
                                                (workoutLimitStatus.freeWorkoutsLimit - workoutLimitStatus.freeWorkoutsUsed) === 1 ? 'тренировка' :
                                                (workoutLimitStatus.freeWorkoutsLimit - workoutLimitStatus.freeWorkoutsUsed) <= 4 ? 'тренировки' : 'тренировок'
                                            }
                                        </span>
                                    </div>
                                )}

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
                ) : hasCompletedToday && todaysWorkout ? (
                    /* COMPLETED WORKOUT CARD */
                    <div className="col-span-2 relative group mt-2">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600 rounded-[2rem] blur-xl opacity-20"></div>
                        <div className="relative bg-[#111] border border-white/10 rounded-[2rem] p-6 overflow-hidden">

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/20 text-green-300 text-[10px] font-bold uppercase tracking-wider">
                                                <Check size={10} /> Тренировка завершена
                                            </span>
                                        </div>
                                        <h2 className="text-3xl font-black text-white leading-tight mb-2">{todaysWorkout.sessionId}</h2>
                                        <p className="text-gray-400 text-sm mb-2">
                                            Отличная работа! Ты стал сильнее.
                                        </p>
                                    </div>
                                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                                        <Trophy size={32} className="text-green-500" />
                                    </div>
                                </div>

                                {/* Workout Stats */}
                                <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
                                    <div className="bg-neutral-900 border border-white/5 rounded-xl p-3 min-w-[100px]">
                                        <Clock size={16} className="text-blue-400 mb-2" />
                                        <p className="text-xs font-bold text-white">
                                            {todaysWorkout.duration ? `${Math.round(todaysWorkout.duration / 60)} мин` : '—'}
                                        </p>
                                        <p className="text-[10px] text-gray-500">Время</p>
                                    </div>
                                    <div className="bg-neutral-900 border border-white/5 rounded-xl p-3 min-w-[100px]">
                                        <Dumbbell size={16} className="text-violet-400 mb-2" />
                                        <p className="text-xs font-bold text-white">
                                            {todaysWorkout.completedExercises?.length || 0}
                                        </p>
                                        <p className="text-[10px] text-gray-500">Упражнений</p>
                                    </div>
                                    <div className="bg-neutral-900 border border-white/5 rounded-xl p-3 min-w-[100px]">
                                        <TrendingUp size={16} className="text-green-400 mb-2" />
                                        <p className="text-xs font-bold text-white">
                                            {(calculateWorkoutVolume(todaysWorkout) / 1000).toFixed(1)}т
                                        </p>
                                        <p className="text-[10px] text-gray-500">Объём</p>
                                    </div>
                                </div>

                                {/* Improvements */}
                                {todayImprovements.length > 0 && (
                                    <div className="mb-4 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                                        <p className="text-xs font-bold text-green-400 mb-2 flex items-center gap-1">
                                            <Sparkles size={12} /> Прогресс сегодня
                                        </p>
                                        <div className="space-y-1">
                                            {todayImprovements.map((imp, idx) => (
                                                <p key={idx} className="text-xs text-green-300">{imp}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Feedback Summary */}
                                {todaysWorkout.feedback && (
                                    <div className="mb-4 bg-neutral-900/50 border border-white/5 rounded-xl p-3">
                                        <p className="text-xs text-gray-400">
                                            Самочувствие: <span className="text-white font-bold">
                                                {todaysWorkout.feedback.perceivedEffort === 'easy' ? 'Легко' :
                                                 todaysWorkout.feedback.perceivedEffort === 'moderate' ? 'Умеренно' :
                                                 todaysWorkout.feedback.perceivedEffort === 'hard' ? 'Тяжело' : '—'}
                                            </span>
                                        </p>
                                    </div>
                                )}
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
                                                    {insight || "Анализирую твой прогресс..."}
                                                </p>
                                            )}

                                            <div className="absolute -bottom-3 -right-3 opacity-10">
                                                <MessageCircle size={64} />
                                            </div>
                                        </div>

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

            </div>
        );
    };

    const handleViewChange = (view: 'today' | 'squad' | 'progress' | 'settings') => {
        setActiveView(view);
        hapticFeedback.selectionChanged();
    };

    return (
        <div className="min-h-screen pb-24 relative overflow-hidden">
            {/* Shield Notification */}
            {shieldNotification && (
                <div className="fixed top-4 left-4 right-4 z-50 animate-slide-down">
                    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 rounded-2xl flex items-center gap-3 shadow-xl shadow-indigo-500/30">
                        <Shield size={24} className="text-white flex-shrink-0" fill="currentColor" />
                        <p className="font-bold text-sm flex-1">{shieldNotification}</p>
                        <button
                            onClick={() => setShieldNotification(null)}
                            className="text-white/70 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="px-6 pt-6 pb-4 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-md z-40 border-b border-white/5">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight italic">
                        SENSEI<span className="text-indigo-500">TRAINING</span>
                    </h1>
                    <p className="text-xs text-gray-400 font-medium">
                        {profile.experience} • {profile.goals.primary}
                    </p>
                </div>
                <button
                    onClick={() => {
                        hapticFeedback.impactOccurred('light');
                        setShowPremiumModal(true);
                    }}
                    className="p-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-xl text-amber-400 hover:text-amber-300 transition-colors relative group"
                >
                    <Crown size={24} fill="currentColor" className="drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0a0a]"></div>
                </button>
            </header>

            {/* Main Content */}
            <main className="px-6 py-6 pb-24">
                {renderContent()}

                {/* Chat Input Bar - show only on 'today' view when no active workout */}
                {activeView === 'today' && !activeWorkout && (
                    <div className="mt-4">
                        <ChatInputBar onSendMessage={onSendMessage} onFocusChange={setIsInputFocused} />
                    </div>
                )}
            </main>

            {/* Navigation Bar - hide when keyboard is visible */}
            <nav className={`fixed bottom-6 left-6 right-6 bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex justify-between items-center shadow-2xl z-40 transition-all duration-200 ${
                isInputFocused ? 'translate-y-full opacity-0 pointer-events-none' : ''
            }`}>
                <NavButton
                    icon={<Dumbbell size={24} />}
                    label="Today"
                    isActive={activeView === 'today'}
                    onClick={() => handleViewChange('today')}
                />
                <NavButton
                    icon={<Users size={24} />}
                    label="Команда"
                    isActive={activeView === 'squad'}
                    onClick={() => handleViewChange('squad')}
                />
                <NavButton
                    icon={<BarChart2 size={24} />}
                    label="Progress"
                    isActive={activeView === 'progress'}
                    onClick={() => handleViewChange('progress')}
                />
                <NavButton
                    icon={<Settings size={24} />}
                    label="Settings"
                    isActive={activeView === 'settings'}
                    onClick={() => handleViewChange('settings')}
                />
            </nav>

            {/* Modals */}
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

            {showPremiumModal && (
                <PremiumModal
                    onClose={() => setShowPremiumModal(false)}
                    onSuccess={() => {
                        onUpdateProfile({ ...profile, isPro: true });
                        setShowPremiumModal(false);
                        // Refresh workout limit status
                        apiService.monetization.getWorkoutLimit().then(setWorkoutLimitStatus).catch(console.error);
                    }}
                    isPro={profile.isPro}
                    trialEndsAt={profile.trialEndsAt}
                    isInTrial={workoutLimitStatus?.isInTrial}
                    trialDaysLeft={workoutLimitStatus?.trialDaysLeft}
                />
            )}

            {showHardPaywall && workoutLimitStatus && (
                <HardPaywall
                    onClose={() => setShowHardPaywall(false)}
                    onOpenPremium={() => {
                        setShowHardPaywall(false);
                        setShowPremiumModal(true);
                    }}
                    onTrialStarted={() => {
                        // Refresh status after trial started
                        apiService.monetization.getWorkoutLimit().then(status => {
                            setWorkoutLimitStatus(status);
                            onUpdateProfile({ ...profile, isPro: status.isPro, trialEndsAt: status.isInTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null });
                        }).catch(console.error);
                    }}
                    freeWorkoutsUsed={workoutLimitStatus.freeWorkoutsUsed}
                    freeWorkoutsLimit={workoutLimitStatus.freeWorkoutsLimit}
                />
            )}

            {/* First Workout Paywall */}
            {showFirstWorkoutPaywall && (
                <FirstWorkoutPaywall
                    onClose={() => setShowFirstWorkoutPaywall(false)}
                    onStartTrial={() => {
                        setShowFirstWorkoutPaywall(false);
                        // Refresh status after trial started
                        apiService.monetization.getWorkoutLimit().then(status => {
                            setWorkoutLimitStatus(status);
                            onUpdateProfile({ ...profile, isPro: status.isPro });
                        }).catch(console.error);
                    }}
                />
            )}

            {/* Streak Milestone Paywall */}
            {streakMilestone && (
                <StreakMilestonePaywall
                    streakDays={streakMilestone}
                    onClose={() => setStreakMilestone(null)}
                    onUpgrade={() => {
                        setStreakMilestone(null);
                        setShowPremiumModal(true);
                    }}
                />
            )}
        </div>
    );
};

const NavButton = ({ icon, label, isActive, onClick }: any) => (
    <button
        onClick={onClick}
        className={`relative flex flex-col items-center justify-center gap-1 w-16 py-1 transition-all duration-300 group ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
    >
        <div className={`relative p-1 transition-transform duration-300 ${isActive ? '-translate-y-1' : ''}`}>
            {icon}
            {isActive && (
                <div className="absolute inset-0 bg-indigo-500/30 blur-lg rounded-full opacity-60"></div>
            )}
        </div>
        <span className={`text-[10px] font-medium tracking-wider transition-opacity duration-300 ${isActive ? 'opacity-100 text-indigo-300' : 'opacity-70'}`}>
            {label}
        </span>

        {/* Top indicator line for active state */}
        {isActive && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-indigo-500 rounded-b-full shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>
        )}
    </button>
)

export default Dashboard;
