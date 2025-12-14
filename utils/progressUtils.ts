
import { WorkoutLog, PersonalRecord, ReadinessData, Exercise, WorkoutSession } from '../types';

// Russian plural forms: 1 тренировка, 2-4 тренировки, 5-20 тренировок
export const pluralizeRu = (n: number, one: string, few: string, many: string): string => {
    const absN = Math.abs(n);
    const mod10 = absN % 10;
    const mod100 = absN % 100;

    if (mod100 >= 11 && mod100 <= 19) {
        return many;
    }
    if (mod10 === 1) {
        return one;
    }
    if (mod10 >= 2 && mod10 <= 4) {
        return few;
    }
    return many;
};

// Format kg with thousands separator (8500 → "8 500 кг")
export const formatKg = (kg: number): string => {
    return Math.round(kg).toLocaleString('ru-RU') + ' кг';
};

// Helper to get the ISO week number for a date
const getWeekNumber = (d: Date): [number, number] => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
    return [d.getUTCFullYear(), weekNo];
};

export interface StreakShieldOptions {
    shieldUsedAt?: string | null;  // Date when shield was used this week
}

export interface StreakResult {
    currentStreak: number;
    bestStreak: number;
    streakProtected: boolean;  // True if shield is currently protecting the streak
}

export const calculateStreaks = (
    logs: WorkoutLog[],
    shieldOptions?: StreakShieldOptions,
    _preferredDays: number[] = [1, 3, 5] // Deprecated: no longer used, kept for API compatibility
): StreakResult => {
    if (logs.length === 0) return { currentStreak: 0, bestStreak: 0, streakProtected: false };

    // Получаем уникальные даты тренировок (без времени), сортируем от новых к старым
    const workoutDates = [...new Set(logs.map(l => {
        const d = new Date(l.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }))].sort((a, b) => b - a); // От новых к старым

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Check if shield was used recently (within last 24 hours)
    let streakProtected = false;
    if (shieldOptions?.shieldUsedAt) {
        const shieldDate = new Date(shieldOptions.shieldUsedAt);
        shieldDate.setHours(0, 0, 0, 0);
        const daysSinceShield = Math.floor((todayTime - shieldDate.getTime()) / oneDayMs);
        if (daysSinceShield <= 1) {
            streakProtected = true;
        }
    }

    // Простая логика: считаем тренировки подряд (каждый день)
    // Streak начинается с сегодня (или вчера если сегодня ещё не тренировался)
    let currentStreak = 0;

    if (workoutDates.length === 0) {
        return { currentStreak: 0, bestStreak: 0, streakProtected };
    }

    const latestWorkout = workoutDates[0];
    const daysSinceLatest = Math.floor((todayTime - latestWorkout) / oneDayMs);

    // Если последняя тренировка была больше чем вчера - streak = 0
    if (daysSinceLatest > 1) {
        // Streak прервался, но вычисляем bestStreak из истории
        let bestStreak = 1;
        let tempStreak = 1;
        for (let i = 1; i < workoutDates.length; i++) {
            const diff = (workoutDates[i - 1] - workoutDates[i]) / oneDayMs;
            if (diff === 1) {
                tempStreak++;
            } else {
                bestStreak = Math.max(bestStreak, tempStreak);
                tempStreak = 1;
            }
        }
        bestStreak = Math.max(bestStreak, tempStreak);
        return { currentStreak: 0, bestStreak, streakProtected };
    }

    // Считаем текущий streak от последней тренировки
    currentStreak = 1;
    for (let i = 1; i < workoutDates.length; i++) {
        const diff = (workoutDates[i - 1] - workoutDates[i]) / oneDayMs;
        if (diff === 1) {
            currentStreak++;
        } else {
            break;
        }
    }

    // Вычисляем лучший streak
    let bestStreak = currentStreak;
    let tempStreak = 1;
    for (let i = 1; i < workoutDates.length; i++) {
        const diff = (workoutDates[i - 1] - workoutDates[i]) / oneDayMs;
        if (diff === 1) {
            tempStreak++;
        } else {
            bestStreak = Math.max(bestStreak, tempStreak);
            tempStreak = 1;
        }
    }
    bestStreak = Math.max(bestStreak, tempStreak);

    return { currentStreak, bestStreak, streakProtected };
};

export const calculateWorkoutVolume = (log: WorkoutLog): number => {
    if (!log || !log.completedExercises || log.completedExercises.length === 0) return 0;
    return log.completedExercises.reduce((totalVol, ex) => {
        if (!ex || !ex.completedSets) return totalVol;
        const exerciseVol = ex.completedSets.reduce((vol, set) => {
            const reps = set?.reps || 0;
            const weight = set?.weight || 0;
            return vol + reps * weight;
        }, 0);
        return totalVol + exerciseVol;
    }, 0);
}

export const calculateTotalVolume = (logs: WorkoutLog[]): number => {
    return logs.reduce((total, log) => total + calculateWorkoutVolume(log), 0);
};

export const calculateWeeklyVolume = (logs: WorkoutLog[]) => {
    const weeks: { [key: string]: number } = {};
    logs.forEach(log => {
        const date = new Date(log.date);
        const [year, week] = getWeekNumber(date);
        const weekKey = `${year}-W${String(week).padStart(2, '0')}`;
        if (!weeks[weekKey]) {
            weeks[weekKey] = 0;
        }
        weeks[weekKey] += calculateWorkoutVolume(log);
    });

    return Object.keys(weeks).map(key => ({ name: key, volume: weeks[key] })).slice(-8); // Last 8 weeks
};

// Epley formula for e1RM
const calculateE1RM = (weight: number, reps: number): number => {
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
};

// Key lifts configuration with keywords, excludes and group keys
interface LiftConfig {
    keywords: string[];
    excludes?: string[];  // If name contains any of these, skip this group
    groupKey: string;
}

const KEY_LIFTS_CONFIG: LiftConfig[] = [
    { keywords: ['squat', 'присед'], groupKey: 'squat' },
    { keywords: ['bench', 'жим лежа'], groupKey: 'bench' },
    { keywords: ['deadlift', 'становая'], groupKey: 'deadlift' },
    { keywords: ['overhead', 'армейский', 'жим стоя', 'жим сидя'], groupKey: 'overhead' },
    { keywords: ['lunge', 'выпад'], groupKey: 'lunges' },
    { keywords: ['row', 'тяга к поясу', 'тяга штанги', 'тяга гантел'], groupKey: 'row' },
    { keywords: ['pull up', 'подтягиван', 'chin up'], groupKey: 'pullup' },
    { keywords: ['leg press', 'жим ног', 'жим платформ'], groupKey: 'legpress' },
    // Leg curl / hamstring curl - separate from bicep curl
    { keywords: ['сгибание ног', 'leg curl', 'бицепс бедра'], groupKey: 'legcurl' },
    // Bicep curls - exclude leg/hamstring exercises
    { keywords: ['curl', 'сгибан', 'бицепс', 'bicep'], excludes: ['ног', 'бедр', 'leg', 'hamstring'], groupKey: 'curl' },
];

// Russian names for key exercises
const EXERCISE_NAMES_RU: Record<string, string> = {
    'squat': 'Приседания',
    'bench': 'Жим лежа',
    'deadlift': 'Становая тяга',
    'overhead': 'Армейский жим',
    'lunges': 'Выпады',
    'row': 'Тяга к поясу',
    'pullup': 'Подтягивания',
    'legpress': 'Жим ногами',
    'legcurl': 'Сгибание ног',
    'curl': 'Бицепс',
};

// Helper to find matching lift config
const findMatchingLift = (exerciseName: string) => {
    const lowerName = exerciseName.toLowerCase();
    return KEY_LIFTS_CONFIG.find(lift => {
        // Check if name contains any keyword
        const hasKeyword = lift.keywords.some(kw => lowerName.includes(kw));
        if (!hasKeyword) return false;

        // Check excludes - if name contains any exclude word, skip this group
        if (lift.excludes && lift.excludes.some(ex => lowerName.includes(ex))) {
            return false;
        }

        return true;
    });
};

export const calculatePersonalRecords = (logs: WorkoutLog[]): PersonalRecord[] => {
    const records: { [key: string]: PersonalRecord } = {};

    logs.forEach(log => {
        log.completedExercises.forEach(ex => {
            const matchedLift = findMatchingLift(ex.name);

            if (matchedLift) {
                const bestSet = ex.completedSets.reduce((best, current) => {
                    if (!current || typeof current.weight !== 'number' || typeof current.reps !== 'number') return best;
                    return (current.weight > best.weight) ? current : best;
                }, { weight: 0, reps: 0 });

                if (bestSet.weight > 0 && bestSet.reps > 0) {
                    const e1rm = calculateE1RM(bestSet.weight, bestSet.reps);

                    if (!records[matchedLift.groupKey] || e1rm > records[matchedLift.groupKey].e1rm) {
                        records[matchedLift.groupKey] = {
                            exerciseName: ex.name,
                            e1rm,
                            date: log.date
                        };
                    }
                }
            }
        });
    });

    return Object.values(records).sort((a, b) => b.e1rm - a.e1rm);
};

export const calculateReadinessScore = (sleep: number, food: number, stress: number, soreness: number): ReadinessData => {
    const score = sleep + food + stress + soreness;
    let status: ReadinessData['status'] = 'Green';
    if (score < 12) status = 'Red';
    else if (score <= 15) status = 'Yellow';

    return { sleep, food, stress, soreness, score, status };
};

export const generateWarmupSets = (workingWeight: number, exerciseName?: string): Exercise[] => {
    if (workingWeight <= 20) return [];

    const warmups: Exercise[] = [];
    const forExercise = exerciseName ? ` → ${exerciseName}` : '';
    const shortName = exerciseName || 'первое упражнение';

    warmups.push({
        name: `🔥 Разминка${forExercise}`,
        description: `Гриф или лёгкий вес (20кг). Подготовь суставы и мышцы перед "${shortName}" с рабочим весом ${workingWeight}кг.`,
        sets: 1,
        reps: "10",
        weight: 20,
        rest: 45,
        isWarmup: true
    });

    if (workingWeight > 40) {
        const weight50 = Math.round((workingWeight * 0.5) / 2.5) * 2.5;
        warmups.push({
            name: `🔥 50% от ${workingWeight}кг`,
            description: `Разминочный подход для "${shortName}". ${weight50}кг = 50% от рабочего веса. Контроль техники.`,
            sets: 1,
            reps: "5",
            weight: weight50,
            rest: 60,
            isWarmup: true
        });
    }

    if (workingWeight > 60) {
        const weight75 = Math.round((workingWeight * 0.75) / 2.5) * 2.5;
        warmups.push({
            name: `🔥 75% от ${workingWeight}кг`,
            description: `Разминочный подход для "${shortName}". ${weight75}кг = 75% от рабочего веса. Не утомляйся!`,
            sets: 1,
            reps: "3",
            weight: weight75,
            rest: 90,
            isWarmup: true
        });
    }

    if (workingWeight > 100) {
        const weight90 = Math.round((workingWeight * 0.9) / 2.5) * 2.5;
        warmups.push({
            name: `🔥 90% от ${workingWeight}кг`,
            description: `Разминочный подход для "${shortName}". ${weight90}кг = 90% от рабочего веса. Один повтор для активации ЦНС.`,
            sets: 1,
            reps: "1",
            weight: weight90,
            rest: 120,
            isWarmup: true
        });
    }

    return warmups;
};

export interface PlateResult {
    weight: number;
    count: number;
    color: string;
}

export const calculatePlates = (targetWeight: number, barWeight: number = 20): PlateResult[] => {
    if (targetWeight <= barWeight) return [];

    const availablePlates = [
        { weight: 25, color: 'bg-red-600' },
        { weight: 20, color: 'bg-blue-600' },
        { weight: 15, color: 'bg-yellow-500' },
        { weight: 10, color: 'bg-green-600' },
        { weight: 5, color: 'bg-white' },
        { weight: 2.5, color: 'bg-gray-400' },
        { weight: 1.25, color: 'bg-gray-300' },
    ];

    let remainder = (targetWeight - barWeight) / 2;
    const result: PlateResult[] = [];

    for (const plate of availablePlates) {
        const count = Math.floor(remainder / plate.weight);
        if (count > 0) {
            result.push({ weight: plate.weight, count, color: plate.color });
            remainder -= count * plate.weight;
        }
    }

    return result;
};

export const getLastPerformance = (exerciseName: string, logs: WorkoutLog[]): string | null => {
    const cleanName = exerciseName.replace("Разминка: ", "").replace("Warm-up: ", "");

    for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i];
        const exLog = log.completedExercises.find(e =>
            e.name.toLowerCase().includes(cleanName.toLowerCase()) && !e.isWarmup
        );

        if (exLog && exLog.completedSets.length > 0) {
            const bestSet = exLog.completedSets.reduce((prev, current) => {
                return (current.weight > prev.weight) ? current : prev;
            });

            if (bestSet.weight > 0) {
                return `${bestSet.weight}kg x ${bestSet.reps}`;
            }
        }
    }
    return null;
};

