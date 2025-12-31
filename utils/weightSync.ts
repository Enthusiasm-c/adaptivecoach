/**
 * Weight Sync Service
 *
 * Synchronizes workout weights from logs back to the training program.
 * Ensures that after each workout, the program reflects actual weights used.
 *
 * This solves the problem where users increase weights during workouts
 * but the program still shows old (lower) weights.
 */

import { TrainingProgram, WorkoutLog, WorkoutSession, Exercise } from '../types';

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
  if (n1.length > 3 && n2.length > 3) {
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }

  // Check if main words match (at least 2 common words)
  const words1 = n1.split(' ').filter(w => w.length > 2);
  const words2 = n2.split(' ').filter(w => w.length > 2);
  const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));

  return commonWords.length >= 2;
}

/**
 * Extract the best weight for each exercise from workout logs
 * Uses the most recent log entry for each exercise
 */
export function extractLatestWeights(logs: WorkoutLog[]): Map<string, number> {
  const latestWeights = new Map<string, number>();

  // Process logs in chronological order (oldest first)
  // So newer entries overwrite older ones
  const sortedLogs = [...logs].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const log of sortedLogs) {
    for (const ex of log.completedExercises) {
      // Skip warmup exercises
      if (ex.isWarmup) continue;

      // Get max weight used in this exercise
      const completedWeights = ex.completedSets
        .map(s => s.weight || 0)
        .filter(w => w > 0);

      if (completedWeights.length > 0) {
        const maxWeight = Math.max(...completedWeights);
        const normalizedName = normalizeExerciseName(ex.name);
        latestWeights.set(normalizedName, maxWeight);
      }
    }
  }

  return latestWeights;
}

/**
 * Sync weights from workout logs to training program
 * Updates exercise weights based on actual weights used in workouts
 * NOW WITH RIR-BASED PROGRESSION
 */
export function syncWeightsFromLogs(
  program: TrainingProgram,
  logs: WorkoutLog[]
): TrainingProgram {
  if (!logs || logs.length === 0) {
    return program;
  }

  const latestWeights = extractLatestWeights(logs);

  if (latestWeights.size === 0) {
    return program;
  }

  let hasChanges = false;

  const updatedSessions = program.sessions.map(session => ({
    ...session,
    exercises: session.exercises.map(exercise => {
      const normalizedName = normalizeExerciseName(exercise.name);

      // Try to find matching weight from logs
      let latestWeight: number | undefined;

      // Direct match
      if (latestWeights.has(normalizedName)) {
        latestWeight = latestWeights.get(normalizedName);
      } else {
        // Fuzzy match
        for (const [loggedName, weight] of latestWeights) {
          if (exerciseNamesMatch(exercise.name, loggedName)) {
            latestWeight = weight;
            break;
          }
        }
      }

      if (latestWeight === undefined) {
        return exercise;
      }

      // NEW: Apply RIR-based progression
      const avgRir = getAverageRirForExercise(exercise.name, logs);
      const { suggestedWeight, reason } = suggestWeightProgression(latestWeight, avgRir);

      // Log progression for debugging
      if (suggestedWeight !== exercise.weight) {
        console.log(`[WeightSync] ${exercise.name}: ${exercise.weight}кг → ${suggestedWeight}кг (${reason})`);
      }

      // Update weight if changed
      if (suggestedWeight !== exercise.weight) {
        hasChanges = true;
        return { ...exercise, weight: suggestedWeight };
      }

      return exercise;
    }),
  }));

  // Only return new object if there were actual changes
  if (!hasChanges) {
    return program;
  }

  return {
    ...program,
    sessions: updatedSessions,
  };
}

/**
 * Get weight progression suggestion based on RIR
 * RIR 3+ -> increase weight
 * RIR 1-2 -> maintain
 * RIR 0 -> maybe decrease
 */
export function suggestWeightProgression(
  currentWeight: number,
  avgRir: number | undefined
): { suggestedWeight: number; reason: string } {
  if (avgRir === undefined) {
    return { suggestedWeight: currentWeight, reason: 'Нет данных RIR' };
  }

  if (avgRir >= 3) {
    // Too easy - increase by 2.5-5%
    const increase = currentWeight >= 40 ? 2.5 : Math.max(1, currentWeight * 0.05);
    return {
      suggestedWeight: Math.round((currentWeight + increase) * 2) / 2, // Round to 0.5
      reason: `RIR ${avgRir} - можно добавить вес`,
    };
  }

  if (avgRir <= 0) {
    // Too hard - maybe decrease
    return {
      suggestedWeight: currentWeight,
      reason: 'RIR 0 - сохраняем вес, работаем над техникой',
    };
  }

  // Optimal range
  return {
    suggestedWeight: currentWeight,
    reason: `RIR ${avgRir} - оптимальная нагрузка`,
  };
}

/**
 * Calculate average RIR for an exercise from recent logs
 */
export function getAverageRirForExercise(
  exerciseName: string,
  logs: WorkoutLog[],
  lookback: number = 3
): number | undefined {
  const recentLogs = logs.slice(-lookback);
  const rirValues: number[] = [];

  for (const log of recentLogs) {
    for (const ex of log.completedExercises) {
      if (exerciseNamesMatch(ex.name, exerciseName) && !ex.isWarmup) {
        const setRirs = ex.completedSets
          .map(s => s.rir)
          .filter((r): r is number => r !== undefined);
        rirValues.push(...setRirs);
      }
    }
  }

  if (rirValues.length === 0) {
    return undefined;
  }

  return rirValues.reduce((a, b) => a + b, 0) / rirValues.length;
}
