import { describe, it, expect } from 'vitest';
import {
  extractLatestWeights,
  syncWeightsFromLogs,
  suggestWeightProgression,
  getAverageRirForExercise,
} from '../weightSync';
import { WorkoutLog, TrainingProgram } from '../../types';

// ==========================================
// HELPER FACTORIES
// ==========================================

const createWorkoutLog = (
  date: string,
  exercises: {
    name: string;
    sets: { reps: number; weight: number; rir?: number }[];
    isWarmup?: boolean;
  }[]
): WorkoutLog => ({
  date,
  sessionName: 'Test Session',
  duration: 60,
  completedExercises: exercises.map(ex => ({
    name: ex.name,
    sets: ex.sets.length,
    reps: '10',
    rest: 90,
    completedSets: ex.sets,
    isWarmup: ex.isWarmup || false,
  })),
});

const createProgram = (
  exercises: { name: string; sets: number; weight?: number }[]
): TrainingProgram => ({
  sessions: [
    {
      name: 'Test Session',
      exercises: exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets,
        reps: '10',
        rest: 90,
        weight: ex.weight,
      })),
    },
  ],
});

const getDateString = (daysAgo: number = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

// ==========================================
// extractLatestWeights
// ==========================================

describe('extractLatestWeights', () => {
  it('returns empty map for no logs', () => {
    const weights = extractLatestWeights([]);

    expect(weights.size).toBe(0);
  });

  it('extracts weight from single log', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60 }] },
      ]),
    ];

    const weights = extractLatestWeights(logs);

    expect(weights.size).toBe(1);
    expect(weights.get('жим лежа')).toBe(60);
  });

  it('extracts max weight from multiple sets', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        {
          name: 'Жим лежа',
          sets: [
            { reps: 10, weight: 50 },
            { reps: 10, weight: 55 },
            { reps: 8, weight: 60 },
          ],
        },
      ]),
    ];

    const weights = extractLatestWeights(logs);

    expect(weights.get('жим лежа')).toBe(60);
  });

  it('uses most recent log for same exercise', () => {
    const logs = [
      createWorkoutLog(getDateString(7), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 50 }] },
      ]),
      createWorkoutLog(getDateString(0), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60 }] },
      ]),
    ];

    const weights = extractLatestWeights(logs);

    expect(weights.get('жим лежа')).toBe(60);
  });

  it('skips warmup exercises', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 20 }], isWarmup: true },
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60 }], isWarmup: false },
      ]),
    ];

    const weights = extractLatestWeights(logs);

    expect(weights.get('жим лежа')).toBe(60);
  });

  it('normalizes exercise names', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим лежа со штангой', sets: [{ reps: 10, weight: 60 }] },
      ]),
    ];

    const weights = extractLatestWeights(logs);

    expect(weights.get('жим лежа')).toBe(60);
  });

  it('handles multiple exercises', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60 }] },
        { name: 'Приседания', sets: [{ reps: 8, weight: 80 }] },
        { name: 'Тяга к поясу', sets: [{ reps: 10, weight: 70 }] },
      ]),
    ];

    const weights = extractLatestWeights(logs);

    expect(weights.size).toBe(3);
    expect(weights.get('жим лежа')).toBe(60);
    expect(weights.get('приседания')).toBe(80);
  });

  it('ignores sets with zero weight', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        {
          name: 'Подтягивания',
          sets: [
            { reps: 10, weight: 0 },
            { reps: 8, weight: 0 },
          ],
        },
      ]),
    ];

    const weights = extractLatestWeights(logs);

    expect(weights.has('подтягивания')).toBe(false);
  });

  it('removes warmup prefix from exercise names', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Разминка: Жим лежа', sets: [{ reps: 10, weight: 30 }] },
      ]),
    ];

    const weights = extractLatestWeights(logs);

    expect(weights.get('жим лежа')).toBe(30);
  });
});

// ==========================================
// syncWeightsFromLogs
// ==========================================

