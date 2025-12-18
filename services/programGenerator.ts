/**
 * Program Generator Service
 *
 * Generates scientifically-backed training programs using:
 * 1. Template-based split selection
 * 2. AI-powered exercise slot filling
 * 3. Mesocycle structure with volume progression
 *
 * Based on research from:
 * - Schoenfeld et al. (2016, 2017) - Training frequency and volume
 * - ACSM Position Stand - Progression models
 * - RP Strength methodology
 */

import { OnboardingProfile, ExperienceLevel, Goal, Location, TrainingProgram, WorkoutSession, Exercise, WorkoutLog } from '../types';
import { getBestLiftForExercise } from '../utils/strengthAnalysisUtils';
import {
  SplitTemplate,
  WorkoutTemplate,
  ExerciseSlot,
  Mesocycle,
  MesocyclePhase,
  VOLUME_MULTIPLIERS,
  PHASE_WEEKS,
  GOAL_CONFIGS,
  ProgramGenerationConfig,
  ProgramGenerationResult,
  ExerciseDefinition,
  ExerciseDifficulty,
} from '../types/training';
import { getSplitByDaysPerWeek, adjustSplitForPhase } from '../data/splitTemplates';
import { getVolumeRecommendation, MUSCLE_GROUPS, getPrimaryMuscles } from '../data/muscleGroups';
import {
  getExercisesForSlot,
  getRandomExerciseForSlot,
  ALL_EXERCISES,
  isExerciseSafe,
} from '../data/exerciseDatabase';

// ==========================================
// SPLIT SELECTION
// ==========================================

/**
 * Select the best split template based on user profile
 */
export function selectSplitTemplate(profile: OnboardingProfile): SplitTemplate {
  return getSplitByDaysPerWeek(profile.daysPerWeek);
}

/**
 * Get difficulty level based on experience
 */
function getDifficultyFromExperience(experience: ExperienceLevel): ExerciseDifficulty {
  switch (experience) {
    case ExperienceLevel.Beginner:
      return 'beginner';
    case ExperienceLevel.Intermediate:
      return 'intermediate';
    case ExperienceLevel.Advanced:
      return 'advanced';
    default:
      return 'intermediate';
  }
}

// ==========================================
// INITIAL WEIGHT ESTIMATION
// ==========================================

/**
 * Normalize exercise name for matching with known weights
 */
function normalizeExerciseNameForWeight(name: string): string {
  return name
    .toLowerCase()
    .replace(/со штангой|штанги|с гантел\w*|гантел\w*/gi, '')
    .replace(/на скамье|на тренажере|в тренажере/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate initial weight for an exercise based on profile and workout history
 * Priority: 1) Logs (E1RM-based), 2) Profile known weights, 3) Estimated defaults
 */
