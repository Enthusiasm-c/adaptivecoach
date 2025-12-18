import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  pluralizeRu,
  formatKg,
  calculateStreaks,
  calculateWorkoutVolume,
  calculateTotalVolume,
  calculateWeeklyVolume,
  calculatePersonalRecords,
  calculateReadinessScore,
  generateWarmupSets,
  calculatePlates,
  getLastPerformance,
  getExerciseHistory,
  calculateLevel,
  calculateWeekComparison,
  getNextScheduledDay,
  calculateWeeklyProgress,
  calculateWeightProgression,
} from '../progressUtils';
import { WorkoutLog, CompletedExercise, WorkoutCompletion } from '../../types';

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
  sets: { weight: number; reps: number }[]
): CompletedExercise => ({
  name,
  sets: sets.length,
  reps: '8-12',
  rest: 90,
  completedSets: sets.map(s => ({ weight: s.weight, reps: s.reps })),
});

// ==========================================
// pluralizeRu
// ==========================================

describe('pluralizeRu', () => {
  it('returns "one" form for 1', () => {
    expect(pluralizeRu(1, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировка');
  });

  it('returns "few" form for 2-4', () => {
    expect(pluralizeRu(2, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировки');
    expect(pluralizeRu(3, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировки');
    expect(pluralizeRu(4, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировки');
  });

  it('returns "many" form for 5-20', () => {
    expect(pluralizeRu(5, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировок');
    expect(pluralizeRu(11, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировок');
    expect(pluralizeRu(15, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировок');
    expect(pluralizeRu(20, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировок');
  });

  it('returns "one" form for 21, 31, etc.', () => {
    expect(pluralizeRu(21, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировка');
    expect(pluralizeRu(31, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировка');
    expect(pluralizeRu(101, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировка');
  });

  it('returns "few" form for 22-24, 32-34, etc.', () => {
    expect(pluralizeRu(22, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировки');
    expect(pluralizeRu(33, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировки');
  });

  it('handles negative numbers', () => {
    expect(pluralizeRu(-1, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировка');
    expect(pluralizeRu(-5, 'тренировка', 'тренировки', 'тренировок')).toBe('тренировок');
  });
});

// ==========================================
// formatKg
// ==========================================

describe('formatKg', () => {
  it('formats small numbers', () => {
    expect(formatKg(100)).toMatch(/100.*кг/);
  });

  it('formats large numbers with separator', () => {
    const result = formatKg(8500);
    expect(result).toContain('кг');
    // Russian locale uses space as thousand separator
    expect(result).toMatch(/8[\s\u00A0]?500/);
  });

  it('rounds decimal numbers', () => {
    expect(formatKg(100.7)).toMatch(/101.*кг/);
    expect(formatKg(100.3)).toMatch(/100.*кг/);
  });
});

// ==========================================
// calculateStreaks
// ==========================================

describe('calculateStreaks', () => {
  it('returns 0 for empty logs', () => {
    const result = calculateStreaks([]);
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(0);
  });

  it('calculates streak for workout this week', () => {
    const today = new Date();
    const log = createWorkoutLog({ date: today.toISOString() });
    const result = calculateStreaks([log]);
    expect(result.currentStreak).toBe(1);
  });

  it('calculates streak across multiple weeks', () => {
    const logs: WorkoutLog[] = [];
    const today = new Date();

    // Add workouts for the past 4 weeks
    for (let i = 0; i < 4; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i * 7);
      logs.push(createWorkoutLog({ date: date.toISOString() }));
    }

    const result = calculateStreaks(logs);
    expect(result.currentStreak).toBe(4);
    expect(result.bestStreak).toBe(4);
  });

  it('handles shield protection with workouts', () => {
    const today = new Date();
    const shieldDate = new Date(today);
    shieldDate.setDate(shieldDate.getDate() - 3);

    // Need at least one workout for shield to be relevant
    const log = createWorkoutLog({ date: today.toISOString() });
    const result = calculateStreaks([log], { shieldUsedAt: shieldDate.toISOString() });
    // streakProtected indicates shield is active
    expect(typeof result.streakProtected).toBe('boolean');
  });

  it('shield expires after 7 days', () => {
    const today = new Date();
    const oldShieldDate = new Date(today);
    oldShieldDate.setDate(oldShieldDate.getDate() - 10);

    const result = calculateStreaks([], { shieldUsedAt: oldShieldDate.toISOString() });
    expect(result.streakProtected).toBe(false);
  });
});

// ==========================================
// calculateWorkoutVolume
// ==========================================

describe('calculateWorkoutVolume', () => {
  it('returns 0 for empty workout', () => {
    const log = createWorkoutLog();
    expect(calculateWorkoutVolume(log)).toBe(0);
  });

  it('calculates volume correctly (weight * reps)', () => {
    const log = createWorkoutLog({
      completedExercises: [
        createCompletedExercise('Bench Press', [
          { weight: 100, reps: 10 },
          { weight: 100, reps: 8 },
        ]),
      ],
    });

    // 100*10 + 100*8 = 1800
    expect(calculateWorkoutVolume(log)).toBe(1800);
  });

  it('sums volume across multiple exercises', () => {
    const log = createWorkoutLog({
      completedExercises: [
        createCompletedExercise('Bench Press', [{ weight: 100, reps: 10 }]),
        createCompletedExercise('Squat', [{ weight: 120, reps: 5 }]),
      ],
    });

    // 100*10 + 120*5 = 1600
    expect(calculateWorkoutVolume(log)).toBe(1600);
  });

  it('handles undefined/null exercises gracefully', () => {
    const log = createWorkoutLog({
      completedExercises: undefined as any,
    });
    expect(calculateWorkoutVolume(log)).toBe(0);
  });
});

// ==========================================
// calculateTotalVolume
// ==========================================

describe('calculateTotalVolume', () => {
  it('returns 0 for empty logs', () => {
    expect(calculateTotalVolume([])).toBe(0);
  });

  it('sums volume across all logs', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [createCompletedExercise('Bench', [{ weight: 100, reps: 10 }])],
      }),
      createWorkoutLog({
        completedExercises: [createCompletedExercise('Squat', [{ weight: 100, reps: 10 }])],
      }),
    ];

    expect(calculateTotalVolume(logs)).toBe(2000);
  });
});

// ==========================================
// calculateReadinessScore
// ==========================================

describe('calculateReadinessScore', () => {
  it('calculates Green status for high scores', () => {
    const result = calculateReadinessScore(5, 5, 5, 5);
    expect(result.score).toBe(20);
    expect(result.status).toBe('Green');
  });

  it('calculates Yellow status for medium scores', () => {
    const result = calculateReadinessScore(3, 3, 4, 4);
    expect(result.score).toBe(14);
    expect(result.status).toBe('Yellow');
  });

  it('calculates Red status for low scores', () => {
    const result = calculateReadinessScore(2, 2, 3, 3);
    expect(result.score).toBe(10);
    expect(result.status).toBe('Red');
  });

  it('stores individual component values', () => {
    const result = calculateReadinessScore(1, 2, 3, 4);
    expect(result.sleep).toBe(1);
    expect(result.food).toBe(2);
    expect(result.stress).toBe(3);
    expect(result.soreness).toBe(4);
  });
});

// ==========================================
// generateWarmupSets
// ==========================================

describe('generateWarmupSets', () => {
  it('returns empty array for very light weights', () => {
    expect(generateWarmupSets(20)).toEqual([]);
    expect(generateWarmupSets(15)).toEqual([]);
  });

  it('generates 1 warmup set for moderate weights (20-40kg)', () => {
    const warmups = generateWarmupSets(35);
    expect(warmups.length).toBe(1);
    expect(warmups[0].isWarmup).toBe(true);
  });

  it('generates 2 warmup sets for medium weights (40-60kg)', () => {
    const warmups = generateWarmupSets(50);
    expect(warmups.length).toBe(2);
  });

  it('generates 3 warmup sets for heavy weights (60-100kg)', () => {
    const warmups = generateWarmupSets(80);
    expect(warmups.length).toBe(3);
  });

  it('generates 4 warmup sets for very heavy weights (>100kg)', () => {
    const warmups = generateWarmupSets(120);
    expect(warmups.length).toBe(4);
    // 90% of 120 = 108, rounded to nearest 2.5 = 107.5
    expect(warmups[3].weight).toBe(107.5);
  });

  it('includes exercise name in warmup description', () => {
    const warmups = generateWarmupSets(80, 'Жим лежа');
    expect(warmups[0].name).toContain('Жим лежа');
  });
});

// ==========================================
// calculatePlates
// ==========================================

describe('calculatePlates', () => {
  it('returns empty array for bar weight only', () => {
    expect(calculatePlates(20, 20)).toEqual([]);
  });

  it('calculates correct plates for 60kg (20kg bar)', () => {
    const plates = calculatePlates(60, 20);
    // (60 - 20) / 2 = 20kg per side
    expect(plates).toContainEqual(expect.objectContaining({ weight: 20, count: 1 }));
  });

  it('calculates correct plates for 100kg', () => {
    const plates = calculatePlates(100, 20);
    // (100 - 20) / 2 = 40kg per side
    // Greedy algorithm: 25 + 15 = 40 (uses largest available first)
    const totalWeightPerSide = plates.reduce((sum, p) => sum + p.weight * p.count, 0);
    expect(totalWeightPerSide).toBe(40);
  });

  it('handles complex plate combinations', () => {
    const plates = calculatePlates(67.5, 20);
    // (67.5 - 20) / 2 = 23.75kg per side = 20 + 2.5 + 1.25
    expect(plates.some(p => p.weight === 20)).toBe(true);
    expect(plates.some(p => p.weight === 2.5)).toBe(true);
    expect(plates.some(p => p.weight === 1.25)).toBe(true);
  });

  it('uses custom bar weight', () => {
    const plates = calculatePlates(35, 15); // 15kg women's bar
    // (35 - 15) / 2 = 10kg per side
    expect(plates).toContainEqual(expect.objectContaining({ weight: 10, count: 1 }));
  });
});

// ==========================================
// calculateLevel
// ==========================================

describe('calculateLevel', () => {
  it('returns level 1 for no workouts', () => {
    const result = calculateLevel([]);
    expect(result.level).toBe(1);
    expect(result.xp).toBe(0);
  });

  it('increases level with more workouts', () => {
    const logs: WorkoutLog[] = [];
    for (let i = 0; i < 10; i++) {
      logs.push(
        createWorkoutLog({
          completedExercises: [
            createCompletedExercise('Bench', [
              { weight: 100, reps: 10 },
              { weight: 100, reps: 10 },
              { weight: 100, reps: 10 },
            ]),
          ],
        })
      );
    }

    const result = calculateLevel(logs);
    expect(result.level).toBeGreaterThan(1);
    expect(result.xp).toBeGreaterThan(0);
  });

  it('provides level progress percentage', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [createCompletedExercise('Bench', [{ weight: 50, reps: 10 }])],
      }),
    ];

    const result = calculateLevel(logs);
    expect(result.levelProgress).toBeGreaterThanOrEqual(0);
    expect(result.levelProgress).toBeLessThanOrEqual(100);
  });
});

// ==========================================
// calculatePersonalRecords
// ==========================================

describe('calculatePersonalRecords', () => {
  it('returns empty array for no logs', () => {
    expect(calculatePersonalRecords([])).toEqual([]);
  });

  it('detects squat PR', () => {
    const logs = [
      createWorkoutLog({
        date: '2024-01-01',
        completedExercises: [
          createCompletedExercise('Приседания со штангой', [{ weight: 100, reps: 5 }]),
        ],
      }),
    ];

    const records = calculatePersonalRecords(logs);
    expect(records.length).toBeGreaterThan(0);
    expect(records[0].exerciseName).toContain('Приседания');
  });

  it('detects bench press PR', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [
          createCompletedExercise('Жим лежа', [{ weight: 80, reps: 8 }]),
        ],
      }),
    ];

    const records = calculatePersonalRecords(logs);
    const benchRecord = records.find(r => r.exerciseName.toLowerCase().includes('жим'));
    expect(benchRecord).toBeDefined();
    expect(benchRecord!.e1rm).toBeGreaterThan(80);
  });

  it('calculates e1RM using Epley formula', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [
          createCompletedExercise('Bench Press', [{ weight: 100, reps: 10 }]),
        ],
      }),
    ];

    const records = calculatePersonalRecords(logs);
    // Epley: 100 * (1 + 10/30) = 133.33
    expect(records[0].e1rm).toBeCloseTo(133.33, 0);
  });

  it('keeps best record across multiple workouts', () => {
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

    const records = calculatePersonalRecords(logs);
    expect(records[0].weight).toBe(120);
  });
});

// ==========================================
// getLastPerformance
// ==========================================

describe('getLastPerformance', () => {
  it('returns null for no matching exercise', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [createCompletedExercise('Bench Press', [{ weight: 100, reps: 10 }])],
      }),
    ];

    expect(getLastPerformance('Squat', logs)).toBeNull();
  });

  it('returns formatted string for matching exercise', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [createCompletedExercise('Bench Press', [{ weight: 100, reps: 10 }])],
      }),
    ];

    const result = getLastPerformance('Bench Press', logs);
    expect(result).toBe('100kg x 10');
  });

  it('returns best set from last workout', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [
          createCompletedExercise('Bench Press', [
            { weight: 80, reps: 12 },
            { weight: 100, reps: 8 },
            { weight: 90, reps: 10 },
          ]),
        ],
      }),
    ];

    const result = getLastPerformance('Bench Press', logs);
    expect(result).toBe('100kg x 8');
  });
});

