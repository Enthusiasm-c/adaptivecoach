/**
 * User Capabilities Snapshot Service
 *
 * Centralizes all user capability data into a single snapshot.
 * This ensures AI prompts and UI have consistent access to:
 * - Volume analysis per muscle group
 * - Strength analysis and E1RM data
 * - Imbalance detection
 * - Pain patterns
 * - Best lifts for weight suggestions
 *
 * Usage:
 * const snapshot = createCapabilitiesSnapshot(profile, program, logs);
 * // Now use snapshot.volumeReport, snapshot.bestLifts, etc.
 */

import { OnboardingProfile, WorkoutLog, TrainingProgram } from '../types';
import { calculateWeeklyVolume, WeeklyVolumeReport } from './volumeTracker';
import {
  analyzeStrength,
  detectImbalances,
  analyzePainPatterns,
  calculateE1RM,
  getBestLiftForExercise,
} from '../utils/strengthAnalysisUtils';
import { syncWeightsFromLogs } from '../utils/weightSync';

// ==========================================
// TYPES
// ==========================================

export interface BestLift {
  weight: number;
  reps: number;
  e1rm: number;
}

export interface UserCapabilitiesSnapshot {
  // Input data
  profile: OnboardingProfile;
  program: TrainingProgram;
  recentLogs: WorkoutLog[];

  // Calculated capabilities
  volumeReport: WeeklyVolumeReport;
  strengthAnalysis: ReturnType<typeof analyzeStrength>;
  imbalances: ReturnType<typeof detectImbalances>;
  painPatterns: ReturnType<typeof analyzePainPatterns>;
  bestLifts: Map<string, BestLift>;

  // Program with actual weights from logs
  syncedProgram: TrainingProgram;

  // Summary flags
  hasInsufficientData: boolean;
  needsMoreVolume: string[];
  hasOvertraining: string[];
  hasPainConcerns: boolean;
}

// ==========================================
// MAIN FUNCTION
// ==========================================

/**
 * Create a comprehensive snapshot of user's training capabilities
 * This is the single source of truth for all AI and UI decisions
 */
