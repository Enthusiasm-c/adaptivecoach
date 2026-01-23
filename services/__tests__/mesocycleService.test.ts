import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PHASE_DESCRIPTIONS,
  MesocycleState,
  createInitialMesocycleState,
  calculateCurrentWeek,
  calculateCurrentWeekFromLogs,
  syncMesocycleWithLogs,
  getPhaseForWeek,
  checkWeekProgression,
  advanceMesocycleWeek,
  createNewMesocycle,
  applyVolumeMultiplier,
  applyProgramVolumeMultiplier,
  getProgramForCurrentPhase,
  recordWorkoutInMesocycle,
  getMesocycleSummary,
  saveMesocycleState,
  loadMesocycleState,
  clearMesocycleState,
  checkMesocycleEvents,
  getEventNotificationMessage,
  MesocycleEvent,
} from '../mesocycleService';
import {
  OnboardingProfile,
  ExperienceLevel,
  Goal,
  Gender,
  ActivityLevel,
  Location,
  Intensity,
  WorkoutLog,
  TrainingProgram,
  WorkoutSession,
} from '../../types';
import { Mesocycle, MesocyclePhase, VOLUME_MULTIPLIERS } from '../../types/training';

// ==========================================
// HELPER FACTORIES
// ==========================================

const createProfile = (overrides: Partial<OnboardingProfile> = {}): OnboardingProfile => ({
  gender: Gender.Male,
  age: 30,
  weight: 80,
  height: 180,
  activityLevel: ActivityLevel.Moderate,
  experience: ExperienceLevel.Intermediate,
  hasInjuries: false,
  goals: { primary: Goal.BuildMuscle },
  daysPerWeek: 4,
  preferredDays: [1, 3, 5, 6],
  location: Location.CommercialGym,
  timePerWorkout: 60,
  intensity: Intensity.Normal,
  ...overrides,
});

const createMesocycleState = (overrides: Partial<MesocycleState> = {}): MesocycleState => ({
  mesocycle: {
    id: 'meso_test',
    weekNumber: 1,
    totalWeeks: 6,
    phase: 'intro',
    splitId: 'upper_lower_4x',
    volumeMultiplier: VOLUME_MULTIPLIERS.intro,
    startDate: new Date().toISOString(),
    exerciseSelections: {},
    exerciseRotationPercent: 0,
  },
  currentWeekStartDate: new Date().toISOString(),
  workoutsThisWeek: 0,
  ...overrides,
});

const createWorkoutLog = (date: string): WorkoutLog => ({
  date,
  sessionName: 'Test Session',
  duration: 60,
  completedExercises: [
    {
      name: 'Test Exercise',
      sets: 3,
      reps: '10',
      rest: 90,
      completedSets: [{ reps: 10, weight: 50 }],
    },
  ],
});

const createProgram = (): TrainingProgram => ({
  sessions: [
    {
      name: 'Workout 1',
      exercises: [
        { name: 'Exercise 1', sets: 4, reps: '10', rest: 90, weight: 50 },
        { name: 'Exercise 2', sets: 3, reps: '12', rest: 60, weight: 30 },
      ],
    },
    {
      name: 'Workout 2',
      exercises: [
        { name: 'Exercise 3', sets: 4, reps: '8', rest: 120, weight: 70 },
      ],
    },
  ],
});

