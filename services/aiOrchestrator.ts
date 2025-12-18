/**
 * AI Orchestrator Service
 *
 * Centralizes all AI operations to prevent:
 * - Race conditions (state locking)
 * - Cascade failures (proper error handling)
 * - Silent failures (validation pipeline)
 * - Inconsistent state (transaction pattern)
 *
 * Usage:
 * const orchestrator = AIOrchestrator.getInstance();
 * const result = await orchestrator.execute({
 *   type: 'adaptPlan',
 *   priority: AIPriority.HIGH,
 *   data: { profile, program, logs },
 * });
 */

import { TrainingProgram, OnboardingProfile, WorkoutLog } from '../types';
import { validateProgramStructure, ValidationResult } from './programValidator';

// ==========================================
// TYPES
// ==========================================

export enum AIPriority {
  CRITICAL = 0,  // Pain adjustment, safety - runs immediately
  HIGH = 1,      // Program adaptation after workout
  NORMAL = 2,    // Coach feedback, chatbot
  LOW = 3,       // Analytics, insights, background tasks
}

export type AIOperationType =
  | 'adaptPlan'
  | 'adjustForPain'
  | 'coachFeedback'
  | 'chatbot'
  | 'generateProgram'
  | 'personalizeWeights';

export interface AIOperation<T = unknown> {
  id: string;
  type: AIOperationType;
  priority: AIPriority;
  data: T;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
}

export interface AIOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  operationId: string;
  duration: number;
  retriesUsed: number;
}

export interface StateLock {
  isLocked: boolean;
  lockedBy: string | null;
  lockTime: number;
  pendingOperations: string[];
}

interface QueuedOperation<T = unknown> {
  operation: AIOperation<T>;
  resolve: (result: AIOperationResult<T>) => void;
  reject: (error: Error) => void;
}

// ==========================================
// AI ORCHESTRATOR
// ==========================================

export class AIOrchestrator {
  private static instance: AIOrchestrator;

  private queue: QueuedOperation[] = [];
  private lock: StateLock = {
    isLocked: false,
    lockedBy: null,
    lockTime: 0,
    pendingOperations: [],
  };

  private isProcessing = false;
  private lastValidProgram: TrainingProgram | null = null;
  private operationHistory: Array<{
    operationId: string;
    type: AIOperationType;
    success: boolean;
    timestamp: number;
    error?: string;
  }> = [];

  // Configuration
  private readonly LOCK_TIMEOUT_MS = 30000; // 30 seconds
  private readonly BASE_RETRY_DELAY_MS = 1000;
  private readonly MAX_HISTORY_SIZE = 50;

  private constructor() {}

