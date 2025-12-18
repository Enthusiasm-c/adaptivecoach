/**
 * Strength Analysis Utilities
 * Based on research from:
 * - PubMed 2024 Study (809,986 competition entries)
 * - Strength Level Standards
 * - Legion Athletics Standards
 */

import {
  WorkoutLog,
  Gender,
  StrengthLevel,
  StrengthAnalysis,
  ImbalanceReport,
  PainPattern,
  PlateauDetection,
  ExerciseSubstitution,
  ReadinessPattern,
  StrengthInsightsData,
} from '../types';

// === STRENGTH STANDARDS ===
// Based on relative strength (weight lifted / bodyweight)

interface StrengthStandard {
  exercise: string;
  aliases: string[];
  nameRu: string;
  movementPattern: 'push' | 'pull' | 'squat' | 'hinge' | 'core';
  standards: {
    male: { untrained: number; beginner: number; intermediate: number; advanced: number; elite: number };
    female: { untrained: number; beginner: number; intermediate: number; advanced: number; elite: number };
  };
}

export const STRENGTH_STANDARDS: StrengthStandard[] = [
  {
    exercise: 'squat',
    aliases: ['squat', 'приседания', 'присед', 'приседы', 'back squat', 'фронтальные приседания', 'goblet'],
    nameRu: 'Приседания',
    movementPattern: 'squat',
    standards: {
      male: { untrained: 0.75, beginner: 1.25, intermediate: 1.5, advanced: 2.0, elite: 2.5 },
      female: { untrained: 0.5, beginner: 0.75, intermediate: 1.0, advanced: 1.5, elite: 2.0 },
    },
  },
  {
    exercise: 'bench',
    aliases: ['bench', 'жим лежа', 'жим штанги лежа', 'жим гантелей лежа', 'bench press'],
    nameRu: 'Жим лежа',
    movementPattern: 'push',
    standards: {
      male: { untrained: 0.5, beginner: 1.0, intermediate: 1.25, advanced: 1.75, elite: 2.0 },
      female: { untrained: 0.35, beginner: 0.5, intermediate: 0.75, advanced: 1.0, elite: 1.35 },
    },
  },
  {
    exercise: 'deadlift',
    aliases: ['deadlift', 'становая тяга', 'становая', 'тяга', 'румынская тяга', 'rdl'],
    nameRu: 'Становая тяга',
    movementPattern: 'hinge',
    standards: {
      male: { untrained: 1.0, beginner: 1.5, intermediate: 2.0, advanced: 2.5, elite: 3.0 },
      female: { untrained: 0.75, beginner: 1.0, intermediate: 1.5, advanced: 2.0, elite: 2.5 },
    },
  },
  {
    exercise: 'ohp',
    aliases: ['overhead press', 'ohp', 'армейский жим', 'жим стоя', 'жим над головой', 'shoulder press'],
    nameRu: 'Жим стоя',
    movementPattern: 'push',
    standards: {
      male: { untrained: 0.35, beginner: 0.55, intermediate: 0.75, advanced: 1.0, elite: 1.25 },
      female: { untrained: 0.25, beginner: 0.35, intermediate: 0.5, advanced: 0.65, elite: 0.85 },
    },
  },
  {
    exercise: 'row',
    aliases: ['row', 'тяга к поясу', 'тяга штанги', 'тяга гантели', 'bent over row', 'barbell row'],
    nameRu: 'Тяга к поясу',
    movementPattern: 'pull',
    standards: {
      male: { untrained: 0.5, beginner: 0.75, intermediate: 1.0, advanced: 1.25, elite: 1.5 },
      female: { untrained: 0.35, beginner: 0.5, intermediate: 0.65, advanced: 0.85, elite: 1.0 },
    },
  },
];

// Ideal ratios for imbalance detection
export const IDEAL_RATIOS = {
  squat_to_bench: 1.33, // Squat should be ~1.33x bench
  deadlift_to_squat: 1.2, // Deadlift should be ~1.2x squat
  row_to_bench: 1.0, // Row should equal bench (push-pull balance)
  ohp_to_bench: 0.67, // OHP should be ~67% of bench
};

// === HELPER FUNCTIONS ===

/**
 * Calculate E1RM using Epley formula
 */
