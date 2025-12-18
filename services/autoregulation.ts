/**
 * Autoregulation Service
 *
 * Analyzes workout feedback to adjust volume and exercise selection.
 * Based on RP Hypertrophy methodology:
 * - Pump quality indicates muscle stimulus
 * - Soreness indicates recovery status
 * - Performance trend indicates adaptation
 *
 * Rules:
 * - Low pump + low soreness → increase volume
 * - High soreness + declining performance → decrease volume
 * - Pain → substitute exercise + reduce weight
 */

import { WorkoutLog, WorkoutFeedback, TrainingProgram, WorkoutSession, Exercise, ReadinessData } from '../types';

// ==========================================
// TYPES
// ==========================================

export interface RecoveryAnalysis {
  overallStatus: 'under_recovered' | 'optimal' | 'under_stimulated';
  avgPumpQuality: number;
  avgSoreness: number;
  performanceTrend: 'improving' | 'stable' | 'declining';
  consecutiveLowPumpWorkouts: number;
  consecutiveHighSorenessWorkouts: number;
  painReported: boolean;
  painLocations: string[];
}

export interface VolumeAdjustment {
  type: 'increase' | 'decrease' | 'maintain';
  setsChange: number; // +1, -1, 0
  weightChange: number; // percentage, e.g., -5 for -5%
  reason: string;
}

export interface AutoregulationRecommendation {
  volumeAdjustment: VolumeAdjustment;
  exercisesToSubstitute: string[];
  warnings: string[];
  suggestions: string[];
}

// ==========================================
// ANALYSIS
// ==========================================

/**
 * Analyze recent workout logs for recovery signals
 */
export function analyzeRecoverySignals(logs: WorkoutLog[], windowSize: number = 3): RecoveryAnalysis {
  const recentLogs = logs.slice(-windowSize);

  if (recentLogs.length === 0) {
    return {
      overallStatus: 'optimal',
      avgPumpQuality: 3,
      avgSoreness: 3,
      performanceTrend: 'stable',
      consecutiveLowPumpWorkouts: 0,
      consecutiveHighSorenessWorkouts: 0,
      painReported: false,
      painLocations: [],
    };
  }

  // Calculate averages
  const pumpValues = recentLogs
    .map(log => log.feedback.pumpQuality)
    .filter((v): v is 1 | 2 | 3 | 4 | 5 => v !== undefined);

  const avgPumpQuality = pumpValues.length > 0
    ? pumpValues.reduce((a, b) => a + b, 0) / pumpValues.length
    : 3;

  // Calculate average soreness from collected data
  const sorenessValues = recentLogs
    .map(log => log.feedback.soreness24h)
    .filter((v): v is 1 | 2 | 3 | 4 | 5 => v !== undefined);

  const avgSoreness = sorenessValues.length > 0
    ? sorenessValues.reduce((a, b) => a + b, 0) / sorenessValues.length
    : 3; // Default to 3 (neutral) if no data collected yet

  // Analyze performance trend from recent logs
  const performanceTrends = recentLogs
    .map(log => log.feedback.performanceTrend)
    .filter((v): v is 'improving' | 'stable' | 'declining' => v !== undefined);

  const performanceTrend = getOverallTrend(performanceTrends);

  // Count consecutive low pump workouts
  let consecutiveLowPumpWorkouts = 0;
  for (let i = recentLogs.length - 1; i >= 0; i--) {
    if (recentLogs[i].feedback.pumpQuality && recentLogs[i].feedback.pumpQuality! <= 2) {
      consecutiveLowPumpWorkouts++;
    } else {
      break;
    }
  }

  // Count consecutive high soreness (4-5 = painful)
  let consecutiveHighSorenessWorkouts = 0;
  for (let i = recentLogs.length - 1; i >= 0; i--) {
    const soreness = recentLogs[i].feedback.soreness24h;
    if (soreness !== undefined && soreness >= 4) {
      consecutiveHighSorenessWorkouts++;
    } else if (soreness !== undefined) {
      break; // Stop counting when we hit non-high soreness
    }
    // If undefined, continue checking older logs
  }

  // Check for pain
  const painReported = recentLogs.some(log => log.feedback.pain.hasPain);
  const painLocations = [...new Set(
    recentLogs
      .filter(log => log.feedback.pain.hasPain && log.feedback.pain.location)
      .map(log => log.feedback.pain.location!)
  )];

  // Determine overall status
  let overallStatus: RecoveryAnalysis['overallStatus'] = 'optimal';

  if (avgPumpQuality <= 2 && performanceTrend !== 'declining') {
    overallStatus = 'under_stimulated';
  } else if (performanceTrend === 'declining' || consecutiveHighSorenessWorkouts >= 2) {
    overallStatus = 'under_recovered';
  }

  return {
    overallStatus,
    avgPumpQuality,
    avgSoreness,
    performanceTrend,
    consecutiveLowPumpWorkouts,
    consecutiveHighSorenessWorkouts,
    painReported,
    painLocations,
  };
}

