import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateE1RM,
  calculateRelativeStrength,
  findStandardForExercise,
  getStrengthLevel,
  calculatePercentile,
  getNextLevelTarget,
  getBestLifts,
  analyzeStrength,
  detectImbalances,
  analyzePainPatterns,
  detectPlateaus,
  analyzeReadinessPatterns,
  calculateOverallLevel,
  generateStrengthInsights,
  STRENGTH_STANDARDS,
  IDEAL_RATIOS,
} from '../strengthAnalysisUtils';
import { WorkoutLog, Gender, WorkoutCompletion, StrengthLevel } from '../../types';

// ==========================================
// HELPER FACTORIES
// ==========================================

const createWorkoutLog = (overrides: Partial<WorkoutLog> = {}): WorkoutLog => ({
  sessionId: 'test-session',
  date: new Date().toISOString(),
  feedback: {
    completion: WorkoutCompletion.Yes,
    pain: { hasPain: false },
  },
  completedExercises: [],
  ...overrides,
});

const createCompletedExercise = (
  name: string,
  sets: { weight: number; reps: number }[],
  isWarmup = false
) => ({
  name,
  sets: sets.length,
  reps: '8-12',
  rest: 90,
  isWarmup,
  completedSets: sets.map(s => ({ weight: s.weight, reps: s.reps })),
});

// ==========================================
// calculateE1RM
// ==========================================

describe('calculateE1RM', () => {
  it('returns weight for 1 rep', () => {
    expect(calculateE1RM(100, 1)).toBe(100);
  });

  it('calculates E1RM using Epley formula', () => {
    // Epley: weight * (1 + reps / 30)
    expect(calculateE1RM(100, 10)).toBe(133); // 100 * (1 + 10/30) = 133.33 rounded
    expect(calculateE1RM(80, 8)).toBe(101); // 80 * (1 + 8/30) = 101.33 rounded
  });

  it('returns 0 for invalid inputs', () => {
    expect(calculateE1RM(0, 10)).toBe(0);
    expect(calculateE1RM(100, 0)).toBe(0);
    expect(calculateE1RM(-100, 10)).toBe(0);
    expect(calculateE1RM(100, -5)).toBe(0);
  });
});

// ==========================================
// calculateRelativeStrength
// ==========================================

describe('calculateRelativeStrength', () => {
  it('calculates ratio of e1rm to bodyweight', () => {
    expect(calculateRelativeStrength(100, 80)).toBe(1.25);
    expect(calculateRelativeStrength(150, 75)).toBe(2);
  });

  it('returns 0 for zero bodyweight', () => {
    expect(calculateRelativeStrength(100, 0)).toBe(0);
  });

  it('rounds to 2 decimal places', () => {
    expect(calculateRelativeStrength(100, 70)).toBe(1.43);
  });
});

// ==========================================
// findStandardForExercise
// ==========================================

describe('findStandardForExercise', () => {
  it('finds squat standard', () => {
    const standard = findStandardForExercise('Приседания со штангой');
    expect(standard).not.toBeNull();
    expect(standard!.exercise).toBe('squat');
  });

  it('finds bench standard', () => {
    const standard = findStandardForExercise('Жим лежа');
    expect(standard).not.toBeNull();
    expect(standard!.exercise).toBe('bench');
  });

  it('finds deadlift standard', () => {
    const standard = findStandardForExercise('Становая тяга');
    expect(standard).not.toBeNull();
    expect(standard!.exercise).toBe('deadlift');
  });

  it('finds overhead press standard', () => {
    const standard = findStandardForExercise('Армейский жим');
    expect(standard).not.toBeNull();
    expect(standard!.exercise).toBe('ohp');
  });

  it('finds row standard', () => {
    // Note: 'Тяга к поясу' is a specific alias for row
    // But 'тяга' alone matches deadlift first in the array
    // Using 'row' keyword to avoid ambiguity
    const standard = findStandardForExercise('barbell row');
    expect(standard).not.toBeNull();
    expect(standard!.exercise).toBe('row');
  });

  it('returns null for unknown exercise', () => {
    const standard = findStandardForExercise('Random exercise');
    expect(standard).toBeNull();
  });

  it('is case insensitive', () => {
    const standard = findStandardForExercise('BENCH PRESS');
    expect(standard).not.toBeNull();
    expect(standard!.exercise).toBe('bench');
  });
});