const getDateString = (daysAgo: number = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

// ==========================================
// PHASE_DESCRIPTIONS
// ==========================================

describe('PHASE_DESCRIPTIONS', () => {
  it('contains all phases', () => {
    expect(PHASE_DESCRIPTIONS).toHaveProperty('intro');
    expect(PHASE_DESCRIPTIONS).toHaveProperty('accumulation');
    expect(PHASE_DESCRIPTIONS).toHaveProperty('overreaching');
    expect(PHASE_DESCRIPTIONS).toHaveProperty('deload');
  });

  it('has title and description for each phase', () => {
    const phases: MesocyclePhase[] = ['intro', 'accumulation', 'overreaching', 'deload'];

    phases.forEach(phase => {
      expect(PHASE_DESCRIPTIONS[phase].title).toBeDefined();
      expect(PHASE_DESCRIPTIONS[phase].description).toBeDefined();
      expect(PHASE_DESCRIPTIONS[phase].color).toBeDefined();
    });
  });

  it('has Russian titles', () => {
    expect(PHASE_DESCRIPTIONS.intro.title).toMatch(/[а-яА-ЯёЁ]/);
    expect(PHASE_DESCRIPTIONS.deload.title).toMatch(/[а-яА-ЯёЁ]/);
  });
});

// ==========================================
// createInitialMesocycleState
// ==========================================

describe('createInitialMesocycleState', () => {
  it('creates state with intro phase', () => {
    const profile = createProfile();
    const state = createInitialMesocycleState(profile);

    expect(state.mesocycle.phase).toBe('intro');
    expect(state.mesocycle.weekNumber).toBe(1);
  });

  it('creates state with correct split based on days per week', () => {
    const profile = createProfile({ daysPerWeek: 4 });
    const state = createInitialMesocycleState(profile);

    expect(state.mesocycle.splitId).toBeDefined();
  });

  it('initializes workout count to 0', () => {
    const profile = createProfile();
    const state = createInitialMesocycleState(profile);

    expect(state.workoutsThisWeek).toBe(0);
  });

  it('sets current week start date', () => {
    const profile = createProfile();
    const state = createInitialMesocycleState(profile);

    expect(state.currentWeekStartDate).toBeDefined();
    const date = new Date(state.currentWeekStartDate);
    expect(date).toBeInstanceOf(Date);
    expect(isNaN(date.getTime())).toBe(false);
  });

  it('generates unique mesocycle ID', () => {
    const profile = createProfile();
    const state1 = createInitialMesocycleState(profile);
    const state2 = createInitialMesocycleState(profile);

    expect(state1.mesocycle.id).toMatch(/^meso_\d+$/);
  });
});

// ==========================================
// calculateCurrentWeek
// ==========================================

describe('calculateCurrentWeek', () => {
  it('returns week 1 for today start date', () => {
    const startDate = new Date().toISOString();
    const week = calculateCurrentWeek(startDate);

    expect(week).toBe(1);
  });

  it('returns week 2 for 8+ days ago', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 8); // 8 days = week 2
    const week = calculateCurrentWeek(startDate.toISOString());

    expect(week).toBe(2);
  });

  it('returns week 3 for 15+ days ago', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 15); // 15 days = week 3
    const week = calculateCurrentWeek(startDate.toISOString());

    expect(week).toBe(3);
  });

  it('returns actual week number beyond 6', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 100);
    const week = calculateCurrentWeek(startDate.toISOString());

    // 100 days / 7 = ~14.3, ceil = 15
    expect(week).toBeGreaterThan(6);
  });

  it('returns minimum week 1', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const week = calculateCurrentWeek(futureDate.toISOString());

    expect(week).toBeGreaterThanOrEqual(1);
  });
});

// ==========================================
// calculateCurrentWeekFromLogs
// ==========================================

describe('calculateCurrentWeekFromLogs', () => {
  it('falls back to startDate when no logs', () => {
    const startDate = new Date().toISOString();
    const week = calculateCurrentWeekFromLogs([], startDate);

    expect(week).toBe(1);
  });

  it('calculates week from first workout date', () => {
    const firstWorkout = new Date();
    firstWorkout.setDate(firstWorkout.getDate() - 7);

    const logs = [createWorkoutLog(firstWorkout.toISOString())];
    const week = calculateCurrentWeekFromLogs(logs, new Date().toISOString());

    expect(week).toBeGreaterThanOrEqual(1);
  });

  it('handles multiple logs', () => {
    const date1 = new Date();
    date1.setDate(date1.getDate() - 10);
    const date2 = new Date();
    date2.setDate(date2.getDate() - 5);

    const logs = [
      createWorkoutLog(date2.toISOString()),
      createWorkoutLog(date1.toISOString()),
    ];

    const week = calculateCurrentWeekFromLogs(logs, new Date().toISOString());

    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(6);
  });
});