/**
 * Get overall trend from array of trends
 */
function getOverallTrend(trends: ('improving' | 'stable' | 'declining')[]): 'improving' | 'stable' | 'declining' {
  if (trends.length === 0) return 'stable';

  const counts = {
    improving: trends.filter(t => t === 'improving').length,
    stable: trends.filter(t => t === 'stable').length,
    declining: trends.filter(t => t === 'declining').length,
  };

  // If declining appears in recent workouts, prioritize it
  if (counts.declining >= 2 || (counts.declining > 0 && trends[trends.length - 1] === 'declining')) {
    return 'declining';
  }

  if (counts.improving >= 2) {
    return 'improving';
  }

  return 'stable';
}

/**
 * Calculate readiness score from feedback data
 * Uses weighted average of sleep, food, stress, and soreness
 * Returns 1-5 scale (1 = low readiness, 5 = high readiness)
 */
export function calculateReadinessScore(readiness: ReadinessData | undefined): number {
  if (!readiness) {
    return 3; // Default to neutral if no data
  }

  // ReadinessData scales:
  // sleep: 1-5 (higher = better)
  // food: 1-5 (higher = better)
  // stress: 1-5 (1 = high stress, 5 = low stress, so higher = better)
  // soreness: 1-5 (1 = very sore, 5 = fresh, so higher = better)

  const weights = {
    sleep: 0.35,    // Sleep is most important for recovery
    food: 0.20,     // Nutrition matters
    stress: 0.20,   // Mental stress affects recovery
    soreness: 0.25, // Physical readiness
  };

  return (
    readiness.sleep * weights.sleep +
    readiness.food * weights.food +
    readiness.stress * weights.stress +
    readiness.soreness * weights.soreness
  );
}

/**
 * Get average readiness from recent logs
 */
export function getAverageReadiness(logs: WorkoutLog[], windowSize: number = 3): number {
  const recentLogs = logs.slice(-windowSize);

  if (recentLogs.length === 0) {
    return 3; // Neutral default
  }

  const readinessScores = recentLogs
    .map(log => calculateReadinessScore(log.feedback.readiness))
    .filter(score => score !== 3 || recentLogs.some(l => l.feedback.readiness)); // Only count real data

  if (readinessScores.length === 0) {
    return 3;
  }

  return readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length;
}

// ==========================================
// RECOMMENDATIONS
// ==========================================

/**
 * Generate autoregulation recommendation based on analysis
 */
export function generateRecommendation(analysis: RecoveryAnalysis): AutoregulationRecommendation {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let volumeAdjustment: VolumeAdjustment;
  const exercisesToSubstitute: string[] = [];

  // Rule 1: Under-stimulated (low pump, not declining)
  if (analysis.overallStatus === 'under_stimulated') {
    volumeAdjustment = {
      type: 'increase',
      setsChange: 1,
      weightChange: 0,
      reason: 'Низкий пампинг указывает на недостаточный стимул. Добавляем объём.',
    };
    suggestions.push('Попробуй увеличить время под нагрузкой (медленнее опускай вес)');
    suggestions.push('Убедись, что достигаешь отказа или близко к нему');
  }
  // Rule 2: Under-recovered (high soreness or declining performance)
  else if (analysis.overallStatus === 'under_recovered') {
    volumeAdjustment = {
      type: 'decrease',
      setsChange: -1,
      weightChange: -5,
      reason: 'Признаки недовосстановления. Снижаем нагрузку.',
    };
    warnings.push('Возможно, ты недовосстановился. Обрати внимание на сон и питание.');
    suggestions.push('Рассмотри дополнительный день отдыха');
  }
  // Rule 3: Optimal
  else {
    volumeAdjustment = {
      type: 'maintain',
      setsChange: 0,
      weightChange: 0,
      reason: 'Прогресс идёт хорошо. Продолжаем в том же духе.',
    };
    if (analysis.performanceTrend === 'improving') {
      suggestions.push('Отличный прогресс! Можно попробовать увеличить вес на 2.5-5%');
    }
  }

  // Rule 4: Pain handling
  if (analysis.painReported) {
    warnings.push(`Зафиксирована боль: ${analysis.painLocations.join(', ')}. Будь осторожен.`);
    // Note: exercise substitution would happen in pain handling flow
  }

  // Rule 5: Consecutive issues
  if (analysis.consecutiveLowPumpWorkouts >= 3) {
    warnings.push('Пампинг был низким 3 тренировки подряд. Возможно, стоит пересмотреть технику.');
  }

  return {
    volumeAdjustment,
    exercisesToSubstitute,
    warnings,
    suggestions,
  };
}

