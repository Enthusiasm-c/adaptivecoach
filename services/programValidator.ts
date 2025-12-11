/**
 * Program Validator Service
 *
 * Validates training programs for:
 * - Muscle group coverage (all primary muscles trained)
 * - Weekly volume within MEV-MRV range
 * - Training frequency (minimum 2x/week per muscle)
 * - Exercise variety and balance
 */

import { OnboardingProfile, TrainingProgram, WorkoutSession, Exercise, ExperienceLevel, Goal } from '../types';
import { getPrimaryMuscles, getSecondaryMuscles, getVolumeRecommendation, MUSCLE_GROUPS } from '../data/muscleGroups';
import { ALL_EXERCISES, getExerciseById } from '../data/exerciseDatabase';

// ==========================================
// TYPES
// ==========================================

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  suggestions: string[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  type: ValidationIssueType;
  message: string;
  muscleGroup?: string;
  details?: any;
}

export type ValidationIssueType =
  | 'missing_muscle'
  | 'low_volume'
  | 'high_volume'
  | 'low_frequency'
  | 'imbalance'
  | 'missing_compound'
  | 'missing_isolation'
  | 'duplicate_exercise'
  | 'equipment_mismatch';

// ==========================================
// MUSCLE COVERAGE VALIDATION
// ==========================================

/**
 * Calculate weekly volume per muscle from a program
 */
export function calculateWeeklyVolumeByMuscle(program: TrainingProgram): { [muscleId: string]: number } {
  const volumeMap: { [muscleId: string]: number } = {};

  // Initialize all muscles with 0
  for (const muscle of MUSCLE_GROUPS) {
    volumeMap[muscle.id] = 0;
  }

  // Count sets per muscle from exercises
  for (const session of program.sessions) {
    for (const exercise of session.exercises) {
      // Try to find exercise in database
      const matchedExercise = ALL_EXERCISES.find(
        e => e.name === exercise.name || e.nameEn.toLowerCase() === exercise.name.toLowerCase()
      );

      if (matchedExercise) {
        // Add sets to primary muscle
        volumeMap[matchedExercise.primaryMuscle] = (volumeMap[matchedExercise.primaryMuscle] || 0) + exercise.sets;

        // Add partial sets to secondary muscles (indirect volume)
        for (const secondary of matchedExercise.secondaryMuscles) {
          volumeMap[secondary] = (volumeMap[secondary] || 0) + Math.round(exercise.sets * 0.4);
        }
      } else {
        // Fallback: try to infer muscle from exercise name
        const inferredMuscle = inferMuscleFromExerciseName(exercise.name);
        if (inferredMuscle) {
          volumeMap[inferredMuscle] = (volumeMap[inferredMuscle] || 0) + exercise.sets;
        }
      }
    }
  }

  return volumeMap;
}

/**
 * Calculate how many times each muscle is trained per week
 */
export function calculateMuscleFrequency(program: TrainingProgram): { [muscleId: string]: number } {
  const frequencyMap: { [muscleId: string]: number } = {};

  // Initialize all muscles with 0
  for (const muscle of MUSCLE_GROUPS) {
    frequencyMap[muscle.id] = 0;
  }

  // Track muscles hit per session
  const musclesPerSession: Set<string>[] = program.sessions.map(() => new Set());

  for (let i = 0; i < program.sessions.length; i++) {
    const session = program.sessions[i];
    for (const exercise of session.exercises) {
      const matchedExercise = ALL_EXERCISES.find(
        e => e.name === exercise.name || e.nameEn.toLowerCase() === exercise.name.toLowerCase()
      );

      if (matchedExercise) {
        musclesPerSession[i].add(matchedExercise.primaryMuscle);
      } else {
        const inferredMuscle = inferMuscleFromExerciseName(exercise.name);
        if (inferredMuscle) {
          musclesPerSession[i].add(inferredMuscle);
        }
      }
    }
  }

  // Count frequency
  for (const muscles of musclesPerSession) {
    for (const muscle of muscles) {
      frequencyMap[muscle] = (frequencyMap[muscle] || 0) + 1;
    }
  }

  return frequencyMap;
}

/**
 * Infer muscle group from exercise name (fallback)
 */
