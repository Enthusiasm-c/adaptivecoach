import { describe, it, expect } from 'vitest';
import {
  analyzeRecoverySignals,
  generateRecommendation,
  applyVolumeAdjustment,
  applyAutoregulationToProgram,
  getStatusMessage,
  RecoveryAnalysis,
  VolumeAdjustment,
} from '../autoregulation';
import { WorkoutLog, WorkoutSession, TrainingProgram, WorkoutCompletion } from '../../types';

// ==========================================
// HELPER FACTORIES
// ==========================================

const createWorkoutLog = (overrides: Partial<WorkoutLog> = {}): WorkoutLog => ({
  sessionId: 'test-session',
  date: new Date().toISOString(),
  feedback: {
    completion: WorkoutCompletion.Yes,
    pain: { hasPain: false },
    ...overrides.feedback,
  },
  completedExercises: [],
  ...overrides,
});

const createSession = (exercises: { name: string; sets: number; weight?: number }[]): WorkoutSession => ({
  name: 'Test Session',
  exercises: exercises.map(e => ({
    name: e.name,
    sets: e.sets,
    reps: '8-12',
    rest: 90,
    weight: e.weight || 100,
  })),
});

const createProgram = (sessions: WorkoutSession[]): TrainingProgram => ({
  sessions,
});

// ==========================================
// analyzeRecoverySignals
// ==========================================

describe('analyzeRecoverySignals', () => {
  it('returns optimal status for empty logs', () => {
    const result = analyzeRecoverySignals([]);

    expect(result.overallStatus).toBe('optimal');
    expect(result.avgPumpQuality).toBe(3);
    expect(result.performanceTrend).toBe('stable');
    expect(result.painReported).toBe(false);
  });

  it('detects under_stimulated status with low pump', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 1 } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 2 } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 1 } }),
    ];

    const result = analyzeRecoverySignals(logs);
    expect(result.overallStatus).toBe('under_stimulated');
    expect(result.avgPumpQuality).toBeLessThan(2.5);
  });

  it('detects under_recovered status with declining performance', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, performanceTrend: 'declining' } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, performanceTrend: 'declining' } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, performanceTrend: 'declining' } }),
    ];

    const result = analyzeRecoverySignals(logs);
    expect(result.overallStatus).toBe('under_recovered');
    expect(result.performanceTrend).toBe('declining');
  });

  it('detects optimal status with good metrics', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 4, performanceTrend: 'stable' } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 4, performanceTrend: 'improving' } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 3, performanceTrend: 'stable' } }),
    ];

    const result = analyzeRecoverySignals(logs);
    expect(result.overallStatus).toBe('optimal');
  });

  it('detects pain and reports locations', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: true, location: 'колено' } } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: true, location: 'плечо' } } }),
    ];

    const result = analyzeRecoverySignals(logs);
    expect(result.painReported).toBe(true);
    expect(result.painLocations).toContain('колено');
    expect(result.painLocations).toContain('плечо');
  });

  it('counts consecutive low pump workouts', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 4 } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 2 } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 1 } }),
    ];

    const result = analyzeRecoverySignals(logs);
    expect(result.consecutiveLowPumpWorkouts).toBe(2);
  });

  it('uses custom window size', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 5 } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 1 } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 1 } }),
    ];

    // Only last 2 logs
    const result = analyzeRecoverySignals(logs, 2);
    expect(result.avgPumpQuality).toBe(1);
  });

  it('determines improving trend', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, performanceTrend: 'improving' } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, performanceTrend: 'improving' } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, performanceTrend: 'stable' } }),
    ];

    const result = analyzeRecoverySignals(logs);
    expect(result.performanceTrend).toBe('improving');
  });
});

// ==========================================
// generateRecommendation
// ==========================================

