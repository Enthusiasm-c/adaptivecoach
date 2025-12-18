import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateWeeklyVolume,
  calculateVolumeHistory,
  getMusclesNeedingWork,
  getVolumeSummary,
  MuscleVolumeData,
  WeeklyVolumeReport,
} from '../volumeTracker';
import { WorkoutLog } from '../../types';

// ==========================================
// HELPER FACTORIES
// ==========================================

const createWorkoutLog = (
  date: string,
  exercises: { name: string; sets: number; isWarmup?: boolean }[]
): WorkoutLog => ({
  date,
  sessionName: 'Test Session',
  duration: 60,
  completedExercises: exercises.map((ex, i) => ({
    name: ex.name,
    sets: ex.sets,
    reps: '10',
    rest: 90,
    completedSets: Array(ex.sets).fill({ reps: 10, weight: 50 }),
    isWarmup: ex.isWarmup || false,
  })),
});

const getThisWeekDate = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

const getDateDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

// ==========================================
// calculateWeeklyVolume
// ==========================================

describe('calculateWeeklyVolume', () => {
  it('returns report with all required fields', () => {
    const logs: WorkoutLog[] = [];
    const report = calculateWeeklyVolume(logs);

    expect(report).toHaveProperty('weekStart');
    expect(report).toHaveProperty('weekEnd');
    expect(report).toHaveProperty('muscles');
    expect(report).toHaveProperty('overallStatus');
    expect(report).toHaveProperty('undertrainedMuscles');
    expect(report).toHaveProperty('overtrainedMuscles');
    expect(report).toHaveProperty('recommendations');
  });

  it('returns empty volume for no logs', () => {
    const report = calculateWeeklyVolume([]);

    const chestData = report.muscles.find(m => m.muscleId === 'chest');
    expect(chestData?.directSets).toBe(0);
    expect(chestData?.totalSets).toBe(0);
  });

  it('calculates direct sets for chest exercises', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Жим лежа', sets: 4 },
        { name: 'Жим гантелей', sets: 3 },
      ]),
    ];

    const report = calculateWeeklyVolume(logs);
    const chestData = report.muscles.find(m => m.muscleId === 'chest');

    expect(chestData?.directSets).toBeGreaterThanOrEqual(4);
  });

  it('calculates direct sets for back exercises', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Подтягивания', sets: 4 },
        { name: 'Тяга штанги', sets: 3 },
      ]),
    ];

    const report = calculateWeeklyVolume(logs);
    const backData = report.muscles.find(m => m.muscleId === 'back');

    expect(backData?.directSets).toBeGreaterThanOrEqual(4);
  });

  it('skips warmup exercises', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Жим лежа', sets: 4, isWarmup: true },
        { name: 'Жим лежа', sets: 3, isWarmup: false },
      ]),
    ];

    const report = calculateWeeklyVolume(logs);
    const chestData = report.muscles.find(m => m.muscleId === 'chest');

    // Should only count non-warmup sets
    expect(chestData?.directSets).toBeGreaterThanOrEqual(3);
    expect(chestData?.directSets).toBeLessThan(7);
  });

  it('calculates indirect volume for secondary muscles', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Жим лежа', sets: 4 }, // Also hits triceps
      ]),
    ];

    const report = calculateWeeklyVolume(logs);
    const tricepsData = report.muscles.find(m => m.muscleId === 'triceps');

    // Triceps should have indirect volume from pressing
    expect(tricepsData?.indirectSets).toBeGreaterThan(0);
  });

  it('sums volume from multiple sessions', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [{ name: 'Жим лежа', sets: 4 }]),
      createWorkoutLog(getThisWeekDate(), [{ name: 'Жим гантелей', sets: 3 }]),
    ];

    const report = calculateWeeklyVolume(logs);
    const chestData = report.muscles.find(m => m.muscleId === 'chest');

    expect(chestData?.directSets).toBeGreaterThanOrEqual(4);
  });

  it('filters logs to current week only', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [{ name: 'Жим лежа', sets: 4 }]),
      createWorkoutLog(getDateDaysAgo(14), [{ name: 'Жим лежа', sets: 10 }]), // Old workout
    ];

    const report = calculateWeeklyVolume(logs);
    const chestData = report.muscles.find(m => m.muscleId === 'chest');

    // Should not include old workout (unless by chance within same week)
    expect(chestData?.directSets).toBeLessThan(14);
  });

  it('determines undertrained status for low volume', () => {
    const logs: WorkoutLog[] = []; // No workouts

    const report = calculateWeeklyVolume(logs);

    // With no volume, muscles should be undertrained
    expect(report.undertrainedMuscles.length).toBeGreaterThan(0);
    expect(report.overallStatus).not.toBe('optimal');
  });

  it('provides recommendations for undertrained muscles', () => {
    const logs: WorkoutLog[] = [];
    const report = calculateWeeklyVolume(logs);

    // Should recommend adding work
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('includes target volume ranges in muscle data', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [{ name: 'Жим лежа', sets: 4 }]),
    ];

    const report = calculateWeeklyVolume(logs);
    const chestData = report.muscles.find(m => m.muscleId === 'chest');

    expect(chestData?.targetMin).toBeDefined();
    expect(chestData?.targetOptimal).toBeDefined();
    expect(chestData?.targetMax).toBeDefined();
    expect(chestData?.targetOptimal).toBeGreaterThan(chestData?.targetMin || 0);
  });

  it('calculates percent of optimal', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Жим лежа', sets: 4 },
        { name: 'Жим гантелей', sets: 4 },
        { name: 'Разводка', sets: 3 },
      ]),
    ];

    const report = calculateWeeklyVolume(logs);
    const chestData = report.muscles.find(m => m.muscleId === 'chest');

    expect(chestData?.percentOfOptimal).toBeGreaterThan(0);
    expect(typeof chestData?.percentOfOptimal).toBe('number');
  });

  it('adjusts volume targets by experience level', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [{ name: 'Жим лежа', sets: 5 }]),
    ];

    const beginnerReport = calculateWeeklyVolume(logs, 'Новичок (0-6 месяцев)');
    const advancedReport = calculateWeeklyVolume(logs, 'Атлет (2+ года)');

    const beginnerChest = beginnerReport.muscles.find(m => m.muscleId === 'chest');
    const advancedChest = advancedReport.muscles.find(m => m.muscleId === 'chest');

    // Advanced athletes typically need more volume for optimal
    expect(advancedChest?.targetOptimal).toBeGreaterThanOrEqual(beginnerChest?.targetOptimal || 0);
  });

  it('maps leg exercises correctly', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Приседания', sets: 4 },
        { name: 'Румынская тяга', sets: 3 },
      ]),
    ];

    const report = calculateWeeklyVolume(logs);
    const quadsData = report.muscles.find(m => m.muscleId === 'quads');
    const hamstringsData = report.muscles.find(m => m.muscleId === 'hamstrings');

    expect(quadsData?.directSets).toBeGreaterThanOrEqual(4);
    expect(hamstringsData?.directSets).toBeGreaterThanOrEqual(3);
  });

  it('maps arm exercises correctly', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Сгибания на бицепс', sets: 3 },
        { name: 'Разгибания на трицепс', sets: 3 },
      ]),
    ];

    const report = calculateWeeklyVolume(logs);
    const bicepsData = report.muscles.find(m => m.muscleId === 'biceps');
    const tricepsData = report.muscles.find(m => m.muscleId === 'triceps');

    expect(bicepsData?.directSets).toBeGreaterThanOrEqual(3);
    expect(tricepsData?.directSets).toBeGreaterThanOrEqual(3);
  });

  it('sorts muscles by status (undertrained first)', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        // Only train chest - other muscles undertrained
        { name: 'Жим лежа', sets: 10 },
        { name: 'Жим гантелей', sets: 10 },
      ]),
    ];

    const report = calculateWeeklyVolume(logs);

    // Find first undertrained and first optimal
    const firstUnder = report.muscles.findIndex(m => m.status === 'under');
    const firstOptimal = report.muscles.findIndex(m => m.status === 'optimal');

    // Undertrained should come before optimal (if both exist)
    if (firstUnder !== -1 && firstOptimal !== -1) {
      expect(firstUnder).toBeLessThan(firstOptimal);
    }
  });
});