// New Helper for Contextual History
export const getExerciseHistory = (exerciseName: string, logs: WorkoutLog[], limit: number = 5) => {
    const cleanName = exerciseName.replace("Разминка: ", "").replace("Warm-up: ", "");
    const history: { date: string, sets: { weight: number, reps: number }[] }[] = [];

    // Iterate backwards
    for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i];
        const exLog = log.completedExercises.find(e =>
            e.name.toLowerCase().trim() === cleanName.toLowerCase().trim() && !e.isWarmup
        );

        if (exLog && exLog.completedSets.length > 0) {
            history.push({
                date: log.date,
                sets: exLog.completedSets.filter(s => s.weight > 0)
            });
        }
        if (history.length >= limit) break;
    }
    return history;
};


// --- Statistics Utils ---

export const calculateReadinessHistory = (logs: WorkoutLog[]) => {
    return logs
        .filter(log => log.feedback?.readiness)
        .map(log => ({
            date: new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            score: log.feedback.readiness?.score || 0,
            sleep: log.feedback.readiness?.sleep || 0,
            food: log.feedback.readiness?.food || 0,
            stress: log.feedback.readiness?.stress || 0,
            soreness: log.feedback.readiness?.soreness || 0,
        }))
        .slice(-10); // Last 10 entries
};