function inferMuscleFromExerciseName(name: string): string | null {
  const nameLower = name.toLowerCase();

  const mappings: { [key: string]: string } = {
    // Chest
    'жим': 'chest',
    'отжим': 'chest',
    'разводк': 'chest',
    'флайс': 'chest',
    'грудь': 'chest',
    'bench': 'chest',
    'push': 'chest',

    // Back
    'тяга': 'back',
    'подтяг': 'back',
    'пуловер': 'back',
    'row': 'back',
    'pull': 'back',
    'lat': 'back',

    // Shoulders
    'махи': 'shoulders',
    'плеч': 'shoulders',
    'дельт': 'shoulders',
    'shoulder': 'shoulders',
    'lateral': 'shoulders',
    'press': 'shoulders',

    // Biceps
    'бицепс': 'biceps',
    'сгибан': 'biceps',
    'curl': 'biceps',
    'bicep': 'biceps',

    // Triceps
    'трицепс': 'triceps',
    'разгибан': 'triceps',
    'французск': 'triceps',
    'tricep': 'triceps',
    'pushdown': 'triceps',

    // Quads
    'присед': 'quads',
    'выпад': 'quads',
    'квадриц': 'quads',
    'жим ног': 'quads',
    'squat': 'quads',
    'lunge': 'quads',
    'leg press': 'quads',

    // Hamstrings
    'бицепс бедр': 'hamstrings',
    'румынск': 'hamstrings',
    'сгибан ног': 'hamstrings',
    'мёртв': 'hamstrings',
    'deadlift': 'hamstrings',
    'hamstring': 'hamstrings',

    // Glutes
    'ягодиц': 'glutes',
    'мостик': 'glutes',
    'hip thrust': 'glutes',
    'glute': 'glutes',

    // Calves
    'икр': 'calves',
    'голен': 'calves',
    'calf': 'calves',
    'calves': 'calves',

    // Core
    'пресс': 'core',
    'планк': 'core',
    'скручив': 'core',
    'кор': 'core',
    'ab': 'core',
    'plank': 'core',
    'crunch': 'core',
  };

  for (const [keyword, muscle] of Object.entries(mappings)) {
    if (nameLower.includes(keyword)) {
      return muscle;
    }
  }

  return null;
}

// ==========================================
// MAIN VALIDATION
// ==========================================

/**
 * Validate a training program for a specific user profile
 */
