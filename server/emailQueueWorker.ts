/**
 * Email Queue Worker
 * 
 * Background worker that processes the email queue at regular intervals.
 * Runs independently of web requests for better reliability and scalability.
 * 
 * Features:
 * - Processes emails in batches
 * - Rate limiting to avoid SMTP throttling
 * - Automatic cleanup of old emails
 * - Graceful shutdown
 */

import { processEmailQueue, cleanupOldEmails, cleanupExpiredTokens } from './emailQueue';

const BATCH_SIZE = 10; // Process 10 emails per batch
const PROCESS_INTERVAL = 10000; // Check every 10 seconds
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Cleanup every hour
const RATE_LIMIT_DELAY = 100; // 100ms delay between batches to avoid rate limiting

class EmailQueueWorker {
  private processing = false;
  private intervalId: NodeJS.Timeout | null = null;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private shouldStop = false;

  async start() {
    console.log('📧 Starting Email Queue Worker...');
    console.log(`   - Batch size: ${BATCH_SIZE}`);
    console.log(`   - Check interval: ${PROCESS_INTERVAL / 1000}s`);
    
    // Process queue periodically
    this.intervalId = setInterval(async () => {
      if (!this.processing && !this.shouldStop) {
        await this.processQueue();
      }
    }, PROCESS_INTERVAL);
    
    // Cleanup old emails periodically
    this.cleanupIntervalId = setInterval(async () => {
      if (!this.shouldStop) {
        await this.cleanup();
      }
    }, CLEANUP_INTERVAL);
    
    // Process immediately on start
    await this.processQueue();
    await this.cleanup();
    
    console.log('✅ Email Queue Worker started successfully');
  }

  private async processQueue() {
    if (this.processing) return;
    
    this.processing = true;
    try {
      await processEmailQueue(BATCH_SIZE);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    } catch (error) {
      console.error('❌ Error processing email queue:', error);
    } finally {
      this.processing = false;
    }
  }

  private async cleanup() {
    try {
      await cleanupOldEmails(30); // Delete emails older than 30 days
      await cleanupExpiredTokens(); // Delete expired signature tokens
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  async stop() {
    console.log('📧 Stopping Email Queue Worker...');
    this.shouldStop = true;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    
    // Wait for current processing to finish
    while (this.processing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('✅ Email Queue Worker stopped');
  }
}

// Singleton instance
let workerInstance: EmailQueueWorker | null = null;

export function startEmailQueueWorker(): EmailQueueWorker {
  if (!workerInstance) {
    workerInstance = new EmailQueueWorker();
    workerInstance.start();
  }
  return workerInstance;
}

export function stopEmailQueueWorker(): Promise<void> {
  if (workerInstance) {
    return workerInstance.stop();
  }
  return Promise.resolve();
}

// Note: Removed process.exit() signal handlers as they conflict with development/testing
// The main process will handle graceful shutdown

