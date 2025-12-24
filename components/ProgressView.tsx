
import React, { useMemo, useState, useEffect } from 'react';
import { WorkoutLog, TrainingProgram, ReadinessData, WorkoutCompletion, OnboardingProfile, WorkoutSession, ImbalanceReport } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    LineChart, Line, PieChart, Pie, Cell, Legend, ReferenceLine
} from 'recharts';
import {
    calculateStreaks, calculateTotalVolume, calculateWeeklyVolume,
    calculatePersonalRecords, calculateReadinessHistory, calculateMovementPatterns, getHeatmapData,
    calculateLevel, getStrengthProgression, getVolumeDistribution,
    calculateWeekComparison, getNextScheduledDay, pluralizeRu,
    formatKg, calculateWeightProgression, WeightProgressionEntry
} from '../utils/progressUtils';
import { getTopImbalances } from '../utils/strengthAnalysisUtils';
import { analyzePainPatterns, PainAnalysisResult } from '../services/geminiService';
import { Dumbbell, Flame, TrendingUp, TrendingDown, Minus, Trophy, Battery, PieChart as PieIcon, Calendar, Crown, Star, Activity, HeartPulse, ChevronLeft, ChevronRight, Check, Target, BarChart2, X, Repeat, Timer, AlertTriangle, Play, Info } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';
import BlurredContent from './BlurredContent';
import CalibrationCard from './CalibrationCard';
import VolumeTrackingCard from './VolumeTrackingCard';
import ImbalanceWarningCard from './ImbalanceWarningCard';
import ImbalanceEducationModal from './ImbalanceEducationModal';
import StrengthAnalysisView from './StrengthAnalysisView';
import EmptyStateCard from './EmptyStateCard';
import { WORKOUT_THRESHOLDS } from '../constants/thresholds';

interface ProgressViewProps {
    logs: WorkoutLog[];
    program: TrainingProgram;
    onUpdateProgram?: (program: TrainingProgram) => void;
    preferredDays?: number[];
    profile?: OnboardingProfile;
    onOpenPremium?: () => void;
    onStartWorkout?: (sessionName: string) => void;
}

// Mock data generator removed - using real workout logs only

