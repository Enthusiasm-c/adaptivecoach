/**
 * State Transaction Service
 *
 * Provides atomic updates for complex state changes that involve
 * multiple steps (logs, program, mesocycle, etc.).
 *
 * If any step fails, all changes are rolled back to maintain consistency.
 *
 * Usage:
 * const transaction = createTransaction('workout_complete');
 * transaction.set('workoutLogs', newLogs);
 * transaction.set('trainingProgram', newProgram);
 * await transaction.commit(); // Applies all or rolls back on error
 */

import { TrainingProgram, WorkoutLog, OnboardingProfile } from '../types';
import { MesocycleState } from './mesocycleService';

// ==========================================
// TYPES
// ==========================================

export type TransactionKey =
  | 'trainingProgram'
  | 'workoutLogs'
  | 'mesocycleState'
  | 'onboardingProfile';

interface TransactionChange<T = unknown> {
  key: TransactionKey;
  oldValue: T | null;
  newValue: T;
  timestamp: number;
}

export interface TransactionResult {
  success: boolean;
  transactionId: string;
  duration: number;
  changes: TransactionKey[];
  error?: string;
  rolledBack?: boolean;
}

export interface TransactionAuditEntry {
  transactionId: string;
  name: string;
  timestamp: number;
  duration: number;
  success: boolean;
  changes: TransactionKey[];
  error?: string;
}

// ==========================================
// STATE TRANSACTION CLASS
// ==========================================

export class StateTransaction {
  private id: string;
  private name: string;
  private changes: Map<TransactionKey, TransactionChange> = new Map();
  private startTime: number;
  private committed = false;
  private rolledBack = false;

  // Callbacks for applying changes
  private applyCallbacks: Map<TransactionKey, (value: unknown) => void> = new Map();

  constructor(name: string) {
    this.id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.startTime = Date.now();
  }

  /**
   * Get transaction ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Register a callback to apply changes for a specific key
   */
  registerApply(key: TransactionKey, callback: (value: unknown) => void): void {
    this.applyCallbacks.set(key, callback);
  }

  /**
   * Stage a change (does not apply yet)
   */
  set<T>(key: TransactionKey, newValue: T, oldValue?: T | null): void {
    if (this.committed || this.rolledBack) {
      throw new Error(`Cannot modify transaction ${this.id}: already ${this.committed ? 'committed' : 'rolled back'}`);
    }

    // Get old value from localStorage if not provided
    const actualOldValue = oldValue !== undefined
      ? oldValue
      : this.getFromStorage(key);

    this.changes.set(key, {
      key,
      oldValue: actualOldValue,
      newValue,
      timestamp: Date.now(),
    });

    console.log(`[Transaction ${this.id}] Staged: ${key}`);
  }

  /**
   * Check if key is staged for change
   */
  has(key: TransactionKey): boolean {
    return this.changes.has(key);
  }

  /**
   * Get staged value (not yet committed)
   */
  get<T>(key: TransactionKey): T | null {
    const change = this.changes.get(key);
    return change ? (change.newValue as T) : null;
  }

  /**
   * Commit all changes atomically
   * If any fails, rolls back all previous changes
   */
  async commit(): Promise<TransactionResult> {
    if (this.committed) {
      return {
        success: false,
        transactionId: this.id,
        duration: Date.now() - this.startTime,
        changes: [],
        error: 'Transaction already committed',
      };
    }

    if (this.rolledBack) {
      return {
        success: false,
        transactionId: this.id,
        duration: Date.now() - this.startTime,
        changes: [],
        error: 'Transaction was rolled back',
      };
    }

    const appliedKeys: TransactionKey[] = [];

    try {
      // Apply all changes
      for (const [key, change] of this.changes) {
        this.applyChange(key, change.newValue);
        appliedKeys.push(key);
      }

      this.committed = true;

      const result: TransactionResult = {
        success: true,
        transactionId: this.id,
        duration: Date.now() - this.startTime,
        changes: appliedKeys,
      };

      // Record to audit trail
      StateTransactionManager.getInstance().recordTransaction({
        transactionId: this.id,
        name: this.name,
        timestamp: this.startTime,
        duration: result.duration,
        success: true,
        changes: appliedKeys,
      });

      console.log(`[Transaction ${this.id}] Committed: ${appliedKeys.join(', ')}`);
      return result;

    } catch (error) {
      // Rollback all applied changes
      console.error(`[Transaction ${this.id}] Failed, rolling back...`, error);

      for (const key of appliedKeys.reverse()) {
        const change = this.changes.get(key);
        if (change) {
          try {
            this.applyChange(key, change.oldValue);
            console.log(`[Transaction ${this.id}] Rolled back: ${key}`);
          } catch (rollbackError) {
            console.error(`[Transaction ${this.id}] Rollback failed for ${key}:`, rollbackError);
          }
        }
      }

      this.rolledBack = true;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Record failure to audit trail
      StateTransactionManager.getInstance().recordTransaction({
        transactionId: this.id,
        name: this.name,
        timestamp: this.startTime,
        duration: Date.now() - this.startTime,
        success: false,
        changes: appliedKeys,
        error: errorMessage,
      });

      return {
        success: false,
        transactionId: this.id,
        duration: Date.now() - this.startTime,
        changes: appliedKeys,
        error: errorMessage,
        rolledBack: true,
      };
    }
  }