export const calculateE1RM = (weight: number, reps: number): number => {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
};

/**
 * Get best lift (highest E1RM) for a specific exercise from workout logs
 * Used for suggesting weights based on actual performance history
 */
export function getBestLiftForExercise(
  exerciseName: string,
  logs: WorkoutLog[]
): { weight: number; reps: number; e1rm: number } | null {
  const normalizedTarget = exerciseName.toLowerCase();

  let bestE1rm = 0;
  let bestLift: { weight: number; reps: number; e1rm: number } | null = null;

  for (const log of logs) {
    for (const ex of log.completedExercises) {
      // Skip warmup exercises
      if (ex.isWarmup) continue;

      const normalizedName = ex.name.toLowerCase();
      // Fuzzy match - check if names contain each other
      if (normalizedName.includes(normalizedTarget) ||
          normalizedTarget.includes(normalizedName) ||
          // Also try to match by removing common suffixes
          normalizedName.replace(/\s*(со штангой|с гантел\w*|на тренажере|в кроссовере)\s*/gi, '').includes(normalizedTarget.replace(/\s*(со штангой|с гантел\w*|на тренажере|в кроссовере)\s*/gi, ''))) {

        for (const set of ex.completedSets) {
          if (set.weight && set.reps && set.reps > 0) {
            const e1rm = calculateE1RM(set.weight, set.reps);
            if (e1rm > bestE1rm) {
              bestE1rm = e1rm;
              bestLift = { weight: set.weight, reps: set.reps, e1rm };
            }
          }
        }
      }
    }
  }

  return bestLift;
}

/**
 * Calculate relative strength (e1rm / bodyweight)
 */
export const calculateRelativeStrength = (e1rm: number, bodyweight: number): number => {
  if (bodyweight <= 0) return 0;
  return Math.round((e1rm / bodyweight) * 100) / 100;
};

/**
 * Find matching strength standard for an exercise
 */
export const findStandardForExercise = (exerciseName: string): StrengthStandard | null => {
  const name = exerciseName.toLowerCase();
  return STRENGTH_STANDARDS.find(s =>
    s.aliases.some(alias => name.includes(alias.toLowerCase()))
  ) || null;
};

/**
 * Get strength level based on relative strength
 */
export const getStrengthLevel = (
  relativeStrength: number,
  standard: StrengthStandard,
  gender: Gender
): StrengthLevel => {
  const levels = gender === Gender.Male ? standard.standards.male : standard.standards.female;

  if (relativeStrength >= levels.elite) return 'elite';
  if (relativeStrength >= levels.advanced) return 'advanced';
  if (relativeStrength >= levels.intermediate) return 'intermediate';
  if (relativeStrength >= levels.beginner) return 'beginner';
  return 'untrained';
};

/**
 * Calculate percentile within current level
 */
export const calculatePercentile = (
  relativeStrength: number,
  standard: StrengthStandard,
  gender: Gender
): number => {
  const levels = gender === Gender.Male ? standard.standards.male : standard.standards.female;
  const thresholds = [levels.untrained, levels.beginner, levels.intermediate, levels.advanced, levels.elite];

  for (let i = 0; i < thresholds.length - 1; i++) {
    if (relativeStrength < thresholds[i + 1]) {
      const range = thresholds[i + 1] - thresholds[i];
      const position = relativeStrength - thresholds[i];
      const percentInLevel = (position / range) * 20; // Each level is 20%
      return Math.round((i * 20) + percentInLevel);
    }
  }
  return 100;
};

/**
 * Calculate target weight for next level
 */
export const getNextLevelTarget = (
  currentE1rm: number,
  bodyweight: number,
  standard: StrengthStandard,
  gender: Gender,
  currentLevel: StrengthLevel
): number => {
  const levels = gender === Gender.Male ? standard.standards.male : standard.standards.female;
  const levelOrder: StrengthLevel[] = ['untrained', 'beginner', 'intermediate', 'advanced', 'elite'];
  const currentIdx = levelOrder.indexOf(currentLevel);

  if (currentIdx >= levelOrder.length - 1) return currentE1rm; // Already elite

  const nextLevelRatio = levels[levelOrder[currentIdx + 1] as keyof typeof levels];
  return Math.round(nextLevelRatio * bodyweight);
};