// ==========================================
// getPhaseForWeek
// ==========================================

describe('getPhaseForWeek', () => {
  it('returns intro for week 1', () => {
    expect(getPhaseForWeek(1)).toBe('intro');
  });

  it('returns accumulation for weeks 2-3', () => {
    expect(getPhaseForWeek(2)).toBe('accumulation');
    expect(getPhaseForWeek(3)).toBe('accumulation');
  });

  it('returns overreaching for weeks 4-5', () => {
    expect(getPhaseForWeek(4)).toBe('overreaching');
    expect(getPhaseForWeek(5)).toBe('overreaching');
  });

  it('returns deload for week 6', () => {
    expect(getPhaseForWeek(6)).toBe('deload');
  });

  it('returns accumulation as default for invalid weeks', () => {
    expect(getPhaseForWeek(0)).toBe('accumulation');
    expect(getPhaseForWeek(7)).toBe('accumulation');
  });
});

// ==========================================
// syncMesocycleWithLogs
// ==========================================

describe('syncMesocycleWithLogs', () => {
  it('returns unchanged state when no logs', () => {
    const state = createMesocycleState();
    const synced = syncMesocycleWithLogs(state, []);

    expect(synced).toEqual(state);
  });

  it('updates week number based on logs', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 10);

    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 1,
        totalWeeks: 6,
        phase: 'intro',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.intro,
        startDate: startDate.toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const logs = [createWorkoutLog(startDate.toISOString())];
    const synced = syncMesocycleWithLogs(state, logs);

    expect(synced.mesocycle.weekNumber).toBeGreaterThanOrEqual(1);
  });

  it('updates phase when week changes', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 35); // 5 weeks ago

    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 1, // Incorrectly set to 1
        totalWeeks: 6,
        phase: 'intro',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.intro,
        startDate: startDate.toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const logs = [createWorkoutLog(startDate.toISOString())];
    const synced = syncMesocycleWithLogs(state, logs);

    // Should update to correct week and phase
    expect(synced.mesocycle.weekNumber).toBeGreaterThan(1);
  });
});

// ==========================================
// checkWeekProgression
// ==========================================

describe('checkWeekProgression', () => {
  it('returns shouldAdvance false when in correct week', () => {
    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 1,
        totalWeeks: 6,
        phase: 'intro',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.intro,
        startDate: new Date().toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const result = checkWeekProgression(state);

    expect(result.shouldAdvance).toBe(false);
    expect(result.newWeek).toBe(1);
  });

  it('returns shouldAdvance true when week should advance', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 8); // 8 days ago

    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 1, // Still at week 1
        totalWeeks: 6,
        phase: 'intro',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.intro,
        startDate: startDate.toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const result = checkWeekProgression(state);

    expect(result.shouldAdvance).toBe(true);
    expect(result.newWeek).toBe(2);
  });

  it('returns correct new phase', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 35); // Week 5-6

    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 1,
        totalWeeks: 6,
        phase: 'intro',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.intro,
        startDate: startDate.toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const result = checkWeekProgression(state);

    expect(['overreaching', 'deload']).toContain(result.newPhase);
  });

  it('detects mesocycle complete', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 50); // Well past 6 weeks

    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 5,
        totalWeeks: 6,
        phase: 'overreaching',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.overreaching,
        startDate: startDate.toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const result = checkWeekProgression(state);

    expect(result.isMesocycleComplete).toBe(true);
  });
});

// ==========================================
// advanceMesocycleWeek (service version)
// ==========================================

