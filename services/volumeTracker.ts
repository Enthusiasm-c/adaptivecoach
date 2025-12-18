/**
 * Volume Tracker Service
 *
 * Tracks weekly training volume per muscle group.
 * Compares actual volume vs recommended MEV/MRV based on experience level.
 *
 * Based on:
 * - Schoenfeld et al. (2017) - Volume recommendations
 * - RP Hypertrophy - MEV/MRV concepts
 */

import { WorkoutLog, ExperienceLevel as AppExperienceLevel } from '../types';
import { MUSCLE_GROUPS, MUSCLE_VOLUME_BY_EXPERIENCE, getMuscleGroup, getIndirectVolumeMultiplier } from '../data/muscleGroups';
import { ALL_EXERCISES, getExerciseById } from '../data/exerciseDatabase';
import { ExperienceLevel } from '../types/training';

// ==========================================
// TYPES
// ==========================================

export interface MuscleVolumeData {
  muscleId: string;
  muscleNameRu: string;
  directSets: number; // Sets directly targeting this muscle
  indirectSets: number; // Sets from synergist movements
  totalSets: number;
  targetMin: number; // MEV
  targetOptimal: number;
  targetMax: number; // MRV
  status: 'under' | 'optimal' | 'over';
  percentOfOptimal: number;
}

export interface WeeklyVolumeReport {
  weekStart: string;
  weekEnd: string;
  muscles: MuscleVolumeData[];
  overallStatus: 'needs_more' | 'optimal' | 'too_much' | 'mixed';
  undertrainedMuscles: string[];
  overtrainedMuscles: string[];
  recommendations: string[];
}

// ==========================================
// EXERCISE-TO-MUSCLE MAPPING
// ==========================================

// Map exercise names to muscle groups (for exercises not in database)
const EXERCISE_MUSCLE_MAP: { [keyword: string]: { primary: string; secondary?: string[] } } = {
  // Chest
  'жим': { primary: 'chest', secondary: ['triceps', 'shoulders'] },
  'жим лежа': { primary: 'chest', secondary: ['triceps', 'shoulders'] },
  'отжимания': { primary: 'chest', secondary: ['triceps', 'shoulders'] },
  'разводка': { primary: 'chest' },
  'кроссовер': { primary: 'chest' },
  'пуловер': { primary: 'chest', secondary: ['back'] },

  // Back
  'тяга штанги': { primary: 'back', secondary: ['biceps'] },
  'тяга гантели': { primary: 'back', secondary: ['biceps'] },
  'подтягивания': { primary: 'back', secondary: ['biceps'] },
  'тяга верхнего': { primary: 'back', secondary: ['biceps'] },
  'тяга нижнего': { primary: 'back', secondary: ['biceps'] },
  'гиперэкстензия': { primary: 'back', secondary: ['hamstrings', 'glutes'] },

  // Shoulders
  'жим стоя': { primary: 'shoulders', secondary: ['triceps'] },
  'жим сидя': { primary: 'shoulders', secondary: ['triceps'] },
  'махи': { primary: 'shoulders' },
  'разведение': { primary: 'shoulders' },

  // Biceps
  'сгибание': { primary: 'biceps' },
  'бицепс': { primary: 'biceps' },
  'молотки': { primary: 'biceps', secondary: ['forearms'] },

  // Triceps
  'разгибание': { primary: 'triceps' },
  'трицепс': { primary: 'triceps' },
  'французский': { primary: 'triceps' },
  'брусья': { primary: 'triceps', secondary: ['chest'] },

  // Legs
  'присед': { primary: 'quads', secondary: ['glutes', 'hamstrings'] },
  'приседания': { primary: 'quads', secondary: ['glutes', 'hamstrings'] },
  'выпады': { primary: 'quads', secondary: ['glutes'] },
  'жим ногами': { primary: 'quads', secondary: ['glutes'] },
  'разгибание ног': { primary: 'quads' },

  // Hamstrings
  'румынская': { primary: 'hamstrings', secondary: ['glutes'] },
  'мертвая тяга': { primary: 'hamstrings', secondary: ['back', 'glutes'] },
  'становая': { primary: 'hamstrings', secondary: ['back', 'glutes', 'quads'] },
  'сгибание ног': { primary: 'hamstrings' },

  // Glutes
  'ягодичный': { primary: 'glutes', secondary: ['hamstrings'] },
  'мостик': { primary: 'glutes', secondary: ['hamstrings'] },

  // Calves
  'икры': { primary: 'calves' },
  'подъем на носки': { primary: 'calves' },
  'голень': { primary: 'calves' },

  // Core
  'планка': { primary: 'core' },
  'пресс': { primary: 'core' },
  'скручивания': { primary: 'core' },
  'кор': { primary: 'core' },
};

/**
 * Normalize exercise name for matching
 * Removes common prefixes, suffixes and normalizes variations
 */
