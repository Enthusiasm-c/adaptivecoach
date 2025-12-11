/**
 * Exercise Migration Utility
 *
 * Migrates cached training programs in localStorage to use:
 * 1. Updated exercise names from exerciseDatabase
 * 2. Exercise descriptions (notes field)
 * 3. exerciseId for linking to database
 */

import { ALL_EXERCISES } from '../data/exerciseDatabase';
import { TrainingProgram, Exercise } from '../types';
import { ExerciseDefinition } from '../types/training';

/**
 * Mapping of old exercise names to new exercise IDs
 * This handles the 8 exercises that were renamed
 */
const EXERCISE_NAME_MIGRATIONS: { [key: string]: string } = {
  'Кубковые приседания': 'goblet_squat',
  'Австралийские подтягивания': 'inverted_row',
  'Алмазные отжимания': 'diamond_push_ups',
  'Болгарские сплит-приседания': 'bulgarian_split_squat',
  'Гуд-морнинг (наклоны со штангой)': 'good_morning',
  'Скандинавские сгибания': 'nordic_curl',
  'Русские скручивания': 'russian_twist',
  'Мёртвый жук': 'dead_bug',
};

/**
 * Find exercise definition by old name (for migration)
 */
function findExerciseByOldName(oldName: string): ExerciseDefinition | undefined {
  const exerciseId = EXERCISE_NAME_MIGRATIONS[oldName];
  if (exerciseId) {
    return ALL_EXERCISES.find(e => e.id === exerciseId);
  }
  return undefined;
}

/**
 * Find exercise definition by current name (exact match)
 */
function findExerciseByName(name: string): ExerciseDefinition | undefined {
  return ALL_EXERCISES.find(e => e.name === name);
}

/**
 * Migrate a single exercise to include exerciseId, updated name, and description
 */
function migrateExercise(exercise: Exercise): Exercise {
  // If exercise already has an ID, use it
  if (exercise.exerciseId) {
    const exerciseDef = ALL_EXERCISES.find(e => e.id === exercise.exerciseId);
    if (exerciseDef) {
      return {
        ...exercise,
        exerciseId: exerciseDef.id,
        name: exerciseDef.name,
        description: exerciseDef.notes,
      };
    }
  }

  // Try to find by old name (for renamed exercises)
  const exerciseDefByOldName = findExerciseByOldName(exercise.name);
  if (exerciseDefByOldName) {
    return {
      ...exercise,
      exerciseId: exerciseDefByOldName.id,
      name: exerciseDefByOldName.name,
      description: exerciseDefByOldName.notes,
    };
  }

  // Try to find by current name
  const exerciseDefByName = findExerciseByName(exercise.name);
  if (exerciseDefByName) {
    return {
      ...exercise,
      exerciseId: exerciseDefByName.id,
      name: exerciseDefByName.name,
      description: exerciseDefByName.notes,
    };
  }

  // If not found, return as-is (but log a warning)
  console.warn('[Migration] Could not find exercise definition for:', exercise.name);
  return exercise;
}

/**
 * Migrate entire training program
 * Updates exercise names, adds descriptions, and adds exerciseId links
 */
export function migrateExerciseNamesAndDescriptions(
  program: TrainingProgram
): TrainingProgram {
  let migrationCount = 0;

  const updatedSessions = program.sessions.map(session => ({
    ...session,
    exercises: session.exercises.map(exercise => {
      const migrated = migrateExercise(exercise);

      // Count migrations (if anything changed)
      if (
        migrated.exerciseId !== exercise.exerciseId ||
        migrated.name !== exercise.name ||
        migrated.description !== exercise.description
      ) {
        migrationCount++;
      }

      return migrated;
    }),
  }));

  console.log(`[Migration] Migrated ${migrationCount} exercises`);

  return {
    ...program,
    sessions: updatedSessions,
  };
}

/**
 * Check if a program needs migration
 * Returns true if any exercise lacks exerciseId or has old names
 */
export function needsMigration(program: TrainingProgram): boolean {
  for (const session of program.sessions) {
    for (const exercise of session.exercises) {
      // Check if exercise has exerciseId
      if (!exercise.exerciseId) {
        return true;
      }

      // Check if exercise has old name that needs updating
      if (EXERCISE_NAME_MIGRATIONS[exercise.name]) {
        return true;
      }

      // Check if exercise is missing description but should have one
      const exerciseDef = ALL_EXERCISES.find(e => e.id === exercise.exerciseId);
      if (exerciseDef && exerciseDef.notes && !exercise.description) {
        return true;
      }
    }
  }

  return false;
}