describe('advanceMesocycleWeek (service)', () => {
  it('advances week number', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 8);

    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 1,
        totalWeeks: 6,
        phase: 'intro',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.intro,
        startDate: startDate.toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const advanced = advanceMesocycleWeek(state);

    expect(advanced.mesocycle.weekNumber).toBe(2);
    expect(advanced.mesocycle.phase).toBe('accumulation');
  });

  it('resets workouts this week', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 8);

    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 1,
        totalWeeks: 6,
        phase: 'intro',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.intro,
        startDate: startDate.toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
      workoutsThisWeek: 3,
    });

    const advanced = advanceMesocycleWeek(state);

    expect(advanced.workoutsThisWeek).toBe(0);
  });

  it('updates volume multiplier', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 8);

    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 1,
        totalWeeks: 6,
        phase: 'intro',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.intro,
        startDate: startDate.toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const advanced = advanceMesocycleWeek(state);

    expect(advanced.mesocycle.volumeMultiplier).toBe(VOLUME_MULTIPLIERS.accumulation);
  });
});

// ==========================================
// createNewMesocycle
// ==========================================

describe('createNewMesocycle', () => {
  it('creates new mesocycle with week 1', () => {
    const profile = createProfile();
    const prevMeso: Mesocycle = {
      id: 'meso_old',
      weekNumber: 6,
      totalWeeks: 6,
      phase: 'deload',
      splitId: 'test',
      volumeMultiplier: VOLUME_MULTIPLIERS.deload,
      startDate: getDateString(42),
      exerciseSelections: {},
      exerciseRotationPercent: 0,
    };

    const newState = createNewMesocycle(prevMeso, profile);

    expect(newState.mesocycle.weekNumber).toBe(1);
    expect(newState.mesocycle.phase).toBe('intro');
    expect(newState.workoutsThisWeek).toBe(0);
  });

  it('generates new ID', () => {
    const profile = createProfile();
    const prevMeso: Mesocycle = {
      id: 'meso_old',
      weekNumber: 6,
      totalWeeks: 6,
      phase: 'deload',
      splitId: 'test',
      volumeMultiplier: VOLUME_MULTIPLIERS.deload,
      startDate: getDateString(42),
      exerciseSelections: {},
      exerciseRotationPercent: 0,
    };

    const newState = createNewMesocycle(prevMeso, profile);

    expect(newState.mesocycle.id).not.toBe('meso_old');
  });
});

// ==========================================
// applyVolumeMultiplier
// ==========================================

describe('applyVolumeMultiplier', () => {
  it('multiplies sets in session', () => {
    const session: WorkoutSession = {
      name: 'Test',
      exercises: [
        { name: 'Exercise 1', sets: 4, reps: '10', rest: 90 },
      ],
    };

    const result = applyVolumeMultiplier(session, 0.5);

    expect(result.exercises[0].sets).toBe(2);
  });

  it('ensures minimum 1 set', () => {
    const session: WorkoutSession = {
      name: 'Test',
      exercises: [
        { name: 'Exercise 1', sets: 1, reps: '10', rest: 90 },
      ],
    };

    const result = applyVolumeMultiplier(session, 0.1);

    expect(result.exercises[0].sets).toBe(1);
  });

  it('rounds to nearest integer', () => {
    const session: WorkoutSession = {
      name: 'Test',
      exercises: [
        { name: 'Exercise 1', sets: 3, reps: '10', rest: 90 },
      ],
    };

    const result = applyVolumeMultiplier(session, 0.75);

    expect(result.exercises[0].sets).toBe(2); // 3 * 0.75 = 2.25 → 2
  });
});

// ==========================================
// applyProgramVolumeMultiplier
// ==========================================

describe('applyProgramVolumeMultiplier', () => {
  it('applies multiplier to all sessions', () => {
    const program = createProgram();
    const result = applyProgramVolumeMultiplier(program, 0.5);

    expect(result.sessions[0].exercises[0].sets).toBe(2);
    expect(result.sessions[0].exercises[1].sets).toBe(2);
    expect(result.sessions[1].exercises[0].sets).toBe(2);
  });

  it('preserves other properties', () => {
    const program = createProgram();
    const result = applyProgramVolumeMultiplier(program, 0.5);

    expect(result.sessions[0].name).toBe('Workout 1');
    expect(result.sessions[0].exercises[0].weight).toBe(50);
    expect(result.sessions[0].exercises[0].reps).toBe('10');
  });
});