// ==========================================
// getExerciseHistory
// ==========================================

describe('getExerciseHistory', () => {
  it('returns empty array for no matching exercises', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [createCompletedExercise('Bench', [{ weight: 100, reps: 10 }])],
      }),
    ];

    expect(getExerciseHistory('Squat', logs)).toEqual([]);
  });

  it('returns history limited to specified count', () => {
    const logs: WorkoutLog[] = [];
    for (let i = 0; i < 10; i++) {
      logs.push(
        createWorkoutLog({
          date: `2024-01-${String(i + 1).padStart(2, '0')}`,
          completedExercises: [createCompletedExercise('Bench', [{ weight: 100 + i * 5, reps: 10 }])],
        })
      );
    }

    const history = getExerciseHistory('Bench', logs, 5);
    expect(history.length).toBe(5);
  });

  it('returns most recent workouts first', () => {
    const logs = [
      createWorkoutLog({
        date: '2024-01-01',
        completedExercises: [createCompletedExercise('Bench', [{ weight: 100, reps: 10 }])],
      }),
      createWorkoutLog({
        date: '2024-01-08',
        completedExercises: [createCompletedExercise('Bench', [{ weight: 110, reps: 10 }])],
      }),
    ];

    const history = getExerciseHistory('Bench', logs);
    expect(history[0].date).toBe('2024-01-08');
  });
});