function calculateInitialWeight(
  exercise: ExerciseDefinition,
  profile: OnboardingProfile,
  logs?: WorkoutLog[]
): number | undefined {
  // For bodyweight exercises, no weight needed
  if (exercise.equipment === 'bodyweight') {
    return undefined;
  }

  // NEW: First check workout history for actual performance data
  if (logs && logs.length > 0) {
    const bestLift = getBestLiftForExercise(exercise.name, logs);
    if (bestLift && bestLift.e1rm > 0) {
      // Use 80% of E1RM for working sets (typical 8-10 rep range)
      const workingWeight = Math.round(bestLift.e1rm * 0.8 / 2.5) * 2.5;
      // Ensure minimum reasonable weight
      if (workingWeight >= 2.5) {
        return workingWeight;
      }
    }

    // Also try English name
    const bestLiftEn = getBestLiftForExercise(exercise.nameEn, logs);
    if (bestLiftEn && bestLiftEn.e1rm > 0) {
      const workingWeight = Math.round(bestLiftEn.e1rm * 0.8 / 2.5) * 2.5;
      if (workingWeight >= 2.5) {
        return workingWeight;
      }
    }
  }

  const normalizedName = normalizeExerciseNameForWeight(exercise.name);
  const normalizedNameEn = normalizeExerciseNameForWeight(exercise.nameEn);

  // 2. Check if user has known weight for this exact exercise (from onboarding)
  if (profile.knownWeights && profile.knownWeights.length > 0) {
    for (const kw of profile.knownWeights) {
      const normalizedKnown = normalizeExerciseNameForWeight(kw.exercise);
      if (
        normalizedName.includes(normalizedKnown) ||
        normalizedKnown.includes(normalizedName) ||
        normalizedNameEn.includes(normalizedKnown) ||
        normalizedKnown.includes(normalizedNameEn)
      ) {
        return kw.weight;
      }
    }

    // 2. Estimate based on similar exercises
    // If user knows bench press, estimate other pressing movements
    const benchWeight = profile.knownWeights.find(
      kw => kw.exercise.toLowerCase().includes('жим лежа') || kw.exercise.toLowerCase().includes('bench')
    );
    const squatWeight = profile.knownWeights.find(
      kw => kw.exercise.toLowerCase().includes('присед') || kw.exercise.toLowerCase().includes('squat')
    );

    if (benchWeight && exercise.primaryMuscle === 'chest') {
      // Other chest exercises: ~60-70% of bench
      return Math.round(benchWeight.weight * 0.65 / 2.5) * 2.5;
    }

    if (benchWeight && exercise.primaryMuscle === 'shoulders') {
      // Shoulder press: ~65% of bench
      return Math.round(benchWeight.weight * 0.65 / 2.5) * 2.5;
    }

    if (benchWeight && exercise.primaryMuscle === 'triceps') {
      // Triceps: ~30-40% of bench
      return Math.round(benchWeight.weight * 0.35 / 2.5) * 2.5;
    }

    if (squatWeight && exercise.primaryMuscle === 'quads') {
      // Leg press: ~150% of squat
      if (exercise.nameEn.toLowerCase().includes('leg press')) {
        return Math.round(squatWeight.weight * 1.5 / 5) * 5;
      }
      // Lunges: ~40% of squat
      return Math.round(squatWeight.weight * 0.4 / 2.5) * 2.5;
    }

    if (squatWeight && exercise.primaryMuscle === 'hamstrings') {
      // Romanian deadlift: ~70% of squat
      return Math.round(squatWeight.weight * 0.7 / 2.5) * 2.5;
    }
  }

  // 3. Default estimation based on gender and experience
  const isMale = profile.gender === 'Мужчина';
  const expMultiplier =
    profile.experience === ExperienceLevel.Beginner ? 0.7 :
    profile.experience === ExperienceLevel.Advanced ? 1.3 : 1.0;

  // Base weights by muscle group (for average male intermediate)
  const baseWeights: { [muscle: string]: number } = {
    chest: 40,
    back: 40,
    shoulders: 20,
    quads: 60,
    hamstrings: 40,
    glutes: 40,
    biceps: 12,
    triceps: 15,
    calves: 40,
    core: 0, // bodyweight
  };

  const baseWeight = baseWeights[exercise.primaryMuscle] || 20;
  const genderFactor = isMale ? 1.0 : 0.6;

  // Compound exercises are heavier
  const compoundFactor = exercise.isCompound ? 1.0 : 0.5;

  const estimatedWeight = baseWeight * genderFactor * expMultiplier * compoundFactor;

  // Round to nearest 2.5kg
  return Math.round(estimatedWeight / 2.5) * 2.5;
}

// ==========================================
// VOLUME CALCULATION
// ==========================================

/**
 * Calculate volume configuration for a user
 */
export function calculateVolumeConfig(
  experience: ExperienceLevel,
  goal: Goal
): { [muscleId: string]: { min: number; optimal: number; max: number } } {
  const goalConfig = GOAL_CONFIGS[goal];
  const volumeConfig: { [muscleId: string]: { min: number; optimal: number; max: number } } = {};

  for (const muscle of MUSCLE_GROUPS) {
    const baseVolume = getVolumeRecommendation(muscle.id, experience);
    // Apply goal multiplier
    volumeConfig[muscle.id] = {
      min: Math.round(baseVolume.min * goalConfig.volumeMultiplier),
      optimal: Math.round(baseVolume.optimal * goalConfig.volumeMultiplier),
      max: Math.round(baseVolume.max * goalConfig.volumeMultiplier),
    };
  }

  return volumeConfig;
}

// ==========================================
// EXERCISE SELECTION
// ==========================================

/**
 * Fill a single slot with an appropriate exercise
 */
