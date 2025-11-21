import { WorkoutLog, PersonalRecord, ReadinessData, Exercise } from '../types';

// Helper to get the ISO week number for a date
const getWeekNumber = (d: Date): [number, number] => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return [d.getUTCFullYear(), weekNo];
};

export const calculateStreaks = (logs: WorkoutLog[]): { currentStreak: number; bestStreak: number } => {
  if (logs.length === 0) return { currentStreak: 0, bestStreak: 0 };

  const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const uniqueWeeks = new Set<string>();
  sortedLogs.forEach(log => {
      const [year, week] = getWeekNumber(new Date(log.date));
      uniqueWeeks.add(`${year}-${week}`);
  });

  const sortedWeeks = Array.from(uniqueWeeks).sort();
  if (sortedWeeks.length === 0) return { currentStreak: 0, bestStreak: 0 };

  let currentStreak = 0;
  let bestStreak = 0;

  // Check if the current week has a workout
  const [currentYear, currentWeekNum] = getWeekNumber(new Date());
  const [lastWorkoutYear, lastWorkoutWeekNum] = getWeekNumber(new Date(sortedLogs[sortedLogs.length - 1].date));
  
  // Also check previous week for continuity
  const today = new Date();
  const lastWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  const [prevYear, prevWeekNum] = getWeekNumber(lastWeek);

  if (`${lastWorkoutYear}-${lastWorkoutWeekNum}` === `${currentYear}-${currentWeekNum}` || 
      `${lastWorkoutYear}-${lastWorkoutWeekNum}` === `${prevYear}-${prevWeekNum}`) {
      currentStreak = 1;
  }
  
  for (let i = sortedWeeks.length - 1; i > 0; i--) {
      const [year1, week1] = sortedWeeks[i].split('-').map(Number);
      const [year2, week2] = sortedWeeks[i - 1].split('-').map(Number);

      let isConsecutive = false;
      if (year1 === year2) {
          isConsecutive = week1 === week2 + 1;
      } else if (year1 === year2 + 1) {
          // Handle year-end transition, check if week 52/53 is followed by week 1
          isConsecutive = week1 === 1 && (week2 === 52 || week2 === 53);
      }

      if (isConsecutive) {
        if(currentStreak > 0) currentStreak++; // only increment current streak if it's "live"
      } else {
        break; // break the current streak count
      }
  }

  // Calculate best streak
  if (sortedWeeks.length > 0) {
    let longest = 1;
    let current = 1;
    for (let i = 1; i < sortedWeeks.length; i++) {
        const [year1, week1] = sortedWeeks[i].split('-').map(Number);
        const [year2, week2] = sortedWeeks[i-1].split('-').map(Number);
        let isConsecutive = false;
        if (year1 === year2) {
            isConsecutive = week1 === week2 + 1;
        } else if (year1 === year2 + 1) {
            isConsecutive = week1 === 1 && (week2 === 52 || week2 === 53);
        }

        if(isConsecutive) {
            current++;
        } else {
            longest = Math.max(longest, current);
            current = 1;
        }
    }
    bestStreak = Math.max(longest, current);
  }


  return { currentStreak, bestStreak };
};