// === MAIN ANALYSIS FUNCTIONS ===

/**
 * Get best E1RM for each key exercise from workout logs
 */
export const getBestLifts = (logs: WorkoutLog[]): Map<string, { e1rm: number; date: string; trend: 'improving' | 'stable' | 'declining' }> => {
  const lifts = new Map<string, { e1rm: number; date: string; history: { e1rm: number; date: string }[] }>();

  // Sort logs by date (oldest first)
  const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedLogs.forEach(log => {
    log.completedExercises?.forEach(ex => {
      if (ex.isWarmup) return;

      const standard = findStandardForExercise(ex.name);
      if (!standard) return;

      // Find best set in this exercise
      const bestSet = ex.completedSets?.reduce<{ e1rm: number; weight: number; reps: number }>((best, set) => {
        if (!set || typeof set.weight !== 'number' || typeof set.reps !== 'number') return best;
        const e1rm = calculateE1RM(set.weight, set.reps);
        return e1rm > best.e1rm ? { e1rm, weight: set.weight, reps: set.reps } : best;
      }, { e1rm: 0, weight: 0, reps: 0 });

      if (bestSet && bestSet.e1rm > 0) {
        const key = standard.exercise;
        const existing = lifts.get(key);

        if (!existing) {
          lifts.set(key, {
            e1rm: bestSet.e1rm,
            date: log.date,
            history: [{ e1rm: bestSet.e1rm, date: log.date }]
          });
        } else {
          existing.history.push({ e1rm: bestSet.e1rm, date: log.date });
          if (bestSet.e1rm > existing.e1rm) {
            existing.e1rm = bestSet.e1rm;
            existing.date = log.date;
          }
        }
      }
    });
  });

  // Calculate trends
  const result = new Map<string, { e1rm: number; date: string; trend: 'improving' | 'stable' | 'declining' }>();

  lifts.forEach((data, key) => {
    let trend: 'improving' | 'stable' | 'declining' = 'stable';

    // Require at least 6 data points for meaningful trend analysis
    if (data.history.length >= 6) {
      // Split at midpoint for proper comparison
      const midpoint = Math.floor(data.history.length / 2);
      const older = data.history.slice(0, midpoint);
      const recent = data.history.slice(midpoint);

      if (older.length > 0 && recent.length > 0) {
        const avgOlder = older.reduce((sum, h) => sum + h.e1rm, 0) / older.length;
        const avgRecent = recent.reduce((sum, h) => sum + h.e1rm, 0) / recent.length;

        // Prevent division by zero
        const change = avgOlder === 0 ? 0 : (avgRecent - avgOlder) / avgOlder;

        if (change > 0.05) trend = 'improving';
        else if (change < -0.05) trend = 'declining';
      }
    }

    result.set(key, { e1rm: data.e1rm, date: data.date, trend });
  });

  return result;
};

/**
 * Analyze strength for all key lifts
 */
export const analyzeStrength = (
  logs: WorkoutLog[],
  bodyweight: number,
  gender: Gender
): StrengthAnalysis[] => {
  const bestLifts = getBestLifts(logs);
  const analysis: StrengthAnalysis[] = [];

  STRENGTH_STANDARDS.forEach(standard => {
    const lift = bestLifts.get(standard.exercise);
    if (!lift) return;

    const relativeStrength = calculateRelativeStrength(lift.e1rm, bodyweight);
    const level = getStrengthLevel(relativeStrength, standard, gender);
    const percentile = calculatePercentile(relativeStrength, standard, gender);
    const nextTarget = getNextLevelTarget(lift.e1rm, bodyweight, standard, gender, level);

    analysis.push({
      exerciseName: standard.exercise,
      exerciseNameRu: standard.nameRu,
      e1rm: lift.e1rm,
      relativeStrength,
      level,
      percentile,
      nextLevelTarget: nextTarget,
      trend: lift.trend,
    });
  });

  return analysis;
};

/**
 * Detect muscle imbalances based on lift ratios
 */
