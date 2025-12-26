import React, { useState, useEffect } from 'react';
import { OnboardingProfile, TrainingProgram, WorkoutLog, WorkoutSession, ReadinessData, ActiveWorkoutState, TelegramUser, WorkoutLimitStatus, WhoopReadinessData, ChatMessage, ChatAction } from '../types';
import WorkoutView from './WorkoutView';
import ProgressView from './ProgressView';
import SettingsView from './SettingsView';
import SquadView from './SquadView';
import CoachChatView from './CoachChatView';
import MesocycleIndicator from './MesocycleIndicator';
import { Dumbbell, Calendar as CalendarIcon, BarChart2, Settings, Play, ChevronRight, Info, Battery, Zap, Trophy, Users, User, Crown, Bot, MessageCircle, Flame, Activity, Clock, TrendingUp, Sparkles, MessageSquarePlus, HelpCircle, Coffee, Sun, Moon, Check, LayoutGrid, Shield, AlertTriangle } from 'lucide-react';
import WorkoutPreviewModal from './WorkoutPreviewModal';
import ReadinessModal from './ReadinessModal';
import WhoopInsightScreen from './WhoopInsightScreen';
import WorkoutIntroModal from './WorkoutIntroModal';
import PremiumModal from './PremiumModal';
import HardPaywall from './HardPaywall';
import TrialBanner from './TrialBanner';
import FirstWorkoutPaywall from './FirstWorkoutPaywall';
import { calculateStreaks, calculateWorkoutVolume, calculateWeeklyProgress, getMuscleFocus, calculateLevel, pluralizeRu, calculateTotalVolume, formatKg } from '../utils/progressUtils';
import { getDashboardInsight } from '../services/geminiService';
import { hapticFeedback } from '../utils/hapticUtils';
import SkeletonLoader from './SkeletonLoader';
import apiService from '../services/apiService';
import { MesocycleState } from '../services/mesocycleService';
import { processWhoopData, WhoopInsight, AdaptedWorkoutResult } from '../services/whoopInsights';
import { calculateReadinessScore } from '../utils/progressUtils';