function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/разминка:\s*/i, '')
    .replace(/warm-?up:\s*/i, '')
    .replace(/со штангой|штанги|с гантел\w*|гантел\w*/gi, '')
    .replace(/на скамье|на тренажере|в тренажере/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two exercise names match (fuzzy matching)
 */
function exerciseNamesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeExerciseName(name1);
  const n2 = normalizeExerciseName(name2);

  // Exact match after normalization
  if (n1 === n2) return true;

  // One contains the other (for partial matches)
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Check if main words match (at least 2 common words)
  const words1 = n1.split(' ').filter(w => w.length > 2);
  const words2 = n2.split(' ').filter(w => w.length > 2);
  const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));

  return commonWords.length >= 2;
}

/**
 * Get muscle groups for an exercise by name
 */
function getMusclesForExercise(exerciseName: string): { primary: string; secondary: string[] } {
  const nameLower = normalizeExerciseName(exerciseName);

  // First, try to find in exercise database (fuzzy matching)
  const dbExercise = ALL_EXERCISES.find(e =>
    exerciseNamesMatch(e.name, exerciseName) || exerciseNamesMatch(e.nameEn, exerciseName)
  );

  if (dbExercise) {
    return {
      primary: dbExercise.primaryMuscle,
      secondary: dbExercise.secondaryMuscles || [],
    };
  }

  // Fallback to keyword matching
  for (const [keyword, muscles] of Object.entries(EXERCISE_MUSCLE_MAP)) {
    if (nameLower.includes(keyword)) {
      return {
        primary: muscles.primary,
        secondary: muscles.secondary || [],
      };
    }
  }

  // Default to unknown
  return { primary: 'unknown', secondary: [] };
}

// ==========================================
// MAIN FUNCTIONS
// ==========================================

/**
 * Convert app experience level to training experience level
 */
function convertExperienceLevel(appLevel: AppExperienceLevel): ExperienceLevel {
  switch (appLevel) {
    case 'Новичок (0-6 месяцев)':
      return ExperienceLevel.Beginner;
    case 'Любитель (6-24 месяцев)':
      return ExperienceLevel.Intermediate;
    case 'Атлет (2+ года)':
      return ExperienceLevel.Advanced;
    default:
      return ExperienceLevel.Intermediate;
  }
}

/**
 * Calculate weekly volume from workout logs
 */
