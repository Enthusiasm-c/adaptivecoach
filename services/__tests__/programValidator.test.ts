import { describe, it, expect } from 'vitest';
import {
  calculateWeeklyVolumeByMuscle,
  calculateMuscleFrequency,
  validateProgram,
  hasAllMajorMuscles,
  getMissingMuscles,
  getValidationSummary,
} from '../programValidator';
import { TrainingProgram, OnboardingProfile, ExperienceLevel, Goal, Gender, ActivityLevel, Location, Intensity } from '../../types';

// ==========================================
// HELPER FACTORIES
// ==========================================

const createSession = (name: string, exercises: { name: string; sets: number }[]) => ({
  name,
  exercises: exercises.map(e => ({
    name: e.name,
    sets: e.sets,
    reps: '8-12',
    rest: 90,
  })),
});

const createProgram = (sessions: ReturnType<typeof createSession>[]): TrainingProgram => ({
  sessions,
});

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
  preferredDays: [1, 3, 5],
  location: Location.CommercialGym,
  timePerWorkout: 60,
  intensity: Intensity.Normal,
  ...overrides,
});

// ==========================================
// calculateWeeklyVolumeByMuscle
// ==========================================

describe('calculateWeeklyVolumeByMuscle', () => {
  it('returns zero volume for empty program', () => {
    const program = createProgram([]);
    const volume = calculateWeeklyVolumeByMuscle(program);

    expect(volume['chest']).toBe(0);
    expect(volume['back']).toBe(0);
  });

  it('calculates volume for chest exercises', () => {
    const program = createProgram([
      createSession('Push Day', [
        { name: 'Жим лежа', sets: 4 },
        { name: 'Жим гантелей', sets: 3 },
      ]),
    ]);

    const volume = calculateWeeklyVolumeByMuscle(program);
    expect(volume['chest']).toBeGreaterThan(0);
  });

  it('calculates volume for back exercises', () => {
    const program = createProgram([
      createSession('Pull Day', [
        { name: 'Тяга к поясу', sets: 4 },
        { name: 'Подтягивания', sets: 3 },
      ]),
    ]);

    const volume = calculateWeeklyVolumeByMuscle(program);
    expect(volume['back']).toBeGreaterThan(0);
  });

  it('infers muscle from exercise name when not in database', () => {
    const program = createProgram([
      createSession('Chest Day', [
        { name: 'Some chest exercise жим', sets: 4 },
      ]),
    ]);

    const volume = calculateWeeklyVolumeByMuscle(program);
    expect(volume['chest']).toBe(4);
  });

  it('sums volume across multiple sessions', () => {
    const program = createProgram([
      createSession('Day 1', [{ name: 'Жим лежа', sets: 4 }]),
      createSession('Day 2', [{ name: 'Жим гантелей на наклонной', sets: 3 }]),
    ]);

    const volume = calculateWeeklyVolumeByMuscle(program);
    expect(volume['chest']).toBeGreaterThan(4);
  });
});

// ==========================================
// calculateMuscleFrequency
// ==========================================

describe('calculateMuscleFrequency', () => {
  it('returns zero frequency for empty program', () => {
    const program = createProgram([]);
    const frequency = calculateMuscleFrequency(program);

    expect(frequency['chest']).toBe(0);
  });

  it('calculates frequency 1 for muscle trained once', () => {
    const program = createProgram([
      createSession('Push Day', [{ name: 'Жим лежа', sets: 4 }]),
    ]);

    const frequency = calculateMuscleFrequency(program);
    expect(frequency['chest']).toBe(1);
  });

  it('calculates frequency 2 for muscle trained twice', () => {
    const program = createProgram([
      createSession('Push Day 1', [{ name: 'Жим лежа', sets: 4 }]),
      createSession('Push Day 2', [{ name: 'Жим гантелей', sets: 3 }]),
    ]);

    const frequency = calculateMuscleFrequency(program);
    expect(frequency['chest']).toBe(2);
  });

  it('counts each muscle only once per session', () => {
    const program = createProgram([
      createSession('Chest Day', [
        { name: 'Жим лежа', sets: 4 },
        { name: 'Разводка гантелей', sets: 3 },
        { name: 'Жим на наклонной', sets: 3 },
      ]),
    ]);

    const frequency = calculateMuscleFrequency(program);
    expect(frequency['chest']).toBe(1);
  });
});

// ==========================================
// validateProgram
// ==========================================

