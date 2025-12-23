// WHOOP Insights Service
// Generates pre-workout insights and adapts training based on WHOOP data

import { WhoopReadinessData, WorkoutSession, Exercise } from '../types';

export interface WhoopInsight {
  type: 'warning' | 'caution' | 'good' | 'excellent';
  icon: string;
  title: string;
  subtitle?: string;
  adaptations: string[];
}

export interface WorkoutAdaptation {
  weightMultiplier: number;  // e.g., 0.85 = -15%
  setsToRemove: number;      // e.g., 2
  reason: 'low_recovery' | 'moderate_recovery' | 'good_recovery';
}

export interface AdaptedWorkoutResult {
  originalSession: WorkoutSession;
  adaptedSession: WorkoutSession;
  insight: WhoopInsight;
  adaptation: WorkoutAdaptation;
}

/**
 * Generate insight message based on WHOOP data
 * Priority: sleep -> recovery -> excellent state
 */
export function generateInsight(whoop: WhoopReadinessData): WhoopInsight {
  // Critical: Very low sleep
  if (whoop.sleepHours < 5) {
    return {
      type: 'warning',
      icon: '😴',
      title: `Вижу, ты спал всего ${whoop.sleepHours.toFixed(1)} часа`,
      subtitle: `Recovery ${whoop.recoveryScore}%`,
      adaptations: ['Убрал 2 тяжёлых сета', 'Снизил веса на 15%']
    };
  }

  // Critical: Very low recovery
  if (whoop.recoveryScore < 40) {
    return {
      type: 'warning',
      icon: '⚠️',
      title: `Восстановление ${whoop.recoveryScore}% — организму тяжело`,
      subtitle: `Сон: ${whoop.sleepHours.toFixed(1)}ч`,
      adaptations: ['Убрал 2 тяжёлых сета', 'Снизил веса на 15%']
    };
  }

  // Excellent: High recovery
  if (whoop.recoveryScore > 80) {
    return {
      type: 'excellent',
      icon: '🔥',
      title: `Recovery ${whoop.recoveryScore}% — отличный день!`,
      subtitle: 'Организм готов к нагрузке',
      adaptations: []
    };
  }

  // Good: Above average recovery
  if (whoop.recoveryScore >= 65) {
    return {
      type: 'good',
      icon: '💪',
      title: `Recovery ${whoop.recoveryScore}% — хорошо`,
      subtitle: `Сон: ${whoop.sleepHours.toFixed(1)}ч`,
      adaptations: []
    };
  }

  // Caution: Moderate recovery (40-65%)
  return {
    type: 'caution',
    icon: '🤔',
    title: `Recovery ${whoop.recoveryScore}% — средненько`,
    subtitle: 'Поберегу тебя сегодня',
    adaptations: ['Немного снизил веса']
  };
}

/**
 * Calculate workout adaptation based on WHOOP data
 */
export function calculateAdaptation(whoop: WhoopReadinessData): WorkoutAdaptation {
  // Critical state: low sleep OR very low recovery
  if (whoop.sleepHours < 5 || whoop.recoveryScore < 40) {
    return {
      weightMultiplier: 0.85,  // -15%
      setsToRemove: 2,
      reason: 'low_recovery'
    };
  }

  // Moderate state: recovery 40-65%
  if (whoop.recoveryScore < 65) {
    return {
      weightMultiplier: 0.95,  // -5%
      setsToRemove: 1,
      reason: 'moderate_recovery'
    };
  }

  // Good state: no adaptation needed
  return {
    weightMultiplier: 1.0,
    setsToRemove: 0,
    reason: 'good_recovery'
  };
}

/**
 * Apply adaptation to a workout session
 */
export function adaptWorkout(
  session: WorkoutSession,
  whoop: WhoopReadinessData
): WorkoutSession {
  const adaptation = calculateAdaptation(whoop);

  // If no adaptation needed, return original
  if (adaptation.weightMultiplier === 1.0 && adaptation.setsToRemove === 0) {
    return session;
  }

  // Apply adaptations to exercises
  const adaptedExercises: Exercise[] = session.exercises.map(ex => {
    // Skip warmup exercises
    if (ex.isWarmup) {
      return ex;
    }

    return {
      ...ex,
      // Adjust weight if present
      weight: ex.weight
        ? Math.round(ex.weight * adaptation.weightMultiplier / 2.5) * 2.5  // Round to nearest 2.5kg
        : undefined,
      // Reduce sets (minimum 2)
      sets: Math.max(ex.sets - adaptation.setsToRemove, 2)
    };
  });

  return {
    ...session,
    exercises: adaptedExercises
  };
}

/**
 * Full workflow: generate insight and adapt workout
 */
export function processWhoopData(
  session: WorkoutSession,
  whoop: WhoopReadinessData
): AdaptedWorkoutResult {
  const insight = generateInsight(whoop);
  const adaptation = calculateAdaptation(whoop);
  const adaptedSession = adaptWorkout(session, whoop);

  return {
    originalSession: session,
    adaptedSession,
    insight,
    adaptation
  };
}

/**
 * Check if workout needs adaptation
 */
export function needsAdaptation(whoop: WhoopReadinessData): boolean {
  return whoop.sleepHours < 5 || whoop.recoveryScore < 65;
}

/**
 * Get color scheme based on insight type
 */
export function getInsightColors(type: WhoopInsight['type']): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} {
  switch (type) {
    case 'warning':
      return {
        bg: 'bg-red-900/30',
        border: 'border-red-500/30',
        text: 'text-red-300',
        icon: 'text-red-400'
      };
    case 'caution':
      return {
        bg: 'bg-yellow-900/30',
        border: 'border-yellow-500/30',
        text: 'text-yellow-300',
        icon: 'text-yellow-400'
      };
    case 'good':
      return {
        bg: 'bg-blue-900/30',
        border: 'border-blue-500/30',
        text: 'text-blue-300',
        icon: 'text-blue-400'
      };
    case 'excellent':
      return {
        bg: 'bg-green-900/30',
        border: 'border-green-500/30',
        text: 'text-green-300',
        icon: 'text-green-400'
      };
  }
}