describe('syncWeightsFromLogs', () => {
  it('returns unchanged program for no logs', () => {
    const program = createProgram([{ name: 'Жим лежа', sets: 4, weight: 50 }]);
    const result = syncWeightsFromLogs(program, []);

    expect(result).toEqual(program);
  });

  it('updates exercise weight from log', () => {
    const program = createProgram([{ name: 'Жим лежа', sets: 4, weight: 50 }]);
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60 }] },
      ]),
    ];

    const result = syncWeightsFromLogs(program, logs);

    expect(result.sessions[0].exercises[0].weight).toBe(60);
  });

  it('preserves other exercise properties', () => {
    const program = createProgram([{ name: 'Жим лежа', sets: 4, weight: 50 }]);
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60 }] },
      ]),
    ];

    const result = syncWeightsFromLogs(program, logs);

    expect(result.sessions[0].exercises[0].sets).toBe(4);
    expect(result.sessions[0].exercises[0].name).toBe('Жим лежа');
    expect(result.sessions[0].exercises[0].reps).toBe('10');
  });

  it('matches exercises with fuzzy matching', () => {
    const program = createProgram([{ name: 'Жим лежа', sets: 4, weight: 50 }]);
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим лежа со штангой', sets: [{ reps: 10, weight: 60 }] },
      ]),
    ];

    const result = syncWeightsFromLogs(program, logs);

    expect(result.sessions[0].exercises[0].weight).toBe(60);
  });

  it('updates multiple exercises', () => {
    const program = createProgram([
      { name: 'Жим лежа', sets: 4, weight: 50 },
      { name: 'Приседания', sets: 4, weight: 70 },
    ]);
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60 }] },
        { name: 'Приседания', sets: [{ reps: 8, weight: 90 }] },
      ]),
    ];

    const result = syncWeightsFromLogs(program, logs);

    expect(result.sessions[0].exercises[0].weight).toBe(60);
    expect(result.sessions[0].exercises[1].weight).toBe(90);
  });

  it('does not change exercise without log data', () => {
    const program = createProgram([
      { name: 'Жим лежа', sets: 4, weight: 50 },
      { name: 'Тяга к поясу', sets: 4, weight: 60 },
    ]);
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 70 }] },
      ]),
    ];

    const result = syncWeightsFromLogs(program, logs);

    expect(result.sessions[0].exercises[0].weight).toBe(70);
    expect(result.sessions[0].exercises[1].weight).toBe(60); // Unchanged
  });

  it('returns same reference when no changes', () => {
    const program = createProgram([{ name: 'Жим лежа', sets: 4, weight: 60 }]);
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60 }] },
      ]),
    ];

    const result = syncWeightsFromLogs(program, logs);

    expect(result).toBe(program);
  });

  it('handles empty weight in logs', () => {
    const program = createProgram([{ name: 'Подтягивания', sets: 4, weight: undefined }]);
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Подтягивания', sets: [{ reps: 10, weight: 0 }] },
      ]),
    ];

    const result = syncWeightsFromLogs(program, logs);

    // Should not change since log has no valid weight
    expect(result).toBe(program);
  });
});

// ==========================================
// suggestWeightProgression
// ==========================================

describe('suggestWeightProgression', () => {
  it('suggests no change when RIR is undefined', () => {
    const result = suggestWeightProgression(60, undefined);

    expect(result.suggestedWeight).toBe(60);
    expect(result.reason).toContain('Нет данных');
  });

  it('suggests increase when RIR >= 3', () => {
    const result = suggestWeightProgression(60, 3);

    expect(result.suggestedWeight).toBeGreaterThan(60);
    expect(result.reason).toContain('добавить');
  });

  it('suggests increase when RIR is 4', () => {
    const result = suggestWeightProgression(60, 4);

    expect(result.suggestedWeight).toBeGreaterThan(60);
  });

  it('suggests maintain when RIR is 1-2', () => {
    const result = suggestWeightProgression(60, 2);

    expect(result.suggestedWeight).toBe(60);
    expect(result.reason).toContain('оптимальная');
  });

  it('suggests maintain when RIR is 1', () => {
    const result = suggestWeightProgression(60, 1);

    expect(result.suggestedWeight).toBe(60);
  });

  it('suggests maintain when RIR is 0', () => {
    const result = suggestWeightProgression(60, 0);

    expect(result.suggestedWeight).toBe(60);
    expect(result.reason).toContain('RIR 0');
  });

  it('uses 2.5kg increment for weights >= 40kg', () => {
    const result = suggestWeightProgression(60, 3);

    expect(result.suggestedWeight).toBe(62.5);
  });

  it('uses percentage increase for lighter weights', () => {
    const result = suggestWeightProgression(20, 3);

    expect(result.suggestedWeight).toBeGreaterThan(20);
    expect(result.suggestedWeight).toBeLessThan(25);
  });

  it('rounds to nearest 0.5kg', () => {
    const result = suggestWeightProgression(45, 3);

    const decimal = result.suggestedWeight % 1;
    expect([0, 0.5]).toContain(decimal);
  });

  it('handles edge case of negative RIR', () => {
    const result = suggestWeightProgression(60, -1);

    expect(result.suggestedWeight).toBe(60);
  });
});

// ==========================================
// getAverageRirForExercise
// ==========================================