export const calculateMovementPatterns = (logs: WorkoutLog[]) => {
    const patterns = {
        Push: 0,
        Pull: 0,
        Squat: 0,
        Hinge: 0,
        Core: 0
    };

    logs.forEach(log => {
        log.completedExercises.forEach(ex => {
            const n = ex.name.toLowerCase();

            if (n.includes('leg curl') || n.includes('сгибани')) {
                patterns.Hinge++;
                return;
            }
            if (n.includes('leg extension') || n.includes('разгибани')) {
                patterns.Squat++;
                return;
            }

            if (n.includes('squat') || n.includes('присед') || n.includes('выпады') || n.includes('leg press') || n.includes('lunge') || n.includes('step up') || n.includes('bulgarian') || n.includes('hack') || n.includes('goblet')) {
                patterns.Squat++;
            } else if (n.includes('deadlift') || n.includes('тяга') || n.includes('rdl') || n.includes('clean') || n.includes('snatch') || n.includes('swing') || n.includes('good morning') || n.includes('hip thrust') || n.includes('glute') || n.includes('мост')) {
                patterns.Hinge++;
            } else if (n.includes('bench') || n.includes('жим') || n.includes('press') || n.includes('push') || n.includes('dip') || n.includes('fly') || n.includes('raise') || n.includes('tricep') || n.includes('skullcrusher') || n.includes('extension') || n.includes('отжимания') || n.includes('разводк')) {
                patterns.Push++;
            } else if (n.includes('row') || n.includes('pull') || n.includes('chin') || n.includes('lat') || n.includes('curl') || n.includes('shrug') || n.includes('bicep') || n.includes('подтягиван')) {
                patterns.Pull++;
            } else if (n.includes('plank') || n.includes('планк') || n.includes('crunch') || n.includes('sit up') || n.includes('leg raise') || n.includes('ab ') || n.includes('hollow') || n.includes('russian') || n.includes('скручиван') || n.includes('пресс')) {
                patterns.Core++;
            }
        });
    });

    const maxVal = Math.max(...Object.values(patterns));
    return Object.keys(patterns).map(key => ({
        subject: key,
        A: (patterns as any)[key],
        fullMark: maxVal > 0 ? maxVal * 1.2 : 10 // Default scale if empty
    }));
};