  /**
   * Manually rollback without committing
   */
  rollback(): void {
    if (this.committed) {
      throw new Error('Cannot rollback: transaction already committed');
    }

    this.rolledBack = true;
    this.changes.clear();
    console.log(`[Transaction ${this.id}] Manually rolled back`);
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private applyChange(key: TransactionKey, value: unknown): void {
    // First try callback if registered
    const callback = this.applyCallbacks.get(key);
    if (callback) {
      callback(value);
    }

    // Always persist to localStorage
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  private getFromStorage(key: TransactionKey): unknown | null {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
}

// ==========================================
// TRANSACTION MANAGER (Singleton)
// ==========================================

class StateTransactionManager {
  private static instance: StateTransactionManager;
  private auditTrail: TransactionAuditEntry[] = [];
  private readonly MAX_AUDIT_SIZE = 100;

  private constructor() {}

  static getInstance(): StateTransactionManager {
    if (!StateTransactionManager.instance) {
      StateTransactionManager.instance = new StateTransactionManager();
    }
    return StateTransactionManager.instance;
  }

  recordTransaction(entry: TransactionAuditEntry): void {
    this.auditTrail.push(entry);

    // Keep bounded
    if (this.auditTrail.length > this.MAX_AUDIT_SIZE) {
      this.auditTrail.shift();
    }
  }

  getAuditTrail(): TransactionAuditEntry[] {
    return [...this.auditTrail];
  }

  getRecentFailures(count = 5): TransactionAuditEntry[] {
    return this.auditTrail
      .filter(e => !e.success)
      .slice(-count);
  }

  clearAuditTrail(): void {
    this.auditTrail = [];
  }
}

// ==========================================
// CONVENIENCE FUNCTIONS
// ==========================================

/**
 * Create a new transaction
 */
export function createTransaction(name: string): StateTransaction {
  return new StateTransaction(name);
}

/**
 * Get transaction manager for audit trail
 */
export function getTransactionManager(): StateTransactionManager {
  return StateTransactionManager.getInstance();
}

/**
 * Create transaction with React state setters pre-registered
 */
export function createReactTransaction(
  name: string,
  setters: {
    setTrainingProgram?: (p: TrainingProgram) => void;
    setWorkoutLogs?: (logs: WorkoutLog[]) => void;
    setMesocycleState?: (state: MesocycleState) => void;
    setOnboardingProfile?: (profile: OnboardingProfile) => void;
  }
): StateTransaction {
  const tx = new StateTransaction(name);

  if (setters.setTrainingProgram) {
    tx.registerApply('trainingProgram', (v) => setters.setTrainingProgram!(v as TrainingProgram));
  }
  if (setters.setWorkoutLogs) {
    tx.registerApply('workoutLogs', (v) => setters.setWorkoutLogs!(v as WorkoutLog[]));
  }
  if (setters.setMesocycleState) {
    tx.registerApply('mesocycleState', (v) => setters.setMesocycleState!(v as MesocycleState));
  }
  if (setters.setOnboardingProfile) {
    tx.registerApply('onboardingProfile', (v) => setters.setOnboardingProfile!(v as OnboardingProfile));
  }

  return tx;
}

/**
 * Quick helper for single-key update with rollback support
 */
export async function atomicUpdate<T>(
  key: TransactionKey,
  newValue: T,
  applyCallback?: (value: T) => void
): Promise<TransactionResult> {
  const tx = createTransaction(`atomic_${key}`);
  tx.set(key, newValue);

  if (applyCallback) {
    tx.registerApply(key, (v) => applyCallback(v as T));
  }

  return tx.commit();
}