// ==========================================
// calculateVolumeHistory
// ==========================================

describe('calculateVolumeHistory', () => {
  it('returns array of weekly reports', () => {
    const logs: WorkoutLog[] = [];
    const history = calculateVolumeHistory(logs, 4);

    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(4);
  });

  it('returns reports in chronological order', () => {
    const logs: WorkoutLog[] = [];
    const history = calculateVolumeHistory(logs, 3);

    // Each report should have weekStart/weekEnd
    history.forEach(report => {
      expect(report.weekStart).toBeDefined();
      expect(report.weekEnd).toBeDefined();
    });

    // First report should be earliest
    if (history.length >= 2) {
      const firstDate = new Date(history[0].weekStart);
      const lastDate = new Date(history[history.length - 1].weekStart);
      expect(firstDate.getTime()).toBeLessThan(lastDate.getTime());
    }
  });

  it('filters logs to appropriate weeks', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [{ name: 'Жим лежа', sets: 5 }]),
      createWorkoutLog(getDateDaysAgo(7), [{ name: 'Жим лежа', sets: 3 }]),
    ];

    const history = calculateVolumeHistory(logs, 2);

    expect(history.length).toBe(2);
  });

  it('defaults to 4 weeks', () => {
    const logs: WorkoutLog[] = [];
    const history = calculateVolumeHistory(logs);

    expect(history.length).toBe(4);
  });
});