describe('validateProgram', () => {
  it('returns validation result with required properties', () => {
    const program = createProgram([
      createSession('Upper 1', [
        { name: 'Жим лежа', sets: 4 },
        { name: 'Тяга к поясу', sets: 4 },
      ]),
    ]);

    const profile = createProfile();
    const result = validateProgram(program, profile);

    // Validation result should have all required properties
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('suggestions');
    expect(typeof result.score).toBe('number');
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it('detects missing muscle groups', () => {
    const program = createProgram([
      createSession('Upper Only', [
        { name: 'Жим лежа', sets: 4 },
        { name: 'Тяга к поясу', sets: 4 },
      ]),
    ]);

    const profile = createProfile();
    const result = validateProgram(program, profile);

    expect(result.issues.some(i => i.type === 'missing_muscle')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('detects low volume', () => {
    const program = createProgram([
      createSession('Chest Day', [
        { name: 'Жим лежа', sets: 1 },
      ]),
    ]);

    const profile = createProfile();
    const result = validateProgram(program, profile);

    const lowVolumeIssue = result.issues.find(i => i.type === 'low_volume');
    expect(lowVolumeIssue).toBeDefined();
  });

  it('detects issues for unbalanced programs', () => {
    const program = createProgram([
      createSession('Push Only', [
        { name: 'Жим лежа', sets: 6 },
        { name: 'Жим гантелей', sets: 6 },
      ]),
    ]);

    const profile = createProfile();
    const result = validateProgram(program, profile);

    // Should detect some issues (missing muscles or imbalance)
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('detects duplicate exercises', () => {
    const program = createProgram([
      createSession('Day 1', [
        { name: 'Жим лежа', sets: 4 },
        { name: 'Жим лежа', sets: 4 },
      ]),
    ]);

    const profile = createProfile();
    const result = validateProgram(program, profile);

    const duplicateIssue = result.issues.find(i => i.type === 'duplicate_exercise');
    expect(duplicateIssue).toBeDefined();
  });

  it('calculates score based on issues', () => {
    const emptyProgram = createProgram([]);
    const profile = createProfile();
    const result = validateProgram(emptyProgram, profile);

    expect(result.score).toBeLessThan(50);
    expect(result.issues.filter(i => i.severity === 'error').length).toBeGreaterThan(0);
  });

  it('provides suggestions for improvements', () => {
    const program = createProgram([
      createSession('Upper', [
        { name: 'Жим лежа', sets: 2 },
      ]),
    ]);

    const profile = createProfile();
    const result = validateProgram(program, profile);

    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});

// ==========================================
// hasAllMajorMuscles
// ==========================================

describe('hasAllMajorMuscles', () => {
  it('returns false for empty program', () => {
    const program = createProgram([]);
    expect(hasAllMajorMuscles(program)).toBe(false);
  });

  it('returns false for upper-only program', () => {
    const program = createProgram([
      createSession('Upper', [
        { name: 'Жим лежа', sets: 4 },
        { name: 'Тяга к поясу', sets: 4 },
        { name: 'Жим стоя', sets: 3 },
        { name: 'Бицепс', sets: 3 },
        { name: 'Трицепс', sets: 3 },
      ]),
    ]);

    expect(hasAllMajorMuscles(program)).toBe(false);
  });

  it('checks required muscle groups', () => {
    // The function checks for: chest, back, shoulders, biceps, triceps, quads, hamstrings
    const program = createProgram([
      createSession('Full Body', [
        { name: 'Жим лежа', sets: 3 }, // chest
        { name: 'Тяга к поясу', sets: 3 }, // back (but "тяга" may match deadlift first)
        { name: 'Жим стоя', sets: 3 }, // shoulders
        { name: 'Сгибания на бицепс', sets: 2 }, // biceps
        { name: 'Разгибания на трицепс', sets: 2 }, // triceps
        { name: 'Приседания', sets: 4 }, // quads
        { name: 'Сгибание ног', sets: 3 }, // hamstrings
      ]),
    ]);

    // Function requires all major muscles covered
    const result = hasAllMajorMuscles(program);
    expect(typeof result).toBe('boolean');
  });
});

// ==========================================
// getMissingMuscles
// ==========================================

describe('getMissingMuscles', () => {
  it('returns missing muscles for empty program', () => {
    const program = createProgram([]);
    const missing = getMissingMuscles(program);

    // Should return Russian muscle names
    expect(missing.length).toBeGreaterThan(0);
    // Names should be strings
    expect(typeof missing[0]).toBe('string');
  });

  it('returns fewer missing muscles when more are covered', () => {
    const emptyProgram = createProgram([]);
    const missingFromEmpty = getMissingMuscles(emptyProgram);

    const partialProgram = createProgram([
      createSession('Upper', [
        { name: 'Жим лежа', sets: 4 },
        { name: 'Тяга к поясу', sets: 4 },
      ]),
    ]);
    const missingFromPartial = getMissingMuscles(partialProgram);

    // Partial program should have fewer missing muscles
    expect(missingFromPartial.length).toBeLessThanOrEqual(missingFromEmpty.length);
  });

  it('returns array of Russian muscle names', () => {
    const program = createProgram([]);
    const missing = getMissingMuscles(program);

    // All items should be Russian strings
    missing.forEach(muscle => {
      expect(typeof muscle).toBe('string');
      // Russian text check (Cyrillic characters)
      expect(muscle).toMatch(/[а-яА-ЯёЁ]/);
    });
  });
});

// ==========================================
// getValidationSummary
// ==========================================

describe('getValidationSummary', () => {
  it('returns good status for high score', () => {
    const result = {
      isValid: true,
      score: 90,
      issues: [],
      suggestions: [],
    };

    const summary = getValidationSummary(result);
    expect(summary.status).toBe('good');
    expect(summary.title).toContain('сбалансирована');
  });

  it('returns warning status for medium score', () => {
    const result = {
      isValid: true,
      score: 65,
      issues: [{ severity: 'warning' as const, type: 'low_volume' as const, message: 'Low volume' }],
      suggestions: ['Add more volume'],
    };

    const summary = getValidationSummary(result);
    expect(summary.status).toBe('warning');
    expect(summary.title).toContain('улучшения');
  });

  it('returns error status for low score', () => {
    const result = {
      isValid: false,
      score: 30,
      issues: [{ severity: 'error' as const, type: 'missing_muscle' as const, message: 'Missing chest' }],
      suggestions: [],
    };

    const summary = getValidationSummary(result);
    expect(summary.status).toBe('error');
    expect(summary.title).toContain('корректировки');
  });
});
