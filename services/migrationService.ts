/**
 * Migration Service
 * Handles automatic upgrading of existing users to the new scientific training system
 * while preserving all their data (streak, logs, injuries, pain history, etc.)
 *
 * This migration runs AUTOMATICALLY without user confirmation.
 */

import { OnboardingProfile, TrainingProgram, WorkoutLog } from '../types';
import { generateProgram, convertToLegacyFormat } from './programGenerator';
import { createInitialMesocycleState, saveMesocycleState, MesocycleState } from './mesocycleService';

// Migration version - increment when making breaking changes
const CURRENT_MIGRATION_VERSION = 1;
const MIGRATION_VERSION_KEY = 'programMigrationVersion';
const MIGRATION_BACKUP_KEY = 'migrationBackup';

export interface MigrationResult {
  success: boolean;
  message: string;
  preservedData: {
    workoutLogs: number;
    painReports: number;
    personalRecords: number;
    injuries: boolean;
  };
  newProgram?: TrainingProgram;
  mesocycleState?: MesocycleState;
}

export interface MigrationBackup {
  timestamp: string;
  version: number;
  profile: OnboardingProfile;
  program: TrainingProgram;
  logs: WorkoutLog[];
}

/**
 * Check if user needs migration to new system
 */
export function needsMigration(): boolean {
  const currentVersion = localStorage.getItem(MIGRATION_VERSION_KEY);
  const program = localStorage.getItem('trainingProgram');

  // No program = no migration needed
  if (!program) return false;

  // Check version
  const version = currentVersion ? parseInt(currentVersion, 10) : 0;
  return version < CURRENT_MIGRATION_VERSION;
}

/**
 * Check if program was created with new system (has mesocycle data)
 */
export function isNewSystemProgram(program: TrainingProgram): boolean {
  return !!(program.mesocycleId && program.mesocycleStartDate);
}

/**
 * Get preserved data summary for display
 */