export const getHeatmapData = (logs: WorkoutLog[]) => {
    const today = new Date();
    const days = [];
    for (let i = 27; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('sv-SE'); // YYYY-MM-DD in local timezone
        // Support both new format (YYYY-MM-DD) and old ISO format
        const logFound = logs.find(l => {
            const logDate = l.date.includes('T') ? l.date.split('T')[0] : l.date;
            return logDate === dateStr;
        });

        days.push({
            date: d,
            hasWorkout: !!logFound,
            intensity: logFound ? (logFound.completedExercises.length > 4 ? 2 : 1) : 0
        });
    }
    return days;
};

// --- GAMIFICATION & ADVANCED CHARTS ---

export const calculateLevel = (logs: WorkoutLog[]) => {
    const totalVol = calculateTotalVolume(logs);
    const workoutCount = logs.length;

    // Base XP formula: volume matters, but consistency matters too
    const xp = Math.floor((totalVol / 500) + (workoutCount * 100));

    // Level formula: progressive difficulty
    // Level 1 = 0 XP
    // Level 2 = 200 XP
    // Level 5 = ~3200 XP
    const level = Math.floor(Math.sqrt(xp / 50)) + 1;

    const currentLevelBaseXp = 50 * Math.pow(level - 1, 2);
    const nextLevelBaseXp = 50 * Math.pow(level, 2);
    const levelProgress = Math.min(100, Math.max(0, ((xp - currentLevelBaseXp) / (nextLevelBaseXp - currentLevelBaseXp)) * 100));

    let title = "Уровень 1";
    if (level >= 3) title = "Уровень 2";
    if (level >= 6) title = "Уровень 3";
    if (level >= 10) title = "Уровень 4";
    if (level >= 15) title = "Уровень 5";
    if (level >= 25) title = "Уровень 6";

    return { level, title, xp, levelProgress, nextLevelBaseXp: Math.floor(nextLevelBaseXp) };
};