// ==========================================
// calculateWeekComparison
// ==========================================

describe('calculateWeekComparison', () => {
  it('returns zero values for empty logs', () => {
    const result = calculateWeekComparison([]);
    expect(result.currentWeekVolume).toBe(0);
    expect(result.previousWeekVolume).toBe(0);
    expect(result.trend).toBe('same');
  });

  it('calculates current week volume', () => {
    const today = new Date();
    const logs = [
      createWorkoutLog({
        date: today.toISOString(),
        completedExercises: [createCompletedExercise('Bench', [{ weight: 100, reps: 10 }])],
      }),
    ];

    const result = calculateWeekComparison(logs);
    expect(result.currentWeekVolume).toBe(1000);
    expect(result.currentWeekDays).toBe(1);
  });

  it('detects upward trend', () => {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const logs = [
      createWorkoutLog({
        date: lastWeek.toISOString(),
        completedExercises: [createCompletedExercise('Bench', [{ weight: 100, reps: 10 }])],
      }),
      createWorkoutLog({
        date: today.toISOString(),
        completedExercises: [createCompletedExercise('Bench', [{ weight: 150, reps: 10 }])],
      }),
    ];

    const result = calculateWeekComparison(logs);
    expect(result.trend).toBe('up');
    expect(result.changePercent).toBeGreaterThan(0);
  });
});