export function calculateWeeklyVolume(
  logs: WorkoutLog[],
  experienceLevel: AppExperienceLevel = 'Любитель (6-24 месяцев)' as AppExperienceLevel
): WeeklyVolumeReport {
  const experience = convertExperienceLevel(experienceLevel);

  // Get logs from current week (Monday-based week)
  const now = new Date();
  const startOfWeek = new Date(now);
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  // We want Monday as start, so: (day + 6) % 7 gives days since Monday
  const daysSinceMonday = (now.getDay() + 6) % 7;
  startOfWeek.setDate(now.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const weekLogs = logs.filter(log => {
    const logDate = new Date(log.date);
    return logDate >= startOfWeek && logDate < endOfWeek;
  });

  // Initialize volume counters
  const volumeByMuscle: { [muscleId: string]: { direct: number; indirect: number } } = {};
  MUSCLE_GROUPS.forEach(m => {
    volumeByMuscle[m.id] = { direct: 0, indirect: 0 };
  });

  // Count sets for each muscle
  weekLogs.forEach(log => {
    log.completedExercises.forEach(exercise => {
      // Skip warmup exercises - they don't count towards training volume
      if (exercise.isWarmup) return;

      const completedSets = exercise.completedSets?.length || exercise.sets || 0;
      const muscles = getMusclesForExercise(exercise.name);

      // Add direct sets
      if (volumeByMuscle[muscles.primary]) {
        volumeByMuscle[muscles.primary].direct += completedSets;
      }

      // Add indirect sets for secondary muscles
      muscles.secondary.forEach(secMuscle => {
        if (volumeByMuscle[secMuscle]) {
          const multiplier = getIndirectVolumeMultiplier(muscles.primary, secMuscle);
          volumeByMuscle[secMuscle].indirect += completedSets * multiplier;
        }
      });
    });
  });

  // Build report
  const muscleData: MuscleVolumeData[] = [];
  const undertrainedMuscles: string[] = [];
  const overtrainedMuscles: string[] = [];

  MUSCLE_GROUPS.forEach(muscle => {
    const volume = volumeByMuscle[muscle.id];
    const directSets = Math.round(volume.direct);
    const indirectSets = Math.round(volume.indirect * 10) / 10;
    const totalSets = directSets + Math.round(indirectSets);

    // Get volume recommendations for experience level
    const volumeRec = MUSCLE_VOLUME_BY_EXPERIENCE[muscle.id]?.[experience] || {
      min: muscle.weeklyMinSets,
      optimal: Math.round((muscle.weeklyMinSets + muscle.weeklyMaxSets) / 2),
      max: muscle.weeklyMaxSets,
    };

    let status: 'under' | 'optimal' | 'over' = 'optimal';
    if (totalSets < volumeRec.min) {
      status = 'under';
      undertrainedMuscles.push(muscle.nameRu);
    } else if (totalSets > volumeRec.max) {
      status = 'over';
      overtrainedMuscles.push(muscle.nameRu);
    }

    const percentOfOptimal = volumeRec.optimal > 0
      ? Math.round((totalSets / volumeRec.optimal) * 100)
      : 0;

    muscleData.push({
      muscleId: muscle.id,
      muscleNameRu: muscle.nameRu,
      directSets,
      indirectSets,
      totalSets,
      targetMin: volumeRec.min,
      targetOptimal: volumeRec.optimal,
      targetMax: volumeRec.max,
      status,
      percentOfOptimal,
    });
  });

  // Sort by status (under first, then optimal, then over)
  muscleData.sort((a, b) => {
    const order = { under: 0, optimal: 1, over: 2 };
    return order[a.status] - order[b.status];
  });

  // Determine overall status
  let overallStatus: WeeklyVolumeReport['overallStatus'] = 'optimal';
  if (undertrainedMuscles.length > 3) {
    overallStatus = 'needs_more';
  } else if (overtrainedMuscles.length > 2) {
    overallStatus = 'too_much';
  } else if (undertrainedMuscles.length > 0 || overtrainedMuscles.length > 0) {
    overallStatus = 'mixed';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (undertrainedMuscles.length > 0) {
    const topUndertrained = undertrainedMuscles.slice(0, 3);
    recommendations.push(`Добавь больше работы на: ${topUndertrained.join(', ')}`);
  }
  if (overtrainedMuscles.length > 0) {
    recommendations.push(`Возможно, слишком много работы на: ${overtrainedMuscles.join(', ')}`);
  }
  if (weekLogs.length === 0) {
    recommendations.push('Начни тренироваться, чтобы отслеживать объём!');
  }

  return {
    weekStart: startOfWeek.toISOString().split('T')[0],
    weekEnd: endOfWeek.toISOString().split('T')[0],
    muscles: muscleData,
    overallStatus,
    undertrainedMuscles,
    overtrainedMuscles,
    recommendations,
  };
}

/**
 * Calculate volume for the last N weeks (for trends)
 */
export function calculateVolumeHistory(
  logs: WorkoutLog[],
  weeks: number = 4,
  experienceLevel: AppExperienceLevel = 'Любитель (6-24 месяцев)' as AppExperienceLevel
): WeeklyVolumeReport[] {
  const reports: WeeklyVolumeReport[] = [];
  const now = new Date();

  for (let i = 0; i < weeks; i++) {
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - (i * 7));
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 7);

    const weekLogs = logs.filter(log => {
      const logDate = new Date(log.date);
      return logDate >= weekStart && logDate < weekEnd;
    });

    // Temporarily filter logs to this week only
    const report = calculateWeeklyVolume(weekLogs, experienceLevel);
    report.weekStart = weekStart.toISOString().split('T')[0];
    report.weekEnd = weekEnd.toISOString().split('T')[0];
    reports.unshift(report); // Add to beginning to maintain chronological order
  }

  return reports;
}

/**
 * Get primary muscles that need more attention
 */
export function getMusclesNeedingWork(
  logs: WorkoutLog[],
  experienceLevel: AppExperienceLevel = 'Любитель (6-24 месяцев)' as AppExperienceLevel
): MuscleVolumeData[] {
  const report = calculateWeeklyVolume(logs, experienceLevel);
  return report.muscles.filter(m => m.status === 'under');
}

/**
 * Get a summary for display (top 5 muscles by need)
 */
export function getVolumeSummary(
  logs: WorkoutLog[],
  experienceLevel: AppExperienceLevel = 'Любитель (6-24 месяцев)' as AppExperienceLevel
): {
  primaryMuscles: MuscleVolumeData[];
  secondaryMuscles: MuscleVolumeData[];
  overallScore: number;
  status: 'excellent' | 'good' | 'needs_work' | 'no_data';
} {
  const report = calculateWeeklyVolume(logs, experienceLevel);

  const primaryIds = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes'];
  const secondaryIds = ['biceps', 'triceps', 'rear_delts', 'calves', 'core'];

  const primaryMuscles = report.muscles.filter(m => primaryIds.includes(m.muscleId));
  const secondaryMuscles = report.muscles.filter(m => secondaryIds.includes(m.muscleId));

  // Calculate overall score (0-100)
  const allPercents = report.muscles.map(m => Math.min(m.percentOfOptimal, 150));
  const avgPercent = allPercents.length > 0
    ? allPercents.reduce((a, b) => a + b, 0) / allPercents.length
    : 0;

  const overallScore = Math.min(100, Math.round(avgPercent));

  let status: 'excellent' | 'good' | 'needs_work' | 'no_data' = 'no_data';
  if (report.muscles.some(m => m.totalSets > 0)) {
    if (overallScore >= 80) status = 'excellent';
    else if (overallScore >= 50) status = 'good';
    else status = 'needs_work';
  }

  return {
    primaryMuscles,
    secondaryMuscles,
    overallScore,
    status,
  };
}