export const calculateWorkoutVolume = (log: WorkoutLog): number => {
    return log.completedExercises.reduce((totalVol, ex) => {
        const exerciseVol = ex.completedSets.reduce((vol, set) => vol + set.reps * set.weight, 0);
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

export const calculatePersonalRecords = (logs: WorkoutLog[]): PersonalRecord[] => {
    const KEY_LIFTS = ['squat', 'bench', 'deadlift', 'overhead press', 'press', 'row', 'pull up'];
    const records: { [key: string]: PersonalRecord } = {};

    logs.forEach(log => {
        log.completedExercises.forEach(ex => {
            const exerciseNameLower = ex.name.toLowerCase();
            const keyLift = KEY_LIFTS.find(lift => exerciseNameLower.includes(lift));
            
            if (keyLift) {
                const bestSet = ex.completedSets.reduce((best, current) => {
                    if (!current || typeof current.weight !== 'number' || typeof current.reps !== 'number') return best;
                    return (current.weight > best.weight) ? current : best;
                }, { weight: 0, reps: 0 });

                if (bestSet.weight > 0 && bestSet.reps > 0) {
                    const e1rm = calculateE1RM(bestSet.weight, bestSet.reps);
                    
                    // Normalize name but keep original flavor if possible
                    const normalizedName = ex.name; 

                    if (!records[keyLift] || e1rm > records[keyLift].e1rm) {
                        records[keyLift] = {
                            exerciseName: normalizedName, 
                            e1rm,
                            date: log.date
                        };
                    }
                }
            }
        });
    });

    return Object.values(records).sort((a,b) => b.e1rm - a.e1rm);
};

export const calculateReadinessScore = (sleep: number, food: number, stress: number, soreness: number): ReadinessData => {
    const score = sleep + food + stress + soreness;
    let status: ReadinessData['status'] = 'Green';
    if (score < 12) status = 'Red';
    else if (score <= 15) status = 'Yellow';

    return { sleep, food, stress, soreness, score, status };
};

export const generateWarmupSets = (workingWeight: number): Exercise[] => {
    if (workingWeight <= 20) return [];

    const warmups: Exercise[] = [];
    
    warmups.push({
        name: "Warm-up: Empty Bar / Light",
        sets: 1,
        reps: "10",
        weight: 20, 
        rest: 45,
        isWarmup: true
    });

    if (workingWeight > 40) {
        warmups.push({
            name: "Warm-up: 50%",
            sets: 1,
            reps: "5",
            weight: Math.round((workingWeight * 0.5) / 2.5) * 2.5,
            rest: 60,
            isWarmup: true
        });
    }

    if (workingWeight > 60) {
        warmups.push({
            name: "Warm-up: 75%",
            sets: 1,
            reps: "3",
            weight: Math.round((workingWeight * 0.75) / 2.5) * 2.5,
            rest: 90,
            isWarmup: true
        });
    }
    
    if (workingWeight > 100) {
        warmups.push({
            name: "Warm-up: 90% (Single)",
            sets: 1,
            reps: "1",
            weight: Math.round((workingWeight * 0.9) / 2.5) * 2.5,
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
    const cleanName = exerciseName.replace("Warm-up: ", "");
    
    for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i];
        const exLog = log.completedExercises.find(e => 
            e.name.toLowerCase().includes(cleanName.toLowerCase()) && !e.isWarmup
        );

        if (exLog && exLog.completedSets.length > 0) {
            const bestSet = exLog.completedSets.reduce((prev, current) => {
                return (current.weight > prev.weight) ? current : prev;
            });
            
            if(bestSet.weight > 0) {
                return `${bestSet.weight}kg x ${bestSet.reps}`;
            }
        }
    }
    return null;
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
            
            if (n.includes('leg curl')) { 
                patterns.Hinge++; 
                return; 
            }
            if (n.includes('leg extension')) { 
                patterns.Squat++; 
                return; 
            }

            if (n.includes('squat') || n.includes('leg press') || n.includes('lunge') || n.includes('step up') || n.includes('bulgarian') || n.includes('hack') || n.includes('goblet')) {
                patterns.Squat++;
            } else if (n.includes('deadlift') || n.includes('rdl') || n.includes('clean') || n.includes('snatch') || n.includes('swing') || n.includes('good morning') || n.includes('hip thrust') || n.includes('glute')) {
                patterns.Hinge++;
            } else if (n.includes('bench') || n.includes('press') || n.includes('push') || n.includes('dip') || n.includes('fly') || n.includes('raise') || n.includes('tricep') || n.includes('skullcrusher') || n.includes('extension')) {
                patterns.Push++;
            } else if (n.includes('row') || n.includes('pull') || n.includes('chin') || n.includes('lat') || n.includes('curl') || n.includes('shrug') || n.includes('bicep')) {
                patterns.Pull++;
            } else if (n.includes('plank') || n.includes('crunch') || n.includes('sit up') || n.includes('leg raise') || n.includes('ab ') || n.includes('hollow') || n.includes('russian')) {
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
    for(let i=27; i>=0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toDateString();
        const logFound = logs.find(l => new Date(l.date).toDateString() === dateStr);
        
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

    let title = "Новичок";
    if (level >= 3) title = "Любитель";
    if (level >= 6) title = "Атлет";
    if (level >= 10) title = "Профи";
    if (level >= 15) title = "Машина";
    if (level >= 25) title = "Легенда";

    return { level, title, xp, levelProgress, nextLevelBaseXp: Math.floor(nextLevelBaseXp) };
};

export const getStrengthProgression = (logs: WorkoutLog[]) => {
    const result: any[] = [];
    
    // Only track main lifts
    const lifts = ['squat', 'bench', 'deadlift'];
    
    logs.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(log => {
        const entry: any = { date: new Date(log.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) };
        let hasData = false;

        lifts.forEach(lift => {
            // Find the best set for this lift in this log
            const exercise = log.completedExercises.find(ex => ex.name.toLowerCase().includes(lift));
            if (exercise) {
                const bestSet = exercise.completedSets.reduce((best, curr) => 
                    (curr.weight > best.weight) ? curr : best
                , { weight: 0, reps: 0 });
                
                if (bestSet.weight > 0) {
                    entry[lift] = calculateE1RM(bestSet.weight, bestSet.reps).toFixed(0);
                    hasData = true;
                }
            }
        });

        if (hasData) result.push(entry);
    });

    return result;
};

export const getVolumeDistribution = (logs: WorkoutLog[]) => {
    const distribution = { Push: 0, Pull: 0, Legs: 0, Core: 0 };

    logs.forEach(log => {
        log.completedExercises.forEach(ex => {
            const vol = ex.completedSets.reduce((s, c) => s + (c.weight * c.reps), 0);
            const n = ex.name.toLowerCase();

            if (n.includes('squat') || n.includes('leg') || n.includes('deadlift') || n.includes('calf') || n.includes('glute')) {
                distribution.Legs += vol;
            } else if (n.includes('bench') || n.includes('press') || n.includes('push') || n.includes('tricep') || n.includes('dip')) {
                distribution.Push += vol;
            } else if (n.includes('row') || n.includes('pull') || n.includes('curl') || n.includes('lat') || n.includes('shrug')) {
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