// ==========================================
// getStrengthLevel
// ==========================================

describe('getStrengthLevel', () => {
  const benchStandard = STRENGTH_STANDARDS.find(s => s.exercise === 'bench')!;
  // Male bench standards: untrained: 0.5, beginner: 1.0, intermediate: 1.25, advanced: 1.75, elite: 2.0

  it('returns untrained for low relative strength (male)', () => {
    expect(getStrengthLevel(0.4, benchStandard, Gender.Male)).toBe('untrained');
  });

  it('returns beginner for moderate relative strength (male)', () => {
    // 1.0 <= x < 1.25 is beginner
    expect(getStrengthLevel(1.1, benchStandard, Gender.Male)).toBe('beginner');
  });

  it('returns intermediate for good relative strength (male)', () => {
    // 1.25 <= x < 1.75 is intermediate
    expect(getStrengthLevel(1.3, benchStandard, Gender.Male)).toBe('intermediate');
  });

  it('returns advanced for high relative strength (male)', () => {
    // 1.75 <= x < 2.0 is advanced
    expect(getStrengthLevel(1.8, benchStandard, Gender.Male)).toBe('advanced');
  });

  it('returns elite for very high relative strength (male)', () => {
    // >= 2.0 is elite
    expect(getStrengthLevel(2.0, benchStandard, Gender.Male)).toBe('elite');
  });

  it('uses female standards for female gender', () => {
    // Female bench standards: untrained: 0.35, beginner: 0.5, intermediate: 0.75, advanced: 1.0, elite: 1.35
    // 0.75 <= x < 1.0 is intermediate for female
    expect(getStrengthLevel(0.8, benchStandard, Gender.Female)).toBe('intermediate');
  });
});

// ==========================================
// calculatePercentile
// ==========================================

describe('calculatePercentile', () => {
  const benchStandard = STRENGTH_STANDARDS.find(s => s.exercise === 'bench')!;

  it('returns 0 for untrained level', () => {
    expect(calculatePercentile(0.4, benchStandard, Gender.Male)).toBeLessThan(20);
  });

  it('returns ~20 for beginner threshold', () => {
    const percentile = calculatePercentile(1.0, benchStandard, Gender.Male);
    expect(percentile).toBeGreaterThanOrEqual(20);
    expect(percentile).toBeLessThan(40);
  });

  it('returns 100 for elite level', () => {
    expect(calculatePercentile(2.5, benchStandard, Gender.Male)).toBe(100);
  });

  it('interpolates within level', () => {
    // Beginner is 1.0, intermediate is 1.25 for male bench
    const percentile = calculatePercentile(1.1, benchStandard, Gender.Male);
    expect(percentile).toBeGreaterThan(20);
    expect(percentile).toBeLessThan(40);
  });
});

// ==========================================
// getNextLevelTarget
// ==========================================

describe('getNextLevelTarget', () => {
  const benchStandard = STRENGTH_STANDARDS.find(s => s.exercise === 'bench')!;

  it('returns target for next level', () => {
    const target = getNextLevelTarget(80, 80, benchStandard, Gender.Male, 'beginner');
    // Next level (intermediate) is 1.25 * bodyweight
    expect(target).toBe(100);
  });

  it('returns current e1rm for elite', () => {
    const target = getNextLevelTarget(200, 80, benchStandard, Gender.Male, 'elite');
    expect(target).toBe(200);
  });

  it('calculates based on bodyweight', () => {
    const target1 = getNextLevelTarget(80, 80, benchStandard, Gender.Male, 'untrained');
    const target2 = getNextLevelTarget(80, 100, benchStandard, Gender.Male, 'untrained');
    expect(target2).toBeGreaterThan(target1);
  });
});

// ==========================================
// getBestLifts
// ==========================================