export function fillSlotWithExercise(
  slot: ExerciseSlot,
  profile: OnboardingProfile,
  usedExerciseIds: string[] = []
): ExerciseDefinition | null {
  const maxDifficulty = getDifficultyFromExperience(profile.experience);

  // Get candidate exercises
  let candidates = getExercisesForSlot(slot, profile.location, maxDifficulty, usedExerciseIds);

  // Filter out unsafe exercises based on injuries
  if (profile.hasInjuries && profile.injuries) {
    candidates = candidates.filter(e => isExerciseSafe(e, profile.injuries));
  }

  if (candidates.length === 0) {
    // Fallback: try without movement pattern restriction
    candidates = ALL_EXERCISES.filter(e => {
      if (e.primaryMuscle !== slot.muscleGroup) return false;
      if (usedExerciseIds.includes(e.id)) return false;
      if (profile.hasInjuries && profile.injuries && !isExerciseSafe(e, profile.injuries)) return false;
      return true;
    });
  }

  if (candidates.length === 0) return null;

  // Prefer exercises matching the exact movement pattern
  const exactMatches = candidates.filter(e => e.movementPattern === slot.movementPattern);
  const pool = exactMatches.length > 0 ? exactMatches : candidates;

  // Random selection
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Fill all slots in a workout template with exercises
 */
export function fillWorkoutSlots(
  workout: WorkoutTemplate,
  profile: OnboardingProfile,
  globalUsedIds: string[] = []
): { slots: ExerciseSlot[]; usedIds: string[] } {
  const filledSlots: ExerciseSlot[] = [];
  const usedIds = [...globalUsedIds];

  for (const slot of workout.slots) {
    const exercise = fillSlotWithExercise(slot, profile, usedIds);
    if (exercise) {
      usedIds.push(exercise.id);
      filledSlots.push({
        ...slot,
        exercise,
      });
    } else {
      // Keep slot without exercise (will need AI fallback)
      filledSlots.push(slot);
    }
  }

  return { slots: filledSlots, usedIds };
}

// ==========================================
// MESOCYCLE CREATION
// ==========================================

/**
 * Create a new mesocycle
 */
export function createMesocycle(
  splitId: string,
  startDate: Date = new Date()
): Mesocycle {
  return {
    id: `meso_${Date.now()}`,
    weekNumber: 1,
    totalWeeks: 6,
    phase: 'intro',
    splitId,
    volumeMultiplier: VOLUME_MULTIPLIERS.intro,
    startDate: startDate.toISOString(),
    exerciseSelections: {},
    exerciseRotationPercent: 0,
  };
}

/**
 * Get current phase based on week number
 */
export function getCurrentPhase(weekNumber: number): MesocyclePhase {
  for (const [phase, weeks] of Object.entries(PHASE_WEEKS)) {
    if ((weeks as number[]).includes(weekNumber)) {
      return phase as MesocyclePhase;
    }
  }
  return 'accumulation';
}

/**
 * Advance mesocycle to next week
 */
export function advanceMesocycleWeek(mesocycle: Mesocycle): Mesocycle {
  const newWeek = mesocycle.weekNumber + 1;

  if (newWeek > mesocycle.totalWeeks) {
    // End of mesocycle - should create new one
    return mesocycle;
  }

  const newPhase = getCurrentPhase(newWeek);
  return {
    ...mesocycle,
    weekNumber: newWeek,
    phase: newPhase,
    volumeMultiplier: VOLUME_MULTIPLIERS[newPhase],
  };
}

/**
 * Check if mesocycle is complete
 */
export function isMesocycleComplete(mesocycle: Mesocycle): boolean {
  return mesocycle.weekNumber >= mesocycle.totalWeeks;
}

// ==========================================
// PROGRAM GENERATION (Main Entry Point)
// ==========================================

/**
 * Generate a complete training program from user profile
 */
export function generateProgram(profile: OnboardingProfile): ProgramGenerationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Select split template
  const split = selectSplitTemplate(profile);

  // 2. Create mesocycle
  const mesocycle = createMesocycle(split.id);

  // 3. Fill all workout slots with exercises
  const usedExerciseIds: string[] = [];
  const filledWorkouts: WorkoutTemplate[] = [];

  for (const workout of split.workouts) {
    const { slots, usedIds } = fillWorkoutSlots(workout, profile, usedExerciseIds);
    usedExerciseIds.push(...usedIds);

    // Track unfilled slots
    const unfilledSlots = slots.filter(s => !s.exercise);
    if (unfilledSlots.length > 0) {
      warnings.push(`${workout.name}: ${unfilledSlots.length} слота без упражнений`);
    }

    filledWorkouts.push({
      ...workout,
      slots,
    });
  }

  // 4. Store exercise selections in mesocycle
  for (const workout of filledWorkouts) {
    for (const slot of workout.slots) {
      if (slot.exercise) {
        mesocycle.exerciseSelections[slot.id] = slot.exercise.id;
      }
    }
  }

  // 5. Validate muscle coverage
  const validation = validateMuscleGroupCoverage(split, profile);

  return {
    success: errors.length === 0,
    split: { ...split, workouts: filledWorkouts },
    mesocycle,
    warnings,
    errors,
    validation,
  };
}

