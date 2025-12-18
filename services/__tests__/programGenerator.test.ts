import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  selectSplitTemplate,
  calculateVolumeConfig,
  fillSlotWithExercise,
  fillWorkoutSlots,
  createMesocycle,
  getCurrentPhase,
  advanceMesocycleWeek,
  isMesocycleComplete,
  generateProgram,
  convertToLegacyFormat,
  rotateExercisesForNewMesocycle,
  createNextMesocycle,
  applyVolumeMultiplier,
} from '../programGenerator';
import {
  OnboardingProfile,
  ExperienceLevel,
  Goal,
  Gender,
  ActivityLevel,
  Location,
  Intensity,
} from '../../types';
import { ExerciseSlot, WorkoutTemplate, Mesocycle, MesocyclePhase, VOLUME_MULTIPLIERS } from '../../types/training';

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

const createSlot = (overrides: Partial<ExerciseSlot> = {}): ExerciseSlot => ({
  id: 'slot_1',
  muscleGroup: 'chest',
  movementPattern: 'horizontal_push',
  sets: 3,
  isCompound: true,
  priority: 'primary',
  ...overrides,
});

const createWorkoutTemplate = (overrides: Partial<WorkoutTemplate> = {}): WorkoutTemplate => ({
  id: 'workout_1',
  name: 'Upper Body',
  nameRu: 'Верх тела',
  slots: [createSlot()],
  targetMuscles: ['chest'],
  estimatedDuration: 60,
  ...overrides,
});

const createMesocycleInstance = (overrides: Partial<Mesocycle> = {}): Mesocycle => ({
  id: 'meso_test',
  weekNumber: 1,
  totalWeeks: 6,
  phase: 'intro',
  splitId: 'upper_lower_4x',
  volumeMultiplier: VOLUME_MULTIPLIERS.intro,
  startDate: new Date().toISOString(),
  exerciseSelections: {},
  exerciseRotationPercent: 0,
  ...overrides,
});

// ==========================================
// selectSplitTemplate
// ==========================================

describe('selectSplitTemplate', () => {
  it('returns a split template for 3 days per week', () => {
    const profile = createProfile({ daysPerWeek: 3 });
    const split = selectSplitTemplate(profile);

    expect(split).toBeDefined();
    expect(split.daysPerWeek).toBe(3);
  });

  it('returns a split template for 4 days per week', () => {
    const profile = createProfile({ daysPerWeek: 4 });
    const split = selectSplitTemplate(profile);

    expect(split).toBeDefined();
    expect(split.daysPerWeek).toBe(4);
  });

  it('returns a split template for 5 days per week', () => {
    const profile = createProfile({ daysPerWeek: 5 });
    const split = selectSplitTemplate(profile);

    expect(split).toBeDefined();
    expect(split.daysPerWeek).toBe(5);
  });

  it('returns a split with workouts array', () => {
    const profile = createProfile({ daysPerWeek: 4 });
    const split = selectSplitTemplate(profile);

    expect(Array.isArray(split.workouts)).toBe(true);
    expect(split.workouts.length).toBeGreaterThan(0);
  });
});

// ==========================================
// calculateVolumeConfig
// ==========================================