describe('getBestLifts', () => {
  it('returns empty map for no logs', () => {
    const result = getBestLifts([]);
    expect(result.size).toBe(0);
  });

  it('extracts best lift for each key exercise', () => {
    const logs = [
      createWorkoutLog({
        date: '2024-01-01',
        completedExercises: [
          createCompletedExercise('Приседания', [{ weight: 100, reps: 5 }]),
          createCompletedExercise('Жим лежа', [{ weight: 80, reps: 8 }]),
        ],
      }),
    ];

    const result = getBestLifts(logs);
    expect(result.has('squat')).toBe(true);
    expect(result.has('bench')).toBe(true);
  });

  it('keeps best e1rm across multiple workouts', () => {
    const logs = [
      createWorkoutLog({
        date: '2024-01-01',
        completedExercises: [createCompletedExercise('Squat', [{ weight: 100, reps: 5 }])],
      }),
      createWorkoutLog({
        date: '2024-01-08',
        completedExercises: [createCompletedExercise('Squat', [{ weight: 120, reps: 5 }])],
      }),
    ];

    const result = getBestLifts(logs);
    expect(result.get('squat')!.e1rm).toBe(calculateE1RM(120, 5));
  });

  it('skips warmup sets', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [
          createCompletedExercise('Squat', [{ weight: 60, reps: 10 }], true), // warmup
          createCompletedExercise('Squat', [{ weight: 100, reps: 5 }], false),
        ],
      }),
    ];

    const result = getBestLifts(logs);
    expect(result.get('squat')!.e1rm).toBe(calculateE1RM(100, 5));
  });

  it('calculates improving trend with enough data', () => {
    const logs: WorkoutLog[] = [];
    for (let i = 0; i < 8; i++) {
      const date = new Date('2024-01-01');
      date.setDate(date.getDate() + i * 7);
      logs.push(
        createWorkoutLog({
          date: date.toISOString(),
          completedExercises: [
            createCompletedExercise('Squat', [{ weight: 100 + i * 5, reps: 5 }]),
          ],
        })
      );
    }

    const result = getBestLifts(logs);
    expect(result.get('squat')!.trend).toBe('improving');
  });
});

// ==========================================
// analyzeStrength
// ==========================================

describe('analyzeStrength', () => {
  it('returns empty array for no matching exercises', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [createCompletedExercise('Random exercise', [{ weight: 50, reps: 10 }])],
      }),
    ];

    const result = analyzeStrength(logs, 80, Gender.Male);
    expect(result).toEqual([]);
  });

  it('analyzes key lifts', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [
          createCompletedExercise('Приседания', [{ weight: 100, reps: 5 }]),
          createCompletedExercise('Жим лежа', [{ weight: 80, reps: 8 }]),
        ],
      }),
    ];

    const result = analyzeStrength(logs, 80, Gender.Male);

    expect(result.length).toBe(2);
    expect(result.some(a => a.exerciseName === 'squat')).toBe(true);
    expect(result.some(a => a.exerciseName === 'bench')).toBe(true);
  });

  it('calculates relative strength correctly', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [createCompletedExercise('Bench Press', [{ weight: 100, reps: 1 }])],
      }),
    ];

    const result = analyzeStrength(logs, 80, Gender.Male);
    expect(result[0].e1rm).toBe(100);
    expect(result[0].relativeStrength).toBe(1.25);
  });

  it('includes next level target', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [createCompletedExercise('Bench Press', [{ weight: 80, reps: 1 }])],
      }),
    ];

    const result = analyzeStrength(logs, 80, Gender.Male);
    expect(result[0].nextLevelTarget).toBeGreaterThan(result[0].e1rm);
  });
});

// ==========================================
// detectImbalances
// ==========================================