/**
 * Validate that all primary muscles are covered
 */
function validateMuscleGroupCoverage(
  split: SplitTemplate,
  profile: OnboardingProfile
): {
  allMusclesCovered: boolean;
  volumeInRange: boolean;
  frequencyMet: boolean;
  equipmentAvailable: boolean;
} {
  const primaryMuscles = getPrimaryMuscles();
  const volumeConfig = calculateVolumeConfig(profile.experience, profile.goals.primary);

  // Check muscle coverage
  const coveredMuscles = new Set(Object.keys(split.weeklyVolume));
  const missingMuscles = primaryMuscles.filter(m => !coveredMuscles.has(m.id) || split.weeklyVolume[m.id] === 0);

  // Check volume ranges
  let volumeInRange = true;
  for (const muscle of primaryMuscles) {
    const actual = split.weeklyVolume[muscle.id] || 0;
    const target = volumeConfig[muscle.id];
    if (actual < target.min) {
      volumeInRange = false;
      break;
    }
  }

  // Check frequency (at least 2x/week for each muscle)
  let frequencyMet = true;
  for (const muscle of primaryMuscles) {
    const freq = split.muscleFrequency[muscle.id] || 0;
    if (freq < 2) {
      frequencyMet = false;
      break;
    }
  }

  return {
    allMusclesCovered: missingMuscles.length === 0,
    volumeInRange,
    frequencyMet,
    equipmentAvailable: true, // Assumed true since we filter exercises by location
  };
}

// ==========================================
// CONVERT TO LEGACY FORMAT
// ==========================================

/**
 * Convert new program format to existing TrainingProgram type
 * This allows gradual migration while maintaining backwards compatibility
 * @param logs - Optional workout logs to use for E1RM-based weight suggestions
 */
export function convertToLegacyFormat(
  result: ProgramGenerationResult,
  profile: OnboardingProfile,
  logs?: WorkoutLog[]
): TrainingProgram {
  const goalConfig = GOAL_CONFIGS[profile.goals.primary];

  const sessions: WorkoutSession[] = result.split.workouts.map(workout => {
    const exercises: Exercise[] = workout.slots
      .filter(slot => slot.exercise)
      .map(slot => {
        const exerciseDef = slot.exercise!;
        const isStrength = exerciseDef.isCompound;

        // Determine rep range based on goal and convert to exact number
        let repsRange: string;
        if (profile.goals.primary === Goal.GetStronger) {
          repsRange = exerciseDef.repRanges.strength;
        } else if (profile.goals.primary === Goal.LoseFat) {
          repsRange = exerciseDef.repRanges.endurance;
        } else {
          repsRange = exerciseDef.repRanges.hypertrophy;
        }

        // Convert range "8-12" to exact number (middle value)
        let reps: string;
        if (repsRange.includes('-')) {
          const [min, max] = repsRange.split('-').map(Number);
          reps = String(Math.round((min + max) / 2)); // "8-12" → "10"
        } else {
          reps = repsRange;
        }

        // Calculate rest time
        const rest = exerciseDef.isCompound
          ? goalConfig.restTimeCompound
          : goalConfig.restTimeIsolation;

        // Calculate initial weight based on profile and workout history
        const weight = calculateInitialWeight(exerciseDef, profile, logs);

        return {
          exerciseId: exerciseDef.id,
          name: exerciseDef.name,
          exerciseType: isStrength ? 'strength' : 'bodyweight',
          sets: slot.sets,
          reps,
          rest,
          weight,
          description: exerciseDef.notes,
        };
      });

    return {
      name: workout.nameRu,
      exercises,
    };
  });

  return {
    sessions,
  };
}