export const getStrengthProgression = (logs: WorkoutLog[]): { data: any[], exercises: string[] } => {
    if (!logs || logs.length === 0) return { data: [], exercises: [] };

    // Собираем статистику по упражнениям: сколько раз выполнялось и макс вес
    const exerciseStats: Map<string, { count: number, maxWeight: number }> = new Map();

    logs.forEach(log => {
        if (!log.completedExercises) return;
        log.completedExercises.forEach(ex => {
            if (!ex.completedSets || ex.isWarmup) return;
            const maxWeight = Math.max(...ex.completedSets.map(s => s?.weight || 0));
            if (maxWeight > 0) {
                const current = exerciseStats.get(ex.name) || { count: 0, maxWeight: 0 };
                exerciseStats.set(ex.name, {
                    count: current.count + 1,
                    maxWeight: Math.max(current.maxWeight, maxWeight)
                });
            }
        });
    });

    // Берем TOP-3 упражнения (по частоте, потом по весу)
    const topExercises = [...exerciseStats.entries()]
        .filter(([_, stats]) => stats.count >= 2) // Минимум 2 раза для показа прогресса
        .sort((a, b) => {
            if (b[1].count !== a[1].count) return b[1].count - a[1].count;
            return b[1].maxWeight - a[1].maxWeight;
        })
        .slice(0, 3)
        .map(([name]) => name);

    if (topExercises.length === 0) return { data: [], exercises: [] };

    // Строим progression для выбранных упражнений
    const result: any[] = [];
    const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedLogs.forEach(log => {
        if (!log.completedExercises) return;
        const entry: any = { date: new Date(log.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) };
        let hasData = false;

        topExercises.forEach((exName, idx) => {
            const exercise = log.completedExercises.find(ex => ex.name === exName);
            if (exercise && exercise.completedSets) {
                const bestSet = exercise.completedSets.reduce((best, curr) =>
                    ((curr?.weight || 0) > (best?.weight || 0)) ? curr : best
                    , { weight: 0, reps: 0 });

                if (bestSet && bestSet.weight > 0 && bestSet.reps > 0) {
                    entry[`ex${idx}`] = Math.round(calculateE1RM(bestSet.weight, bestSet.reps));
                    hasData = true;
                }
            }
        });

        if (hasData) result.push(entry);
    });

    return { data: result, exercises: topExercises };
};