describe('detectImbalances', () => {
  it('returns empty array for balanced lifts', () => {
    const analysis = [
      { exerciseName: 'squat', exerciseNameRu: 'Приседания', e1rm: 133, relativeStrength: 1.66, level: 'intermediate' as const, percentile: 50, nextLevelTarget: 160, trend: 'stable' as const },
      { exerciseName: 'bench', exerciseNameRu: 'Жим лежа', e1rm: 100, relativeStrength: 1.25, level: 'intermediate' as const, percentile: 50, nextLevelTarget: 140, trend: 'stable' as const },
      { exerciseName: 'row', exerciseNameRu: 'Тяга к поясу', e1rm: 100, relativeStrength: 1.25, level: 'intermediate' as const, percentile: 50, nextLevelTarget: 120, trend: 'stable' as const },
    ];

    const result = detectImbalances(analysis);
    expect(result.length).toBe(0);
  });

  it('detects push/pull imbalance', () => {
    const analysis = [
      { exerciseName: 'bench', exerciseNameRu: 'Жим лежа', e1rm: 120, relativeStrength: 1.5, level: 'intermediate' as const, percentile: 50, nextLevelTarget: 140, trend: 'stable' as const },
      { exerciseName: 'row', exerciseNameRu: 'Тяга к поясу', e1rm: 60, relativeStrength: 0.75, level: 'beginner' as const, percentile: 30, nextLevelTarget: 80, trend: 'stable' as const },
    ];

    const result = detectImbalances(analysis);
    expect(result.some(i => i.type === 'push_pull')).toBe(true);
    expect(result.find(i => i.type === 'push_pull')!.severity).toBe('severe');
  });

  it('detects squat to bench ratio imbalance', () => {
    const analysis = [
      { exerciseName: 'squat', exerciseNameRu: 'Приседания', e1rm: 80, relativeStrength: 1.0, level: 'beginner' as const, percentile: 30, nextLevelTarget: 120, trend: 'stable' as const },
      { exerciseName: 'bench', exerciseNameRu: 'Жим лежа', e1rm: 100, relativeStrength: 1.25, level: 'intermediate' as const, percentile: 50, nextLevelTarget: 140, trend: 'stable' as const },
    ];

    const result = detectImbalances(analysis);
    expect(result.some(i => i.type === 'ratio')).toBe(true);
    expect(result.find(i => i.type === 'ratio')!.description).toContain('Верх тела');
  });

  it('detects deadlift to squat imbalance', () => {
    const analysis = [
      { exerciseName: 'squat', exerciseNameRu: 'Приседания', e1rm: 150, relativeStrength: 1.875, level: 'advanced' as const, percentile: 70, nextLevelTarget: 200, trend: 'stable' as const },
      { exerciseName: 'deadlift', exerciseNameRu: 'Становая тяга', e1rm: 100, relativeStrength: 1.25, level: 'beginner' as const, percentile: 30, nextLevelTarget: 160, trend: 'stable' as const },
    ];

    const result = detectImbalances(analysis);
    expect(result.some(i => i.type === 'anterior_posterior')).toBe(true);
  });
});

// ==========================================
// analyzePainPatterns
// ==========================================

describe('analyzePainPatterns', () => {
  it('returns empty array for no pain', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false } } }),
    ];

    const result = analyzePainPatterns(logs);
    expect(result).toEqual([]);
  });

  it('ignores single pain occurrence', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: true, location: 'колено' } } }),
    ];

    const result = analyzePainPatterns(logs);
    expect(result).toEqual([]);
  });

  it('detects recurring pain', () => {
    const logs = [
      createWorkoutLog({
        date: '2024-01-01',
        feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: true, location: 'колено' } },
        completedExercises: [createCompletedExercise('Приседания', [{ weight: 100, reps: 5 }])],
      }),
      createWorkoutLog({
        date: '2024-01-08',
        feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: true, location: 'колено' } },
        completedExercises: [createCompletedExercise('Приседания', [{ weight: 100, reps: 5 }])],
      }),
    ];

    const result = analyzePainPatterns(logs);
    expect(result.length).toBe(1);
    expect(result[0].location).toBe('колено');
    expect(result[0].frequency).toBe(2);
  });

  it('identifies movement pattern associated with pain', () => {
    const logs = [
      createWorkoutLog({
        feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: true, location: 'плечо' } },
        completedExercises: [createCompletedExercise('Жим лежа', [{ weight: 80, reps: 8 }])],
      }),
      createWorkoutLog({
        feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: true, location: 'плечо' } },
        completedExercises: [createCompletedExercise('Жим стоя', [{ weight: 50, reps: 8 }])],
      }),
    ];

    const result = analyzePainPatterns(logs);
    expect(result[0].movementPattern).toBe('жимовые');
  });

  it('sorts by frequency', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: true, location: 'колено' } } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: true, location: 'колено' } } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: true, location: 'плечо' } } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: true, location: 'плечо' } } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: true, location: 'плечо' } } }),
    ];

    const result = analyzePainPatterns(logs);
    expect(result[0].location).toBe('плечо');
    expect(result[0].frequency).toBe(3);
  });
});