describe('generateRecommendation', () => {
  it('recommends volume increase for under_stimulated', () => {
    const analysis: RecoveryAnalysis = {
      overallStatus: 'under_stimulated',
      avgPumpQuality: 2,
      avgSoreness: 3,
      performanceTrend: 'stable',
      consecutiveLowPumpWorkouts: 2,
      consecutiveHighSorenessWorkouts: 0,
      painReported: false,
      painLocations: [],
    };

    const recommendation = generateRecommendation(analysis);

    expect(recommendation.volumeAdjustment.type).toBe('increase');
    expect(recommendation.volumeAdjustment.setsChange).toBe(1);
    expect(recommendation.suggestions.length).toBeGreaterThan(0);
  });

  it('recommends volume decrease for under_recovered', () => {
    const analysis: RecoveryAnalysis = {
      overallStatus: 'under_recovered',
      avgPumpQuality: 4,
      avgSoreness: 2,
      performanceTrend: 'declining',
      consecutiveLowPumpWorkouts: 0,
      consecutiveHighSorenessWorkouts: 2,
      painReported: false,
      painLocations: [],
    };

    const recommendation = generateRecommendation(analysis);

    expect(recommendation.volumeAdjustment.type).toBe('decrease');
    expect(recommendation.volumeAdjustment.setsChange).toBe(-1);
    expect(recommendation.volumeAdjustment.weightChange).toBe(-5);
    expect(recommendation.warnings.length).toBeGreaterThan(0);
  });

  it('recommends maintain for optimal status', () => {
    const analysis: RecoveryAnalysis = {
      overallStatus: 'optimal',
      avgPumpQuality: 4,
      avgSoreness: 3,
      performanceTrend: 'stable',
      consecutiveLowPumpWorkouts: 0,
      consecutiveHighSorenessWorkouts: 0,
      painReported: false,
      painLocations: [],
    };

    const recommendation = generateRecommendation(analysis);

    expect(recommendation.volumeAdjustment.type).toBe('maintain');
    expect(recommendation.volumeAdjustment.setsChange).toBe(0);
  });

  it('adds suggestions for improving trend', () => {
    const analysis: RecoveryAnalysis = {
      overallStatus: 'optimal',
      avgPumpQuality: 4,
      avgSoreness: 3,
      performanceTrend: 'improving',
      consecutiveLowPumpWorkouts: 0,
      consecutiveHighSorenessWorkouts: 0,
      painReported: false,
      painLocations: [],
    };

    const recommendation = generateRecommendation(analysis);
    expect(recommendation.suggestions.some(s => s.includes('увеличить вес'))).toBe(true);
  });

  it('adds pain warning when pain reported', () => {
    const analysis: RecoveryAnalysis = {
      overallStatus: 'optimal',
      avgPumpQuality: 4,
      avgSoreness: 3,
      performanceTrend: 'stable',
      consecutiveLowPumpWorkouts: 0,
      consecutiveHighSorenessWorkouts: 0,
      painReported: true,
      painLocations: ['колено', 'плечо'],
    };

    const recommendation = generateRecommendation(analysis);
    expect(recommendation.warnings.some(w => w.includes('боль'))).toBe(true);
    expect(recommendation.warnings.some(w => w.includes('колено'))).toBe(true);
  });

  it('warns about consecutive low pump', () => {
    const analysis: RecoveryAnalysis = {
      overallStatus: 'under_stimulated',
      avgPumpQuality: 2,
      avgSoreness: 3,
      performanceTrend: 'stable',
      consecutiveLowPumpWorkouts: 3,
      consecutiveHighSorenessWorkouts: 0,
      painReported: false,
      painLocations: [],
    };

    const recommendation = generateRecommendation(analysis);
    expect(recommendation.warnings.some(w => w.includes('3 тренировки'))).toBe(true);
  });
});

// ==========================================
// applyVolumeAdjustment
// ==========================================

describe('applyVolumeAdjustment', () => {
  it('returns unchanged session for maintain', () => {
    const session = createSession([
      { name: 'Bench Press', sets: 4, weight: 100 },
    ]);

    const adjustment: VolumeAdjustment = {
      type: 'maintain',
      setsChange: 0,
      weightChange: 0,
      reason: 'All good',
    };

    const result = applyVolumeAdjustment(session, adjustment);
    expect(result).toBe(session);
  });

  it('increases sets for increase adjustment', () => {
    const session = createSession([
      { name: 'Bench Press', sets: 3, weight: 100 },
    ]);

    const adjustment: VolumeAdjustment = {
      type: 'increase',
      setsChange: 1,
      weightChange: 0,
      reason: 'Need more volume',
    };

    const result = applyVolumeAdjustment(session, adjustment);
    expect(result.exercises[0].sets).toBe(4);
  });

  it('decreases sets for decrease adjustment', () => {
    const session = createSession([
      { name: 'Bench Press', sets: 4, weight: 100 },
    ]);

    const adjustment: VolumeAdjustment = {
      type: 'decrease',
      setsChange: -1,
      weightChange: 0,
      reason: 'Need rest',
    };

    const result = applyVolumeAdjustment(session, adjustment);
    expect(result.exercises[0].sets).toBe(3);
  });

  it('adjusts weight percentage', () => {
    const session = createSession([
      { name: 'Bench Press', sets: 4, weight: 100 },
    ]);

    const adjustment: VolumeAdjustment = {
      type: 'decrease',
      setsChange: 0,
      weightChange: -5,
      reason: 'Reduce intensity',
    };

    const result = applyVolumeAdjustment(session, adjustment);
    expect(result.exercises[0].weight).toBe(95);
  });

  it('clamps sets between 1 and 6', () => {
    const session = createSession([
      { name: 'Bench Press', sets: 6, weight: 100 },
    ]);

    const increaseAdjustment: VolumeAdjustment = {
      type: 'increase',
      setsChange: 2,
      weightChange: 0,
      reason: 'More volume',
    };

    const result1 = applyVolumeAdjustment(session, increaseAdjustment);
    expect(result1.exercises[0].sets).toBe(6); // Clamped to max

    const session2 = createSession([
      { name: 'Bench Press', sets: 1, weight: 100 },
    ]);

    const decreaseAdjustment: VolumeAdjustment = {
      type: 'decrease',
      setsChange: -2,
      weightChange: 0,
      reason: 'Less volume',
    };

    const result2 = applyVolumeAdjustment(session2, decreaseAdjustment);
    expect(result2.exercises[0].sets).toBe(1); // Clamped to min
  });

  it('applies adjustments to all exercises', () => {
    const session = createSession([
      { name: 'Bench Press', sets: 3, weight: 100 },
      { name: 'Squat', sets: 4, weight: 120 },
    ]);

    const adjustment: VolumeAdjustment = {
      type: 'increase',
      setsChange: 1,
      weightChange: 0,
      reason: 'More volume',
    };

    const result = applyVolumeAdjustment(session, adjustment);
    expect(result.exercises[0].sets).toBe(4);
    expect(result.exercises[1].sets).toBe(5);
  });
});