export function getPreservedDataSummary(logs: WorkoutLog[]): {
  workoutCount: number;
  painReportsCount: number;
  uniqueExercises: number;
  totalVolumeKg: number;
  streakDays: number;
} {
  const painReports = logs.filter(l => l.feedback?.pain?.hasPain);
  const uniqueExercises = new Set(
    logs.flatMap(l => l.completedExercises.map(e => e.name))
  );

  const totalVolume = logs.reduce((sum, log) => {
    return sum + log.completedExercises.reduce((exSum, ex) => {
      return exSum + ex.completedSets.reduce((setSum, set) => {
        return setSum + (set.weight * set.reps);
      }, 0);
    }, 0);
  }, 0);

  // Calculate streak (simplified)
  const sortedLogs = [...logs].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let streak = 0;
  if (sortedLogs.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentDate = today;
    for (const log of sortedLogs) {
      const logDate = new Date(log.date);
      logDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor((currentDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) {
        streak++;
        currentDate = logDate;
      } else {
        break;
      }
    }
  }

  return {
    workoutCount: logs.length,
    painReportsCount: painReports.length,
    uniqueExercises: uniqueExercises.size,
    totalVolumeKg: Math.round(totalVolume),
    streakDays: streak,
  };
}

/**
 * Create backup before migration
 */
export function createBackup(): MigrationBackup | null {
  try {
    const profile = localStorage.getItem('onboardingProfile');
    const program = localStorage.getItem('trainingProgram');
    const logs = localStorage.getItem('workoutLogs');

    if (!profile || !program) return null;

    const backup: MigrationBackup = {
      timestamp: new Date().toISOString(),
      version: parseInt(localStorage.getItem(MIGRATION_VERSION_KEY) || '0', 10),
      profile: JSON.parse(profile),
      program: JSON.parse(program),
      logs: logs ? JSON.parse(logs) : [],
    };

    localStorage.setItem(MIGRATION_BACKUP_KEY, JSON.stringify(backup));
    return backup;
  } catch (e) {
    console.error('Failed to create backup:', e);
    return null;
  }
}

/**
 * Restore from backup if migration fails
 */
export function restoreFromBackup(): boolean {
  try {
    const backupJson = localStorage.getItem(MIGRATION_BACKUP_KEY);
    if (!backupJson) return false;

    const backup: MigrationBackup = JSON.parse(backupJson);

    localStorage.setItem('onboardingProfile', JSON.stringify(backup.profile));
    localStorage.setItem('trainingProgram', JSON.stringify(backup.program));
    localStorage.setItem('workoutLogs', JSON.stringify(backup.logs));
    localStorage.setItem(MIGRATION_VERSION_KEY, backup.version.toString());

    return true;
  } catch (e) {
    console.error('Failed to restore from backup:', e);
    return false;
  }
}

/**
 * Extract personal records (best weights) from workout logs
 */
function extractPersonalRecords(logs: WorkoutLog[]): Map<string, { weight: number; reps: number; date: string }> {
  const prs = new Map<string, { weight: number; reps: number; date: string }>();

  for (const log of logs) {
    for (const exercise of log.completedExercises) {
      for (const set of exercise.completedSets) {
        const current = prs.get(exercise.name);
        // Calculate estimated 1RM for comparison
        const e1rm = set.weight * (1 + set.reps / 30);
        const currentE1rm = current ? current.weight * (1 + current.reps / 30) : 0;

        if (e1rm > currentE1rm) {
          prs.set(exercise.name, {
            weight: set.weight,
            reps: set.reps,
            date: log.date,
          });
        }
      }
    }
  }

  return prs;
}

/**
 * Apply personal records to new program exercises
 */
function applyPersonalRecordsToProgram(
  program: TrainingProgram,
  prs: Map<string, { weight: number; reps: number; date: string }>
): TrainingProgram {
  const updatedSessions = program.sessions.map(session => ({
    ...session,
    exercises: session.exercises.map(exercise => {
      const pr = prs.get(exercise.name);
      if (pr) {
        // Use 70-80% of PR weight as working weight
        const workingWeight = Math.round(pr.weight * 0.75 / 2.5) * 2.5;
        return {
          ...exercise,
          weight: workingWeight > 0 ? workingWeight : exercise.weight,
        };
      }
      return exercise;
    }),
  }));

  return {
    ...program,
    sessions: updatedSessions,
  };
}

/**
 * Extract pain patterns from logs for consideration in new program
 */
function extractPainPatterns(logs: WorkoutLog[]): {
  locations: string[];
  associatedExercises: Map<string, string[]>;
} {
  const locations: string[] = [];
  const associatedExercises = new Map<string, string[]>();

  for (const log of logs) {
    if (log.feedback?.pain?.hasPain && log.feedback.pain.location) {
      const location = log.feedback.pain.location;
      if (!locations.includes(location)) {
        locations.push(location);
      }

      // Associate exercises from this workout with pain location
      const exercises = log.completedExercises.map(e => e.name);
      const current = associatedExercises.get(location) || [];
      associatedExercises.set(location, [...new Set([...current, ...exercises])]);
    }
  }

  return { locations, associatedExercises };
}

/**
 * Main migration function
 * Generates new program while preserving user data
 */
export async function migrateToNewSystem(
  profile: OnboardingProfile,
  logs: WorkoutLog[]
): Promise<MigrationResult> {
  try {
    // 1. Create backup first
    const backup = createBackup();
    if (!backup) {
      return {
        success: false,
        message: 'Не удалось создать резервную копию',
        preservedData: { workoutLogs: 0, painReports: 0, personalRecords: 0, injuries: false },
      };
    }

    // 2. Extract data to preserve
    const personalRecords = extractPersonalRecords(logs);
    const painPatterns = extractPainPatterns(logs);
    const painReportsCount = logs.filter(l => l.feedback?.pain?.hasPain).length;

    // 3. Generate new program using the new scientific system
    const generationResult = generateProgram(profile);
    if (!generationResult.success) {
      return {
        success: false,
        message: generationResult.errors?.join(', ') || 'Ошибка генерации программы',
        preservedData: { workoutLogs: logs.length, painReports: painReportsCount, personalRecords: personalRecords.size, injuries: profile.hasInjuries },
      };
    }

    // 4. Convert to legacy format for TrainingProgram (with logs for E1RM-based weights)
    const newProgram = convertToLegacyFormat(generationResult, profile, logs);

    // 5. Apply personal records to new program (preserve strength gains)
    const programWithPRs = applyPersonalRecordsToProgram(newProgram, personalRecords);

    // 6. Initialize mesocycle state
    const mesocycleState = createInitialMesocycleState(profile);

    // 7. Add mesocycle info to program
    const finalProgram: TrainingProgram = {
      ...programWithPRs,
      mesocycleId: mesocycleState.mesocycle.id,
      mesocycleStartDate: mesocycleState.mesocycle.startDate,
      currentMesocycleWeek: mesocycleState.mesocycle.weekNumber,
    };

    // 8. Save everything
    localStorage.setItem('trainingProgram', JSON.stringify(finalProgram));
    saveMesocycleState(mesocycleState);
    localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());

    // Note: workoutLogs are NOT touched - they remain intact!
    // Note: onboardingProfile is NOT touched - injuries info remains!

    return {
      success: true,
      message: 'Программа успешно обновлена до научной системы!',
      preservedData: {
        workoutLogs: logs.length,
        painReports: painReportsCount,
        personalRecords: personalRecords.size,
        injuries: profile.hasInjuries,
      },
      newProgram: finalProgram,
      mesocycleState,
    };

  } catch (error) {
    console.error('Migration failed:', error);

    // Try to restore from backup
    const restored = restoreFromBackup();

    return {
      success: false,
      message: restored
        ? 'Ошибка миграции. Данные восстановлены из резервной копии.'
        : 'Ошибка миграции. Не удалось восстановить данные.',
      preservedData: { workoutLogs: 0, painReports: 0, personalRecords: 0, injuries: false },
    };
  }
}