export function createCapabilitiesSnapshot(
  profile: OnboardingProfile,
  program: TrainingProgram,
  logs: WorkoutLog[]
): UserCapabilitiesSnapshot {
  // Use recent logs (last 6 workouts = ~2 weeks)
  const recentLogs = logs.slice(-6);

  // Calculate volume report
  const volumeReport = calculateWeeklyVolume(recentLogs, profile.experience);

  // Calculate strength analysis
  const bodyweight = profile.weight || 70; // Default to 70kg if not provided
  const gender = profile.gender === 'Мужчина' ? 'male' : 'female';
  const strengthAnalysis = analyzeStrength(logs, bodyweight, gender as any);

  // Detect imbalances (needs strength analysis first)
  const imbalances = detectImbalances(strengthAnalysis);

  // Analyze pain patterns
  const painPatterns = analyzePainPatterns(logs);

  // Get best lifts for all exercises in the program
  const bestLifts = new Map<string, BestLift>();
  for (const session of program.sessions) {
    for (const exercise of session.exercises) {
      const bestLift = getBestLiftForExercise(exercise.name, logs);
      if (bestLift) {
        bestLifts.set(exercise.name.toLowerCase(), bestLift);
      }
    }
  }

  // Sync weights from logs
  const syncedProgram = syncWeightsFromLogs(program, logs);

  // Calculate summary flags
  const hasInsufficientData = recentLogs.length < 3;
  const needsMoreVolume = volumeReport.undertrainedMuscles;
  const hasOvertraining = volumeReport.overtrainedMuscles;
  const hasPainConcerns = painPatterns.length > 0;

  return {
    profile,
    program,
    recentLogs,
    volumeReport,
    strengthAnalysis,
    imbalances,
    painPatterns,
    bestLifts,
    syncedProgram,
    hasInsufficientData,
    needsMoreVolume,
    hasOvertraining,
    hasPainConcerns,
  };
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get suggested working weight for an exercise based on capabilities
 * Returns 80% of E1RM rounded to nearest 2.5kg
 */
export function getSuggestedWeight(
  snapshot: UserCapabilitiesSnapshot,
  exerciseName: string
): number | null {
  const bestLift = snapshot.bestLifts.get(exerciseName.toLowerCase());
  if (!bestLift || bestLift.e1rm <= 0) return null;

  // 80% of E1RM for working sets (typical 8-10 rep range)
  return Math.round(bestLift.e1rm * 0.8 / 2.5) * 2.5;
}

/**
 * Format capabilities for AI prompt
 */
export function formatCapabilitiesForAI(snapshot: UserCapabilitiesSnapshot): string {
  const lines: string[] = [];

  // Volume summary
  lines.push('=== АНАЛИЗ ОБЪЁМА ===');
  if (snapshot.needsMoreVolume.length > 0) {
    lines.push(`⚠️ Недостаточно нагрузки: ${snapshot.needsMoreVolume.join(', ')}`);
  }
  if (snapshot.hasOvertraining.length > 0) {
    lines.push(`🔴 Возможная перетренировка: ${snapshot.hasOvertraining.join(', ')}`);
  }
  for (const m of snapshot.volumeReport.muscles.slice(0, 8)) {
    const icon = m.status === 'under' ? '📉' : m.status === 'over' ? '📈' : '✅';
    lines.push(`${icon} ${m.muscleNameRu}: ${m.totalSets} сетов (${m.percentOfOptimal}% оптимума)`);
  }

  // Strength insights
  if (snapshot.strengthAnalysis.length > 0) {
    lines.push('');
    lines.push('=== СИЛОВЫЕ ПОКАЗАТЕЛИ ===');
    for (const s of snapshot.strengthAnalysis.slice(0, 5)) {
      lines.push(`💪 ${s.exerciseName}: E1RM ${s.e1rm}кг (${s.level})`);
    }
  }

  // Best lifts
  if (snapshot.bestLifts.size > 0) {
    lines.push('');
    lines.push('=== ЛУЧШИЕ РЕЗУЛЬТАТЫ ===');
    for (const [name, lift] of Array.from(snapshot.bestLifts.entries()).slice(0, 8)) {
      lines.push(`• ${name}: ${lift.weight}кг x ${lift.reps} (E1RM: ${lift.e1rm}кг)`);
    }
  }

  // Pain concerns
  if (snapshot.hasPainConcerns) {
    lines.push('');
    lines.push('=== ИСТОРИЯ БОЛИ ===');
    for (const pain of snapshot.painPatterns) {
      lines.push(`⚠️ ${pain.location}: ${pain.frequency} случаев (связано с: ${pain.associatedExercises.slice(0, 3).join(', ')})`);
    }
  }

  // Imbalances
  if (snapshot.imbalances.length > 0) {
    lines.push('');
    lines.push('=== ДИСБАЛАНСЫ ===');
    for (const imb of snapshot.imbalances) {
      const severityIcon = imb.severity === 'severe' ? '🔴' : imb.severity === 'moderate' ? '🟡' : '🟢';
      lines.push(`${severityIcon} ${imb.description} (${imb.severity})`);
    }
  }

  return lines.join('\n');
}

/**
 * Check if user needs program adjustment
 */
export function needsProgramAdjustment(snapshot: UserCapabilitiesSnapshot): {
  needsAdjustment: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (snapshot.needsMoreVolume.length > 2) {
    reasons.push(`Недостаточный объём для ${snapshot.needsMoreVolume.length} групп мышц`);
  }

  if (snapshot.hasOvertraining.length > 0) {
    reasons.push(`Возможная перетренировка: ${snapshot.hasOvertraining.join(', ')}`);
  }

  if (snapshot.hasPainConcerns) {
    reasons.push('Обнаружены повторяющиеся боли');
  }

  if (snapshot.imbalances.length > 2) {
    reasons.push('Выявлены значительные мышечные дисбалансы');
  }

  return {
    needsAdjustment: reasons.length > 0,
    reasons,
  };
}