export function validateProgram(
  program: TrainingProgram,
  profile: OnboardingProfile
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const suggestions: string[] = [];

  // 1. Calculate metrics
  const volumeByMuscle = calculateWeeklyVolumeByMuscle(program);
  const frequencyByMuscle = calculateMuscleFrequency(program);

  // 2. Validate muscle coverage
  const primaryMuscles = getPrimaryMuscles();
  for (const muscle of primaryMuscles) {
    const volume = volumeByMuscle[muscle.id] || 0;
    const frequency = frequencyByMuscle[muscle.id] || 0;
    const volumeTarget = getVolumeRecommendation(muscle.id, profile.experience);

    // Check if muscle is missing completely
    if (volume === 0) {
      issues.push({
        severity: 'error',
        type: 'missing_muscle',
        message: `Мышечная группа "${muscle.nameRu}" не тренируется`,
        muscleGroup: muscle.id,
      });
      suggestions.push(`Добавить упражнения на ${muscle.nameRu}`);
    }
    // Check volume is too low
    else if (volume < volumeTarget.min) {
      issues.push({
        severity: 'warning',
        type: 'low_volume',
        message: `Недостаточный объём на ${muscle.nameRu}: ${volume} сетов (минимум ${volumeTarget.min})`,
        muscleGroup: muscle.id,
        details: { actual: volume, min: volumeTarget.min, optimal: volumeTarget.optimal },
      });
      suggestions.push(`Увеличить объём на ${muscle.nameRu} до ${volumeTarget.optimal} сетов`);
    }
    // Check volume is too high
    else if (volume > volumeTarget.max) {
      issues.push({
        severity: 'warning',
        type: 'high_volume',
        message: `Слишком большой объём на ${muscle.nameRu}: ${volume} сетов (максимум ${volumeTarget.max})`,
        muscleGroup: muscle.id,
        details: { actual: volume, max: volumeTarget.max },
      });
      suggestions.push(`Снизить объём на ${muscle.nameRu} до ${volumeTarget.max} сетов`);
    }

    // Check frequency (should be at least 2x/week)
    if (frequency < 2 && volume > 0) {
      issues.push({
        severity: 'warning',
        type: 'low_frequency',
        message: `Низкая частота тренировки ${muscle.nameRu}: ${frequency}x/неделю (рекомендуется 2x)`,
        muscleGroup: muscle.id,
        details: { actual: frequency, recommended: 2 },
      });
    }
  }

  // 3. Check for push/pull/legs balance
  const pushVolume = (volumeByMuscle['chest'] || 0) + (volumeByMuscle['shoulders'] || 0) + (volumeByMuscle['triceps'] || 0);
  const pullVolume = (volumeByMuscle['back'] || 0) + (volumeByMuscle['biceps'] || 0) + (volumeByMuscle['rear_delts'] || 0);
  const legsVolume = (volumeByMuscle['quads'] || 0) + (volumeByMuscle['hamstrings'] || 0) + (volumeByMuscle['glutes'] || 0) + (volumeByMuscle['calves'] || 0);

  // Push:Pull ratio should be close to 1:1
  if (pushVolume > 0 && pullVolume > 0) {
    const pushPullRatio = pushVolume / pullVolume;
    if (pushPullRatio > 1.5) {
      issues.push({
        severity: 'warning',
        type: 'imbalance',
        message: `Дисбаланс: слишком много жимовых упражнений (${pushPullRatio.toFixed(1)}:1)`,
        details: { push: pushVolume, pull: pullVolume },
      });
      suggestions.push('Добавить больше тяговых упражнений для баланса');
    } else if (pushPullRatio < 0.67) {
      issues.push({
        severity: 'warning',
        type: 'imbalance',
        message: `Дисбаланс: слишком много тяговых упражнений (1:${(1/pushPullRatio).toFixed(1)})`,
        details: { push: pushVolume, pull: pullVolume },
      });
      suggestions.push('Добавить больше жимовых упражнений для баланса');
    }
  }

  // 4. Check for duplicate exercises
  const exerciseNames = program.sessions.flatMap(s => s.exercises.map(e => e.name.toLowerCase()));
  const duplicates = exerciseNames.filter((name, index) => exerciseNames.indexOf(name) !== index);
  const uniqueDuplicates = [...new Set(duplicates)];

  if (uniqueDuplicates.length > 0) {
    issues.push({
      severity: 'info',
      type: 'duplicate_exercise',
      message: `Повторяющиеся упражнения: ${uniqueDuplicates.join(', ')}`,
      details: { duplicates: uniqueDuplicates },
    });
  }

  // 5. Check for compound/isolation ratio
  const totalExercises = program.sessions.flatMap(s => s.exercises).length;
  let compoundCount = 0;
  for (const session of program.sessions) {
    for (const exercise of session.exercises) {
      const matchedExercise = ALL_EXERCISES.find(
        e => e.name === exercise.name || e.nameEn.toLowerCase() === exercise.name.toLowerCase()
      );
      if (matchedExercise?.isCompound) {
        compoundCount++;
      }
    }
  }

  const compoundRatio = totalExercises > 0 ? compoundCount / totalExercises : 0;
  if (compoundRatio < 0.4) {
    issues.push({
      severity: 'info',
      type: 'missing_compound',
      message: `Мало базовых упражнений (${(compoundRatio * 100).toFixed(0)}%, рекомендуется 50-60%)`,
      details: { compound: compoundCount, total: totalExercises },
    });
  }

  // 6. Calculate validation score
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  const score = Math.max(0, 100 - (errorCount * 25) - (warningCount * 10) - (infoCount * 2));

  return {
    isValid: errorCount === 0,
    score,
    issues,
    suggestions,
  };
}

// ==========================================
// QUICK CHECKS
// ==========================================

/**
 * Quick check if all major muscles are covered
 */
export function hasAllMajorMuscles(program: TrainingProgram): boolean {
  const volumeByMuscle = calculateWeeklyVolumeByMuscle(program);
  const requiredMuscles = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings'];

  return requiredMuscles.every(muscle => (volumeByMuscle[muscle] || 0) > 0);
}

/**
 * Get list of missing muscles
 */
export function getMissingMuscles(program: TrainingProgram): string[] {
  const volumeByMuscle = calculateWeeklyVolumeByMuscle(program);
  const primaryMuscles = getPrimaryMuscles();

  return primaryMuscles
    .filter(muscle => (volumeByMuscle[muscle.id] || 0) === 0)
    .map(muscle => muscle.nameRu);
}

/**
 * Get summary report for UI display
 */
export function getValidationSummary(result: ValidationResult): {
  status: 'good' | 'warning' | 'error';
  title: string;
  description: string;
} {
  if (result.score >= 80) {
    return {
      status: 'good',
      title: 'Программа сбалансирована',
      description: 'Все мышечные группы покрыты с оптимальным объёмом',
    };
  } else if (result.score >= 50) {
    return {
      status: 'warning',
      title: 'Есть области для улучшения',
      description: result.suggestions[0] || 'Рекомендуется скорректировать программу',
    };
  } else {
    return {
      status: 'error',
      title: 'Программа требует корректировки',
      description: result.issues.find(i => i.severity === 'error')?.message || 'Обнаружены серьёзные проблемы',
    };
  }
}