// --- WEIGHT PROGRESSION TRACKING ---

export interface WeightProgressionEntry {
    exerciseName: string;
    exerciseNameRu: string;
    currentWeight: number;
    previousWeight: number;
    firstWeight: number;
    changeFromPrevious: number;
    changeFromFirst: number;
    trend: 'up' | 'down' | 'stable';
    dataPoints: { date: string; weight: number }[];
}

/**
 * Calculates weight progression for key exercises
 * Focus on consistency and dynamics, not just records
 */
export const calculateWeightProgression = (logs: WorkoutLog[]): WeightProgressionEntry[] => {
    // Collect weights for each exercise
    const exerciseData: Record<string, { name: string; dataPoints: { date: string; weight: number }[] }> = {};

    // Sort logs by date (old to new)
    const sortedLogs = [...logs].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedLogs.forEach(log => {
        if (!log.completedExercises) return;

        log.completedExercises.forEach(ex => {
            if (ex.isWarmup || !ex.completedSets?.length) return;

            const matchedLift = findMatchingLift(ex.name);
            if (!matchedLift) return;

            // Get max working weight from set
            const maxWeight = Math.max(
                ...ex.completedSets
                    .filter(s => s && s.weight > 0)
                    .map(s => s.weight)
            );

            if (maxWeight > 0) {
                if (!exerciseData[matchedLift.groupKey]) {
                    exerciseData[matchedLift.groupKey] = {
                        name: ex.name,
                        dataPoints: []
                    };
                }

                exerciseData[matchedLift.groupKey].dataPoints.push({
                    date: log.date,
                    weight: maxWeight
                });
            }
        });
    });

    // Build result
    const result: WeightProgressionEntry[] = [];

    Object.entries(exerciseData).forEach(([groupKey, data]) => {
        const points = data.dataPoints;
        if (points.length < 2) return; // Need at least 2 points for trend

        const currentWeight = points[points.length - 1].weight;
        const previousWeight = points[points.length - 2].weight;
        const firstWeight = points[0].weight;

        const changeFromPrevious = currentWeight - previousWeight;
        const changeFromFirst = currentWeight - firstWeight;

        // Determine trend: stable if change < 2.5 kg
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (changeFromPrevious >= 2.5) trend = 'up';
        else if (changeFromPrevious <= -2.5) trend = 'down';

        result.push({
            exerciseName: data.name,
            exerciseNameRu: EXERCISE_NAMES_RU[groupKey] || data.name,
            currentWeight,
            previousWeight,
            firstWeight,
            changeFromPrevious,
            changeFromFirst,
            trend,
            dataPoints: points
        });
    });

    // Sort by absolute progress from start
    return result.sort((a, b) => Math.abs(b.changeFromFirst) - Math.abs(a.changeFromFirst));
};