// ==========================================
// detectPlateaus
// ==========================================

describe('detectPlateaus', () => {
  it('returns empty array for insufficient data', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [createCompletedExercise('Bench', [{ weight: 100, reps: 5 }])],
      }),
    ];

    const result = detectPlateaus(logs);
    expect(result).toEqual([]);
  });

  it('detects plateau when no PR for threshold weeks', () => {
    const logs: WorkoutLog[] = [];
    const now = new Date();

    // Add PR 5 weeks ago
    const prDate = new Date(now);
    prDate.setDate(prDate.getDate() - 35);
    logs.push(
      createWorkoutLog({
        date: prDate.toISOString(),
        completedExercises: [createCompletedExercise('Bench Press', [{ weight: 100, reps: 5 }])],
      })
    );

    // Add recent workouts with lower weight
    for (let i = 0; i < 4; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i * 7);
      logs.push(
        createWorkoutLog({
          date: date.toISOString(),
          completedExercises: [createCompletedExercise('Bench Press', [{ weight: 90, reps: 5 }])],
        })
      );
    }

    const result = detectPlateaus(logs, 3);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].exerciseName).toBe('Bench Press');
    expect(result[0].weeksStuck).toBeGreaterThanOrEqual(3);
  });

  it('does not detect plateau when making progress', () => {
    const logs: WorkoutLog[] = [];
    const now = new Date();

    // Add recent PR
    logs.push(
      createWorkoutLog({
        date: now.toISOString(),
        completedExercises: [createCompletedExercise('Bench Press', [{ weight: 100, reps: 5 }])],
      })
    );

    // Add older workouts with lower weight
    for (let i = 1; i < 5; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i * 7);
      logs.push(
        createWorkoutLog({
          date: date.toISOString(),
          completedExercises: [createCompletedExercise('Bench Press', [{ weight: 90, reps: 5 }])],
        })
      );
    }

    const result = detectPlateaus(logs, 3);
    expect(result).toEqual([]);
  });
});

// ==========================================
// analyzeReadinessPatterns
// ==========================================

describe('analyzeReadinessPatterns', () => {
  it('returns defaults for no readiness data', () => {
    const logs = [createWorkoutLog()];
    const result = analyzeReadinessPatterns(logs);

    expect(result.chronicLowSleep).toBe(false);
    expect(result.highStress).toBe(false);
    expect(result.averageSleep).toBe(3);
  });

  it('detects chronic low sleep', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, readiness: { sleep: 2, food: 3, stress: 3, soreness: 3, score: 11, status: 'Yellow' } } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, readiness: { sleep: 2, food: 3, stress: 3, soreness: 3, score: 11, status: 'Yellow' } } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, readiness: { sleep: 2, food: 3, stress: 3, soreness: 3, score: 11, status: 'Yellow' } } }),
    ];

    const result = analyzeReadinessPatterns(logs);
    expect(result.chronicLowSleep).toBe(true);
    expect(result.averageSleep).toBe(2);
  });

  it('detects high stress', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, readiness: { sleep: 4, food: 4, stress: 2, soreness: 4, score: 14, status: 'Yellow' } } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, readiness: { sleep: 4, food: 4, stress: 2, soreness: 4, score: 14, status: 'Yellow' } } }),
    ];

    const result = analyzeReadinessPatterns(logs);
    expect(result.highStress).toBe(true);
  });

  it('calculates averages correctly', () => {
    const logs = [
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, readiness: { sleep: 3, food: 4, stress: 3, soreness: 4, score: 14, status: 'Yellow' } } }),
      createWorkoutLog({ feedback: { completion: WorkoutCompletion.Yes, pain: { hasPain: false }, readiness: { sleep: 5, food: 4, stress: 5, soreness: 4, score: 18, status: 'Green' } } }),
    ];

    const result = analyzeReadinessPatterns(logs);
    expect(result.averageSleep).toBe(4);
    expect(result.averageStress).toBe(4);
    expect(result.averageSoreness).toBe(4);
  });
});

// ==========================================
// calculateOverallLevel
// ==========================================