describe('getAverageRirForExercise', () => {
  it('returns undefined for no logs', () => {
    const result = getAverageRirForExercise('Жим лежа', []);

    expect(result).toBeUndefined();
  });

  it('returns undefined when exercise not in logs', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Приседания', sets: [{ reps: 10, weight: 80, rir: 2 }] },
      ]),
    ];

    const result = getAverageRirForExercise('Жим лежа', logs);

    expect(result).toBeUndefined();
  });

  it('calculates average RIR from single log', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        {
          name: 'Жим лежа',
          sets: [
            { reps: 10, weight: 60, rir: 2 },
            { reps: 10, weight: 60, rir: 2 },
            { reps: 8, weight: 60, rir: 1 },
          ],
        },
      ]),
    ];

    const result = getAverageRirForExercise('Жим лежа', logs);

    // Average of 2, 2, 1 = 1.67
    expect(result).toBeCloseTo(1.67, 1);
  });

  it('calculates average RIR from multiple logs', () => {
    const logs = [
      createWorkoutLog(getDateString(7), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60, rir: 3 }] },
      ]),
      createWorkoutLog(getDateString(0), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60, rir: 1 }] },
      ]),
    ];

    const result = getAverageRirForExercise('Жим лежа', logs);

    // Average of 3, 1 = 2
    expect(result).toBe(2);
  });

  it('uses lookback parameter', () => {
    const logs = [
      createWorkoutLog(getDateString(21), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60, rir: 5 }] },
      ]),
      createWorkoutLog(getDateString(14), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60, rir: 4 }] },
      ]),
      createWorkoutLog(getDateString(7), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60, rir: 3 }] },
      ]),
      createWorkoutLog(getDateString(0), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60, rir: 2 }] },
      ]),
    ];

    // Default lookback is 3, so only last 3 logs
    const result = getAverageRirForExercise('Жим лежа', logs, 3);

    // Average of 4, 3, 2 = 3
    expect(result).toBe(3);
  });

  it('matches exercises with fuzzy matching', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим лежа со штангой', sets: [{ reps: 10, weight: 60, rir: 2 }] },
      ]),
    ];

    const result = getAverageRirForExercise('Жим лежа', logs);

    expect(result).toBe(2);
  });

  it('skips warmup exercises', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 30, rir: 5 }], isWarmup: true },
        { name: 'Жим лежа', sets: [{ reps: 10, weight: 60, rir: 2 }], isWarmup: false },
      ]),
    ];

    const result = getAverageRirForExercise('Жим лежа', logs);

    expect(result).toBe(2);
  });

  it('skips sets without RIR', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        {
          name: 'Жим лежа',
          sets: [
            { reps: 10, weight: 60, rir: 2 },
            { reps: 10, weight: 60 }, // No RIR
            { reps: 8, weight: 60, rir: 1 },
          ],
        },
      ]),
    ];

    const result = getAverageRirForExercise('Жим лежа', logs);

    // Average of 2, 1 = 1.5
    expect(result).toBe(1.5);
  });

  it('returns undefined when no sets have RIR', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        {
          name: 'Жим лежа',
          sets: [
            { reps: 10, weight: 60 },
            { reps: 10, weight: 60 },
          ],
        },
      ]),
    ];

    const result = getAverageRirForExercise('Жим лежа', logs);

    expect(result).toBeUndefined();
  });

  it('handles RIR of 0', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        {
          name: 'Жим лежа',
          sets: [
            { reps: 10, weight: 60, rir: 0 },
            { reps: 8, weight: 60, rir: 0 },
          ],
        },
      ]),
    ];

    const result = getAverageRirForExercise('Жим лежа', logs);

    expect(result).toBe(0);
  });
});

// ==========================================
// EXERCISE NAME NORMALIZATION (implicit tests)
// ==========================================

describe('Exercise name normalization', () => {
  it('handles various equipment suffixes', () => {
    const logs = [
      createWorkoutLog(getDateString(3), [
        { name: 'Тяга штанги', sets: [{ reps: 10, weight: 60 }] },
      ]),
      createWorkoutLog(getDateString(2), [
        { name: 'Тяга с гантелями', sets: [{ reps: 10, weight: 30 }] },
      ]),
      createWorkoutLog(getDateString(0), [
        { name: 'Тяга гантелей', sets: [{ reps: 10, weight: 35 }] },
      ]),
    ];

    const weights = extractLatestWeights(logs);

    // Should normalize to "тяга"
    expect(weights.size).toBeGreaterThan(0);
  });

  it('handles trainer/machine suffixes', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Разгибание ног на тренажере', sets: [{ reps: 12, weight: 40 }] },
      ]),
    ];

    const weights = extractLatestWeights(logs);

    expect(weights.get('разгибание ног')).toBe(40);
  });

  it('handles bench suffixes', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Жим на скамье', sets: [{ reps: 10, weight: 60 }] },
      ]),
    ];

    const weights = extractLatestWeights(logs);

    expect(weights.get('жим')).toBe(60);
  });

  it('handles warmup prefix', () => {
    const logs = [
      createWorkoutLog(getDateString(), [
        { name: 'Warm-up: Bench Press', sets: [{ reps: 10, weight: 20 }] },
      ]),
    ];

    const weights = extractLatestWeights(logs);

    expect(weights.get('bench press')).toBe(20);
  });
});
