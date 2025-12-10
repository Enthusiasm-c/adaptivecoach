
import React, { useMemo, useState } from 'react';
import { WorkoutLog, TrainingProgram, ReadinessData, WorkoutCompletion, OnboardingProfile, WorkoutSession } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    calculateStreaks, calculateTotalVolume, calculateWeeklyVolume,
    calculatePersonalRecords, calculateReadinessHistory, calculateMovementPatterns, getHeatmapData,
    calculateLevel, getStrengthProgression, getVolumeDistribution,
    calculateWeekComparison, getNextScheduledDay, pluralizeRu,
    formatKg, calculateWeightProgression, WeightProgressionEntry
} from '../utils/progressUtils';
import { Dumbbell, Flame, TrendingUp, TrendingDown, Minus, Trophy, Battery, PieChart as PieIcon, Calendar, Eye, Crown, Star, Activity, HeartPulse, ChevronLeft, ChevronRight, Check, Target, BarChart2, X, Repeat, Timer, AlertTriangle } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';
import BlurredContent from './BlurredContent';
import CalibrationCard from './CalibrationCard';

interface ProgressViewProps {
    logs: WorkoutLog[];
    program: TrainingProgram;
    onUpdateProgram?: (program: TrainingProgram) => void;
    preferredDays?: number[];
    profile?: OnboardingProfile;
    onOpenPremium?: () => void;
}

// --- Mock Data Generator ---
const generateMockLogs = (): WorkoutLog[] => {
    const logs: WorkoutLog[] = [];
    const today = new Date();

    // Create 12 workouts over the last 4 weeks (3 per week)
    for (let i = 11; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - (i * 2.5)); // Every 2-3 days

        // Fluctuate volume and readiness for realistic charts
        const isStrongDay = i % 3 !== 0;
        const volumeMultiplier = isStrongDay ? 1.1 : 0.9;
        const strengthProgression = (12 - i) * 1.5; // Gradual increase

        const readinessScore = isStrongDay ? 18 : 10; // Mix of Green and Red days

        logs.push({
            sessionId: `Тренировка ${12 - i}`,
            date: date.toISOString(),
            feedback: {
                completion: WorkoutCompletion.Yes,
                pain: { hasPain: false },
                readiness: {
                    sleep: isStrongDay ? 4 : 2,
                    food: 4,
                    stress: isStrongDay ? 4 : 2,
                    soreness: isStrongDay ? 5 : 3,
                    score: readinessScore,
                    status: readinessScore > 15 ? 'Green' : 'Red'
                }
            },
            completedExercises: [
                {
                    name: "Приседания со штангой",
                    sets: 3,
                    reps: "5",
                    rest: 120,
                    completedSets: [
                        { reps: 5, weight: 100 + strengthProgression },
                        { reps: 5, weight: 100 + strengthProgression },
                        { reps: 5, weight: 100 + strengthProgression }
                    ]
                },
                {
                    name: "Жим лежа",
                    sets: 3,
                    reps: "8-10",
                    rest: 90,
                    completedSets: [
                        { reps: 10, weight: 60 + (strengthProgression * 0.6) },
                        { reps: 9, weight: 60 + (strengthProgression * 0.6) },
                        { reps: 8, weight: 60 + (strengthProgression * 0.6) }
                    ]
                },
                {
                    name: "Становая тяга",
                    sets: 1,
                    reps: "5",
                    rest: 180,
                    completedSets: [
                        { reps: 5, weight: 120 + (strengthProgression * 1.2) }
                    ]
                },
                // Add variety for radar chart
                ...(i % 2 === 0 ? [{
                    name: "Подтягивания",
                    sets: 3,
                    reps: "10",
                    rest: 60,
                    completedSets: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 8, weight: 0 }]
                }] : [])
            ]
        });
    }
    return logs;
};