  static getInstance(): AIOrchestrator {
    if (!AIOrchestrator.instance) {
      AIOrchestrator.instance = new AIOrchestrator();
    }
    return AIOrchestrator.instance;
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  /**
   * Execute an AI operation with priority queue and validation
   */
  async execute<TInput, TOutput>(
    type: AIOperationType,
    priority: AIPriority,
    data: TInput,
    executor: (data: TInput) => Promise<TOutput>,
    validator?: (result: TOutput) => ValidationResult | boolean
  ): Promise<AIOperationResult<TOutput>> {
    const operation: AIOperation<TInput> = {
      id: this.generateOperationId(),
      type,
      priority,
      data,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: this.getMaxRetries(priority),
    };

    return new Promise((resolve, reject) => {
      // Add to queue with priority sorting
      this.addToQueue({
        operation: operation as AIOperation<unknown>,
        resolve: resolve as (result: AIOperationResult<unknown>) => void,
        reject,
      });

      // Start processing if not already running
      this.processQueue(executor as (data: unknown) => Promise<unknown>, validator as ((result: unknown) => ValidationResult | boolean) | undefined);
    });
  }

  /**
   * Set the last known valid program state (for fallback)
   */
  setLastValidProgram(program: TrainingProgram): void {
    this.lastValidProgram = JSON.parse(JSON.stringify(program));
  }

  /**
   * Get fallback program if AI fails
   */
  getLastValidProgram(): TrainingProgram | null {
    return this.lastValidProgram;
  }

  /**
   * Check if orchestrator is currently busy
   */
  isBusy(): boolean {
    return this.lock.isLocked || this.queue.length > 0;
  }

  /**
   * Get current lock status
   */
  getLockStatus(): StateLock {
    return { ...this.lock };
  }

  /**
   * Get operation history for debugging
   */
  getHistory(): typeof this.operationHistory {
    return [...this.operationHistory];
  }

  /**
   * Cancel all pending operations (emergency stop)
   */
  cancelAll(): void {
    for (const queued of this.queue) {
      queued.reject(new Error('Operations cancelled'));
    }
    this.queue = [];
    this.releaseLock();
  }

  // ==========================================
  // QUEUE MANAGEMENT
  // ==========================================

  private addToQueue(queued: QueuedOperation): void {
    // Insert based on priority (lower number = higher priority)
    const insertIndex = this.queue.findIndex(
      q => q.operation.priority > queued.operation.priority
    );

    if (insertIndex === -1) {
      this.queue.push(queued);
    } else {
      this.queue.splice(insertIndex, 0, queued);
    }

    this.lock.pendingOperations = this.queue.map(q => q.operation.id);
  }

  private async processQueue<T>(
    executor: (data: unknown) => Promise<T>,
    validator?: (result: T) => ValidationResult | boolean
  ): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        // Check and clear stale locks
        this.checkLockTimeout();

        // Wait if locked by another operation
        if (this.lock.isLocked) {
          await this.waitForUnlock();
          continue;
        }

        const queued = this.queue.shift();
        if (!queued) continue;

        // Acquire lock
        this.acquireLock(queued.operation.id, queued.operation.type);

        const startTime = Date.now();

        try {
          // Execute with retry logic
          const result = await this.executeWithRetry(
            queued.operation,
            executor,
            validator
          );

          const duration = Date.now() - startTime;

          // Record success
          this.recordOperation(queued.operation, true);

          queued.resolve({
            success: true,
            data: result as unknown,
            operationId: queued.operation.id,
            duration,
            retriesUsed: queued.operation.retryCount,
          });

        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Record failure
          this.recordOperation(queued.operation, false, errorMessage);

          queued.resolve({
            success: false,
            error: errorMessage,
            operationId: queued.operation.id,
            duration,
            retriesUsed: queued.operation.retryCount,
          });
        } finally {
          this.releaseLock();
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeWithRetry<T>(
    operation: AIOperation,
    executor: (data: unknown) => Promise<T>,
    validator?: (result: T) => ValidationResult | boolean
  ): Promise<T> {
    let lastError: Error | null = null;

    while (operation.retryCount <= operation.maxRetries) {
      try {
        // Execute the AI call
        const result = await executor(operation.data);

        // Validate result if validator provided
        if (validator) {
          const validation = validator(result);
          const isValid = typeof validation === 'boolean'
            ? validation
            : validation.isValid;

          if (!isValid) {
            throw new Error('AI response validation failed');
          }
        }

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        operation.retryCount++;

        if (operation.retryCount <= operation.maxRetries) {
          // Exponential backoff
          const delay = this.BASE_RETRY_DELAY_MS * Math.pow(2, operation.retryCount - 1);
          console.log(`[AIOrchestrator] Retry ${operation.retryCount}/${operation.maxRetries} for ${operation.type} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  // ==========================================
  // LOCK MANAGEMENT
  // ==========================================

  private acquireLock(operationId: string, operationType: AIOperationType): void {
    this.lock = {
      isLocked: true,
      lockedBy: operationId,
      lockTime: Date.now(),
      pendingOperations: this.queue.map(q => q.operation.id),
    };
    console.log(`[AIOrchestrator] Lock acquired by ${operationType} (${operationId})`);
  }

  private releaseLock(): void {
    console.log(`[AIOrchestrator] Lock released by ${this.lock.lockedBy}`);
    this.lock = {
      isLocked: false,
      lockedBy: null,
      lockTime: 0,
      pendingOperations: this.queue.map(q => q.operation.id),
    };
  }

  private checkLockTimeout(): void {
    if (this.lock.isLocked && Date.now() - this.lock.lockTime > this.LOCK_TIMEOUT_MS) {
      console.warn(`[AIOrchestrator] Lock timeout, forcing release. Was held by: ${this.lock.lockedBy}`);
      this.releaseLock();
    }
  }

  private async waitForUnlock(): Promise<void> {
    const checkInterval = 100;
    const maxWait = this.LOCK_TIMEOUT_MS;
    let waited = 0;

    while (this.lock.isLocked && waited < maxWait) {
      await this.sleep(checkInterval);
      waited += checkInterval;
      this.checkLockTimeout();
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMaxRetries(priority: AIPriority): number {
    switch (priority) {
      case AIPriority.CRITICAL: return 3;
      case AIPriority.HIGH: return 2;
      case AIPriority.NORMAL: return 1;
      case AIPriority.LOW: return 0;
      default: return 1;
    }
  }

  private recordOperation(
    operation: AIOperation,
    success: boolean,
    error?: string
  ): void {
    this.operationHistory.push({
      operationId: operation.id,
      type: operation.type,
      success,
      timestamp: Date.now(),
      error,
    });

    // Keep history bounded
    if (this.operationHistory.length > this.MAX_HISTORY_SIZE) {
      this.operationHistory.shift();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==========================================
// CONVENIENCE FUNCTIONS
// ==========================================

/**
 * Get singleton instance
 */
export function getOrchestrator(): AIOrchestrator {
  return AIOrchestrator.getInstance();
}

/**
 * Validate program structure and return detailed result
 */
export function validateAIResponse(program: TrainingProgram): ValidationResult {
  return validateProgramStructure(program);
}

/**
 * Check if operation should proceed based on priority and lock state
 */
export function shouldProceed(priority: AIPriority): boolean {
  const orchestrator = getOrchestrator();
  const lockStatus = orchestrator.getLockStatus();

  // CRITICAL always proceeds
  if (priority === AIPriority.CRITICAL) return true;

  // If not locked, proceed
  if (!lockStatus.isLocked) return true;

  // Otherwise, wait in queue
  return false;
}