// ==========================================
// EXERCISE ROTATION
// ==========================================

/**
 * Rotate exercises for a new mesocycle
 * Keeps compound movements mostly stable, rotates isolation more frequently
 */
export function rotateExercisesForNewMesocycle(
  previousMesocycle: Mesocycle,
  split: SplitTemplate,
  profile: OnboardingProfile,
  rotationPercent: number = 0.3
): { newSelections: { [slotId: string]: string }; rotationCount: number } {
  const newSelections: { [slotId: string]: string } = {};
  let rotationCount = 0;

  // Separate compound and isolation slots
  const allSlots = split.workouts.flatMap(w => w.slots);
  const compoundSlots = allSlots.filter(s => s.isCompound);
  const isolationSlots = allSlots.filter(s => !s.isCompound);

  // Rotate fewer compound exercises (10-20%)
  const compoundToRotate = Math.ceil(compoundSlots.length * (rotationPercent * 0.5));
  // Rotate more isolation exercises (30-40%)
  const isolationToRotate = Math.ceil(isolationSlots.length * rotationPercent);

  // Shuffle and pick slots to rotate
  const shuffledCompound = [...compoundSlots].sort(() => Math.random() - 0.5);
  const shuffledIsolation = [...isolationSlots].sort(() => Math.random() - 0.5);

  const slotsToRotate = new Set([
    ...shuffledCompound.slice(0, compoundToRotate).map(s => s.id),
    ...shuffledIsolation.slice(0, isolationToRotate).map(s => s.id),
  ]);

  // Fill new selections
  const usedIds = new Set<string>();

  for (const slot of allSlots) {
    const previousExerciseId = previousMesocycle.exerciseSelections[slot.id];

    if (slotsToRotate.has(slot.id)) {
      // Rotate this slot
      const excludeIds = previousExerciseId ? [previousExerciseId, ...usedIds] : [...usedIds];
      const newExercise = fillSlotWithExercise(slot, profile, excludeIds);

      if (newExercise && newExercise.id !== previousExerciseId) {
        newSelections[slot.id] = newExercise.id;
        usedIds.add(newExercise.id);
        rotationCount++;
      } else if (previousExerciseId) {
        // Couldn't find alternative, keep previous
        newSelections[slot.id] = previousExerciseId;
        usedIds.add(previousExerciseId);
      }
    } else {
      // Keep previous exercise
      if (previousExerciseId) {
        newSelections[slot.id] = previousExerciseId;
        usedIds.add(previousExerciseId);
      } else {
        // No previous exercise, fill new
        const newExercise = fillSlotWithExercise(slot, profile, [...usedIds]);
        if (newExercise) {
          newSelections[slot.id] = newExercise.id;
          usedIds.add(newExercise.id);
        }
      }
    }
  }

  return { newSelections, rotationCount };
}

/**
 * Create a new mesocycle with rotated exercises
 */
export function createNextMesocycle(
  previousMesocycle: Mesocycle,
  split: SplitTemplate,
  profile: OnboardingProfile
): Mesocycle {
  const { newSelections, rotationCount } = rotateExercisesForNewMesocycle(
    previousMesocycle,
    split,
    profile
  );

  const totalSlots = split.workouts.reduce((sum, w) => sum + w.slots.length, 0);
  const rotationPercent = totalSlots > 0 ? (rotationCount / totalSlots) * 100 : 0;

  return {
    id: `meso_${Date.now()}`,
    weekNumber: 1,
    totalWeeks: 6,
    phase: 'intro',
    splitId: split.id,
    volumeMultiplier: VOLUME_MULTIPLIERS.intro,
    startDate: new Date().toISOString(),
    exerciseSelections: newSelections,
    exerciseRotationPercent: Math.round(rotationPercent),
  };
}

// ==========================================
// APPLY VOLUME MULTIPLIER TO PROGRAM
// ==========================================

/**
 * Apply mesocycle phase volume multiplier to a program
 */
export function applyVolumeMultiplier(
  sessions: WorkoutSession[],
  multiplier: number
): WorkoutSession[] {
  return sessions.map(session => ({
    ...session,
    exercises: session.exercises.map(exercise => ({
      ...exercise,
      sets: Math.max(1, Math.round(exercise.sets * multiplier)),
    })),
  }));
}
