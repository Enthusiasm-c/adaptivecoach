/**
 * Integration Tests for Architecture Fixes
 *
 * These tests verify that the "engine is connected to the wheels":
 * - Volume tracker data flows to AI prompts
 * - E1RM calculations inform weight suggestions
 * - Mesocycle multipliers are applied to displayed program
 * - User capabilities snapshot provides consistent data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCapabilitiesSnapshot, getSuggestedWeight, formatCapabilitiesForAI } from '../userCapabilities';
import { calculateWeeklyVolume } from '../volumeTracker';
import { getBestLiftForExercise, calculateE1RM } from '../../utils/strengthAnalysisUtils';
import { getProgramForCurrentPhase, createInitialMesocycleState } from '../mesocycleService';
import { OnboardingProfile, WorkoutLog, TrainingProgram, ExperienceLevel, Goal, Location } from '../../types';

// ==========================================
// TEST FIXTURES
// ==========================================

const mockProfile: OnboardingProfile = {
  name: 'Тест',
  gender: 'Мужчина',
  age: 30,
  weight: 80,
  height: 180,
  experience: ExperienceLevel.Intermediate,
  goals: {
    primary: Goal.BuildMuscle,
    secondary: [],
  },
  trainingDays: ['monday', 'wednesday', 'friday'],
  sessionDuration: 60,
  location: Location.FitCube,
  hasInjuries: false,
};

const mockProgram: TrainingProgram = {
  sessions: [
    {
      name: 'День 1',
      exercises: [
        {
          name: 'Жим лежа',
          exerciseType: 'strength',
          sets: 3,
          reps: '10',
          rest: 90,
          weight: 60,
        },
        {
          name: 'Тяга верхнего блока',
          exerciseType: 'strength',
          sets: 3,
          reps: '12',
          rest: 60,
          weight: 50,
        },
      ],
    },
    {
      name: 'День 2',
      exercises: [
        {
          name: 'Приседания со штангой',
          exerciseType: 'strength',
          sets: 4,
          reps: '8',
          rest: 120,
          weight: 80,
        },
      ],
    },
  ],
};

const createMockLog = (exercises: Array<{
  name: string;
  sets: Array<{ weight: number; reps: number; isCompleted?: boolean }>;
}>): WorkoutLog => ({
  date: new Date().toISOString(),
  completedExercises: exercises.map(ex => ({
    name: ex.name,
    exerciseType: 'strength' as const,
    sets: ex.sets.length,
    reps: '10',
    completedSets: ex.sets.map(s => ({
      ...s,
      isCompleted: s.isCompleted ?? true,
    })),
    isWarmup: false,
  })),
  duration: 3600,
  feedback: {
    overallFeeling: 4,
    pumpQuality: 3,
    performanceTrend: 'stable',
    pain: { hasPain: false },
  },
});

// ==========================================
// VOLUME TRACKER TESTS
// ==========================================

describe('Volume Tracker Integration', () => {
  it('should calculate weekly volume from workout logs', () => {
    const logs: WorkoutLog[] = [
      createMockLog([
        { name: 'Жим лежа', sets: [{ weight: 60, reps: 10 }, { weight: 60, reps: 10 }, { weight: 60, reps: 8 }] },
        { name: 'Разводка гантелей', sets: [{ weight: 15, reps: 12 }, { weight: 15, reps: 12 }] },
      ]),
    ];

    const report = calculateWeeklyVolume(logs, ExperienceLevel.Intermediate);

    // Should have some muscle data
    expect(report.muscles.length).toBeGreaterThan(0);

    // Chest should have sets counted
    const chest = report.muscles.find(m => m.muscleId === 'chest');
    expect(chest).toBeDefined();
    expect(chest?.totalSets).toBeGreaterThan(0);
  });

  it('should exclude warmup exercises from volume calculation', () => {
    const logs: WorkoutLog[] = [{
      date: new Date().toISOString(),
      completedExercises: [
        {
          name: 'Жим лежа (разминка)',
          exerciseType: 'strength',
          sets: 2,
          reps: '10',
          completedSets: [{ weight: 20, reps: 10, isCompleted: true }, { weight: 30, reps: 10, isCompleted: true }],
          isWarmup: true, // This should be excluded
        },
        {
          name: 'Жим лежа',
          exerciseType: 'strength',
          sets: 3,
          reps: '10',
          completedSets: [{ weight: 60, reps: 10, isCompleted: true }, { weight: 60, reps: 10, isCompleted: true }, { weight: 60, reps: 8, isCompleted: true }],
          isWarmup: false,
        },
      ],
      duration: 3600,
      feedback: {
        overallFeeling: 4,
        pumpQuality: 3,
        performanceTrend: 'stable',
        pain: { hasPain: false },
      },
    }];

    const report = calculateWeeklyVolume(logs, ExperienceLevel.Intermediate);
    const chest = report.muscles.find(m => m.muscleId === 'chest');

    // Should only count the 3 working sets, not the 2 warmup sets
    expect(chest?.directSets).toBe(3);
  });
});

// ==========================================
// E1RM AND WEIGHT SUGGESTION TESTS
// ==========================================

describe('E1RM and Weight Suggestions', () => {
  it('should calculate E1RM correctly using Epley formula', () => {
    // 80kg x 8 reps = 80 * (1 + 8/30) = 80 * 1.267 = 101.3 ≈ 101
    const e1rm = calculateE1RM(80, 8);
    expect(e1rm).toBe(101);
  });

  it('should return weight itself for 1 rep', () => {
    const e1rm = calculateE1RM(100, 1);
    expect(e1rm).toBe(100);
  });

  it('should find best lift for an exercise from logs', () => {
    const logs: WorkoutLog[] = [
      createMockLog([
        { name: 'Жим лежа', sets: [{ weight: 60, reps: 10 }, { weight: 65, reps: 8 }] },
      ]),
      createMockLog([
        { name: 'Жим лежа', sets: [{ weight: 70, reps: 6 }, { weight: 70, reps: 5 }] },
      ]),
    ];

    const bestLift = getBestLiftForExercise('Жим лежа', logs);

    expect(bestLift).not.toBeNull();
    // 70kg x 6 = E1RM 84, 65kg x 8 = E1RM 82, so 70x6 is best
    expect(bestLift?.weight).toBe(70);
    expect(bestLift?.reps).toBe(6);
  });

  it('should suggest working weight at 80% of E1RM', () => {
    const snapshot = createCapabilitiesSnapshot(mockProfile, mockProgram, [
      createMockLog([
        { name: 'Жим лежа', sets: [{ weight: 80, reps: 8 }] }, // E1RM = 101
      ]),
    ]);

    const suggestedWeight = getSuggestedWeight(snapshot, 'Жим лежа');

    // 80% of 101 = 80.8, rounded to 2.5 = 80
    expect(suggestedWeight).toBeGreaterThan(0);
    expect(suggestedWeight).toBeLessThanOrEqual(85);
    expect(suggestedWeight! % 2.5).toBe(0); // Should be multiple of 2.5
  });
});

// ==========================================
// MESOCYCLE INTEGRATION TESTS
// ==========================================

describe('Mesocycle Volume Multiplier', () => {
  it('should apply volume multiplier to program in intro phase', () => {
    const state = createInitialMesocycleState(mockProfile);

    // Initial state is 'intro' phase with 0.7 multiplier
    expect(state.mesocycle.phase).toBe('intro');
    expect(state.mesocycle.volumeMultiplier).toBe(0.7);

    const displayProgram = getProgramForCurrentPhase(mockProgram, state);

    // 3 sets * 0.7 = 2.1 → 2 sets
    expect(displayProgram.sessions[0].exercises[0].sets).toBe(2);
  });

  it('should increase sets during intensification phase', () => {
    // Create state with higher multiplier
    const state = {
      ...createInitialMesocycleState(mockProfile),
      mesocycle: {
        ...createInitialMesocycleState(mockProfile).mesocycle,
        volumeMultiplier: 1.2, // 20% increase
      },
    };

    const displayProgram = getProgramForCurrentPhase(mockProgram, state);

    // 3 sets * 1.2 = 3.6 → 4 sets
    expect(displayProgram.sessions[0].exercises[0].sets).toBe(4);
  });

  it('should decrease sets during deload phase', () => {
    // Create state with lower multiplier
    const state = {
      ...createInitialMesocycleState(mockProfile),
      mesocycle: {
        ...createInitialMesocycleState(mockProfile).mesocycle,
        volumeMultiplier: 0.6, // 40% decrease (deload)
      },
    };

    const displayProgram = getProgramForCurrentPhase(mockProgram, state);

    // 3 sets * 0.6 = 1.8 → 2 sets
    expect(displayProgram.sessions[0].exercises[0].sets).toBe(2);
  });
});

// ==========================================
// USER CAPABILITIES SNAPSHOT TESTS
// ==========================================

describe('User Capabilities Snapshot', () => {
  it('should create a complete snapshot from profile, program, and logs', () => {
    const logs = [
      createMockLog([
        { name: 'Жим лежа', sets: [{ weight: 60, reps: 10 }, { weight: 60, reps: 10 }] },
      ]),
      createMockLog([
        { name: 'Приседания со штангой', sets: [{ weight: 80, reps: 8 }] },
      ]),
    ];

    const snapshot = createCapabilitiesSnapshot(mockProfile, mockProgram, logs);

    expect(snapshot.profile).toBe(mockProfile);
    expect(snapshot.program).toBe(mockProgram);
    expect(snapshot.recentLogs.length).toBeLessThanOrEqual(6);
    expect(snapshot.volumeReport).toBeDefined();
    expect(snapshot.bestLifts).toBeInstanceOf(Map);
    expect(snapshot.syncedProgram).toBeDefined();
  });

  it('should identify muscles needing more volume', () => {
    // Create logs with only chest work
    const logs = [
      createMockLog([
        { name: 'Жим лежа', sets: [{ weight: 60, reps: 10 }] },
      ]),
    ];

    const snapshot = createCapabilitiesSnapshot(mockProfile, mockProgram, logs);

    // Should identify undertrained muscles
    expect(snapshot.volumeReport.undertrainedMuscles.length).toBeGreaterThan(0);
    expect(snapshot.needsMoreVolume.length).toBeGreaterThan(0);
  });

  it('should format capabilities for AI prompt', () => {
    const logs = [
      createMockLog([
        { name: 'Жим лежа', sets: [{ weight: 60, reps: 10 }, { weight: 65, reps: 8 }] },
      ]),
    ];

    const snapshot = createCapabilitiesSnapshot(mockProfile, mockProgram, logs);
    const formatted = formatCapabilitiesForAI(snapshot);

    expect(formatted).toContain('АНАЛИЗ ОБЪЁМА');
    expect(formatted.length).toBeGreaterThan(50);
  });
});

// ==========================================
// DATA FLOW INTEGRATION TESTS
// ==========================================

describe('End-to-End Data Flow', () => {
  it('should use best lifts for weight suggestions when logs exist', () => {
    const logs = [
      createMockLog([
        { name: 'Жим лежа', sets: [{ weight: 100, reps: 1 }] }, // E1RM = 100
      ]),
    ];

    const snapshot = createCapabilitiesSnapshot(mockProfile, mockProgram, logs);
    const suggestedWeight = getSuggestedWeight(snapshot, 'Жим лежа');

    // Should suggest 80% of 100 = 80
    expect(suggestedWeight).toBe(80);
  });

  it('should have consistent data across volume report and snapshot', () => {
    const logs = [
      createMockLog([
        { name: 'Жим лежа', sets: [{ weight: 60, reps: 10 }, { weight: 60, reps: 10 }, { weight: 60, reps: 10 }] },
      ]),
    ];

    const directReport = calculateWeeklyVolume(logs, ExperienceLevel.Intermediate);
    const snapshot = createCapabilitiesSnapshot(mockProfile, mockProgram, logs);

    // Volume reports should match
    expect(snapshot.volumeReport.muscles.length).toBe(directReport.muscles.length);
  });
});