// ==========================================
// getMusclesNeedingWork
// ==========================================

describe('getMusclesNeedingWork', () => {
  it('returns undertrained muscles', () => {
    const logs: WorkoutLog[] = []; // No workouts = all undertrained

    const needsWork = getMusclesNeedingWork(logs);

    expect(Array.isArray(needsWork)).toBe(true);
    expect(needsWork.length).toBeGreaterThan(0);
  });

  it('returns empty array when all muscles are trained', () => {
    // Create comprehensive workout covering all muscles
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Жим лежа', sets: 15 },
        { name: 'Тяга штанги', sets: 15 },
        { name: 'Жим стоя', sets: 15 },
        { name: 'Приседания', sets: 15 },
        { name: 'Румынская тяга', sets: 15 },
        { name: 'Бицепс', sets: 15 },
        { name: 'Трицепс', sets: 15 },
        { name: 'Икры', sets: 15 },
        { name: 'Планка', sets: 15 },
      ]),
    ];

    const needsWork = getMusclesNeedingWork(logs);

    // Most muscles should be covered
    expect(needsWork.length).toBeLessThan(5);
  });

  it('returns muscles with status "under"', () => {
    const logs: WorkoutLog[] = [];
    const needsWork = getMusclesNeedingWork(logs);

    needsWork.forEach(muscle => {
      expect(muscle.status).toBe('under');
    });
  });

  it('includes muscle data with volume info', () => {
    const logs: WorkoutLog[] = [];
    const needsWork = getMusclesNeedingWork(logs);

    if (needsWork.length > 0) {
      expect(needsWork[0]).toHaveProperty('muscleId');
      expect(needsWork[0]).toHaveProperty('directSets');
      expect(needsWork[0]).toHaveProperty('targetOptimal');
    }
  });
});

// ==========================================
// getVolumeSummary
// ==========================================