export const getVolumeDistribution = (logs: WorkoutLog[]) => {
    const distribution = { Push: 0, Pull: 0, Legs: 0, Core: 0 };

    logs.forEach(log => {
        log.completedExercises.forEach(ex => {
            const vol = ex.completedSets.reduce((s, c) => s + (c.weight * c.reps), 0);
            const n = ex.name.toLowerCase();

            if (n.includes('squat') || n.includes('leg') || n.includes('deadlift') || n.includes('calf') || n.includes('glute') || n.includes('присед') || n.includes('тяга') || n.includes('выпады')) {
                distribution.Legs += vol;
            } else if (n.includes('bench') || n.includes('press') || n.includes('push') || n.includes('tricep') || n.includes('dip') || n.includes('жим') || n.includes('отжимания')) {
                distribution.Push += vol;
            } else if (n.includes('row') || n.includes('pull') || n.includes('curl') || n.includes('lat') || n.includes('shrug') || n.includes('бицепс') || n.includes('подтягивания')) {
                distribution.Pull += vol;
            } else {
                distribution.Core += vol; // Catch-all/Core
            }
        });
    });

    // Format for Recharts Pie
    return Object.keys(distribution)
        .filter(k => (distribution as any)[k] > 0)
        .map(k => ({ name: k, value: (distribution as any)[k] }));
};

// Prediction Logic for Onboarding
export const calculateProjectedOutcome = (currentWeight: number, targetWeight: number): {
    months: number;
    completionDate: string;
    weeklyChange: number;
} | null => {
    if (!targetWeight || currentWeight === targetWeight) return null;

    const diff = currentWeight - targetWeight;
    const isWeightLoss = diff > 0;

    // Conservative estimates based on standard health recommendations (0.5-0.7kg per week)
    const weeklyRate = isWeightLoss ? 0.6 : 0.3; // kg per week
    const weeksNeeded = Math.abs(diff) / weeklyRate;
    const months = Math.ceil(weeksNeeded / 4);

    const today = new Date();
    today.setDate(today.getDate() + (weeksNeeded * 7));

    const monthName = today.toLocaleDateString('ru-RU', { month: 'long' });
    const completionDate = `к ${today.getDate()} ${monthName} ${today.getFullYear()}`;

    return {
        months,
        completionDate,
        weeklyChange: weeklyRate
    };
}

export const calculateWeeklyProgress = (logs: WorkoutLog[]): number => {
    const today = new Date();
    const [currentYear, currentWeek] = getWeekNumber(today);

    let count = 0;
    logs.forEach(log => {
        const [y, w] = getWeekNumber(new Date(log.date));
        if (y === currentYear && w === currentWeek) {
            count++;
        }
    });
    return count;
};