// ==========================================
// getNextScheduledDay
// ==========================================

describe('getNextScheduledDay', () => {
  it('returns null for empty preferred days', () => {
    expect(getNextScheduledDay([])).toBeNull();
  });

  it('returns today if today is a scheduled day', () => {
    const today = new Date();
    const todayDay = today.getDay();

    const result = getNextScheduledDay([todayDay]);
    expect(result).not.toBeNull();
    expect(result!.daysUntil).toBe(0);
  });

  it('returns next scheduled day', () => {
    const today = new Date();
    const tomorrow = (today.getDay() + 1) % 7;

    const result = getNextScheduledDay([tomorrow]);
    expect(result).not.toBeNull();
    expect(result!.daysUntil).toBe(1);
  });

  it('wraps around to next week', () => {
    const today = new Date();
    const yesterday = (today.getDay() + 6) % 7; // Yesterday's day of week

    const result = getNextScheduledDay([yesterday]);
    expect(result).not.toBeNull();
    expect(result!.daysUntil).toBe(6);
  });
});

// ==========================================
// calculateWeightProgression
// ==========================================

describe('calculateWeightProgression', () => {
  it('returns empty array for no logs', () => {
    expect(calculateWeightProgression([])).toEqual([]);
  });

  it('returns empty array for single data point', () => {
    const logs = [
      createWorkoutLog({
        completedExercises: [createCompletedExercise('Squat', [{ weight: 100, reps: 5 }])],
      }),
    ];

    expect(calculateWeightProgression(logs)).toEqual([]);
  });

  it('tracks weight progression for key exercises', () => {
    const logs = [
      createWorkoutLog({
        date: '2024-01-01',
        completedExercises: [createCompletedExercise('Приседания', [{ weight: 100, reps: 5 }])],
      }),
      createWorkoutLog({
        date: '2024-01-08',
        completedExercises: [createCompletedExercise('Приседания', [{ weight: 110, reps: 5 }])],
      }),
    ];

    const progression = calculateWeightProgression(logs);
    expect(progression.length).toBe(1);
    expect(progression[0].currentWeight).toBe(110);
    expect(progression[0].previousWeight).toBe(100);
    expect(progression[0].changeFromPrevious).toBe(10);
    expect(progression[0].trend).toBe('up');
  });

  it('identifies declining trend', () => {
    const logs = [
      createWorkoutLog({
        date: '2024-01-01',
        completedExercises: [createCompletedExercise('Bench', [{ weight: 100, reps: 5 }])],
      }),
      createWorkoutLog({
        date: '2024-01-08',
        completedExercises: [createCompletedExercise('Bench', [{ weight: 90, reps: 5 }])],
      }),
    ];

    const progression = calculateWeightProgression(logs);
    expect(progression[0].trend).toBe('down');
    expect(progression[0].changeFromPrevious).toBe(-10);
  });
});