// ==========================================
// applyAutoregulationToProgram
// ==========================================

describe('applyAutoregulationToProgram', () => {
  it('returns unchanged program for optimal recovery', () => {
    const program = createProgram([
      createSession([{ name: 'Bench', sets: 4, weight: 100 }]),
    ]);

    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 4, performanceTrend: 'stable' } }),
    ];

    const result = applyAutoregulationToProgram(program, logs);
    expect(result.recommendation.volumeAdjustment.type).toBe('maintain');
    expect(result.program.sessions[0].exercises[0].sets).toBe(4);
  });

  it('increases volume for under-stimulated athletes', () => {
    const program = createProgram([
      createSession([{ name: 'Bench', sets: 3, weight: 100 }]),
    ]);

    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 1 } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 2 } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, pumpQuality: 1 } }),
    ];

    const result = applyAutoregulationToProgram(program, logs);
    expect(result.recommendation.volumeAdjustment.type).toBe('increase');
    expect(result.program.sessions[0].exercises[0].sets).toBe(4);
  });

  it('decreases volume for under-recovered athletes', () => {
    const program = createProgram([
      createSession([{ name: 'Bench', sets: 4, weight: 100 }]),
    ]);

    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, performanceTrend: 'declining' } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, performanceTrend: 'declining' } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, performanceTrend: 'declining' } }),
    ];

    const result = applyAutoregulationToProgram(program, logs);
    expect(result.recommendation.volumeAdjustment.type).toBe('decrease');
    expect(result.program.sessions[0].exercises[0].sets).toBe(3);
  });
});

// ==========================================
// getStatusMessage
// ==========================================

describe('getStatusMessage', () => {
  it('returns green message for optimal', () => {
    const analysis: RecoveryAnalysis = {
      overallStatus: 'optimal',
      avgPumpQuality: 4,
      avgSoreness: 3,
      performanceTrend: 'stable',
      consecutiveLowPumpWorkouts: 0,
      consecutiveHighSorenessWorkouts: 0,
      painReported: false,
      painLocations: [],
    };

    const message = getStatusMessage(analysis);
    expect(message.color).toBe('green');
    expect(message.title).toContain('Оптимальное');
  });

  it('returns yellow message for under_stimulated', () => {
    const analysis: RecoveryAnalysis = {
      overallStatus: 'under_stimulated',
      avgPumpQuality: 2,
      avgSoreness: 3,
      performanceTrend: 'stable',
      consecutiveLowPumpWorkouts: 2,
      consecutiveHighSorenessWorkouts: 0,
      painReported: false,
      painLocations: [],
    };

    const message = getStatusMessage(analysis);
    expect(message.color).toBe('yellow');
    expect(message.title).toContain('Недостаточный стимул');
  });

  it('returns red message for under_recovered', () => {
    const analysis: RecoveryAnalysis = {
      overallStatus: 'under_recovered',
      avgPumpQuality: 4,
      avgSoreness: 2,
      performanceTrend: 'declining',
      consecutiveLowPumpWorkouts: 0,
      consecutiveHighSorenessWorkouts: 2,
      painReported: false,
      painLocations: [],
    };

    const message = getStatusMessage(analysis);
    expect(message.color).toBe('red');
    expect(message.title).toContain('Недовосстановление');
  });
});
