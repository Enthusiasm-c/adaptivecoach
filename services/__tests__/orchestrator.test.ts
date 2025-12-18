/**
 * Tests for AIOrchestrator and StateTransaction
 *
 * Verifies:
 * - Priority queue ordering
 * - State locking mechanism
 * - Transaction atomic commits and rollbacks
 * - Retry logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIOrchestrator, getOrchestrator, AIPriority } from '../aiOrchestrator';
import { StateTransaction, createTransaction, createReactTransaction } from '../stateTransaction';
import { TrainingProgram } from '../../types';

// ==========================================
// AIOrchestrator Tests
// ==========================================

describe('AIOrchestrator', () => {
  let orchestrator: AIOrchestrator;

  beforeEach(() => {
    // Get fresh instance
    orchestrator = getOrchestrator();
    orchestrator.cancelAll(); // Clear any pending operations
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = getOrchestrator();
      const instance2 = getOrchestrator();
      expect(instance1).toBe(instance2);
    });
  });

  describe('execute', () => {
    it('should execute simple operation successfully', async () => {
      const result = await orchestrator.execute(
        'adaptPlan',
        AIPriority.NORMAL,
        { value: 42 },
        async (data) => data.value * 2
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe(84);
      expect(result.retriesUsed).toBe(0);
    });

    it('should handle operation failure', async () => {
      const result = await orchestrator.execute(
        'adaptPlan',
        AIPriority.NORMAL,
        { value: 42 },
        async () => {
          throw new Error('Test error');
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });

    it('should retry on failure for HIGH priority', async () => {
      let attempts = 0;

      const result = await orchestrator.execute(
        'adaptPlan',
        AIPriority.HIGH,
        { value: 42 },
        async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Retry me');
          }
          return 'success';
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should not retry for LOW priority', async () => {
      let attempts = 0;

      const result = await orchestrator.execute(
        'adaptPlan',
        AIPriority.LOW,
        { value: 42 },
        async () => {
          attempts++;
          throw new Error('No retry');
        }
      );

      expect(result.success).toBe(false);
      expect(attempts).toBe(1); // No retries for LOW priority
    });

    it('should use validator when provided', async () => {
      const result = await orchestrator.execute(
        'adaptPlan',
        AIPriority.NORMAL,
        { value: 42 },
        async () => ({ invalid: true }),
        (result) => !result.invalid // Validator rejects invalid results
      );

      // Should fail validation and exhaust retries
      expect(result.success).toBe(false);
      expect(result.error).toBe('AI response validation failed');
    });
  });

  describe('lock management', () => {
    it('should report not busy when no operations', () => {
      expect(orchestrator.isBusy()).toBe(false);
    });

    it('should track lock status', async () => {
      // Start a slow operation
      const slowOperation = orchestrator.execute(
        'adaptPlan',
        AIPriority.NORMAL,
        {},
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'done';
        }
      );

      // Give it time to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should be busy now
      expect(orchestrator.isBusy()).toBe(true);

      // Wait for completion
      await slowOperation;

      // Should not be busy after
      expect(orchestrator.isBusy()).toBe(false);
    });
  });

  describe('fallback program', () => {
    it('should store and retrieve last valid program', () => {
      const program: TrainingProgram = {
        sessions: [{ name: 'Test', exercises: [] }]
      };

      orchestrator.setLastValidProgram(program);
      const retrieved = orchestrator.getLastValidProgram();

      expect(retrieved).not.toBe(program); // Should be a copy
      expect(retrieved?.sessions[0].name).toBe('Test');
    });
  });

  describe('operation history', () => {
    it('should record operations', async () => {
      await orchestrator.execute(
        'adaptPlan',
        AIPriority.NORMAL,
        {},
        async () => 'done'
      );

      const history = orchestrator.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].type).toBe('adaptPlan');
      expect(history[history.length - 1].success).toBe(true);
    });
  });
});

// ==========================================
// StateTransaction Tests
// ==========================================

describe('StateTransaction', () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
    };
  })();

  beforeEach(() => {
    localStorageMock.clear();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  describe('createTransaction', () => {
    it('should create transaction with unique ID', () => {
      const tx1 = createTransaction('test1');
      const tx2 = createTransaction('test2');
      expect(tx1.getId()).not.toBe(tx2.getId());
    });
  });

  describe('set and get', () => {
    it('should stage values without applying', () => {
      const tx = createTransaction('test');
      tx.set('workoutLogs', [{ id: 1 }]);

      expect(tx.has('workoutLogs')).toBe(true);
      expect(tx.get('workoutLogs')).toEqual([{ id: 1 }]);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('commit', () => {
    it('should apply all changes on commit', async () => {
      const tx = createTransaction('test');
      tx.set('workoutLogs', [{ id: 1 }]);
      tx.set('trainingProgram', { sessions: [] });

      const result = await tx.commit();

      expect(result.success).toBe(true);
      expect(result.changes).toContain('workoutLogs');
      expect(result.changes).toContain('trainingProgram');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'workoutLogs',
        JSON.stringify([{ id: 1 }])
      );
    });

    it('should prevent double commit', async () => {
      const tx = createTransaction('test');
      tx.set('workoutLogs', []);

      await tx.commit();
      const result = await tx.commit();

      expect(result.success).toBe(false);
      expect(result.error).toContain('already committed');
    });
  });

  describe('rollback', () => {
    it('should allow manual rollback', () => {
      const tx = createTransaction('test');
      tx.set('workoutLogs', []);
      tx.rollback();

      expect(tx.has('workoutLogs')).toBe(false);
    });

    it('should prevent commit after rollback', async () => {
      const tx = createTransaction('test');
      tx.set('workoutLogs', []);
      tx.rollback();

      const result = await tx.commit();
      expect(result.success).toBe(false);
    });
  });

  describe('createReactTransaction', () => {
    it('should call React setters on commit', async () => {
      const setProgram = vi.fn();
      const setLogs = vi.fn();

      const tx = createReactTransaction('test', {
        setTrainingProgram: setProgram,
        setWorkoutLogs: setLogs,
      });

      tx.set('trainingProgram', { sessions: [] });
      tx.set('workoutLogs', []);

      await tx.commit();

      expect(setProgram).toHaveBeenCalledWith({ sessions: [] });
      expect(setLogs).toHaveBeenCalledWith([]);
    });
  });
});