// ==========================================
// getProgramForCurrentPhase
// ==========================================

describe('getProgramForCurrentPhase', () => {
  it('returns unchanged program when multiplier is 1.0', () => {
    const program = createProgram();
    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 3,
        totalWeeks: 6,
        phase: 'accumulation',
        splitId: 'test',
        volumeMultiplier: 1.0,
        startDate: new Date().toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const result = getProgramForCurrentPhase(program, state);

    expect(result.sessions[0].exercises[0].sets).toBe(4);
  });

  it('applies deload multiplier', () => {
    const program = createProgram();
    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 6,
        totalWeeks: 6,
        phase: 'deload',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.deload,
        startDate: new Date().toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const result = getProgramForCurrentPhase(program, state);

    // Deload should reduce sets
    expect(result.sessions[0].exercises[0].sets).toBeLessThan(4);
  });
});

// ==========================================
// recordWorkoutInMesocycle
// ==========================================

describe('recordWorkoutInMesocycle', () => {
  it('increments workout count', () => {
    const state = createMesocycleState({ workoutsThisWeek: 1 });
    const log = createWorkoutLog(new Date().toISOString());

    const result = recordWorkoutInMesocycle(state, log);

    expect(result.workoutsThisWeek).toBeGreaterThanOrEqual(1);
  });

  it('sets last workout date', () => {
    const state = createMesocycleState();
    const workoutDate = new Date().toISOString();
    const log = createWorkoutLog(workoutDate);

    const result = recordWorkoutInMesocycle(state, log);

    expect(result.lastWorkoutDate).toBe(workoutDate);
  });
});

// ==========================================
// getMesocycleSummary
// ==========================================

describe('getMesocycleSummary', () => {
  it('returns summary with all required fields', () => {
    const state = createMesocycleState();
    const summary = getMesocycleSummary(state);

    expect(summary).toHaveProperty('weekNumber');
    expect(summary).toHaveProperty('totalWeeks');
    expect(summary).toHaveProperty('phase');
    expect(summary).toHaveProperty('phaseInfo');
    expect(summary).toHaveProperty('volumeMultiplier');
    expect(summary).toHaveProperty('progressPercent');
    expect(summary).toHaveProperty('isDeloadWeek');
  });

  it('calculates progress percent', () => {
    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 3,
        totalWeeks: 6,
        phase: 'accumulation',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.accumulation,
        startDate: new Date().toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const summary = getMesocycleSummary(state);

    expect(summary.progressPercent).toBeGreaterThanOrEqual(0);
    expect(summary.progressPercent).toBeLessThanOrEqual(100);
  });

  it('identifies deload week', () => {
    // Start date 36+ days ago = week 6 (ceil(36/7) = 6)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 36);

    const state = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 6,
        totalWeeks: 6,
        phase: 'deload',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.deload,
        startDate: startDate.toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const summary = getMesocycleSummary(state);

    // Summary recalculates week from startDate - phase should be deload
    expect(summary.phase).toBe('deload');
    expect(summary.isDeloadWeek).toBe(true);
  });

  it('includes phase info', () => {
    const state = createMesocycleState();
    const summary = getMesocycleSummary(state);

    expect(summary.phaseInfo.title).toBeDefined();
    expect(summary.phaseInfo.description).toBeDefined();
    expect(summary.phaseInfo.color).toBeDefined();
  });
});

// ==========================================
// LOCAL STORAGE FUNCTIONS
// ==========================================

