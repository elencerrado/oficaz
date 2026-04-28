/**
 * Vacation Calculation Lock Manager
 * 
 * Prevents race conditions when recalculating vacation days by:
 * 1. Serializing all calculations per user (only one at a time per userId)
 * 2. Preventing duplicate concurrent calculations
 * 3. Providing centralized logging and error handling
 */

type LockEntry = {
  promise: Promise<any>;
  timestamp: number;
};

class VacationCalculationLockManager {
  private locks: Map<number, LockEntry> = new Map();
  private readonly LOCK_TIMEOUT_MS = 30000; // 30 seconds timeout

  /**
   * Execute a vacation calculation with lock protection
   * If another calculation is in progress for this user, wait for it to complete
   */
  async withLock<T>(userId: number, operation: () => Promise<T>, operationName: string = 'unknown'): Promise<T> {
    // Clean up stale locks first
    this.cleanupStaleLocks();

    // Check if there's already a calculation in progress for this user
    const existingLock = this.locks.get(userId);
    if (existingLock) {
      console.log(`⏳ Vacation calculation for user ${userId} already in progress (${operationName}), waiting...`);
      try {
        // Wait for the existing operation to complete
        await existingLock.promise;
        console.log(`✅ Previous calculation completed for user ${userId}, proceeding with ${operationName}`);
      } catch (error) {
        console.warn(`⚠️ Previous calculation failed for user ${userId}, proceeding anyway`);
      }
    }

    // Create new lock
    console.log(`🔒 Starting vacation calculation for user ${userId} (${operationName})`);
    const operationPromise = this.executeWithTimeout(userId, operation, operationName);
    
    this.locks.set(userId, {
      promise: operationPromise,
      timestamp: Date.now()
    });

    try {
      const result = await operationPromise;
      console.log(`✅ Completed vacation calculation for user ${userId} (${operationName})`);
      return result;
    } catch (error) {
      console.error(`❌ Failed vacation calculation for user ${userId} (${operationName}):`, error);
      throw error;
    } finally {
      // Always clean up the lock
      this.locks.delete(userId);
    }
  }

  /**
   * Execute operation with timeout protection
   */
  private async executeWithTimeout<T>(
    userId: number, 
    operation: () => Promise<T>, 
    operationName: string
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => 
        setTimeout(
          () => reject(new Error(`Vacation calculation timeout for user ${userId} (${operationName})`)),
          this.LOCK_TIMEOUT_MS
        )
      )
    ]);
  }

  /**
   * Clean up locks that have been held too long (likely dead processes)
   */
  private cleanupStaleLocks(): void {
    const now = Date.now();
    const toDelete: number[] = [];
    
    this.locks.forEach((lock, userId) => {
      if (now - lock.timestamp > this.LOCK_TIMEOUT_MS) {
        console.warn(`⚠️ Cleaning up stale lock for user ${userId} (held for ${(now - lock.timestamp) / 1000}s)`);
        toDelete.push(userId);
      }
    });
    
    toDelete.forEach(userId => this.locks.delete(userId));
  }

  /**
   * Get current lock status (for debugging)
   */
  getLockStatus(): { userId: number; ageMs: number }[] {
    const now = Date.now();
    const status: { userId: number; ageMs: number }[] = [];
    
    this.locks.forEach((lock, userId) => {
      status.push({
        userId,
        ageMs: now - lock.timestamp
      });
    });
    
    return status;
  }

  /**
   * Force clear all locks (use with caution!)
   */
  clearAllLocks(): void {
    console.warn('⚠️ Force clearing all vacation calculation locks');
    this.locks.clear();
  }
}

// Singleton instance
export const vacationLockManager = new VacationCalculationLockManager();