interface DashboardProps {
    profile: OnboardingProfile;
    logs: WorkoutLog[];
    program: TrainingProgram | null;
    telegramUser: TelegramUser | null;
    mesocycleState: MesocycleState | null;
    onUpdateProgram: (program: TrainingProgram) => void;
    onUpdateProfile: (profile: OnboardingProfile) => void;
    onWorkoutComplete: (log: WorkoutLog) => void;
    onResetAccount: () => void;
    // Chat props
    chatMessages: ChatMessage[];
    onSendMessage: (message: string) => void;
    onActionClick: (action: ChatAction) => void;
    isChatLoading: boolean;
    executingActionId?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ profile, logs, program, telegramUser, mesocycleState, onUpdateProgram, onUpdateProfile, onWorkoutComplete, onResetAccount, chatMessages, onSendMessage, onActionClick, isChatLoading, executingActionId }) => {
    const [activeView, setActiveView] = useState<'today' | 'squad' | 'progress' | 'settings' | 'coach'>('today');
    const [activeWorkout, setActiveWorkout] = useState<string | null>(null);
    const [workoutToPreview, setWorkoutToPreview] = useState<WorkoutSession | null>(null);
    const [insight, setInsight] = useState<string | null>(null); // Unified insight state
    const [isInsightLoading, setIsInsightLoading] = useState(false);
    const [showPremiumModal, setShowPremiumModal] = useState(false);
    const [showReadinessModal, setShowReadinessModal] = useState(false);
    const [showIntroModal, setShowIntroModal] = useState(false);
    const [pendingSessionName, setPendingSessionName] = useState<string | null>(null);
    const [currentReadiness, setCurrentReadiness] = useState<ReadinessData | null>(null);
    const [restoredState, setRestoredState] = useState<ActiveWorkoutState | null>(null);
    const [staleWorkoutState, setStaleWorkoutState] = useState<ActiveWorkoutState | null>(null);

    // Workout timeout constant (1 hour - allows for rest periods and distractions)
    const STALE_TIMEOUT_MS = 60 * 60 * 1000;

    // Monetization state
    const [showHardPaywall, setShowHardPaywall] = useState(false);
    const [workoutLimitStatus, setWorkoutLimitStatus] = useState<WorkoutLimitStatus | null>(null);
    const [streakShieldAvailable, setStreakShieldAvailable] = useState(false);

    // Track page views for analytics
    useEffect(() => {
        apiService.analytics.track('page_view', { page: activeView }).catch(() => { });
    }, [activeView]);
    const [shieldNotification, setShieldNotification] = useState<string | null>(null);
    const [showFirstWorkoutPaywall, setShowFirstWorkoutPaywall] = useState(false);

    // WHOOP Insight Screen state
    const [showWhoopInsight, setShowWhoopInsight] = useState(false);
    const [whoopInsightData, setWhoopInsightData] = useState<{
        whoopData: WhoopReadinessData;
        originalSession: WorkoutSession;
        adaptedSession: WorkoutSession;
        insight: WhoopInsight;
    } | null>(null);
    const [isLoadingWhoop, setIsLoadingWhoop] = useState(false);
    // Store adapted session to use in WorkoutView (bypasses program lookup)
    const [activeAdaptedSession, setActiveAdaptedSession] = useState<WorkoutSession | null>(null);
    // Store WHOOP data during workout for persistence (Bug #1 & #2)
    const [currentWhoopData, setCurrentWhoopData] = useState<WhoopReadinessData | null>(null);

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
                    setShieldNotification('Сохранение серии активировано! Ваша серия тренировок сохранена.');
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
                    // Check for stale workout (no activity for STALE_TIMEOUT_MS)
                    const lastActivity = parsedState.lastActivityTime || parsedState.startTime;
                    const isStale = Date.now() - lastActivity > STALE_TIMEOUT_MS;

                    if (isStale) {
                        // Show dialog to continue or close
                        setStaleWorkoutState(parsedState);
                    } else {
                        // Restore active workout
                        setRestoredState(parsedState);
                        setActiveWorkout(parsedState.session.name);
                        setCurrentReadiness(parsedState.readiness);
                        // Restore adapted session if it was a WHOOP-adapted workout
                        if (parsedState.session) {
                            setActiveAdaptedSession(parsedState.session);
                        }
                        // Restore WHOOP data if present
                        if (parsedState.whoopData) {
                            setCurrentWhoopData(parsedState.whoopData);
                        }
                    }
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

        // 2. NEW: If user has never trained, allow first workout ANY day
        // This prevents showing "Rest Day" to brand new users
        if (logs.length === 0) return true;

        // 3. Check Schedule Preference
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
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
    const totalVolume = logs.length > 0 ? calculateTotalVolume(logs) : 0;
    const weeklyProgress = calculateWeeklyProgress(logs);
    const userLevel = calculateLevel(logs);

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
        // Use adapted session from WHOOP if available, otherwise look up from program
        const workout = activeAdaptedSession || program.sessions.find(s => s.name === activeWorkout);
        if (workout) {
            return (
                <WorkoutView
                    session={workout}
                    profile={profile}
                    readiness={currentReadiness}
                    logs={logs}
                    initialState={restoredState && restoredState.session.name === workout.name ? {
                        completedExercises: restoredState.completedExercises,
                        startTime: restoredState.startTime,
                        lastActivityTime: restoredState.lastActivityTime
                    } : undefined}
                    whoopData={currentWhoopData || undefined}
                    onProgress={(state) => {
                        const activeState: ActiveWorkoutState = {
                            session: workout,
                            completedExercises: state.completedExercises,
                            startTime: state.startTime,
                            readiness: currentReadiness,
                            lastActivityTime: state.lastActivityTime,
                            isValidSession: true,
                            whoopData: currentWhoopData || undefined
                        };
                        localStorage.setItem('activeWorkoutState', JSON.stringify(activeState));
                    }}
                    onFinish={(log) => {
                        onWorkoutComplete(log);
                        setActiveWorkout(null);
                        setCurrentReadiness(null);
                        setRestoredState(null);
                        setActiveAdaptedSession(null);
                        setCurrentWhoopData(null); // Clear WHOOP data
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
                        setActiveAdaptedSession(null); // Clear adapted session
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

        // Show intro modal first
        setPendingSessionName(sessionName);
        setShowIntroModal(true);
        hapticFeedback.impactOccurred('heavy');
    };

    // Called when user clicks "Поехали!" on the intro modal
    const handleIntroContinue = async () => {
        setShowIntroModal(false);

        // Check if WHOOP is connected and try to get data
        setIsLoadingWhoop(true);
        try {
            const whoopStatus = await apiService.whoop.getStatus();

            if (whoopStatus.connected && pendingSessionName) {
                // Get WHOOP readiness data
                const whoopReadiness = await apiService.whoop.getReadiness();

                // Use backend hasRealData flag for reliable validation
                // This handles cases where WHOOP API returned empty data
                if (!whoopReadiness.hasRealData) {
                    console.warn('WHOOP returned no real data, falling back to manual input');
                    throw new Error('No WHOOP data available');
                }

                const whoopData: WhoopReadinessData = {
                    recoveryScore: whoopReadiness.recoveryScore ?? 50,
                    sleepPerformance: whoopReadiness.sleepPerformance ?? 80,
                    sleepHours: whoopReadiness.sleepHours ?? 7,
                    hrv: whoopReadiness.hrv ?? 50,
                    rhr: whoopReadiness.rhr ?? 60,
                    sleepScore: whoopReadiness.sleepScore ?? 3,
                    stressScore: whoopReadiness.stressScore ?? 3,
                    sorenessScore: whoopReadiness.sorenessScore ?? 3,
                };

                // Find the session
                const originalSession = program?.sessions.find(s => s.name === pendingSessionName);
                if (originalSession) {
                    // Process WHOOP data and get adapted workout
                    const result = processWhoopData(originalSession, whoopData);

                    setWhoopInsightData({
                        whoopData,
                        originalSession: result.originalSession,
                        adaptedSession: result.adaptedSession,
                        insight: result.insight,
                    });
                    setShowWhoopInsight(true);
                    hapticFeedback.notificationOccurred('success');
                    return;
                }
            }
        } catch (error) {
            console.error('Failed to get WHOOP data:', error);
            // Notify user with haptic feedback that WHOOP sync failed
            hapticFeedback.notificationOccurred('warning');
            // Fall through to regular readiness modal
        } finally {
            setIsLoadingWhoop(false);
        }

        // Fallback: show regular readiness modal
        setShowReadinessModal(true);
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

    // Handler for starting the adapted workout (WHOOP recommended)
    const handleStartAdaptedWorkout = () => {
        if (!whoopInsightData || !pendingSessionName) return;

        // Calculate readiness from WHOOP data for tracking
        const readinessData = calculateReadinessScore(
            whoopInsightData.whoopData.sleepScore,
            3, // Default food score
            whoopInsightData.whoopData.stressScore,
            whoopInsightData.whoopData.sorenessScore
        );

        setCurrentReadiness(readinessData);
        setShowWhoopInsight(false);

        // Store the adapted session to use instead of looking up from program
        setActiveAdaptedSession(whoopInsightData.adaptedSession);
        setActiveWorkout(whoopInsightData.adaptedSession.name);
        // Bug fix: Store WHOOP data for persistence and logging
        setCurrentWhoopData(whoopInsightData.whoopData);
        setWhoopInsightData(null);
        setPendingSessionName(null);
        hapticFeedback.notificationOccurred('success');
    };

    // Handler for starting the original workout (user overrides WHOOP recommendation)
    const handleStartOriginalWorkout = () => {
        if (!whoopInsightData || !pendingSessionName) return;

        // Calculate readiness from WHOOP data for tracking
        const readinessData = calculateReadinessScore(
            whoopInsightData.whoopData.sleepScore,
            3, // Default food score
            whoopInsightData.whoopData.stressScore,
            whoopInsightData.whoopData.sorenessScore
        );

        setCurrentReadiness(readinessData);
        setShowWhoopInsight(false);
        // Bug fix: Store WHOOP data for persistence and logging
        setCurrentWhoopData(whoopInsightData.whoopData);
        setWhoopInsightData(null);

        // Use original session (no adapted session needed)
        setActiveAdaptedSession(null);
        setActiveWorkout(whoopInsightData.originalSession.name);
        setPendingSessionName(null);
        hapticFeedback.impactOccurred('medium');
    };

    // Handler for canceling WHOOP insight screen
    const handleCancelWhoopInsight = () => {
        setShowWhoopInsight(false);
        setWhoopInsightData(null);
        setPendingSessionName(null);
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
            return <ProgressView logs={logs} program={program} preferredDays={profile.preferredDays} profile={profile} onOpenPremium={() => setShowPremiumModal(true)} onStartWorkout={forceStartWorkout} />;
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

        if (activeView === 'coach') {
            return (
                <div className="fixed inset-0 z-50 bg-black animate-fade-in">
                    <CoachChatView
                        messages={chatMessages}
                        onSendMessage={onSendMessage}
                        onActionClick={onActionClick}
                        isLoading={isChatLoading}
                        executingActionId={executingActionId}
                        onBack={() => setActiveView('today')}
                    />
                </div>
            );
        }

        // Default 'today' view
        return (
            <div className="grid grid-cols-2 gap-4 animate-fade-in">
                {/* Header with Weekly Progress Ring */}
                {/* Header with Weekly Progress Ring */}
                <div className="col-span-2 flex justify-between items-center py-4 px-1 pt-[env(safe-area-inset-top)]">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            {telegramUser?.photo_url ? (
                                <img
                                    src={telegramUser.photo_url}
                                    alt="User"
                                    className="w-14 h-14 rounded-full border-2 border-white/10"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-neutral-800 border-2 border-white/10 flex items-center justify-center">
                                    <User size={24} className="text-gray-400" />
                                </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-black rounded-full flex items-center justify-center border border-subtle">
                                <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(76,199,109,0.8)] animate-pulse"></div>
                            </div>
                        </div>
                        <div>
                            <p className="text-gray-500 text-[10px] font-bold mb-1">
                                {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                            <h1 className="text-3xl font-display font-black text-white italic leading-none">
                                {telegramUser?.first_name || "ТЫ"}
                            </h1>
                        </div>
                    </div>

                    {/* Weekly Goal Widget - Clean Technical Look */}
                    <button
                        onClick={() => handleViewChange('progress')}
                        className="flex flex-col items-end"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] text-gray-500 font-bold">Цель недели</span>
                            <div className="w-2 h-2 rounded-full bg-primary" />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-display font-black ${weeklyProgress >= profile.daysPerWeek ? 'text-success' : 'text-white'}`}>
                                {weeklyProgress}
                            </span>
                            <span className="text-sm font-display font-bold text-gray-600">
                                / {profile.daysPerWeek}
                            </span>
                        </div>
                    </button>
                </div>


                {/* Stats Grid - Premium Cards */}
                <div className="col-span-2 grid grid-cols-3 gap-3">
                    {/* Streak */}
                    <div className="bg-surface border border-subtle rounded-xl p-3 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Flame size={18} className="text-orange-500 mb-2" />
                        <span className="text-2xl font-display font-black text-white leading-none italic">{currentStreak}</span>
                        <span className="text-[9px] text-gray-500 font-bold mt-1">
                            {pluralizeRu(currentStreak, 'серия', 'серии', 'серий')}
                        </span>
                    </div>

                    {/* Level */}
                    <div className="bg-surface border border-subtle rounded-xl p-3 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-0 left-0 h-1 bg-subtle w-full">
                            <div className="h-full bg-yellow-500" style={{ width: `${userLevel.levelProgress}%` }}></div>
                        </div>
                        <Crown size={18} className="text-yellow-500 mb-2" />
                        <span className="text-2xl font-display font-black text-white leading-none italic">{userLevel.level}</span>
                        <span className="text-[9px] text-gray-500 font-bold mt-1">Уровень</span>
                    </div>

                    {/* Total Volume */}
                    <div className="bg-surface border border-subtle rounded-xl p-3 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Activity size={18} className="text-blue-500 mb-2" />
                        <span className="text-xl font-display font-black text-white leading-none italic mt-1">{formatKg(totalVolume)}</span>
                        <span className="text-[9px] text-gray-500 font-bold mt-1">Тоннаж</span>
                    </div>
                </div>

                {/* Mesocycle Indicator */}
                {mesocycleState && (
                    <div className="col-span-2">
                        <MesocycleIndicator mesocycleState={mesocycleState} />
                    </div>
                )}

                {/* Trial Banner for users in trial */}
                {workoutLimitStatus?.isInTrial && workoutLimitStatus.trialDaysLeft > 0 && (
                    <TrialBanner
                        daysLeft={workoutLimitStatus.trialDaysLeft}
                        onUpgrade={() => setShowPremiumModal(true)}
                    />
                )}

                {/* CONDITIONAL MAIN CARD: Workout OR Rest */}
                {isTodayWorkoutDay ? (
                    /* WORKOUT CARD - PREMIUM REDESIGN */
                    <div className="col-span-2 mt-4">
                        <div className="bg-surface border border-subtle rounded-2xl overflow-hidden relative group">
                            {/* Decorative Activity Line */}
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

                            <div className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-white text-[10px] font-bold">
                                                <CalendarIcon size={10} /> {logs.length === 0 ? 'Старт' : 'Сегодня'}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-gray-400 text-[10px] font-bold">
                                                <Clock size={10} /> ~{profile.timePerWorkout} мин
                                            </span>
                                        </div>
                                        <h2 className="text-4xl font-display font-black text-white italic leading-none mb-1">
                                            {logs.length === 0 ? 'Первая тренировка' : nextWorkout.name}
                                        </h2>
                                        <p className="text-gray-500 text-xs font-bold">
                                            {logs.length === 0 ? 'Начните свой путь сегодня' : 'Ваш персональный план на день'}
                                        </p>
                                    </div>
                                </div>

                                {/* Muscle Focus Tags - Minimalist */}
                                <div className="flex flex-wrap gap-2 mb-8">
                                    {muscleFocus.map(muscle => (
                                        <span key={muscle} className="px-3 py-1.5 rounded-sm bg-neutral-900 border border-subtle text-gray-300 text-[10px] font-bold uppercase tracking-wider">
                                            {muscle}
                                        </span>
                                    ))}
                                    <span className="px-3 py-1.5 rounded-sm bg-neutral-900 border border-subtle text-gray-500 text-[10px] font-bold">
                                        +{Math.max(0, nextWorkout.exercises.length - muscleFocus.length)} упр.
                                    </span>
                                </div>

                                {/* Free workouts remaining warning */}
                                {workoutLimitStatus && !workoutLimitStatus.isPro && !workoutLimitStatus.isInTrial && (
                                    <div className="flex items-center gap-3 mb-6 p-4 bg-amber-900/10 border border-amber-900/30 rounded-lg">
                                        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                                        <span className="text-amber-500 text-xs font-bold">
                                            Осталось {workoutLimitStatus.freeWorkoutsLimit - workoutLimitStatus.freeWorkoutsUsed} {
                                                (workoutLimitStatus.freeWorkoutsLimit - workoutLimitStatus.freeWorkoutsUsed) === 1 ? 'тренировка' :
                                                    (workoutLimitStatus.freeWorkoutsLimit - workoutLimitStatus.freeWorkoutsUsed) <= 4 ? 'тренировки' : 'тренировок'
                                            }
                                        </span>
                                    </div>
                                )}

                                <div className="grid grid-cols-4 gap-3">
                                    <button
                                        onClick={() => initiateWorkoutStart(nextWorkout.name)}
                                        className="col-span-3 bg-white text-black h-14 rounded-full flex items-center justify-center gap-3 hover:bg-gray-200 transition active:scale-95 group"
                                    >
                                        <span className="font-display font-black text-xl pt-1">Начать тренировку</span>
                                        <Play size={20} fill="currentColor" className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    <button
                                        onClick={() => setWorkoutToPreview(nextWorkout)}
                                        className="col-span-1 bg-transparent border border-white/20 text-white h-14 rounded-full flex items-center justify-center hover:bg-white/5 transition active:scale-95"
                                    >
                                        <Info size={24} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : hasCompletedToday && todaysWorkout ? (
                    /* COMPLETED WORKOUT CARD - PREMIUM REDESIGN */
                    <div className="col-span-2 mt-4">
                        <div className="bg-surface border border-subtle rounded-2xl overflow-hidden relative group">
                            {/* Decorative Success Line */}
                            <div className="absolute top-0 left-0 w-1 h-full bg-success" />

                            <div className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 border border-success/20 text-success text-[10px] font-bold">
                                                <Check size={10} strokeWidth={4} /> Завершено
                                            </span>
                                        </div>
                                        <h2 className="text-3xl font-display font-black text-white italic leading-none mb-2">{todaysWorkout.sessionId}</h2>
                                        <p className="text-gray-500 text-xs font-bold">
                                            Ещё один шаг к цели
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center border border-subtle">
                                        <Trophy size={20} className="text-success" />
                                    </div>
                                </div>

                                {/* Workout Stats - Minimalist Row */}
                                <div className="flex gap-4 mb-6">
                                    <div className="flex-1 bg-neutral-900/50 p-2 rounded-lg text-center border border-subtle">
                                        <p className="text-xl font-display font-black text-white leading-none">
                                            {todaysWorkout.duration ? `${Math.round(todaysWorkout.duration / 60)}` : '0'}
                                        </p>
                                        <p className="text-[9px] text-gray-600 font-bold mt-1">минут</p>
                                    </div>
                                    <div className="flex-1 bg-neutral-900/50 p-2 rounded-lg text-center border border-subtle">
                                        <p className="text-xl font-display font-black text-white leading-none">
                                            {todaysWorkout.completedExercises?.length || 0}
                                        </p>
                                        <p className="text-[9px] text-gray-600 font-bold mt-1">упр.</p>
                                    </div>
                                    <div className="flex-1 bg-neutral-900/50 p-2 rounded-lg text-center border border-subtle">
                                        <p className="text-xl font-display font-black text-white leading-none">
                                            {formatKg(calculateWorkoutVolume(todaysWorkout))}
                                        </p>
                                        <p className="text-[9px] text-gray-600 font-bold mt-1">кг</p>
                                    </div>
                                </div>

                                {/* Improvements */}
                                {todayImprovements.length > 0 && (
                                    <div className="mb-4 bg-neutral-900 border border-subtle rounded-xl p-4">
                                        <p className="text-[10px] font-bold text-gray-500 mb-3 flex items-center gap-1.5">
                                            <Sparkles size={10} className="text-success" /> Лучшие результаты сегодня
                                        </p>
                                        <div className="space-y-2">
                                            {todayImprovements.map((imp, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-success"></div>
                                                    <p className="text-xs font-bold text-white">{imp}</p>
                                                </div>
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
                    /* REST DAY CARD - Minimalist Design */
                    <div className="col-span-2 relative group mt-2">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-teal-600 rounded-[2rem] blur-xl opacity-15"></div>
                        <div className="relative bg-surface border border-white/10 rounded-[2rem] p-5 overflow-hidden">

                            {/* Header */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                                    <Moon size={18} className="text-green-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">День восстановления</h2>
                                    <p className="text-xs text-gray-500">Мышцы растут именно сейчас</p>
                                </div>
                            </div>

                            {/* Coach Message - Single clean block */}
                            <div className="mb-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Bot size={16} className="text-indigo-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {isInsightLoading ? (
                                            <div className="space-y-2">
                                                <SkeletonLoader className="h-4 w-3/4" />
                                                <SkeletonLoader className="h-4 w-full" />
                                            </div>
                                        ) : (
                                            <p className="text-gray-300 text-sm leading-relaxed">
                                                {insight || "Отдыхай и восстанавливайся. Завтра продолжим!"}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Recovery tips - subtle inline */}
                            <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5">
                                    <Sun size={12} className="text-yellow-500/70" />
                                    Прогулка 30 мин
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Activity size={12} className="text-blue-500/70" />
                                    Лёгкая растяжка
                                </span>
                            </div>

                            {/* Secondary action */}
                            <button
                                onClick={() => initiateWorkoutStart(nextWorkout.name)}
                                className="w-full py-2.5 text-gray-500 text-sm flex items-center justify-center gap-1.5 hover:text-white transition"
                            >
                                <Play size={12} /> Начать тренировку досрочно
                            </button>
                        </div>
                    </div>
                )}

            </div>
        );
    };

    const handleViewChange = (view: 'today' | 'squad' | 'progress' | 'settings' | 'coach') => {
        setActiveView(view);
        hapticFeedback.selectionChanged();
    };

    return (
        <div className="min-h-screen pb-32 relative overflow-hidden">
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
            <header className="px-6 pt-6 pb-4 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-40 border-b border-white/5">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight italic">
                        SENSEI<span className="text-indigo-500">.AI</span>
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
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black"></div>
                </button>
            </header>

            {/* Main Content */}
            <main className="px-6 py-6 pb-32">
                {renderContent()}
            </main>

            {/* Navigation Bar - WHOOP-style with separate AI button */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-40">
                {/* Main Navigation */}
                <nav className="bg-surface/90 backdrop-blur-xl border border-white/10 rounded-[2rem] px-4 py-1.5 flex items-center gap-2 shadow-2xl"
                     style={{ touchAction: 'manipulation' }}>
                    <NavButton
                        icon={<Dumbbell size={24} />}
                        label="Тренировка"
                        isActive={activeView === 'today'}
                        onClick={() => handleViewChange('today')}
                    />
                    <NavButton
                        icon={<BarChart2 size={24} />}
                        label="Прогресс"
                        isActive={activeView === 'progress'}
                        onClick={() => handleViewChange('progress')}
                    />
                    <NavButton
                        icon={<Settings size={24} />}
                        label="Настройки"
                        isActive={activeView === 'settings'}
                        onClick={() => handleViewChange('settings')}
                    />
                </nav>

                {/* AI Coach Button - separate with gradient ring */}
                <button
                    onClick={() => handleViewChange('coach')}
                    className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95
                        ${activeView === 'coach'
                            ? 'bg-surface'
                            : 'bg-surface/90 hover:bg-surface'
                        }`}
                    style={{ touchAction: 'manipulation' }}
                >
                    {/* Gradient ring */}
                    <div className={`absolute inset-0 rounded-2xl p-[2px] bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 ${
                        activeView === 'coach' ? 'opacity-100' : 'opacity-50'
                    }`}>
                        <div className="w-full h-full rounded-[14px] bg-black" />
                    </div>
                    {/* Icon */}
                    <MessageCircle size={24} className={`relative z-10 ${
                        activeView === 'coach' ? 'text-indigo-400' : 'text-gray-400'
                    }`} />
                </button>
            </div>

            {/* Modals */}
            {workoutToPreview && (
                <WorkoutPreviewModal
                    session={workoutToPreview}
                    onClose={() => setWorkoutToPreview(null)}
                    onStart={() => forceStartWorkout(workoutToPreview.name)}
                />
            )}

            {showIntroModal && pendingSessionName && (
                <WorkoutIntroModal
                    session={program.sessions.find(s => s.name === pendingSessionName)!}
                    profile={profile}
                    logs={logs}
                    onContinue={handleIntroContinue}
                    onCancel={() => {
                        setShowIntroModal(false);
                        setPendingSessionName(null);
                    }}
                />
            )}

            {/* WHOOP Loading Indicator */}
            {isLoadingWhoop && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50">
                    <div className="bg-neutral-900 border border-white/10 rounded-3xl p-8 text-center animate-fade-in">
                        <div className="relative w-16 h-16 mx-auto mb-4">
                            <div className="absolute inset-0 border-4 border-green-500/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-t-green-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Activity size={24} className="text-green-400" />
                            </div>
                        </div>
                        <p className="text-white font-medium">Синхронизация с WHOOP...</p>
                        <p className="text-gray-500 text-sm mt-1">Проверяем твоё восстановление</p>
                    </div>
                </div>
            )}

            {showReadinessModal && (
                <ReadinessModal
                    onConfirm={handleReadinessConfirm}
                    onCancel={() => setShowReadinessModal(false)}
                />
            )}

            {/* WHOOP Insight Screen - shows when WHOOP data is available */}
            {showWhoopInsight && whoopInsightData && (
                <WhoopInsightScreen
                    whoopData={whoopInsightData.whoopData}
                    originalSession={whoopInsightData.originalSession}
                    adaptedSession={whoopInsightData.adaptedSession}
                    insight={whoopInsightData.insight}
                    onStartAdapted={handleStartAdaptedWorkout}
                    onStartOriginal={handleStartOriginalWorkout}
                    onCancel={handleCancelWhoopInsight}
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

            {/* Stale Workout Dialog - shown when workout was inactive for 20+ min */}
            {staleWorkoutState && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 pb-28">
                    <div className="bg-neutral-900 rounded-2xl p-6 max-w-sm w-full border border-white/10 space-y-4 animate-slide-up">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <AlertTriangle size={20} className="text-amber-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white">Тренировка не завершена</h3>
                        </div>

                        <p className="text-gray-400 text-sm">
                            Прошло более 20 минут с последней активности. Хочешь продолжить тренировку или начать заново?
                        </p>

                        <div className="bg-neutral-800/50 rounded-xl p-3 text-sm text-gray-500">
                            <span className="text-gray-300 font-medium">{staleWorkoutState.session.name}</span>
                            <br />
                            Выполнено упражнений: {staleWorkoutState.completedExercises.filter(ex =>
                                ex.completedSets.some(s => s.isCompleted)
                            ).length} из {staleWorkoutState.completedExercises.length}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => {
                                    localStorage.removeItem('activeWorkoutState');
                                    setStaleWorkoutState(null);
                                    hapticFeedback.impactOccurred('light');
                                }}
                                className="flex-1 py-3 bg-neutral-800 text-gray-400 rounded-xl font-bold hover:bg-neutral-700 transition"
                            >
                                Закрыть
                            </button>
                            <button
                                onClick={() => {
                                    // Continue workout with updated lastActivityTime
                                    const updatedState = {
                                        ...staleWorkoutState,
                                        lastActivityTime: Date.now()
                                    };
                                    localStorage.setItem('activeWorkoutState', JSON.stringify(updatedState));
                                    setRestoredState(updatedState);
                                    setActiveWorkout(staleWorkoutState.session.name);
                                    setCurrentReadiness(staleWorkoutState.readiness);
                                    setStaleWorkoutState(null);
                                    hapticFeedback.notificationOccurred('success');
                                }}
                                className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-400 transition"
                            >
                                Продолжить
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

const NavButton = ({ icon, label, isActive, onClick }: any) => (
    <button
        onClick={onClick}
        className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[60px] min-h-[48px] py-2 px-3 rounded-xl active:scale-95 active:bg-white/5 ${isActive ? 'text-white' : 'text-gray-500'}`}
        style={{ touchAction: 'manipulation' }}
    >
        <div className={`relative ${isActive ? '-translate-y-0.5' : ''}`}>
            {icon}
            {isActive && (
                <div className="absolute inset-0 bg-indigo-500/30 blur-lg rounded-full opacity-60"></div>
            )}
        </div>
        <span className={`text-[10px] font-medium ${isActive ? 'text-indigo-300' : 'opacity-70'}`}>
            {label}
        </span>

        {/* Bottom indicator dot for active state */}
        {isActive && (
            <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full shadow-[0_0_6px_rgba(99,102,241,0.8)]"></div>
        )}
    </button>
)

export default Dashboard;