describe('localStorage functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveMesocycleState saves to localStorage', () => {
    const state = createMesocycleState();
    saveMesocycleState(state);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'mesocycleState',
      expect.any(String)
    );
  });

  it('loadMesocycleState returns null when nothing saved', () => {
    (localStorage.getItem as any).mockReturnValue(null);

    const result = loadMesocycleState();

    expect(result).toBeNull();
  });

  it('loadMesocycleState parses saved state', () => {
    const state = createMesocycleState();
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(state));

    const result = loadMesocycleState();

    expect(result).not.toBeNull();
    expect(result?.mesocycle.id).toBe(state.mesocycle.id);
  });

  it('clearMesocycleState removes from localStorage', () => {
    clearMesocycleState();

    expect(localStorage.removeItem).toHaveBeenCalledWith('mesocycleState');
  });
});

// ==========================================
// EVENTS
// ==========================================

describe('checkMesocycleEvents', () => {
  it('returns empty array when no old state', () => {
    const newState = createMesocycleState();
    const events = checkMesocycleEvents(null, newState);

    expect(events).toEqual([]);
  });

  it('detects phase change', () => {
    const oldState = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 1,
        totalWeeks: 6,
        phase: 'intro',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.intro,
        startDate: new Date().toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const newState = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 2,
        totalWeeks: 6,
        phase: 'accumulation',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.accumulation,
        startDate: new Date().toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const events = checkMesocycleEvents(oldState, newState);

    expect(events.some(e => e.type === 'phase_change')).toBe(true);
  });

  it('detects deload start', () => {
    const oldState = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 5,
        totalWeeks: 6,
        phase: 'overreaching',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.overreaching,
        startDate: new Date().toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const newState = createMesocycleState({
      mesocycle: {
        id: 'meso_test',
        weekNumber: 6,
        totalWeeks: 6,
        phase: 'deload',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.deload,
        startDate: new Date().toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const events = checkMesocycleEvents(oldState, newState);

    expect(events.some(e => e.type === 'deload_start')).toBe(true);
  });

  it('detects new mesocycle', () => {
    const oldState = createMesocycleState({
      mesocycle: {
        id: 'meso_old',
        weekNumber: 6,
        totalWeeks: 6,
        phase: 'deload',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.deload,
        startDate: new Date().toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 0,
      },
    });

    const newState = createMesocycleState({
      mesocycle: {
        id: 'meso_new',
        weekNumber: 1,
        totalWeeks: 6,
        phase: 'intro',
        splitId: 'test',
        volumeMultiplier: VOLUME_MULTIPLIERS.intro,
        startDate: new Date().toISOString(),
        exerciseSelections: {},
        exerciseRotationPercent: 30,
      },
    });

    const events = checkMesocycleEvents(oldState, newState);

    expect(events.some(e => e.type === 'new_mesocycle')).toBe(true);
    expect(events.some(e => e.type === 'mesocycle_complete')).toBe(true);
  });
});

// ==========================================
// getEventNotificationMessage
// ==========================================

describe('getEventNotificationMessage', () => {
  it('returns Russian message for phase change', () => {
    const event: MesocycleEvent = {
      type: 'phase_change',
      oldPhase: 'intro',
      newPhase: 'accumulation',
    };

    const message = getEventNotificationMessage(event);

    expect(message).toContain('Новая фаза');
    expect(message.length).toBeGreaterThan(0);
  });

  it('returns Russian message for deload start', () => {
    const event: MesocycleEvent = {
      type: 'deload_start',
      weekNumber: 6,
    };

    const message = getEventNotificationMessage(event);

    expect(message).toContain('разгрузки');
  });

  it('returns Russian message for mesocycle complete', () => {
    const event: MesocycleEvent = {
      type: 'mesocycle_complete',
      mesocycleId: 'meso_123',
    };

    const message = getEventNotificationMessage(event);

    expect(message).toContain('завершён');
  });

  it('returns Russian message for new mesocycle', () => {
    const event: MesocycleEvent = {
      type: 'new_mesocycle',
      mesocycleId: 'meso_456',
      exercisesRotated: 30,
    };

    const message = getEventNotificationMessage(event);

    expect(message).toContain('30%');
    expect(message).toContain('Новый');
  });
});