// ==========================================
// APPLICATION
// ==========================================

/**
 * Apply volume adjustment to a workout session
 */
export function applyVolumeAdjustment(
  session: WorkoutSession,
  adjustment: VolumeAdjustment
): WorkoutSession {
  if (adjustment.type === 'maintain') {
    return session;
  }

  return {
    ...session,
    exercises: session.exercises.map(exercise => {
      let newSets = exercise.sets + adjustment.setsChange;
      newSets = Math.max(1, Math.min(6, newSets)); // Keep between 1-6 sets

      let newWeight = exercise.weight;
      if (newWeight && adjustment.weightChange !== 0) {
        newWeight = Math.round(newWeight * (1 + adjustment.weightChange / 100));
        newWeight = Math.max(0, newWeight);
      }

      return {
        ...exercise,
        sets: newSets,
        weight: newWeight,
      };
    }),
  };
}

/**
 * Apply autoregulation to entire program based on recent logs
 * Now includes readiness-based adjustments
 */
export function applyAutoregulationToProgram(
  program: TrainingProgram,
  logs: WorkoutLog[]
): { program: TrainingProgram; recommendation: AutoregulationRecommendation } {
  const analysis = analyzeRecoverySignals(logs);
  let recommendation = generateRecommendation(analysis);

  // Get readiness from most recent log
  const lastLog = logs[logs.length - 1];
  const readinessScore = lastLog ? calculateReadinessScore(lastLog.feedback.readiness) : 3;
  const avgReadiness = getAverageReadiness(logs);

  // Low readiness override: reduce volume even if analysis says "maintain"
  if (avgReadiness < 2.5 && recommendation.volumeAdjustment.type !== 'decrease') {
    recommendation = {
      ...recommendation,
      volumeAdjustment: {
        type: 'decrease',
        setsChange: 0,
        weightChange: -10, // Reduce weight by 10%
        reason: 'Низкая готовность к нагрузке. Снижаем интенсивность.',
      },
      warnings: [
        ...recommendation.warnings,
        'Твои показатели готовности низкие. Обрати внимание на сон и восстановление.',
      ],
    };
  }

  // Very low readiness: suggest skipping workout
  if (readinessScore < 2) {
    recommendation = {
      ...recommendation,
      suggestions: [
        ...recommendation.suggestions,
        'Рассмотри лёгкую тренировку или активный отдых сегодня.',
      ],
    };
  }

  // High readiness + good recovery: can push harder
  if (avgReadiness >= 4 && analysis.overallStatus === 'optimal' && analysis.performanceTrend === 'improving') {
    recommendation = {
      ...recommendation,
      suggestions: [
        ...recommendation.suggestions,
        'Отличная готовность! Можешь добавить вес или подходы.',
      ],
    };
  }

  // If no adjustment needed, return original program
  if (recommendation.volumeAdjustment.type === 'maintain') {
    return { program, recommendation };
  }

  const adjustedSessions = program.sessions.map(session =>
    applyVolumeAdjustment(session, recommendation.volumeAdjustment)
  );

  return {
    program: {
      ...program,
      sessions: adjustedSessions,
    },
    recommendation,
  };
}

// ==========================================
// DISPLAY HELPERS
// ==========================================

/**
 * Get human-readable status message
 */
export function getStatusMessage(analysis: RecoveryAnalysis): {
  title: string;
  description: string;
  color: 'green' | 'yellow' | 'red';
} {
  switch (analysis.overallStatus) {
    case 'optimal':
      return {
        title: 'Оптимальное восстановление',
        description: 'Ты хорошо восстанавливаешься. Продолжай в том же духе!',
        color: 'green',
      };
    case 'under_stimulated':
      return {
        title: 'Недостаточный стимул',
        description: 'Можно увеличить нагрузку для лучшего прогресса.',
        color: 'yellow',
      };
    case 'under_recovered':
      return {
        title: 'Недовосстановление',
        description: 'Обрати внимание на отдых и питание.',
        color: 'red',
      };
  }
}
