/**
 * Workout Muscle Utils
 *
 * Utility functions to extract muscle group information from workout sessions.
 * Used for displaying target muscles in WorkoutPreviewModal.
 */

import { WorkoutSession, WorkoutLog } from '../types';
import { MUSCLE_GROUPS, MUSCLE_VOLUME_BY_EXPERIENCE } from '../data/muscleGroups';
import { ALL_EXERCISES } from '../data/exerciseDatabase';
import { ExperienceLevel } from '../types/training';

// ==========================================
// TYPES
// ==========================================

export interface MuscleInfo {
  muscleId: string;
  muscleNameRu: string;
  setsInSession: number;
  isPrimary: boolean;
}

export interface SessionMuscleData {
  primary: MuscleInfo[];
  secondary: MuscleInfo[];
  totalSets: number;
}

export interface MuscleVolumeProgress {
  muscleId: string;
  muscleNameRu: string;
  currentSets: number;
  afterSessionSets: number;
  optimalSets: number;
  percentAfter: number;
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Normalize exercise name for matching
 */
function normalizeExerciseName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Check if exercise names match (fuzzy matching)
 */
function exerciseNamesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeExerciseName(name1);
  const n2 = normalizeExerciseName(name2);

  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Check if main words match
  const words1 = n1.split(' ').filter(w => w.length > 2);
  const words2 = n2.split(' ').filter(w => w.length > 2);
  const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));

  return commonWords.length >= 2;
}

/**
 * Get muscle groups for an exercise by name
 */
function getMusclesForExercise(exerciseName: string): { primary: string; secondary: string[] } {
  // First, try to find in exercise database
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
  const nameLower = normalizeExerciseName(exerciseName);

  const EXERCISE_MUSCLE_MAP: { [key: string]: { primary: string; secondary: string[] } } = {
    'жим': { primary: 'chest', secondary: ['triceps', 'shoulders'] },
    'грудь': { primary: 'chest', secondary: ['triceps', 'shoulders'] },
    'bench': { primary: 'chest', secondary: ['triceps', 'shoulders'] },
    'тяга': { primary: 'back', secondary: ['biceps'] },
    'подтягив': { primary: 'back', secondary: ['biceps'] },
    'pull': { primary: 'back', secondary: ['biceps'] },
    'row': { primary: 'back', secondary: ['biceps'] },
    'присед': { primary: 'quads', secondary: ['glutes', 'hamstrings'] },
    'squat': { primary: 'quads', secondary: ['glutes', 'hamstrings'] },
    'разгибан': { primary: 'quads', secondary: [] },
    'выпад': { primary: 'quads', secondary: ['glutes'] },
    'lunge': { primary: 'quads', secondary: ['glutes'] },
    'сгибан': { primary: 'hamstrings', secondary: [] },
    'curl': { primary: 'biceps', secondary: [] },
    'бицепс': { primary: 'biceps', secondary: [] },
    'трицепс': { primary: 'triceps', secondary: [] },
    'french': { primary: 'triceps', secondary: [] },
    'плеч': { primary: 'shoulders', secondary: [] },
    'дельт': { primary: 'shoulders', secondary: [] },
    'shoulder': { primary: 'shoulders', secondary: [] },
    'press': { primary: 'shoulders', secondary: ['triceps'] },
    'жим стоя': { primary: 'shoulders', secondary: ['triceps'] },
    'икр': { primary: 'calves', secondary: [] },
    'calf': { primary: 'calves', secondary: [] },
    'пресс': { primary: 'core', secondary: [] },
    'скручив': { primary: 'core', secondary: [] },
    'планк': { primary: 'core', secondary: [] },
    'становая': { primary: 'back', secondary: ['glutes', 'hamstrings'] },
    'deadlift': { primary: 'back', secondary: ['glutes', 'hamstrings'] },
    'ягодиц': { primary: 'glutes', secondary: ['hamstrings'] },
    'glute': { primary: 'glutes', secondary: [] },
  };

  for (const [keyword, muscles] of Object.entries(EXERCISE_MUSCLE_MAP)) {
    if (nameLower.includes(keyword)) {
      return muscles;
    }
  }

  return { primary: 'unknown', secondary: [] };
}

/**
 * Get Russian name for muscle ID
 */
function getMuscleNameRu(muscleId: string): string {
  const muscle = MUSCLE_GROUPS.find(m => m.id === muscleId);
  if (muscle) return muscle.nameRu;

  // Fallback names
  const fallbackNames: { [key: string]: string } = {
    chest: 'Грудь',
    back: 'Спина',
    shoulders: 'Плечи',
    biceps: 'Бицепс',
    triceps: 'Трицепс',
    quads: 'Квадрицепс',
    hamstrings: 'Бицепс бедра',
    glutes: 'Ягодицы',
    calves: 'Икры',
    core: 'Пресс',
    rear_delts: 'Задние дельты',
    forearms: 'Предплечья',
  };

  return fallbackNames[muscleId] || muscleId;
}