export const detectImbalances = (strengthAnalysis: StrengthAnalysis[]): ImbalanceReport[] => {
  const imbalances: ImbalanceReport[] = [];

  const getE1rm = (name: string) => strengthAnalysis.find(s => s.exerciseName === name)?.e1rm || 0;

  const squat = getE1rm('squat');
  const bench = getE1rm('bench');
  const deadlift = getE1rm('deadlift');
  const row = getE1rm('row');
  const ohp = getE1rm('ohp');

  // Check squat to bench ratio
  if (squat > 0 && bench > 0) {
    const ratio = squat / bench;
    const ideal = IDEAL_RATIOS.squat_to_bench;
    const deviation = Math.abs(ratio - ideal) / ideal;

    if (deviation > 0.25) {
      const isLegDominant = ratio > ideal;
      imbalances.push({
        type: 'ratio',
        description: isLegDominant
          ? 'Ноги значительно сильнее верха тела'
          : 'Верх тела непропорционально силён относительно ног',
        severity: deviation > 0.35 ? 'severe' : 'moderate',
        recommendation: isLegDominant
          ? 'Добавьте больше жимовых движений (жим лёжа, отжимания на брусьях)'
          : 'Увеличьте объём приседаний и выпадов',
        relatedExercises: isLegDominant ? ['Жим лежа', 'Жим гантелей'] : ['Приседания', 'Выпады'],
      });
    }
  }

  // Check deadlift to squat ratio
  if (deadlift > 0 && squat > 0) {
    const ratio = deadlift / squat;
    const ideal = IDEAL_RATIOS.deadlift_to_squat;
    const deviation = Math.abs(ratio - ideal) / ideal;

    if (deviation > 0.25) {
      const isHingeDominant = ratio > ideal;
      imbalances.push({
        type: 'anterior_posterior',
        description: isHingeDominant
          ? 'Ягодицы и бицепс бедра сильнее квадрицепсов'
          : 'Квадрицепсы сильнее ягодиц и бицепса бедра',
        severity: deviation > 0.35 ? 'severe' : 'moderate',
        recommendation: isHingeDominant
          ? 'Добавьте фронтальные приседания и leg press'
          : 'Увеличьте объём становой тяги и румынской тяги',
        relatedExercises: isHingeDominant ? ['Приседания', 'Leg press'] : ['Становая тяга', 'RDL'],
      });
    }
  }

  // Check push/pull balance (row to bench)
  if (row > 0 && bench > 0) {
    const ratio = row / bench;
    const ideal = IDEAL_RATIOS.row_to_bench;
    const deviation = Math.abs(ratio - ideal) / ideal;

    if (deviation > 0.2) {
      const isPushDominant = ratio < ideal;
      imbalances.push({
        type: 'push_pull',
        description: isPushDominant
          ? 'Жимовые движения сильнее тяговых — риск проблем с осанкой'
          : 'Тяговые движения доминируют над жимовыми',
        severity: isPushDominant && deviation > 0.3 ? 'severe' : 'moderate',
        recommendation: isPushDominant
          ? 'Критично! Добавьте тяги: к поясу, горизонтальные, подтягивания'
          : 'Можно добавить жимовые упражнения для баланса',
        relatedExercises: isPushDominant
          ? ['Тяга к поясу', 'Подтягивания', 'Тяга в наклоне']
          : ['Жим лежа', 'Жим гантелей', 'Отжимания'],
      });
    }
  }

  return imbalances;
};

/**
 * Analyze pain patterns from workout feedback
 */
export const analyzePainPatterns = (logs: WorkoutLog[]): PainPattern[] => {
  const painMap = new Map<string, { count: number; dates: string[]; exercises: Set<string> }>();

  logs.forEach(log => {
    if (log.feedback?.pain?.hasPain && log.feedback.pain.location) {
      const location = log.feedback.pain.location.toLowerCase();
      const existing = painMap.get(location) || { count: 0, dates: [], exercises: new Set<string>() };

      existing.count++;
      existing.dates.push(log.date);
      log.completedExercises?.forEach(ex => existing.exercises.add(ex.name));

      painMap.set(location, existing);
    }
  });

  const patterns: PainPattern[] = [];

  painMap.forEach((data, location) => {
    if (data.count >= 2) { // Only report if pain occurred multiple times
      // Determine movement pattern based on exercises
      const exerciseList = Array.from(data.exercises);
      let movementPattern = 'общий';

      if (exerciseList.some(e => e.toLowerCase().includes('жим') || e.toLowerCase().includes('press'))) {
        movementPattern = 'жимовые';
      } else if (exerciseList.some(e => e.toLowerCase().includes('тяга') || e.toLowerCase().includes('pull'))) {
        movementPattern = 'тяговые';
      } else if (exerciseList.some(e => e.toLowerCase().includes('присед') || e.toLowerCase().includes('squat'))) {
        movementPattern = 'приседания';
      }

      patterns.push({
        location,
        frequency: data.count,
        lastOccurrence: data.dates[data.dates.length - 1],
        associatedExercises: exerciseList.slice(0, 5),
        movementPattern,
      });
    }
  });

  return patterns.sort((a, b) => b.frequency - a.frequency);
};