const ProgressView: React.FC<ProgressViewProps> = ({ logs, program, onUpdateProgram, preferredDays = [], profile, onOpenPremium, onStartWorkout }) => {
    // Use real workout logs directly
    const displayLogs = logs;

    const { currentStreak, bestStreak } = useMemo(() => calculateStreaks(displayLogs), [displayLogs]);
    const totalVolume = useMemo(() => calculateTotalVolume(displayLogs), [displayLogs]);
    const weeklyVolumeData = useMemo(() => calculateWeeklyVolume(displayLogs), [displayLogs]);
    const personalRecords = useMemo(() => calculatePersonalRecords(displayLogs), [displayLogs]);
    const readinessData = useMemo(() => calculateReadinessHistory(displayLogs), [displayLogs]);
    const movementData = useMemo(() => calculateMovementPatterns(displayLogs), [displayLogs]);
    const heatmapData = useMemo(() => getHeatmapData(displayLogs), [displayLogs]);

    // New Analytics
    const userLevel = useMemo(() => calculateLevel(displayLogs), [displayLogs]);
    const strengthData = useMemo(() => getStrengthProgression(displayLogs), [displayLogs]);
    const volumeDistData = useMemo(() => getVolumeDistribution(displayLogs), [displayLogs]);

    // Progress Insights
    const weekComparison = useMemo(() => calculateWeekComparison(displayLogs), [displayLogs]);
    const nextScheduledDay = useMemo(() => getNextScheduledDay(preferredDays), [preferredDays]);
    const weightProgression = useMemo(() => calculateWeightProgression(displayLogs), [displayLogs]);

    // Pain diary data
    const painLogs = useMemo(() => {
        return displayLogs.filter(l => l.feedback?.pain?.hasPain);
    }, [displayLogs]);

    const painByLocation = useMemo(() => {
        const grouped: { [key: string]: WorkoutLog[] } = {};
        // Расширенный список частей тела с нормализованными названиями
        const bodyPartsMap: { [key: string]: string } = {
            // Плечи
            'плечо': 'Плечо',
            'плечи': 'Плечо',
            'плечевой': 'Плечо',
            'дельт': 'Плечо',
            // Спина
            'спина': 'Спина',
            'спину': 'Спина',
            'спине': 'Спина',
            'поясниц': 'Поясница',
            'лопатк': 'Лопатка',
            // Ноги
            'колен': 'Колено',
            'бедр': 'Бедро',
            'голен': 'Голень',
            'икр': 'Икры',
            'стоп': 'Стопа',
            'ног': 'Нога',
            'квадрицепс': 'Бедро',
            // Руки
            'локот': 'Локоть',
            'локт': 'Локоть',
            'запяст': 'Запястье',
            'кист': 'Кисть',
            'рук': 'Рука',
            'бицепс': 'Бицепс',
            'трицепс': 'Трицепс',
            'предплеч': 'Предплечье',
            // Шея/голова
            'ше': 'Шея',
            'голов': 'Голова',
            // Корпус
            'груд': 'Грудь',
            'живот': 'Живот',
            'прес': 'Пресс',
            'ребр': 'Рёбра',
            'бок': 'Бок',
            // Суставы
            'сустав': 'Сустав',
            'связк': 'Связки',
            'мышц': 'Мышцы',
            // Ягодицы
            'ягодиц': 'Ягодицы',
            'попа': 'Ягодицы',
            // Таз
            'таз': 'Таз',
            'пах': 'Пах',
        };

        painLogs.forEach(log => {
            let location = log.feedback?.pain?.location;
            if (!location) {
                const details = (log.feedback?.pain?.details || '').toLowerCase();
                // Ищем первое совпадение части тела
                for (const [keyword, normalizedName] of Object.entries(bodyPartsMap)) {
                    if (details.includes(keyword)) {
                        location = normalizedName;
                        break;
                    }
                }
            }
            // Только добавляем если нашли реальную часть тела
            if (location) {
                if (!grouped[location]) grouped[location] = [];
                grouped[location].push(log);
            }
        });
        return grouped;
    }, [painLogs]);

    // AI-анализ паттернов боли
    const [painAnalysis, setPainAnalysis] = useState<PainAnalysisResult | null>(null);
    const [painAnalysisLoading, setPainAnalysisLoading] = useState(false);

    useEffect(() => {
        if (painLogs.length > 0 && !painAnalysis && !painAnalysisLoading) {
            setPainAnalysisLoading(true);
            analyzePainPatterns(painLogs)
                .then(result => {
                    setPainAnalysis(result);
                })
                .catch(err => {
                    console.error('Pain analysis failed:', err);
                })
                .finally(() => {
                    setPainAnalysisLoading(false);
                });
        }
    }, [painLogs, painAnalysis, painAnalysisLoading]);

    // --- Calendar Logic ---
    const [currentDate, setCurrentDate] = React.useState(new Date());
    const [selectedDateToMove, setSelectedDateToMove] = React.useState<Date | null>(null);
    const [workoutToPreview, setWorkoutToPreview] = React.useState<WorkoutSession | null>(null);
    const [workoutLogToView, setWorkoutLogToView] = React.useState<WorkoutLog | null>(null);

    // --- Imbalance Detection ---
    const [detectedImbalances, setDetectedImbalances] = React.useState<ImbalanceReport[]>([]);
    const [showImbalanceEducation, setShowImbalanceEducation] = React.useState(false);
    const [selectedImbalance, setSelectedImbalance] = React.useState<ImbalanceReport | null>(null);
    const [showStrengthAnalysis, setShowStrengthAnalysis] = React.useState(false);
    const [showVolumeInfo, setShowVolumeInfo] = React.useState(false);
    const [selectedMovement, setSelectedMovement] = React.useState<{name: string; key: string; muscles: string[]; sets: number} | null>(null);

    // Calculate imbalances when user has enough workout data
    // Cache version to invalidate old data with bad translations
    const IMBALANCE_CACHE_VERSION = 2;

    useEffect(() => {
        if (displayLogs.length < 5 || !profile) {
            setDetectedImbalances([]);
            return;
        }

        try {
            const cached = localStorage.getItem('imbalanceAnalysis');
            if (cached) {
                const parsed = JSON.parse(cached);
                const isStale = (Date.now() - parsed.timestamp) > 24 * 60 * 60 * 1000;
                const isValidVersion = parsed.version === IMBALANCE_CACHE_VERSION;
                if (isValidVersion && parsed.logCount === displayLogs.length && !isStale) {
                    setDetectedImbalances(parsed.imbalances);
                    return;
                }
            }

            const imbalances = getTopImbalances(displayLogs, profile.weight, profile.gender, 3);
            setDetectedImbalances(imbalances);

            localStorage.setItem('imbalanceAnalysis', JSON.stringify({
                version: IMBALANCE_CACHE_VERSION,
                timestamp: Date.now(),
                logCount: displayLogs.length,
                imbalances
            }));
        } catch (error) {
            console.error('Failed to calculate imbalances:', error);
            setDetectedImbalances([]);
        }
    }, [displayLogs, profile?.weight, profile?.gender]);

    // Get workout for specific date based on preferredDays rotation
    // Helper: get start of week (Monday) for a given date
    const getWeekStart = (date: Date): Date => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        return new Date(d.setDate(diff));
    };

    // Helper: check if a session was already completed this week
    const isSessionCompletedThisWeek = (sessionName: string, targetDate: Date): boolean => {
        const weekStart = getWeekStart(targetDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        return logs.some(log => {
            const logDate = new Date(log.date);
            return logDate >= weekStart &&
                logDate < weekEnd &&
                log.sessionId === sessionName;
        });
    };

    const getWorkoutForDate = (date: Date): WorkoutSession | null => {
        if (!program || program.sessions.length === 0) return null;

        const dayOfWeek = date.getDay();

        // If no preferredDays, just use first session
        if (!preferredDays || preferredDays.length === 0) {
            return program.sessions[0];
        }

        // Sort preferred days to get consistent order
        const sortedDays = [...preferredDays].sort((a, b) => a - b);
        const dayIndex = sortedDays.indexOf(dayOfWeek);

        // If this day is not in preferredDays, still return based on day of week
        if (dayIndex === -1) {
            return program.sessions[dayOfWeek % program.sessions.length];
        }

        // Calculate which workout in rotation
        const workoutIndex = dayIndex % program.sessions.length;
        return program.sessions[workoutIndex];
    };

    // Generate planned workouts based on preferredDays
    const plannedDates = useMemo(() => {
        const planned = new Set<string>();
        if (preferredDays.length === 0 || !program) return planned;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Generate for next 60 days
        for (let i = 0; i < 60; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            const dayOfWeek = date.getDay();
            if (preferredDays.includes(dayOfWeek)) {
                planned.add(date.toLocaleDateString('sv-SE'));
            }
        }
        return planned;
    }, [preferredDays, program]);

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = [];
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Add empty slots for days before the first day of the month
        // Adjust for Monday start (0 = Sunday, 1 = Monday, etc.)
        let firstDayIndex = firstDay.getDay() - 1;
        if (firstDayIndex < 0) firstDayIndex = 6;

        for (let i = 0; i < firstDayIndex; i++) {
            days.push(null);
        }

        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const handleDateClick = (date: Date, status: any) => {
        hapticFeedback.selectionChanged();

        // Show workout preview for planned days
        if (status?.type === 'planned') {
            const workout = getWorkoutForDate(date);
            if (workout) {
                setWorkoutToPreview(workout);
                setWorkoutLogToView(null);
            }
        }

        // For completed days, show actual workout report
        if (status?.type === 'completed' && status.data) {
            setWorkoutLogToView(status.data);
            setWorkoutToPreview(null);
        }
    };

    const moveSession = (from: Date, to: Date) => {
        if (!program || !onUpdateProgram) return;

        const newSchedule = [...(program.schedule || [])];
        const fromDateStr = from.toISOString().split('T')[0];
        const toDateStr = to.toISOString().split('T')[0];

        // Find session at 'from' date
        const sessionIndex = newSchedule.findIndex(s => s.day === fromDateStr);
        if (sessionIndex === -1) return;

        // Update date
        newSchedule[sessionIndex] = { ...newSchedule[sessionIndex], day: toDateStr };

        onUpdateProgram({ ...program, schedule: newSchedule });
    };

    const toggleDayStatus = (date: Date, status: any) => {
        if (!program || !onUpdateProgram) return;

        const dateStr = date.toISOString().split('T')[0];
        let newSchedule = [...(program.schedule || [])];

        if (status?.type === 'planned') {
            // Remove session
            newSchedule = newSchedule.filter(s => s.day !== dateStr);
        } else {
            // Add session (find next available workout type or default)
            // For simplicity, just cycling through available workouts or picking first
            const nextWorkout = program.sessions[0];
            newSchedule.push({ day: dateStr, workoutId: nextWorkout.name, isCompleted: false });
        }

        onUpdateProgram({ ...program, schedule: newSchedule });
    };

    // Removed redundant props access

    const renderCalendar = () => {
        const days = getDaysInMonth(currentDate);
        const monthName = currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

        return (
            <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg animate-fade-in">
                <div className="flex items-end justify-between mb-6 px-1">
                    <h2 className="text-3xl font-display font-black text-white italic tracking-tighter uppercase leading-none">
                        {monthName}
                    </h2>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-2">
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                        <div key={d} className="text-center text-[10px] font-bold text-gray-500 uppercase">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {days.map((day, idx) => {
                        if (!day) return <div key={idx} className="aspect-square"></div>;

                        const dateStr = day.toLocaleDateString('sv-SE'); // YYYY-MM-DD in local timezone

                        // Check status
                        let status = null;
                        // Support both new format (YYYY-MM-DD) and old ISO format
                        const log = logs.find(l => {
                            const logDate = l.date.includes('T') ? l.date.split('T')[0] : l.date;
                            return logDate === dateStr;
                        });

                        // Check if this is a planned workout day (from preferredDays)
                        const isPlannedDay = plannedDates.has(dateStr);

                        // Get the workout session for this date
                        const plannedSession = getWorkoutForDate(day);

                        // Check if this session was already completed this week (even on different day)
                        const sessionAlreadyDone = plannedSession
                            ? isSessionCompletedThisWeek(plannedSession.name, day)
                            : false;

                        if (log) {
                            status = { type: 'completed', data: log };
                        } else if (isPlannedDay && !sessionAlreadyDone) {
                            // Only show as planned if session not yet done this week
                            status = { type: 'planned', data: null };
                        }

                        const isToday = day.toDateString() === new Date().toDateString();
                        const isSelected = selectedDateToMove?.toDateString() === day.toDateString();

                        return (
                            <div
                                key={idx}
                                onClick={() => status && handleDateClick(day, status)}
                                className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all duration-300
                              ${isToday ? 'bg-white/10 border border-white/20' : ''}
                              ${status ? 'cursor-pointer hover:bg-white/5' : 'opacity-40'}
                          `}
                            >
                                <span className={`text-xs font-medium ${isToday ? 'text-white font-bold' : 'text-gray-400'}`}>{day.getDate()}</span>

                                {status?.type === 'completed' && (
                                    <div className="mt-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
                                        <Check size={10} className="text-black" strokeWidth={4} />
                                    </div>
                                )}

                                {status?.type === 'planned' && (
                                    <div className="mt-1 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex justify-center gap-6 text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div> По плану
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div> Выполнено
                    </div>
                </div>
            </div>
        );
    };

    const chartTheme = {
        grid: "#262626",
        text: "#737373",
        fontSize: 10,
        fontFamily: "var(--font-display)", // Ensure this maps to Barlow Condensed in CSS
    };

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']; // Indigo, Emerald, Amber, Pink

    return (
        <div className="pb-40 space-y-6 animate-fade-in px-1 relative pt-[env(safe-area-inset-top)]">

            {/* Level Header - moved to top */}
            <div className="bg-gradient-to-br from-neutral-900 to-neutral-900/50 border border-white/10 rounded-3xl p-5 shadow-2xl relative overflow-hidden mx-1">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

                <div className="flex items-center gap-4 mb-3 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-display font-black text-3xl shadow-lg shadow-indigo-500/30 transform rotate-3 border border-white/10">
                        {userLevel.level}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-display font-black text-white">{userLevel.title}</h2>
                            <Crown size={18} className="text-yellow-400 fill-yellow-400" />
                        </div>
                        <p className="text-xs text-gray-400 font-medium">{userLevel.xp} XP</p>
                    </div>
                </div>

                <div className="relative z-10">
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                        <span>До следующего уровня</span>
                        <span>{userLevel.levelProgress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-indigo-500 rounded-full relative"
                            style={{ width: `${userLevel.levelProgress}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>

            <h2 className="text-lg font-display font-bold text-white px-2 mt-8 mb-4 uppercase tracking-wider opacity-60">Статистика</h2>

            {/* Calendar Section */}
            {renderCalendar()}

            {/* Demo Mode Banner removed - showing empty states instead */}

            {/* Calibration Card - shows progress toward strength analysis */}
            <CalibrationCard logs={displayLogs} />

            {/* Imbalance Warning Card */}
            {detectedImbalances.length > 0 && (
                <ImbalanceWarningCard
                    imbalances={detectedImbalances}
                    onLearnMore={(imbalance) => {
                        setSelectedImbalance(imbalance);
                        setShowImbalanceEducation(true);
                    }}
                    onViewDetails={() => {
                        if (profile?.isPro) {
                            setShowStrengthAnalysis(true);
                        } else {
                            onOpenPremium?.();
                        }
                    }}
                    isPro={profile?.isPro || false}
                />
            )}

            {/* Volume Tracking by Muscle Group */}
            <VolumeTrackingCard
                logs={displayLogs}
                experienceLevel={profile?.experience}
                isPro={profile?.isPro}
                onOpenPremium={onOpenPremium}
            />

            {/* Pain Diary Section */}
            {/* Body Status Monitor (Pain Diary Redesign) */}
            <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <h3 className="font-display font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Activity size={16} className={painLogs.length > 0 ? "text-orange-500" : "text-green-500"} />
                        Статус тела
                    </h3>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${painLogs.length === 0 ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {painLogs.length === 0 ? 'OPTIMIZED' : 'RECOVERY NEEDED'}
                    </div>
                </div>

                {painLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-3">
                            <Check size={32} className="text-green-500" />
                        </div>
                        <p className="text-gray-400 text-sm">Болей не зафиксировано.</p>
                        <p className="text-gray-600 text-xs">Тренировочный процесс оптимален.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Status Visualization */}
                        <div className="bg-neutral-800/50 rounded-2xl p-4 flex flex-col items-center justify-center relative">
                            {/* Body Silhouette Placeholder / Status Ring */}
                            <div className="relative w-24 h-24 flex items-center justify-center mb-2">
                                <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full animate-pulse"></div>
                                <div className="absolute inset-2 border-4 border-orange-500/40 rounded-full"></div>
                                <div className="text-2xl font-display font-black text-white">{painLogs.length}</div>
                            </div>
                            <p className="text-xs text-orange-400 font-bold uppercase tracking-wider">Проблемные зоны</p>
                            <p className="text-[10px] text-gray-500 text-center mt-1 leading-tight">
                                Высокая частота болевых ощущений. Рекомендуется снижение нагрузки.
                            </p>
                        </div>

                        {/* Active Zones List */}
                        <div className="space-y-2">
                            <p className="text-[10px] text-gray-500 px-1 font-bold uppercase tracking-wider">Последние отчеты</p>
                            {Object.entries(painByLocation).slice(0, 3).map(([location, logs]) => {
                                const typedLogs = logs as WorkoutLog[];
                                const lastLog = typedLogs[typedLogs.length - 1];
                                const dateStr = new Date(lastLog.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
                                return (
                                    <div key={location} className="flex items-center justify-between bg-neutral-800 rounded-lg p-2 px-3 border border-white/5">
                                        <span className="text-sm text-gray-200 font-medium">{location}</span>
                                        <div className="text-right">
                                            <div className="text-[10px] text-gray-500 font-medium uppercase">{dateStr}</div>
                                            <div className="text-[10px] text-orange-400">{typedLogs.length} записи</div>
                                        </div>
                                    </div>
                                );
                            })}

                            {painAnalysis && (
                                <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl relative">
                                    <div className="absolute top-0 left-0 bg-orange-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-br-lg rounded-tl-lg">
                                        PHYSIO AI
                                    </div>
                                    <p className="text-[11px] text-orange-200 leading-snug mt-2 italic">
                                        "{painAnalysis.recommendation || "Рекомендуется снизить нагрузку на проблемные зоны."}"
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Enhanced Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Total Volume Card */}
                <div className="bg-neutral-900 border border-white/5 rounded-2xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Dumbbell size={40} />
                    </div>
                    <div className="text-xs font-bold text-gray-500 mb-1">
                        Объем всего
                    </div>
                    <div className="text-3xl font-display font-black text-white tracking-tight">
                        {formatKg(totalVolume)}
                    </div>
                </div>

                {/* Streak Card - Enhanced */}
                <div className="bg-neutral-900 border border-white/5 rounded-2xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity text-orange-500">
                        <Flame size={40} />
                    </div>
                    <div className="text-xs font-bold text-gray-500 mb-1">
                        Серия (нед)
                    </div>
                    <div className="text-3xl font-display font-black text-white tracking-tight flex items-baseline gap-1">
                        {currentStreak}
                        <span className="text-sm font-sans font-medium text-gray-500">
                            {pluralizeRu(currentStreak, 'нед', 'нед', 'нед')}
                        </span>
                    </div>
                    {nextScheduledDay && (
                        <div className="text-[10px] text-gray-500 mt-1">
                            След: {nextScheduledDay.dayName}
                            {nextScheduledDay.daysUntil === 0 ? ' (сегодня)' :
                                nextScheduledDay.daysUntil === 1 ? ' (завтра)' :
                                    ` (через ${nextScheduledDay.daysUntil} дн.)`}
                        </div>
                    )}
                </div>
            </div>

            {/* Strength Progression Chart - Premium */}
            {logs.length >= WORKOUT_THRESHOLDS.STRENGTH_CHART && strengthData.data.length > 0 && strengthData.exercises.length > 0 ? (
                <BlurredContent
                    title="Динамика Силы"
                    description="Отслеживай прогресс в ключевых упражнениях"
                    onUnlock={onOpenPremium || (() => { })}
                    isPro={profile?.isPro || false}
                >
                    <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg relative overflow-hidden">
                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>

                        <div className="flex items-center gap-2 mb-4 text-gray-400 font-bold text-xs relative z-10">
                            <TrendingUp size={14} className="text-indigo-400" />
                            Динамика силы (e1RM)
                        </div>
                        <div className="h-56 -ml-2 relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={strengthData.data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorEx0" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorEx1" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="date"
                                        stroke={chartTheme.text}
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                        tick={{ fontFamily: 'var(--font-display)' }}
                                    />
                                    <YAxis
                                        stroke={chartTheme.text}
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        domain={['auto', 'auto']}
                                        tick={{ fontFamily: 'var(--font-display)' }}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '12px', fontFamily: 'var(--font-display)' }}
                                        itemStyle={{ padding: 0 }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '15px', fontFamily: 'var(--font-display)', opacity: 0.7 }} iconType="circle" />
                                    {strengthData.exercises[0] && (
                                        <Area
                                            type="monotone"
                                            dataKey="ex0"
                                            name={strengthData.exercises[0]}
                                            stroke="#6366f1"
                                            fillOpacity={1}
                                            fill="url(#colorEx0)"
                                            strokeWidth={3}
                                            dot={false}
                                        />
                                    )}
                                    {strengthData.exercises[1] && (
                                        <Area
                                            type="monotone"
                                            dataKey="ex1"
                                            name={strengthData.exercises[1]}
                                            stroke="#10b981"
                                            fillOpacity={1}
                                            fill="url(#colorEx1)"
                                            strokeWidth={3}
                                            dot={false}
                                        />
                                    )}
                                    {strengthData.exercises[2] && (
                                        <Area
                                            type="monotone"
                                            dataKey="ex2"
                                            name={strengthData.exercises[2]}
                                            stroke="#f59e0b"
                                            fillOpacity={0.1}
                                            fill="#f59e0b"
                                            strokeWidth={3}
                                            strokeDasharray="5 5"
                                            dot={false}
                                        />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </BlurredContent>
            ) : logs.length < WORKOUT_THRESHOLDS.STRENGTH_CHART ? (
                <EmptyStateCard
                    icon={<TrendingUp size={48} className="text-gray-600" />}
                    title="Динамика силы"
                    currentCount={logs.length}
                    requiredCount={WORKOUT_THRESHOLDS.STRENGTH_CHART}
                    description="Отслеживайте прогресс в ключевых упражнениях (e1RM)"
                    showProgress={true}
                />
            ) : null}

            {/* Split & Volume Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Weekly Volume with Comparison */}
                {logs.length >= WORKOUT_THRESHOLDS.WEEKLY_VOLUME && weeklyVolumeData.length > 0 ? (
                    <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-gray-400 font-bold text-xs">
                                <Activity size={14} className="text-green-400" />
                                Объем за неделю
                                <button
                                    onClick={() => setShowVolumeInfo(true)}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <Info size={12} className="text-gray-500" />
                                </button>
                            </div>
                            {/* Trend Badge */}
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${weekComparison.trend === 'up'
                                ? 'bg-green-500/20 text-green-400'
                                : weekComparison.trend === 'down'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                }`}>
                                {weekComparison.trend === 'up' && <TrendingUp size={12} />}
                                {weekComparison.trend === 'down' && <TrendingDown size={12} />}
                                {weekComparison.trend === 'same' && <Minus size={12} />}
                                {weekComparison.changePercent > 0 && '+'}
                                {weekComparison.changePercent}%
                            </div>
                        </div>

                        {/* Current vs Previous - Average per day */}
                        <div className="flex flex-col gap-1 mb-4">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-display font-black text-white tracking-tight">
                                    {formatKg(Math.round(weekComparison.currentWeekAvgPerDay))}
                                </span>
                                <span className="text-[10px] font-bold text-gray-500 uppercase">/ день</span>
                            </div>
                            <span className="text-xs text-gray-500">
                                vs {formatKg(Math.round(weekComparison.previousWeekAvgPerDay))}/день
                            </span>
                        </div>

                        <div className="h-40 -ml-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyVolumeData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="name"
                                        stroke={chartTheme.text}
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                        tick={{ fontFamily: 'var(--font-display)' }}
                                    />
                                    <YAxis
                                        stroke={chartTheme.text}
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                                        tick={{ fontFamily: 'var(--font-display)' }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'white', opacity: 0.05 }}
                                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '12px', fontFamily: 'var(--font-display)' }}
                                    />
                                    <Bar
                                        dataKey="volume"
                                        fill="url(#volumeGradient)"
                                        radius={[4, 4, 0, 0]}
                                        barSize={24}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                ) : (
                    <EmptyStateCard
                        icon={<BarChart2 size={48} className="text-gray-600" />}
                        title="Объём за неделю"
                        currentCount={logs.length}
                        requiredCount={WORKOUT_THRESHOLDS.WEEKLY_VOLUME}
                        description="Отслеживайте изменение нагрузки по неделям"
                    />
                )}

                {/* Symmetry Radar Chart */}
                {logs.length >= 5 ? (
                    <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
                        <div className="flex items-center gap-2 mb-2 text-gray-400 font-bold text-xs uppercase tracking-wider">
                            <Target size={14} className="text-indigo-400" />
                            Баланс Нагрузки
                        </div>
                        <div className="h-56 flex items-center justify-center -ml-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={movementData}>
                                    <PolarGrid gridType="polygon" stroke="#262626" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#737373', fontSize: 10, fontFamily: 'var(--font-display)' }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                                    <Radar
                                        name="Ваша статистика"
                                        dataKey="A"
                                        stroke="#6366f1"
                                        strokeWidth={2}
                                        fill="#6366f1"
                                        fillOpacity={0.4}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '12px', fontFamily: 'var(--font-display)' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Interactive muscle group list */}
                        <div className="mt-3 flex flex-wrap gap-2 justify-center">
                            {movementData.map((item: any) => (
                                <button
                                    key={item.key}
                                    onClick={() => {
                                        hapticFeedback.selectionChanged();
                                        setSelectedMovement({
                                            name: item.subject,
                                            key: item.key,
                                            muscles: item.muscles || [],
                                            sets: item.A
                                        });
                                    }}
                                    className="px-3 py-1.5 bg-neutral-800 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/30 rounded-lg text-xs text-gray-300 hover:text-indigo-300 transition-all flex items-center gap-1.5"
                                >
                                    <span className="font-medium">{item.subject}</span>
                                    <span className="text-gray-500 text-[10px]">{item.A}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-gray-500 text-center mt-3">
                            Нажмите на группу чтобы увидеть детали
                        </p>
                    </div>
                ) : (
                    <EmptyStateCard
                        icon={<Target size={48} className="text-gray-600" />}
                        title="Баланс нагрузки"
                        currentCount={logs.length}
                        requiredCount={5}
                        description="Визуализация симметрии развития мышечных групп"
                        showProgress={true}
                    />
                )}
            </div>

            {/* Consistency Heatmap */}
            <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-4 text-gray-300 font-bold text-sm">
                    <Calendar size={16} className="text-green-400" />
                    Календарь Активности
                </div>
                <div className="flex justify-between gap-1">
                    {heatmapData.map((day, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                            <div
                                className={`w-full aspect-[4/5] rounded-md transition-all duration-500 ${day.hasWorkout
                                    ? (day.intensity > 1 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-green-500/60')
                                    : 'bg-neutral-800'
                                    }`}
                                title={day.date.toDateString()}
                            ></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Enhanced PR List with Dates */}
            {logs.length >= WORKOUT_THRESHOLDS.PERSONAL_RECORDS && personalRecords.length > 0 ? (
                <div className="space-y-3">
                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                        <Trophy size={18} className="text-yellow-500" />
                        Личные Рекорды
                    </h3>
                    <div className="grid gap-2">
                        {personalRecords.map(pr => (
                            <div
                                key={pr.exerciseName}
                                className="bg-neutral-900 border border-white/5 p-4 rounded-2xl"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-bold text-gray-300 text-sm">
                                            {pr.exerciseName}
                                        </span>
                                        <div className="text-[10px] text-gray-500 mt-1">
                                            {new Date(pr.date).toLocaleDateString('ru-RU', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-display font-black text-2xl text-white tracking-tight">
                                            {pr.weight}
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-bold ml-1">
                                            кг
                                        </span>
                                        <div className="text-[10px] text-gray-500 font-medium mt-0.5">
                                            × {pr.reps}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : logs.length < WORKOUT_THRESHOLDS.PERSONAL_RECORDS ? (
                <EmptyStateCard
                    icon={<Trophy size={48} className="text-gray-600" />}
                    title="Личные рекорды"
                    currentCount={logs.length}
                    requiredCount={WORKOUT_THRESHOLDS.PERSONAL_RECORDS}
                    description="Мы посчитаем ваш e1RM для каждого упражнения"
                    showProgress={true}
                />
            ) : null}

            {/* Weight Progression Section - Focus on consistency */}
            {logs.length >= WORKOUT_THRESHOLDS.WEIGHT_PROGRESSION && weightProgression.length > 0 ? (
                <div className="space-y-3">
                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                        <Activity size={18} className="text-blue-500" />
                        Динамика весов
                    </h3>
                    <p className="text-xs text-gray-500 -mt-2">
                        Постоянство важнее рекордов
                    </p>
                    <div className="grid gap-2">
                        {weightProgression.map(entry => (
                            <div
                                key={entry.exerciseNameRu}
                                className="bg-neutral-900 border border-white/5 p-4 rounded-2xl"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-bold text-gray-300 text-sm">
                                            {entry.exerciseNameRu}
                                        </span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-gray-500 text-xs">
                                                {entry.previousWeight}кг → {entry.currentWeight}кг
                                            </span>
                                            {entry.trend === 'up' && (
                                                <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                                                    <TrendingUp size={12} />
                                                    +{entry.changeFromPrevious.toFixed(1)}
                                                </span>
                                            )}
                                            {entry.trend === 'down' && (
                                                <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
                                                    <TrendingDown size={12} />
                                                    {entry.changeFromPrevious.toFixed(1)}
                                                </span>
                                            )}
                                            {entry.trend === 'stable' && (
                                                <span className="flex items-center gap-1 text-gray-400 text-xs">
                                                    <Minus size={12} />
                                                    стабильно
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-display font-black text-2xl text-white tracking-tight">
                                            {entry.currentWeight}
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-bold ml-1">
                                            кг
                                        </span>
                                        {entry.changeFromFirst !== 0 && (
                                            <div className={`text-[10px] mt-1 ${entry.changeFromFirst > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {entry.changeFromFirst > 0 ? '+' : ''}{entry.changeFromFirst.toFixed(1)} кг с начала
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : logs.length < WORKOUT_THRESHOLDS.WEIGHT_PROGRESSION ? (
                <EmptyStateCard
                    icon={<TrendingUp size={48} className="text-gray-600" />}
                    title="Динамика весов"
                    currentCount={logs.length}
                    requiredCount={WORKOUT_THRESHOLDS.WEIGHT_PROGRESSION}
                    description="Отслеживайте рост рабочих весов в ключевых упражнениях"
                    showProgress={true}
                />
            ) : null}

            {/* Workout Preview Modal (for planned days) */}
            {workoutToPreview && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 pb-28">
                    <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-md space-y-4 text-white animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide">План</p>
                                <h2 className="text-xl font-bold text-indigo-300">{workoutToPreview.name}</h2>
                            </div>
                            <button onClick={() => setWorkoutToPreview(null)} className="p-1 rounded-full hover:bg-gray-700">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                            {workoutToPreview.exercises.map((ex, index) => (
                                <div key={index} className="bg-gray-700 p-4 rounded-lg">
                                    <h3 className="font-semibold text-white">{ex.name}</h3>
                                    <div className="flex items-center gap-4 text-gray-400 text-sm mt-2">
                                        <span className="flex items-center gap-1.5"><Repeat size={14} /> {ex.sets} подх. x {ex.reps} повт.</span>
                                        <span className="flex items-center gap-1.5"><Timer size={14} /> {ex.rest}с отдых</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            {onStartWorkout && (
                                <button
                                    onClick={() => {
                                        onStartWorkout(workoutToPreview.name);
                                        setWorkoutToPreview(null);
                                    }}
                                    className="flex-1 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-500 transition-all duration-300 flex items-center justify-center gap-2"
                                >
                                    <Play size={18} fill="currentColor" />
                                    Начать сейчас
                                </button>
                            )}
                            <button
                                onClick={() => setWorkoutToPreview(null)}
                                className={`${onStartWorkout ? 'flex-1' : 'w-full'} bg-neutral-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-neutral-600 transition-all duration-300`}
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Workout Report Modal (for completed days) */}
            {workoutLogToView && (() => {
                // Helper to detect timed exercises (plank, cardio, etc.)
                const isTimedExercise = (name: string) => {
                    const n = name.toLowerCase();
                    return n.includes('планк') || n.includes('plank') ||
                        n.includes('кардио') || n.includes('cardio') ||
                        n.includes('бег') || n.includes('run') ||
                        n.includes('велосипед') || n.includes('bike') ||
                        n.includes('эллипс') || n.includes('ellip') ||
                        n.includes('дорожк') || n.includes('treadmill') ||
                        n.includes('скакалк') || n.includes('rope') ||
                        n.includes('берпи') || n.includes('burpee');
                };

                // Calculate total volume (only for weighted exercises)
                const totalVolume = workoutLogToView.completedExercises.reduce((total, ex) => {
                    if (isTimedExercise(ex.name)) return total;
                    return total + ex.completedSets.reduce((sum, set) => {
                        const weight = set.weight || 0;
                        const reps = set.reps || 0;
                        return sum + (weight * reps);
                    }, 0);
                }, 0);

                return (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 pb-28">
                        <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-md space-y-4 text-white animate-fade-in-up flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-green-400 uppercase tracking-wide flex items-center gap-1">
                                        <Check size={12} /> Выполнено
                                    </p>
                                    <h2 className="text-xl font-bold text-white">{workoutLogToView.sessionId}</h2>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {new Date(workoutLogToView.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                                        {workoutLogToView.duration && ` • ${Math.round(workoutLogToView.duration / 60)} мин`}
                                    </p>
                                </div>
                                <button onClick={() => setWorkoutLogToView(null)} className="p-1 rounded-full hover:bg-gray-700">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Total volume (only if > 0) */}
                            {totalVolume > 0 && (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center justify-between">
                                    <span className="text-green-400 text-sm font-medium">Общий объём</span>
                                    <span className="text-white font-bold">{totalVolume.toLocaleString()} кг</span>
                                </div>
                            )}

                            <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                                {workoutLogToView.completedExercises.map((ex, index) => {
                                    const isTimed = isTimedExercise(ex.name);

                                    return (
                                        <div key={index} className="bg-gray-700 p-4 rounded-lg">
                                            <h3 className="font-semibold text-white mb-2">{ex.name}</h3>
                                            <div className="space-y-1">
                                                {ex.completedSets.map((set, setIdx) => (
                                                    <div key={setIdx} className="flex items-center justify-between text-sm">
                                                        <span className="text-gray-500">Подход {setIdx + 1}</span>
                                                        <span className="text-white font-medium">
                                                            {isTimed ? (
                                                                // Timed exercise: show seconds
                                                                `${set.reps || 0} сек`
                                                            ) : set.weight && set.weight > 0 ? (
                                                                // Weighted exercise
                                                                <>
                                                                    {set.weight} кг × {set.reps || 0}
                                                                    {set.rir !== undefined && <span className="text-gray-400 ml-2">RIR {set.rir}</span>}
                                                                </>
                                                            ) : (
                                                                // Bodyweight exercise (no weight)
                                                                `${set.reps || 0} повт.`
                                                            )}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => setWorkoutLogToView(null)}
                                className="w-full bg-neutral-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-neutral-600 transition-all duration-300"
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Imbalance Education Modal */}
            {showImbalanceEducation && selectedImbalance && (
                <ImbalanceEducationModal
                    imbalance={selectedImbalance}
                    onClose={() => {
                        setShowImbalanceEducation(false);
                        setSelectedImbalance(null);
                    }}
                    onUpgrade={() => {
                        setShowImbalanceEducation(false);
                        setSelectedImbalance(null);
                        onOpenPremium?.();
                    }}
                    isPro={profile?.isPro || false}
                />
            )}

            {/* Strength Analysis Modal */}
            {showStrengthAnalysis && profile && (
                <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
                    <div className="min-h-screen p-4">
                        <div className="max-w-lg mx-auto">
                            <button
                                onClick={() => setShowStrengthAnalysis(false)}
                                className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                                Закрыть
                            </button>
                            <StrengthAnalysisView
                                profile={profile}
                                logs={displayLogs}
                                isPro={profile.isPro || false}
                                onUpgrade={() => {
                                    setShowStrengthAnalysis(false);
                                    onOpenPremium?.();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Volume Info Modal */}
            {showVolumeInfo && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 pb-28">
                    <div className="bg-gray-800 rounded-2xl shadow-lg w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="p-4 border-b border-neutral-700 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Activity size={20} className="text-green-400" />
                                <h2 className="text-lg font-bold text-white">Тренировочный объём</h2>
                            </div>
                            <button
                                onClick={() => setShowVolumeInfo(false)}
                                className="p-1 rounded-full hover:bg-gray-700 text-gray-400"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="bg-neutral-700/30 rounded-xl p-3">
                                <h3 className="text-sm font-medium text-white mb-2">Что это?</h3>
                                <p className="text-gray-300 text-sm">
                                    Тренировочный объём — это общая нагрузка за тренировку:<br />
                                    <span className="text-green-400 font-medium">Вес × Подходы × Повторения</span>
                                </p>
                            </div>

                            <div className="bg-neutral-700/30 rounded-xl p-3">
                                <h3 className="text-sm font-medium text-white mb-2">Зачем отслеживать?</h3>
                                <ul className="space-y-2 text-sm text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <TrendingUp size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                                        <span><strong>Прогрессия:</strong> Рост объёма = рост мышц и силы</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Target size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                                        <span><strong>Контроль:</strong> Видно перетренированность или недогруз</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <BarChart2 size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                        <span><strong>Тренд:</strong> Сравнение недель показывает динамику</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                                <div className="flex items-start gap-2">
                                    <span className="text-lg">💡</span>
                                    <p className="text-sm text-gray-300">
                                        Стремись к <strong className="text-green-400">постепенному росту</strong> объёма на 5-10% в неделю. Резкие скачки могут привести к перетренированности.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-neutral-700">
                            <button
                                onClick={() => setShowVolumeInfo(false)}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all"
                            >
                                Понятно
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Movement Pattern Detail Modal */}
            {selectedMovement && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 pb-28">
                    <div className="bg-gray-800 rounded-2xl shadow-lg w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="p-4 border-b border-neutral-700 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Target size={20} className="text-indigo-400" />
                                <h2 className="text-lg font-bold text-white">{selectedMovement.name}</h2>
                            </div>
                            <button
                                onClick={() => setSelectedMovement(null)}
                                className="p-1 rounded-full hover:bg-gray-700 text-gray-400"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Stats */}
                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-center justify-between">
                                <span className="text-indigo-300 font-medium">Выполнено подходов</span>
                                <span className="text-2xl font-display font-black text-white">{selectedMovement.sets}</span>
                            </div>

                            {/* Muscles included */}
                            <div className="bg-neutral-700/30 rounded-xl p-4">
                                <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Мышцы в этой группе</h3>
                                <div className="space-y-2">
                                    {selectedMovement.muscles.length > 0 ? (
                                        selectedMovement.muscles.map((muscle, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-neutral-800 rounded-lg px-3 py-2">
                                                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                                <span className="text-gray-200 text-sm">{muscle}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm">Информация о мышцах недоступна</p>
                                    )}
                                </div>
                            </div>

                            {/* Pattern description */}
                            <div className="bg-neutral-700/30 rounded-xl p-4">
                                <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Описание</h3>
                                <p className="text-gray-300 text-sm">
                                    {selectedMovement.key === 'Push' && 'Жимовые движения развивают переднюю поверхность тела: грудные мышцы, передние дельты и трицепсы.'}
                                    {selectedMovement.key === 'Pull' && 'Тяговые движения укрепляют заднюю поверхность: широчайшие мышцы спины, ромбовидные, задние дельты и бицепсы.'}
                                    {selectedMovement.key === 'Squat' && 'Приседания — базовое движение для нижней части тела, акцент на квадрицепсы и ягодичные мышцы.'}
                                    {selectedMovement.key === 'Hinge' && 'Наклоны и становые тяги прорабатывают заднюю цепь: бицепс бедра, ягодичные и разгибатели спины.'}
                                    {selectedMovement.key === 'Core' && 'Упражнения на кор стабилизируют корпус и защищают позвоночник при всех движениях.'}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-neutral-700">
                            <button
                                onClick={() => setSelectedMovement(null)}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all"
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, value, sub, icon, color, bg }: any) => (
    <div className="bg-neutral-900 border border-white/5 p-4 rounded-3xl flex flex-col justify-between min-h-[110px]">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bg} ${color} mb-2`}>
            {icon}
        </div>
        <div>
            <p className="text-2xl font-black text-white tracking-tight">{value}</p>
            <p className="text-xs text-gray-500 font-bold uppercase mt-0.5">{sub}</p>
        </div>
    </div>
);

export default ProgressView;