const ProgressView: React.FC<ProgressViewProps> = ({ logs, program, onUpdateProgram, preferredDays = [], profile, onOpenPremium }) => {
    const isDemoMode = logs.length === 0;

    const displayLogs = useMemo(() => {
        return isDemoMode ? generateMockLogs() : logs;
    }, [logs, isDemoMode]);

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
        painLogs.forEach(log => {
            const location = log.feedback?.pain?.location || 'Не указано';
            if (!grouped[location]) grouped[location] = [];
            grouped[location].push(log);
        });
        return grouped;
    }, [painLogs]);

    // --- Calendar Logic ---
    const [currentDate, setCurrentDate] = React.useState(new Date());
    const [selectedDateToMove, setSelectedDateToMove] = React.useState<Date | null>(null);
    const [workoutToPreview, setWorkoutToPreview] = React.useState<WorkoutSession | null>(null);
    const [workoutLogToView, setWorkoutLogToView] = React.useState<WorkoutLog | null>(null);

    // Get workout for specific date based on preferredDays rotation
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
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white capitalize flex items-center gap-2">
                        <Calendar size={20} className="text-indigo-500" />
                        {monthName}
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-neutral-800 rounded-xl p-1">
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-white/10 rounded-lg text-gray-400">
                                <ChevronLeft size={18} />
                            </button>
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-white/10 rounded-lg text-gray-400">
                                <ChevronRight size={18} />
                            </button>
                        </div>
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

                        if (log) {
                            status = { type: 'completed', data: log };
                        } else if (isPlannedDay) {
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
        grid: "#404040",
        text: "#737373",
    };

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']; // Indigo, Emerald, Amber, Pink

    return (
        <div className="pb-40 space-y-6 animate-fade-in px-1 relative pt-[env(safe-area-inset-top)]">

            {/* Level Header - moved to top */}
            <div className="bg-gradient-to-br from-neutral-900 to-neutral-900/50 border border-white/10 rounded-3xl p-5 shadow-2xl relative overflow-hidden mx-1">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

                <div className="flex items-center gap-4 mb-3 relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/30 transform rotate-3 border border-white/10">
                        {userLevel.level}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-white">{userLevel.title}</h2>
                            <Crown size={16} className="text-yellow-400 fill-yellow-400" />
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

            <h2 className="text-xl font-bold text-white px-2">Статистика</h2>

            {/* Calendar Section */}
            {renderCalendar()}

            {/* Demo Mode Banner */}
            {isDemoMode && (
                <div className="bg-indigo-500/10 border border-indigo-500/50 rounded-2xl p-4 flex items-start gap-3 animate-slide-up">
                    <div className="p-2 bg-indigo-500 text-white rounded-lg mt-0.5">
                        <Eye size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Демонстрационный режим</h3>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                            Показываем пример статистики. Начните тренироваться, чтобы увидеть свой реальный прогресс!
                        </p>
                    </div>
                </div>
            )}

            {/* Calibration Card - shows progress toward strength analysis */}
            <CalibrationCard logs={displayLogs} />

            {/* Pain Diary Section */}
            {painLogs.length > 0 && (
                <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-400" />
                        Дневник боли
                    </h3>

                    <div className="space-y-3">
                        {painLogs.slice(0, 5).map((log, idx) => {
                            // Get max weight for each exercise
                            const exerciseWeights = log.completedExercises.slice(0, 3).map(ex => ({
                                name: ex.name,
                                maxWeight: Math.max(...ex.completedSets.map(s => s.weight || 0))
                            })).filter(e => e.maxWeight > 0);

                            return (
                                <div key={`${log.date}-${idx}`} className="bg-neutral-800 rounded-xl p-3">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-red-400 font-medium">
                                            {log.feedback?.pain?.location || 'Не указано'}
                                        </span>
                                        <span className="text-gray-500">
                                            {new Date(log.date).toLocaleDateString('ru-RU', {
                                                day: 'numeric',
                                                month: 'short'
                                            })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-2">{log.sessionId}</p>
                                    {log.feedback?.pain?.details && (
                                        <p className="text-xs text-gray-500 mb-2 italic">
                                            "{log.feedback.pain.details}"
                                        </p>
                                    )}
                                    {/* Show exercises + weights from that workout */}
                                    {exerciseWeights.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {exerciseWeights.map(ex => (
                                                <span key={ex.name} className="text-[10px] bg-neutral-700 px-2 py-0.5 rounded">
                                                    {ex.name.length > 15 ? ex.name.slice(0, 15) + '...' : ex.name}: {ex.maxWeight}кг
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Pain patterns summary */}
                    {Object.keys(painByLocation).length > 0 && (
                        <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                            <p className="text-red-300 text-sm font-bold mb-2">Частые зоны:</p>
                            <div className="flex flex-wrap gap-2">
                                {(Object.entries(painByLocation) as [string, WorkoutLog[]][])
                                    .sort((a, b) => b[1].length - a[1].length)
                                    .slice(0, 4)
                                    .map(([location, locationLogs]) => (
                                        <span
                                            key={location}
                                            className="px-2 py-1 bg-red-500/20 text-red-200 rounded-full text-xs font-medium"
                                        >
                                            {location}: {locationLogs.length}×
                                        </span>
                                    ))
                                }
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Enhanced Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Total Volume Card */}
                <div className="bg-neutral-900 border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                        <Dumbbell size={14} />
                        <span>Объем всего</span>
                    </div>
                    <div className="text-xl font-black text-white">
                        {formatKg(totalVolume)}
                    </div>
                </div>

                {/* Streak Card - Enhanced */}
                <div className="bg-neutral-900 border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                        <Flame size={14} className="text-orange-500" />
                        <span>Серия тренировок</span>
                    </div>
                    <div className="text-2xl font-black text-white">
                        {currentStreak}
                        <span className="text-sm text-gray-500 ml-1">
                            {pluralizeRu(currentStreak, 'день', 'дня', 'дней')}
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
            {strengthData.data.length > 0 && strengthData.exercises.length > 0 && (
                <BlurredContent
                    title="Динамика Силы"
                    description="Отслеживай прогресс в ключевых упражнениях"
                    onUnlock={onOpenPremium || (() => {})}
                    isPro={profile?.isPro || false}
                >
                    <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
                        <div className="flex items-center gap-2 mb-4 text-gray-300 font-bold text-sm">
                            <TrendingUp size={16} className="text-indigo-400" />
                            Динамика Силы (e1RM)
                        </div>
                        <div className="h-56 -ml-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={strengthData.data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
                                    <XAxis dataKey="date" stroke={chartTheme.text} fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke={chartTheme.text} fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} iconType="circle" />
                                    {strengthData.exercises[0] && (
                                        <Line type="monotone" dataKey="ex0" name={strengthData.exercises[0]} stroke="#6366f1" strokeWidth={3} dot={false} connectNulls />
                                    )}
                                    {strengthData.exercises[1] && (
                                        <Line type="monotone" dataKey="ex1" name={strengthData.exercises[1]} stroke="#10b981" strokeWidth={3} dot={false} connectNulls />
                                    )}
                                    {strengthData.exercises[2] && (
                                        <Line type="monotone" dataKey="ex2" name={strengthData.exercises[2]} stroke="#f59e0b" strokeWidth={3} dot={false} connectNulls />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </BlurredContent>
            )}

            {/* Split & Volume Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Weekly Volume with Comparison */}
                <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-gray-300 font-bold text-sm">
                            <Activity size={16} className="text-emerald-400" />
                            Объем за неделю
                        </div>
                        {/* Trend Badge */}
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                            weekComparison.trend === 'up'
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
                            <span className="text-2xl font-black text-white">
                                {formatKg(Math.round(weekComparison.currentWeekAvgPerDay))}
                            </span>
                            <span className="text-sm text-gray-500">/ день</span>
                        </div>
                        <span className="text-xs text-gray-500">
                            vs {formatKg(Math.round(weekComparison.previousWeekAvgPerDay))}/день пр. неделя
                            ({weekComparison.currentWeekDays} vs {weekComparison.previousWeekDays} {pluralizeRu(weekComparison.previousWeekDays, 'день', 'дня', 'дней')})
                        </span>
                    </div>

                    <div className="h-40 -ml-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyVolumeData.length > 0 ? weeklyVolumeData : [{ name: 'Нет данных', volume: 0 }]} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="name"
                                    stroke={chartTheme.text}
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => val.includes('-W') ? `W${val.split('-W')[1]}` : val}
                                    dy={10}
                                />
                                <YAxis stroke={chartTheme.text} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}т`} />
                                <Bar dataKey="volume" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                                    formatter={(value: any) => [`${(value / 1000).toFixed(2)}т`, 'Объем']}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Split Distribution Pie */}
                <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
                    <div className="flex items-center gap-2 mb-2 text-gray-300 font-bold text-sm">
                        <PieIcon size={16} className="text-pink-400" />
                        Акцент Нагрузки
                    </div>
                    <div className="h-48 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={volumeDistData}
                                    innerRadius={40}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {volumeDistData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }} />
                                <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px', color: '#a3a3a3' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
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
            {personalRecords.length > 0 && (
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
                                        <span className="font-black text-xl text-white">
                                            {pr.e1rm.toFixed(0)}
                                        </span>
                                        <span className="text-xs text-gray-500 font-bold ml-1">
                                            КГ
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Weight Progression Section - Focus on consistency */}
            {weightProgression.length > 0 && (
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
                                            {entry.trend === 'up' && (
                                                <span className="flex items-center gap-1 text-green-400 text-xs">
                                                    <TrendingUp size={12} />
                                                    +{entry.changeFromPrevious.toFixed(1)} кг
                                                </span>
                                            )}
                                            {entry.trend === 'down' && (
                                                <span className="flex items-center gap-1 text-red-400 text-xs">
                                                    <TrendingDown size={12} />
                                                    {entry.changeFromPrevious.toFixed(1)} кг
                                                </span>
                                            )}
                                            {entry.trend === 'stable' && (
                                                <span className="flex items-center gap-1 text-gray-400 text-xs">
                                                    <Minus size={12} />
                                                    Стабильно
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-black text-xl text-white">
                                            {entry.currentWeight}
                                        </span>
                                        <span className="text-xs text-gray-500 font-bold ml-1">
                                            КГ
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
            )}

            {/* Workout Preview Modal (for planned days) */}
            {workoutToPreview && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
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
                                        <span className="flex items-center gap-1.5"><Repeat size={14}/> {ex.sets} подх. x {ex.reps} повт.</span>
                                        <span className="flex items-center gap-1.5"><Timer size={14}/> {ex.rest}с отдых</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setWorkoutToPreview(null)}
                            className="w-full bg-neutral-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-neutral-600 transition-all duration-300"
                        >
                            Закрыть
                        </button>
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
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
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