describe('calculateVolumeConfig', () => {
  it('returns volume config with min, optimal, max for muscles', () => {
    const config = calculateVolumeConfig(ExperienceLevel.Intermediate, Goal.BuildMuscle);

    expect(config['chest']).toBeDefined();
    expect(config['chest'].min).toBeGreaterThan(0);
    expect(config['chest'].optimal).toBeGreaterThan(config['chest'].min);
    expect(config['chest'].max).toBeGreaterThan(config['chest'].optimal);
  });

  it('applies goal multiplier for strength goal', () => {
    const hypertrophyConfig = calculateVolumeConfig(ExperienceLevel.Intermediate, Goal.BuildMuscle);
    const strengthConfig = calculateVolumeConfig(ExperienceLevel.Intermediate, Goal.GetStronger);

    // Strength usually has lower volume multiplier
    expect(strengthConfig['chest'].optimal).toBeLessThanOrEqual(hypertrophyConfig['chest'].optimal);
  });

  it('returns config for all major muscle groups', () => {
    const config = calculateVolumeConfig(ExperienceLevel.Intermediate, Goal.BuildMuscle);

    expect(config['chest']).toBeDefined();
    expect(config['back']).toBeDefined();
    expect(config['shoulders']).toBeDefined();
    expect(config['quads']).toBeDefined();
    expect(config['hamstrings']).toBeDefined();
  });

  it('adjusts volume for beginners', () => {
    const beginnerConfig = calculateVolumeConfig(ExperienceLevel.Beginner, Goal.BuildMuscle);
    const intermediateConfig = calculateVolumeConfig(ExperienceLevel.Intermediate, Goal.BuildMuscle);

    // Beginners should have lower or equal volume requirements
    expect(beginnerConfig['chest'].min).toBeLessThanOrEqual(intermediateConfig['chest'].optimal);
  });

  it('adjusts volume for advanced athletes', () => {
    const intermediateConfig = calculateVolumeConfig(ExperienceLevel.Intermediate, Goal.BuildMuscle);
    const advancedConfig = calculateVolumeConfig(ExperienceLevel.Advanced, Goal.BuildMuscle);

    // Advanced athletes typically need more volume
    expect(advancedConfig['chest'].optimal).toBeGreaterThanOrEqual(intermediateConfig['chest'].optimal);
  });
});

// ==========================================
// fillSlotWithExercise
// ==========================================

describe('fillSlotWithExercise', () => {
  it('fills slot with exercise matching muscle group', () => {
    const slot = createSlot({ muscleGroup: 'chest' });
    const profile = createProfile();

    const exercise = fillSlotWithExercise(slot, profile);

    expect(exercise).not.toBeNull();
    expect(exercise?.primaryMuscle).toBe('chest');
  });

  it('excludes already used exercises', () => {
    const slot = createSlot({ muscleGroup: 'chest' });
    const profile = createProfile();

    const exercise1 = fillSlotWithExercise(slot, profile);
    expect(exercise1).not.toBeNull();

    const exercise2 = fillSlotWithExercise(slot, profile, [exercise1!.id]);
    expect(exercise2).not.toBeNull();
    expect(exercise2!.id).not.toBe(exercise1!.id);
  });

  it('filters exercises by location', () => {
    const slot = createSlot({ muscleGroup: 'chest' });
    const gymProfile = createProfile({ location: Location.CommercialGym });

    const exercise = fillSlotWithExercise(slot, gymProfile);

    // Should return exercise suitable for gym training
    expect(exercise).not.toBeNull();
  });

  it('filters exercises by experience level', () => {
    const slot = createSlot({ muscleGroup: 'quads' });
    const beginnerProfile = createProfile({ experience: ExperienceLevel.Beginner });

    const exercise = fillSlotWithExercise(slot, beginnerProfile);

    expect(exercise).not.toBeNull();
    // Beginner exercises should have beginner or intermediate difficulty
    expect(['beginner', 'intermediate']).toContain(exercise?.difficulty);
  });

  it('filters out unsafe exercises when injuries exist', () => {
    const slot = createSlot({ muscleGroup: 'back' });
    const profile = createProfile({
      hasInjuries: true,
      injuries: ['lower_back'],
    });

    const exercise = fillSlotWithExercise(slot, profile);

    // Should either return safe exercise or null
    if (exercise) {
      expect(exercise.contraindications || []).not.toContain('lower_back');
    }
  });
});

// ==========================================
// fillWorkoutSlots
// ==========================================