/**
 * Detect plateaus (no progress for 3+ weeks)
 */
export const detectPlateaus = (logs: WorkoutLog[], weeksThreshold: number = 3): PlateauDetection[] => {
  const plateaus: PlateauDetection[] = [];
  const exerciseHistory = new Map<string, { e1rm: number; date: string }[]>();

  // Sort logs by date
  const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedLogs.forEach(log => {
    log.completedExercises?.forEach(ex => {
      if (ex.isWarmup) return;

      const bestSet = ex.completedSets?.reduce((best, set) => {
        if (!set) return best;
        const e1rm = calculateE1RM(set.weight || 0, set.reps || 0);
        return e1rm > best ? e1rm : best;
      }, 0);

      if (bestSet > 0) {
        const history = exerciseHistory.get(ex.name) || [];
        history.push({ e1rm: bestSet, date: log.date });
        exerciseHistory.set(ex.name, history);
      }
    });
  });

  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  exerciseHistory.forEach((history, exerciseName) => {
    if (history.length < 4) return; // Need enough data

    // Find the last PR
    let maxE1rm = 0;
    let prDate = '';

    history.forEach(h => {
      if (h.e1rm > maxE1rm) {
        maxE1rm = h.e1rm;
        prDate = h.date;
      }
    });

    // Check if PR is older than threshold
    const prTime = new Date(prDate).getTime();
    const weeksSincePR = Math.floor((now.getTime() - prTime) / msPerWeek);

    if (weeksSincePR >= weeksThreshold) {
      const currentE1rm = history[history.length - 1].e1rm;

      plateaus.push({
        exerciseName,
        weeksStuck: weeksSincePR,
        lastPR: prDate,
        currentE1rm,
      });
    }
  });

  return plateaus.sort((a, b) => b.weeksStuck - a.weeksStuck);
};

/**
 * Analyze readiness patterns
 */
export const analyzeReadinessPatterns = (logs: WorkoutLog[]): ReadinessPattern => {
  const readinessData = logs
    .filter(log => log.feedback?.readiness)
    .map(log => log.feedback.readiness!);

  if (readinessData.length === 0) {
    return {
      chronicLowSleep: false,
      highStress: false,
      averageSleep: 3,
      averageStress: 3,
      averageSoreness: 3,
    };
  }

  const avgSleep = readinessData.reduce((sum, r) => sum + r.sleep, 0) / readinessData.length;
  const avgStress = readinessData.reduce((sum, r) => sum + r.stress, 0) / readinessData.length;
  const avgSoreness = readinessData.reduce((sum, r) => sum + r.soreness, 0) / readinessData.length;

  return {
    chronicLowSleep: avgSleep < 2.5,
    highStress: avgStress < 2.5,
    averageSleep: Math.round(avgSleep * 10) / 10,
    averageStress: Math.round(avgStress * 10) / 10,
    averageSoreness: Math.round(avgSoreness * 10) / 10,
  };
};

/**
 * Get exercise substitution patterns from localStorage
 */