/**
 * Skip migration and mark as done (for users who don't want to migrate)
 */
export function skipMigration(): void {
  localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
}

/**
 * Clear backup after successful migration or if user confirms
 */
export function clearBackup(): void {
  localStorage.removeItem(MIGRATION_BACKUP_KEY);
}

/**
 * Check if backup exists
 */
export function hasBackup(): boolean {
  return !!localStorage.getItem(MIGRATION_BACKUP_KEY);
}

/**
 * Get backup info for display
 */
export function getBackupInfo(): { timestamp: string; workoutCount: number } | null {
  try {
    const backupJson = localStorage.getItem(MIGRATION_BACKUP_KEY);
    if (!backupJson) return null;

    const backup: MigrationBackup = JSON.parse(backupJson);
    return {
      timestamp: backup.timestamp,
      workoutCount: backup.logs.length,
    };
  } catch {
    return null;
  }
}

/**
 * Automatic migration - runs silently without user interaction
 * Returns the new program and mesocycle state if migration was performed
 */
export async function runAutoMigration(): Promise<{
  migrated: boolean;
  program?: TrainingProgram;
  mesocycleState?: MesocycleState;
  error?: string;
}> {
  // Check if migration is needed
  if (!needsMigration()) {
    return { migrated: false };
  }

  // Load existing data
  try {
    const profileJson = localStorage.getItem('onboardingProfile');
    const logsJson = localStorage.getItem('workoutLogs');

    if (!profileJson) {
      return { migrated: false };
    }

    const profile: OnboardingProfile = JSON.parse(profileJson);
    const logs: WorkoutLog[] = logsJson ? JSON.parse(logsJson) : [];

    console.log('[Migration] Starting automatic migration...');
    console.log(`[Migration] Preserving ${logs.length} workouts`);

    // Run migration
    const result = await migrateToNewSystem(profile, logs);

    if (result.success && result.newProgram && result.mesocycleState) {
      console.log('[Migration] Success! Data preserved:', result.preservedData);

      // Clear backup after successful migration
      clearBackup();

      return {
        migrated: true,
        program: result.newProgram,
        mesocycleState: result.mesocycleState,
      };
    } else {
      console.error('[Migration] Failed:', result.message);
      return {
        migrated: false,
        error: result.message,
      };
    }
  } catch (error) {
    console.error('[Migration] Unexpected error:', error);
    return {
      migrated: false,
      error: 'Unexpected migration error',
    };
  }
}