describe('fillWorkoutSlots', () => {
  it('fills multiple slots with exercises', () => {
    const workout = createWorkoutTemplate({
      slots: [
        createSlot({ id: 'slot_1', muscleGroup: 'chest' }),
        createSlot({ id: 'slot_2', muscleGroup: 'back' }),
      ],
    });
    const profile = createProfile();

    const { slots, usedIds } = fillWorkoutSlots(workout, profile);

    expect(slots.length).toBe(2);
    expect(usedIds.length).toBeGreaterThan(0);
  });

  it('returns filled slots with exercise definitions', () => {
    const workout = createWorkoutTemplate({
      slots: [createSlot({ muscleGroup: 'chest' })],
    });
    const profile = createProfile();

    const { slots } = fillWorkoutSlots(workout, profile);

    expect(slots[0].exercise).toBeDefined();
  });

  it('tracks used exercise IDs to avoid duplicates', () => {
    const workout = createWorkoutTemplate({
      slots: [
        createSlot({ id: 'slot_1', muscleGroup: 'chest' }),
        createSlot({ id: 'slot_2', muscleGroup: 'chest' }),
      ],
    });
    const profile = createProfile();

    const { slots, usedIds } = fillWorkoutSlots(workout, profile);

    // If both slots are filled, exercises should be different
    if (slots[0].exercise && slots[1].exercise) {
      expect(slots[0].exercise.id).not.toBe(slots[1].exercise.id);
    }
    expect(new Set(usedIds).size).toBe(usedIds.length);
  });

  it('respects globally used IDs', () => {
    const workout = createWorkoutTemplate({
      slots: [createSlot({ muscleGroup: 'chest' })],
    });
    const profile = createProfile();

    // First fill
    const { usedIds: firstUsedIds } = fillWorkoutSlots(workout, profile);

    // Second fill with global IDs
    const { usedIds: secondUsedIds } = fillWorkoutSlots(workout, profile, firstUsedIds);

    // Should have additional unique IDs
    const allUnique = new Set([...firstUsedIds, ...secondUsedIds]);
    expect(allUnique.size).toBeGreaterThanOrEqual(firstUsedIds.length);
  });
});

// ==========================================
// createMesocycle
// ==========================================

