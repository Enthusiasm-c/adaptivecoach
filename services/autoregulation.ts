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

import { WorkoutLog, WorkoutFeedback, TrainingProgram, WorkoutSession, Exercise } from '../types';

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

  // Note: soreness24h would be collected separately (next day)
  // For now, we'll use a default
  const avgSoreness = 3;

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

  // Count consecutive high soreness (would need soreness24h data)
  const consecutiveHighSorenessWorkouts = 0;

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
 */
export function applyAutoregulationToProgram(
  program: TrainingProgram,
  logs: WorkoutLog[]
): { program: TrainingProgram; recommendation: AutoregulationRecommendation } {
  const analysis = analyzeRecoverySignals(logs);
  const recommendation = generateRecommendation(analysis);

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