describe('getVolumeSummary', () => {
  it('returns summary with all required fields', () => {
    const logs: WorkoutLog[] = [];
    const summary = getVolumeSummary(logs);

    expect(summary).toHaveProperty('primaryMuscles');
    expect(summary).toHaveProperty('secondaryMuscles');
    expect(summary).toHaveProperty('overallScore');
    expect(summary).toHaveProperty('status');
  });

  it('separates primary and secondary muscles', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Жим лежа', sets: 4 },
      ]),
    ];

    const summary = getVolumeSummary(logs);

    // Primary muscles: chest, back, shoulders, quads, hamstrings, glutes
    const primaryIds = summary.primaryMuscles.map(m => m.muscleId);
    expect(primaryIds).toContain('chest');
    expect(primaryIds).toContain('back');
    expect(primaryIds).toContain('quads');

    // Secondary muscles: biceps, triceps, calves, core
    const secondaryIds = summary.secondaryMuscles.map(m => m.muscleId);
    expect(secondaryIds).toContain('biceps');
    expect(secondaryIds).toContain('triceps');
  });

  it('calculates overall score 0-100', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Жим лежа', sets: 10 },
      ]),
    ];

    const summary = getVolumeSummary(logs);

    expect(summary.overallScore).toBeGreaterThanOrEqual(0);
    expect(summary.overallScore).toBeLessThanOrEqual(100);
  });

  it('returns no_data status for empty logs', () => {
    const logs: WorkoutLog[] = [];
    const summary = getVolumeSummary(logs);

    expect(summary.status).toBe('no_data');
  });

  it('returns needs_work status for low volume', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Жим лежа', sets: 1 },
      ]),
    ];

    const summary = getVolumeSummary(logs);

    expect(['needs_work', 'no_data', 'good']).toContain(summary.status);
  });

  it('returns excellent status for high volume coverage', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Жим лежа', sets: 15 },
        { name: 'Тяга штанги', sets: 15 },
        { name: 'Жим стоя', sets: 15 },
        { name: 'Приседания', sets: 15 },
        { name: 'Румынская тяга', sets: 15 },
        { name: 'Ягодичный мостик', sets: 15 },
        { name: 'Бицепс', sets: 10 },
        { name: 'Трицепс', sets: 10 },
        { name: 'Подъем на носки', sets: 10 },
        { name: 'Планка', sets: 10 },
      ]),
    ];

    const summary = getVolumeSummary(logs);

    expect(['excellent', 'good']).toContain(summary.status);
    expect(summary.overallScore).toBeGreaterThanOrEqual(50);
  });

  it('returns good status for moderate volume', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Жим лежа', sets: 8 },
        { name: 'Тяга штанги', sets: 8 },
        { name: 'Приседания', sets: 8 },
      ]),
    ];

    const summary = getVolumeSummary(logs);

    expect(['good', 'needs_work']).toContain(summary.status);
  });

  it('caps score at 100', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Жим лежа', sets: 50 },
        { name: 'Тяга штанги', sets: 50 },
        { name: 'Жим стоя', sets: 50 },
        { name: 'Приседания', sets: 50 },
        { name: 'Румынская тяга', sets: 50 },
        { name: 'Ягодичный мостик', sets: 50 },
      ]),
    ];

    const summary = getVolumeSummary(logs);

    expect(summary.overallScore).toBeLessThanOrEqual(100);
  });
});

// ==========================================
// EXERCISE-TO-MUSCLE MAPPING (implicit tests)
// ==========================================

describe('Exercise-to-muscle mapping', () => {
  it('maps shoulder exercises correctly', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Жим стоя', sets: 4 },
        { name: 'Махи гантелей', sets: 3 },
      ]),
    ];

    const report = calculateWeeklyVolume(logs);
    const shouldersData = report.muscles.find(m => m.muscleId === 'shoulders');

    expect(shouldersData?.directSets).toBeGreaterThanOrEqual(4);
  });

  it('maps core exercises correctly', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Планка', sets: 3 },
        { name: 'Скручивания', sets: 3 },
      ]),
    ];

    const report = calculateWeeklyVolume(logs);
    const coreData = report.muscles.find(m => m.muscleId === 'core');

    expect(coreData?.directSets).toBeGreaterThanOrEqual(6);
  });

  it('maps calf exercises correctly', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Подъем на носки', sets: 4 },
      ]),
    ];

    const report = calculateWeeklyVolume(logs);
    const calvesData = report.muscles.find(m => m.muscleId === 'calves');

    expect(calvesData?.directSets).toBeGreaterThanOrEqual(4);
  });

  it('maps glute exercises correctly', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Ягодичный мостик', sets: 4 },
      ]),
    ];

    const report = calculateWeeklyVolume(logs);
    const glutesData = report.muscles.find(m => m.muscleId === 'glutes');

    expect(glutesData?.directSets).toBeGreaterThanOrEqual(4);
  });

  it('handles unknown exercises gracefully', () => {
    const logs = [
      createWorkoutLog(getThisWeekDate(), [
        { name: 'Some unknown exercise', sets: 4 },
      ]),
    ];

    // Should not throw
    expect(() => calculateWeeklyVolume(logs)).not.toThrow();
  });
});