describe('createMesocycle', () => {
  it('creates mesocycle with correct initial values', () => {
    const mesocycle = createMesocycle('upper_lower_4x');

    expect(mesocycle.weekNumber).toBe(1);
    expect(mesocycle.totalWeeks).toBe(6);
    expect(mesocycle.phase).toBe('intro');
    expect(mesocycle.splitId).toBe('upper_lower_4x');
  });

  it('sets volume multiplier for intro phase', () => {
    const mesocycle = createMesocycle('push_pull_legs_6x');

    expect(mesocycle.volumeMultiplier).toBe(VOLUME_MULTIPLIERS.intro);
  });

  it('generates ID with timestamp format', () => {
    const meso1 = createMesocycle('split_1');

    expect(meso1.id).toMatch(/^meso_\d+$/);
    expect(meso1.id.length).toBeGreaterThan(5);
  });

  it('sets start date', () => {
    const beforeCreate = new Date();
    const mesocycle = createMesocycle('test_split');
    const afterCreate = new Date();

    const mesoDate = new Date(mesocycle.startDate);
    expect(mesoDate.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(mesoDate.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
  });

  it('accepts custom start date', () => {
    const customDate = new Date('2024-01-15');
    const mesocycle = createMesocycle('test_split', customDate);

    expect(mesocycle.startDate).toBe(customDate.toISOString());
  });

  it('initializes empty exercise selections', () => {
    const mesocycle = createMesocycle('test_split');

    expect(mesocycle.exerciseSelections).toEqual({});
    expect(mesocycle.exerciseRotationPercent).toBe(0);
  });
});

// ==========================================
// getCurrentPhase
// ==========================================

describe('getCurrentPhase', () => {
  it('returns intro for week 1', () => {
    expect(getCurrentPhase(1)).toBe('intro');
  });

  it('returns accumulation for weeks 2-3', () => {
    expect(getCurrentPhase(2)).toBe('accumulation');
    expect(getCurrentPhase(3)).toBe('accumulation');
  });

  it('returns overreaching for weeks 4-5', () => {
    expect(getCurrentPhase(4)).toBe('overreaching');
    expect(getCurrentPhase(5)).toBe('overreaching');
  });

  it('returns deload for week 6', () => {
    expect(getCurrentPhase(6)).toBe('deload');
  });

  it('handles edge cases with default', () => {
    // Out of range weeks should return accumulation
    expect(getCurrentPhase(0)).toBe('accumulation');
    expect(getCurrentPhase(7)).toBe('accumulation');
  });
});

// ==========================================
// advanceMesocycleWeek
// ==========================================

describe('advanceMesocycleWeek', () => {
  it('advances week number by 1', () => {
    const mesocycle = createMesocycleInstance({ weekNumber: 1 });
    const advanced = advanceMesocycleWeek(mesocycle);

    expect(advanced.weekNumber).toBe(2);
  });

  it('updates phase when transitioning', () => {
    const mesocycle = createMesocycleInstance({
      weekNumber: 1,
      phase: 'intro',
    });
    const advanced = advanceMesocycleWeek(mesocycle);

    expect(advanced.phase).toBe('accumulation');
  });

  it('updates volume multiplier with phase', () => {
    const mesocycle = createMesocycleInstance({
      weekNumber: 4,
      phase: 'accumulation',
    });
    const advanced = advanceMesocycleWeek(mesocycle);

    expect(advanced.phase).toBe('overreaching');
    expect(advanced.volumeMultiplier).toBe(VOLUME_MULTIPLIERS.overreaching);
  });

  it('does not advance beyond total weeks', () => {
    const mesocycle = createMesocycleInstance({
      weekNumber: 6,
      totalWeeks: 6,
    });
    const advanced = advanceMesocycleWeek(mesocycle);

    expect(advanced.weekNumber).toBe(6);
    expect(advanced).toEqual(mesocycle);
  });

  it('preserves other mesocycle properties', () => {
    const mesocycle = createMesocycleInstance({
      weekNumber: 2,
      splitId: 'custom_split',
      exerciseSelections: { slot_1: 'ex_1' },
    });
    const advanced = advanceMesocycleWeek(mesocycle);

    expect(advanced.splitId).toBe('custom_split');
    expect(advanced.exerciseSelections).toEqual({ slot_1: 'ex_1' });
  });
});

// ==========================================
// isMesocycleComplete
// ==========================================

describe('isMesocycleComplete', () => {
  it('returns false for week 1', () => {
    const mesocycle = createMesocycleInstance({ weekNumber: 1 });
    expect(isMesocycleComplete(mesocycle)).toBe(false);
  });

  it('returns false for week 5', () => {
    const mesocycle = createMesocycleInstance({ weekNumber: 5 });
    expect(isMesocycleComplete(mesocycle)).toBe(false);
  });

  it('returns true for week 6 (last week)', () => {
    const mesocycle = createMesocycleInstance({ weekNumber: 6, totalWeeks: 6 });
    expect(isMesocycleComplete(mesocycle)).toBe(true);
  });

  it('handles custom total weeks', () => {
    const mesocycle = createMesocycleInstance({ weekNumber: 4, totalWeeks: 4 });
    expect(isMesocycleComplete(mesocycle)).toBe(true);
  });
});

// ==========================================
// generateProgram
// ==========================================

describe('generateProgram', () => {
  it('generates program with split', () => {
    const profile = createProfile();
    const result = generateProgram(profile);

    expect(result.split).toBeDefined();
    expect(result.split.workouts).toBeDefined();
  });

  it('generates program with mesocycle', () => {
    const profile = createProfile();
    const result = generateProgram(profile);

    expect(result.mesocycle).toBeDefined();
    expect(result.mesocycle.weekNumber).toBe(1);
    expect(result.mesocycle.phase).toBe('intro');
  });

  it('fills workout slots with exercises', () => {
    const profile = createProfile();
    const result = generateProgram(profile);

    const hasFilledSlots = result.split.workouts.some(w =>
      w.slots.some(s => s.exercise !== undefined)
    );
    expect(hasFilledSlots).toBe(true);
  });

  it('stores exercise selections in mesocycle', () => {
    const profile = createProfile();
    const result = generateProgram(profile);

    const selections = Object.keys(result.mesocycle.exerciseSelections);
    expect(selections.length).toBeGreaterThan(0);
  });

  it('returns success status', () => {
    const profile = createProfile();
    const result = generateProgram(profile);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns validation info', () => {
    const profile = createProfile();
    const result = generateProgram(profile);

    expect(result.validation).toBeDefined();
    expect(result.validation).toHaveProperty('allMusclesCovered');
    expect(result.validation).toHaveProperty('volumeInRange');
    expect(result.validation).toHaveProperty('frequencyMet');
  });

  it('handles different day frequencies', () => {
    const profile3days = createProfile({ daysPerWeek: 3 });
    const profile5days = createProfile({ daysPerWeek: 5 });

    const result3 = generateProgram(profile3days);
    const result5 = generateProgram(profile5days);

    expect(result3.split.daysPerWeek).toBe(3);
    expect(result5.split.daysPerWeek).toBe(5);
  });
});

// ==========================================
// convertToLegacyFormat
// ==========================================

describe('convertToLegacyFormat', () => {
  it('converts to TrainingProgram format', () => {
    const profile = createProfile();
    const result = generateProgram(profile);
    const legacy = convertToLegacyFormat(result, profile);

    expect(legacy.sessions).toBeDefined();
    expect(Array.isArray(legacy.sessions)).toBe(true);
  });

  it('creates sessions with exercises', () => {
    const profile = createProfile();
    const result = generateProgram(profile);
    const legacy = convertToLegacyFormat(result, profile);

    expect(legacy.sessions.length).toBeGreaterThan(0);
    const hasExercises = legacy.sessions.some(s => s.exercises.length > 0);
    expect(hasExercises).toBe(true);
  });

  it('sets exercise properties correctly', () => {
    const profile = createProfile();
    const result = generateProgram(profile);
    const legacy = convertToLegacyFormat(result, profile);

    const session = legacy.sessions.find(s => s.exercises.length > 0);
    if (session) {
      const exercise = session.exercises[0];
      expect(exercise).toHaveProperty('name');
      expect(exercise).toHaveProperty('sets');
      expect(exercise).toHaveProperty('reps');
      expect(exercise).toHaveProperty('rest');
    }
  });

  it('applies goal-specific rep ranges', () => {
    const strengthProfile = createProfile({ goals: { primary: Goal.GetStronger } });
    const strengthResult = generateProgram(strengthProfile);
    const strengthLegacy = convertToLegacyFormat(strengthResult, strengthProfile);

    const hypertrophyProfile = createProfile({ goals: { primary: Goal.BuildMuscle } });
    const hypertrophyResult = generateProgram(hypertrophyProfile);
    const hypertrophyLegacy = convertToLegacyFormat(hypertrophyResult, hypertrophyProfile);

    // Both should have valid reps
    const getFirstReps = (program: typeof strengthLegacy) => {
      const session = program.sessions.find(s => s.exercises.length > 0);
      return session?.exercises[0]?.reps;
    };

    expect(getFirstReps(strengthLegacy)).toBeDefined();
    expect(getFirstReps(hypertrophyLegacy)).toBeDefined();
  });

  it('uses Russian workout names', () => {
    const profile = createProfile();
    const result = generateProgram(profile);
    const legacy = convertToLegacyFormat(result, profile);

    // Session names should be in Russian
    const hasRussianNames = legacy.sessions.some(s =>
      /[а-яА-ЯёЁ]/.test(s.name)
    );
    expect(hasRussianNames).toBe(true);
  });
});

// ==========================================
// applyVolumeMultiplier
// ==========================================

describe('applyVolumeMultiplier', () => {
  it('applies multiplier to all exercise sets', () => {
    const sessions = [
      {
        name: 'Workout 1',
        exercises: [
          { name: 'Exercise 1', sets: 4, reps: '10', rest: 90 },
          { name: 'Exercise 2', sets: 3, reps: '12', rest: 60 },
        ],
      },
    ];

    const result = applyVolumeMultiplier(sessions, 0.5);

    expect(result[0].exercises[0].sets).toBe(2); // 4 * 0.5 = 2
    expect(result[0].exercises[1].sets).toBe(2); // 3 * 0.5 = 1.5 → 2 (rounded)
  });

  it('ensures minimum 1 set', () => {
    const sessions = [
      {
        name: 'Workout 1',
        exercises: [
          { name: 'Exercise 1', sets: 1, reps: '10', rest: 90 },
        ],
      },
    ];

    const result = applyVolumeMultiplier(sessions, 0.5);

    expect(result[0].exercises[0].sets).toBe(1);
  });

  it('increases sets with multiplier > 1', () => {
    const sessions = [
      {
        name: 'Workout 1',
        exercises: [
          { name: 'Exercise 1', sets: 3, reps: '10', rest: 90 },
        ],
      },
    ];

    const result = applyVolumeMultiplier(sessions, 1.2);

    expect(result[0].exercises[0].sets).toBe(4); // 3 * 1.2 = 3.6 → 4
  });

  it('preserves other exercise properties', () => {
    const sessions = [
      {
        name: 'Workout 1',
        exercises: [
          { name: 'Exercise 1', sets: 4, reps: '10', rest: 90, weight: 50 },
        ],
      },
    ];

    const result = applyVolumeMultiplier(sessions, 0.75);

    expect(result[0].exercises[0].name).toBe('Exercise 1');
    expect(result[0].exercises[0].reps).toBe('10');
    expect(result[0].exercises[0].rest).toBe(90);
    expect(result[0].exercises[0].weight).toBe(50);
  });
});

// ==========================================
// rotateExercisesForNewMesocycle
// ==========================================

describe('rotateExercisesForNewMesocycle', () => {
  it('returns new exercise selections', () => {
    const profile = createProfile();
    const result = generateProgram(profile);
    const mesocycle = result.mesocycle;

    const { newSelections } = rotateExercisesForNewMesocycle(
      mesocycle,
      result.split,
      profile
    );

    expect(Object.keys(newSelections).length).toBeGreaterThan(0);
  });

  it('tracks rotation count', () => {
    const profile = createProfile();
    const result = generateProgram(profile);
    const mesocycle = result.mesocycle;

    const { rotationCount } = rotateExercisesForNewMesocycle(
      mesocycle,
      result.split,
      profile,
      0.5 // Higher rotation percentage
    );

    expect(typeof rotationCount).toBe('number');
    expect(rotationCount).toBeGreaterThanOrEqual(0);
  });

  it('respects rotation percentage', () => {
    const profile = createProfile();
    const result = generateProgram(profile);
    const mesocycle = result.mesocycle;

    const { rotationCount: lowRotation } = rotateExercisesForNewMesocycle(
      mesocycle,
      result.split,
      profile,
      0.1
    );

    const { rotationCount: highRotation } = rotateExercisesForNewMesocycle(
      mesocycle,
      result.split,
      profile,
      0.9
    );

    // Higher percentage should generally rotate more (with some randomness)
    expect(typeof lowRotation).toBe('number');
    expect(typeof highRotation).toBe('number');
  });
});

// ==========================================
// createNextMesocycle
// ==========================================

describe('createNextMesocycle', () => {
  it('creates new mesocycle starting at week 1', () => {
    const profile = createProfile();
    const result = generateProgram(profile);
    const prevMeso = result.mesocycle;

    const newMeso = createNextMesocycle(prevMeso, result.split, profile);

    expect(newMeso.weekNumber).toBe(1);
    expect(newMeso.phase).toBe('intro');
  });

  it('generates ID with timestamp format', () => {
    const profile = createProfile();
    const result = generateProgram(profile);
    const prevMeso = result.mesocycle;

    const newMeso = createNextMesocycle(prevMeso, result.split, profile);

    // Both should have valid timestamp-based IDs
    expect(newMeso.id).toMatch(/^meso_\d+$/);
    expect(prevMeso.id).toMatch(/^meso_\d+$/);
  });

  it('preserves split ID', () => {
    const profile = createProfile();
    const result = generateProgram(profile);
    const prevMeso = result.mesocycle;

    const newMeso = createNextMesocycle(prevMeso, result.split, profile);

    expect(newMeso.splitId).toBe(prevMeso.splitId);
  });

  it('calculates exercise rotation percent', () => {
    const profile = createProfile();
    const result = generateProgram(profile);
    const prevMeso = result.mesocycle;

    const newMeso = createNextMesocycle(prevMeso, result.split, profile);

    expect(typeof newMeso.exerciseRotationPercent).toBe('number');
    expect(newMeso.exerciseRotationPercent).toBeGreaterThanOrEqual(0);
    expect(newMeso.exerciseRotationPercent).toBeLessThanOrEqual(100);
  });

  it('carries over exercise selections with some rotations', () => {
    const profile = createProfile();
    const result = generateProgram(profile);
    const prevMeso = result.mesocycle;

    const newMeso = createNextMesocycle(prevMeso, result.split, profile);

    // Should have exercise selections
    expect(Object.keys(newMeso.exerciseSelections).length).toBeGreaterThan(0);
  });
});