export const getMuscleFocus = (session: WorkoutSession): string[] => {
    const name = session.name.toLowerCase();
    const exNames = session.exercises.map(e => e.name.toLowerCase()).join(' ');

    const focus = new Set<string>();

    if (name.includes('upper') || name.includes('верх')) {
        focus.add('Грудь');
        focus.add('Спина');
    } else if (name.includes('lower') || name.includes('низ') || name.includes('legs') || name.includes('ног')) {
        focus.add('Ноги');
        focus.add('Ягодицы');
    } else if (name.includes('full') || name.includes('фул')) {
        focus.add('Все тело');
    } else if (name.includes('push') || name.includes('тяни')) {
        focus.add('Грудь');
        focus.add('Плечи');
        focus.add('Трицепс');
    } else if (name.includes('pull') || name.includes('толкай')) {
        focus.add('Спина');
        focus.add('Бицепс');
    }

    // Fallback if name is generic
    if (focus.size === 0) {
        if (exNames.includes('bench') || exNames.includes('жим') || exNames.includes('push')) focus.add('Грудь');
        if (exNames.includes('squat') || exNames.includes('присед') || exNames.includes('leg')) focus.add('Ноги');
        if (exNames.includes('pull') || exNames.includes('row') || exNames.includes('тяга')) focus.add('Спина');
    }

    return Array.from(focus).slice(0, 3);
};

// --- PROGRESS INSIGHTS ---

export interface WeekComparison {
    currentWeekVolume: number;
    previousWeekVolume: number;
    currentWeekDays: number;
    previousWeekDays: number;
    currentWeekAvgPerDay: number;
    previousWeekAvgPerDay: number;
    changePercent: number;
    trend: 'up' | 'down' | 'same';
}

export const calculateWeekComparison = (logs: WorkoutLog[]): WeekComparison => {
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
    currentWeekStart.setHours(0, 0, 0, 0);

    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setMilliseconds(-1);

    let currentWeekVolume = 0;
    let previousWeekVolume = 0;

    // Use Set to count unique workout days
    const currentWeekDates = new Set<string>();
    const previousWeekDates = new Set<string>();

    logs.forEach(log => {
        const logDate = new Date(log.date);
        const volume = calculateWorkoutVolume(log);
        const dateStr = logDate.toISOString().split('T')[0];

        if (logDate >= currentWeekStart) {
            currentWeekVolume += volume;
            currentWeekDates.add(dateStr);
        } else if (logDate >= previousWeekStart && logDate <= previousWeekEnd) {
            previousWeekVolume += volume;
            previousWeekDates.add(dateStr);
        }
    });

    const currentWeekDays = currentWeekDates.size;
    const previousWeekDays = previousWeekDates.size;

    // Average volume per day (protect against division by 0)
    const currentWeekAvgPerDay = currentWeekDays > 0 ? currentWeekVolume / currentWeekDays : 0;
    const previousWeekAvgPerDay = previousWeekDays > 0 ? previousWeekVolume / previousWeekDays : 0;

    // Compare by AVERAGE per day, not total volume
    const changePercent = previousWeekAvgPerDay > 0
        ? Math.round(((currentWeekAvgPerDay - previousWeekAvgPerDay) / previousWeekAvgPerDay) * 100)
        : 0;

    return {
        currentWeekVolume,
        previousWeekVolume,
        currentWeekDays,
        previousWeekDays,
        currentWeekAvgPerDay,
        previousWeekAvgPerDay,
        changePercent,
        trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'same'
    };
};

export interface NextScheduledDay {
    date: Date;
    dayName: string;
    daysUntil: number;
}

export const getNextScheduledDay = (preferredDays: number[]): NextScheduledDay | null => {
    if (!preferredDays || preferredDays.length === 0) return null;

    const today = new Date();
    const todayDay = today.getDay();

    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const sortedDays = [...preferredDays].sort((a, b) => a - b);

    // Find next scheduled day
    for (let i = 0; i < 7; i++) {
        const checkDay = (todayDay + i) % 7;
        if (sortedDays.includes(checkDay)) {
            const nextDate = new Date(today);
            nextDate.setDate(today.getDate() + i);
            return {
                date: nextDate,
                dayName: dayNames[checkDay],
                daysUntil: i
            };
        }
    }

    return null;
};