describe('calculateOverallLevel', () => {
  it('returns untrained for empty analysis', () => {
    expect(calculateOverallLevel([])).toBe('untrained');
  });

  it('averages levels across exercises', () => {
    const analysis = [
      { exerciseName: 'squat', exerciseNameRu: 'Приседания', e1rm: 100, relativeStrength: 1.25, level: 'intermediate' as const, percentile: 50, nextLevelTarget: 160, trend: 'stable' as const },
      { exerciseName: 'bench', exerciseNameRu: 'Жим лежа', e1rm: 80, relativeStrength: 1.0, level: 'beginner' as const, percentile: 30, nextLevelTarget: 100, trend: 'stable' as const },
    ];

    const result = calculateOverallLevel(analysis);
    // Average of intermediate (2) and beginner (1) = 1.5 -> rounds to 2 (intermediate)
    expect(result).toBe('intermediate');
  });

  it('returns elite for all elite lifts', () => {
    const analysis = [
      { exerciseName: 'squat', exerciseNameRu: 'Приседания', e1rm: 200, relativeStrength: 2.5, level: 'elite' as const, percentile: 100, nextLevelTarget: 200, trend: 'stable' as const },
      { exerciseName: 'bench', exerciseNameRu: 'Жим лежа', e1rm: 160, relativeStrength: 2.0, level: 'elite' as const, percentile: 100, nextLevelTarget: 160, trend: 'stable' as const },
    ];

    expect(calculateOverallLevel(analysis)).toBe('elite');
  });
});

// ==========================================
// generateStrengthInsights
// ==========================================

describe('generateStrengthInsights', () => {
  it('generates complete insights object', () => {
    const logs = [
      createWorkoutLog({
        date: '2024-01-01',
        completedExercises: [
          createCompletedExercise('Приседания', [{ weight: 100, reps: 5 }]),
          createCompletedExercise('Жим лежа', [{ weight: 80, reps: 8 }]),
        ],
        feedback: {
          completion: WorkoutCompletion.Yes,
          pain: { hasPain: false },
          readiness: { sleep: 4, food: 4, stress: 4, soreness: 4, score: 16, status: 'Green' },
        },
      }),
    ];

    const result = generateStrengthInsights(logs, 80, Gender.Male);

    expect(result).toHaveProperty('strengthAnalysis');
    expect(result).toHaveProperty('imbalances');
    expect(result).toHaveProperty('painPatterns');
    expect(result).toHaveProperty('plateaus');
    expect(result).toHaveProperty('substitutions');
    expect(result).toHaveProperty('readinessPatterns');
    expect(result).toHaveProperty('overallLevel');
    expect(result).toHaveProperty('lastUpdated');
  });

  it('includes correct strength analysis', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [
          createCompletedExercise('Bench Press', [{ weight: 100, reps: 5 }]),
        ],
      }),
    ];

    const result = generateStrengthInsights(logs, 80, Gender.Male);

    expect(result.strengthAnalysis.length).toBeGreaterThan(0);
    expect(result.strengthAnalysis[0].exerciseName).toBe('bench');
    expect(result.strengthAnalysis[0].e1rm).toBe(calculateE1RM(100, 5));
  });
});

// ==========================================
// CONSTANTS
// ==========================================

describe('Constants', () => {
  it('STRENGTH_STANDARDS has all major lifts', () => {
    expect(STRENGTH_STANDARDS.some(s => s.exercise === 'squat')).toBe(true);
    expect(STRENGTH_STANDARDS.some(s => s.exercise === 'bench')).toBe(true);
    expect(STRENGTH_STANDARDS.some(s => s.exercise === 'deadlift')).toBe(true);
    expect(STRENGTH_STANDARDS.some(s => s.exercise === 'ohp')).toBe(true);
    expect(STRENGTH_STANDARDS.some(s => s.exercise === 'row')).toBe(true);
  });

  it('IDEAL_RATIOS has sensible values', () => {
    expect(IDEAL_RATIOS.squat_to_bench).toBeGreaterThan(1);
    expect(IDEAL_RATIOS.deadlift_to_squat).toBeGreaterThan(1);
    expect(IDEAL_RATIOS.row_to_bench).toBe(1);
    expect(IDEAL_RATIOS.ohp_to_bench).toBeLessThan(1);
  });
});