// ==========================================
// MAIN FUNCTIONS
// ==========================================

/**
 * Extract all muscle groups from a workout session
 */
export function getSessionMuscles(session: WorkoutSession): SessionMuscleData {
  const primaryMap = new Map<string, number>();
  const secondaryMap = new Map<string, number>();
  let totalSets = 0;

  for (const exercise of session.exercises) {
    // Skip warmup exercises
    if (exercise.isWarmup) continue;

    const sets = exercise.sets || 0;
    totalSets += sets;

    const muscles = getMusclesForExercise(exercise.name);

    if (muscles.primary !== 'unknown') {
      const currentPrimary = primaryMap.get(muscles.primary) || 0;
      primaryMap.set(muscles.primary, currentPrimary + sets);
    }

    for (const secondary of muscles.secondary) {
      // Don't add to secondary if it's already in primary
      if (!primaryMap.has(secondary)) {
        const currentSecondary = secondaryMap.get(secondary) || 0;
        // Secondary muscles get ~50% volume credit
        secondaryMap.set(secondary, currentSecondary + Math.round(sets * 0.5));
      }
    }
  }

  // Convert maps to arrays
  const primary: MuscleInfo[] = Array.from(primaryMap.entries())
    .map(([muscleId, setsInSession]) => ({
      muscleId,
      muscleNameRu: getMuscleNameRu(muscleId),
      setsInSession,
      isPrimary: true,
    }))
    .sort((a, b) => b.setsInSession - a.setsInSession);

  const secondary: MuscleInfo[] = Array.from(secondaryMap.entries())
    .filter(([muscleId]) => !primaryMap.has(muscleId))
    .map(([muscleId, setsInSession]) => ({
      muscleId,
      muscleNameRu: getMuscleNameRu(muscleId),
      setsInSession,
      isPrimary: false,
    }))
    .sort((a, b) => b.setsInSession - a.setsInSession);

  return { primary, secondary, totalSets };
}

/**
 * Calculate volume progress after completing this session
 */
export function calculateVolumeProgress(
  session: WorkoutSession,
  logs: WorkoutLog[],
  experienceLevel: ExperienceLevel = ExperienceLevel.Intermediate
): MuscleVolumeProgress[] {
  const sessionMuscles = getSessionMuscles(session);
  const allMuscles = [...sessionMuscles.primary, ...sessionMuscles.secondary];

  // Get current week's volume from logs
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const thisWeekLogs = logs.filter(log => new Date(log.date) >= weekStart);

  // Calculate current volume per muscle
  const currentVolume = new Map<string, number>();

  for (const log of thisWeekLogs) {
    for (const exercise of log.completedExercises) {
      const completedSets = exercise.completedSets?.filter(s => s.isCompleted).length || 0;
      const muscles = getMusclesForExercise(exercise.name);

      if (muscles.primary !== 'unknown') {
        const current = currentVolume.get(muscles.primary) || 0;
        currentVolume.set(muscles.primary, current + completedSets);
      }

      for (const secondary of muscles.secondary) {
        const current = currentVolume.get(secondary) || 0;
        currentVolume.set(secondary, current + Math.round(completedSets * 0.5));
      }
    }
  }

  // Build progress data for muscles in this session
  return allMuscles.map(muscle => {
    const volumeConfig = MUSCLE_VOLUME_BY_EXPERIENCE[muscle.muscleId]?.[experienceLevel];
    const optimalSets = volumeConfig?.optimal || 14;
    const currentSets = currentVolume.get(muscle.muscleId) || 0;
    const afterSessionSets = currentSets + muscle.setsInSession;
    const percentAfter = Math.round((afterSessionSets / optimalSets) * 100);

    return {
      muscleId: muscle.muscleId,
      muscleNameRu: muscle.muscleNameRu,
      currentSets,
      afterSessionSets,
      optimalSets,
      percentAfter,
    };
  }).sort((a, b) => b.afterSessionSets - a.afterSessionSets);
}

/**
 * Get short muscle name for chips
 */
export function getShortMuscleName(muscleId: string): string {
  const shortNames: { [key: string]: string } = {
    chest: 'Грудь',
    back: 'Спина',
    shoulders: 'Плечи',
    biceps: 'Бицепс',
    triceps: 'Трицепс',
    quads: 'Квадрицепс',
    hamstrings: 'Бицепс бедра',
    glutes: 'Ягодицы',
    calves: 'Икры',
    core: 'Пресс',
    rear_delts: 'Зад. дельты',
    forearms: 'Предплечья',
  };

  return shortNames[muscleId] || muscleId;
}