export const getSubstitutionPatterns = (): ExerciseSubstitution[] => {
  try {
    const data = localStorage.getItem('exerciseSubstitutions');
    if (!data) return [];

    const substitutions: ExerciseSubstitution[] = JSON.parse(data);
    return substitutions.filter(s => s.count >= 2).sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
};

/**
 * Record an exercise substitution
 */
export const recordSubstitution = (original: string, replacement: string): void => {
  try {
    const data = localStorage.getItem('exerciseSubstitutions');
    const substitutions: ExerciseSubstitution[] = data ? JSON.parse(data) : [];

    const existing = substitutions.find(s => s.original === original && s.replacement === replacement);

    if (existing) {
      existing.count++;
      existing.lastDate = new Date().toISOString();
    } else {
      substitutions.push({
        original,
        replacement,
        count: 1,
        lastDate: new Date().toISOString(),
      });
    }

    localStorage.setItem('exerciseSubstitutions', JSON.stringify(substitutions));
  } catch (e) {
    console.error('Failed to record substitution:', e);
  }
};

/**
 * Calculate overall strength level
 */
export const calculateOverallLevel = (strengthAnalysis: StrengthAnalysis[]): StrengthLevel => {
  if (strengthAnalysis.length === 0) return 'untrained';

  const levelOrder: StrengthLevel[] = ['untrained', 'beginner', 'intermediate', 'advanced', 'elite'];
  const avgIndex = strengthAnalysis.reduce((sum, s) => sum + levelOrder.indexOf(s.level), 0) / strengthAnalysis.length;

  return levelOrder[Math.round(avgIndex)];
};

/**
 * Generate complete strength insights data
 */
export const generateStrengthInsights = (
  logs: WorkoutLog[],
  bodyweight: number,
  gender: Gender
): Omit<StrengthInsightsData, 'aiInsights'> => {
  const strengthAnalysis = analyzeStrength(logs, bodyweight, gender);
  const imbalances = detectImbalances(strengthAnalysis);
  const painPatterns = analyzePainPatterns(logs);
  const plateaus = detectPlateaus(logs);
  const substitutions = getSubstitutionPatterns();
  const readinessPatterns = analyzeReadinessPatterns(logs);
  const overallLevel = calculateOverallLevel(strengthAnalysis);

  return {
    strengthAnalysis,
    imbalances,
    painPatterns,
    plateaus,
    substitutions,
    readinessPatterns,
    overallLevel,
    lastUpdated: new Date().toISOString(),
  };
};

/**
 * Get top N imbalances for dashboard display
 * Filters out minor imbalances and sorts by severity
 */
export const getTopImbalances = (
  logs: WorkoutLog[],
  bodyweight: number,
  gender: Gender,
  maxCount: number = 2
): ImbalanceReport[] => {
  if (logs.length < 5) return []; // Need minimum data

  const strengthAnalysis = analyzeStrength(logs, bodyweight, gender);
  const imbalances = detectImbalances(strengthAnalysis);

  // Severity order for sorting
  const severityOrder = (severity: 'minor' | 'moderate' | 'severe'): number => {
    switch (severity) {
      case 'severe': return 3;
      case 'moderate': return 2;
      case 'minor': return 1;
      default: return 0;
    }
  };

  return imbalances
    .filter(i => i.severity !== 'minor')
    .sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity))
    .slice(0, maxCount);
};

/**
 * Get imbalance icon and color for UI
 */
export const getImbalanceDisplay = (type: string, severity: string): {
  icon: string;
  color: string;
  bgColor: string;
  title: string;
} => {
  const severityColors = {
    severe: { color: 'text-red-400', bgColor: 'bg-red-500/10' },
    moderate: { color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    minor: { color: 'text-gray-400', bgColor: 'bg-gray-500/10' },
  };

  const typeInfo: { [key: string]: { icon: string; title: string } } = {
    push_pull: { icon: 'scale', title: 'Жим/Тяга' },
    anterior_posterior: { icon: 'scale', title: 'Ноги' },
    ratio: { icon: 'scale', title: 'Верх/Низ' },
  };

  const colors = severityColors[severity as keyof typeof severityColors] || severityColors.minor;
  const info = typeInfo[type] || { icon: 'alert-triangle', title: 'Дисбаланс' };

  return { ...colors, ...info };
};

// === LEVEL LABELS ===

export const LEVEL_LABELS: Record<StrengthLevel, { ru: string; color: string }> = {
  untrained: { ru: 'Новичок', color: 'text-gray-400' },
  beginner: { ru: 'Начинающий', color: 'text-green-400' },
  intermediate: { ru: 'Любитель', color: 'text-blue-400' },
  advanced: { ru: 'Атлет', color: 'text-purple-400' },
  elite: { ru: 'Элита', color: 'text-yellow-400' },
};
