import { storage } from './storage.js';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import type { ImageProcessingJob } from '@shared/schema';

class BackgroundImageProcessor {
  private isRunning = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly PROCESSING_INTERVAL = 5000; // Check every 5 seconds
  private readonly MAX_CONCURRENT_JOBS = 2; // Limit concurrent processing
  private currentlyProcessing = new Set<number>();

  async start() {
    if (this.isRunning) {
      console.log('📸 Background image processor is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Background image processor started');
    
    // Start the processing loop
    this.processingInterval = setInterval(async () => {
      await this.processNextJob();
    }, this.PROCESSING_INTERVAL);
    
    // Process any existing jobs immediately
    await this.processNextJob();
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log('⏹️ Background image processor stopped');
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Wait for current jobs to finish (max 30 seconds)
    const maxWait = 30000;
    const startTime = Date.now();
    while (this.currentlyProcessing.size > 0 && (Date.now() - startTime) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async processNextJob(): Promise<void> {
    if (this.currentlyProcessing.size >= this.MAX_CONCURRENT_JOBS) {
      return; // Already at max capacity
    }

    try {
      const pendingJobs = await storage.getPendingImageProcessingJobs();
      
      for (const job of pendingJobs) {
        if (this.currentlyProcessing.has(job.id) || this.currentlyProcessing.size >= this.MAX_CONCURRENT_JOBS) {
          continue;
        }

        // Mark as being processed
        this.currentlyProcessing.add(job.id);
        
        // Process job asynchronously
        this.processJob(job).finally(() => {
          this.currentlyProcessing.delete(job.id);
        });
      }
    } catch (error) {
      console.error('❌ Error checking for pending jobs:', error);
    }
  }

  private async processJob(job: ImageProcessingJob): Promise<void> {
    console.log(`📸 Starting processing job ${job.id} for user ${job.userId}`);
    
    try {
      // Mark job as started
      await storage.updateImageProcessingJob(job.id, {
        status: 'processing',
        startedAt: new Date()
      });

      const result = await this.processImage(job);
      
      // Update user's profile picture if this is a profile picture job
      if (job.processingType === 'profile_picture') {
        const metadata = (job.metadata || {}) as any;
        const targetUserId = metadata.targetUserId || job.userId;
        const profilePictureUrl = `/uploads/${path.basename(result.outputPath)}`;
        
        await storage.updateUser(targetUserId, { 
          profilePicture: profilePictureUrl 
        });
        console.log(`👤 Updated user ${targetUserId} profile picture: ${profilePictureUrl}`);
      }
      
      // Mark job as completed
      await storage.updateImageProcessingJob(job.id, {
        status: 'completed',
        processedFilePath: result.outputPath,
        completedAt: new Date()
      });

      console.log(`✅ Completed processing job ${job.id} -> ${result.outputPath}`);
      
      // Cleanup original file after successful processing
      try {
        await fs.unlink(job.originalFilePath);
        console.log(`🗑️ Cleaned up original file: ${job.originalFilePath}`);
      } catch (cleanupError) {
        console.warn(`⚠️ Warning: Could not delete original file ${job.originalFilePath}:`, cleanupError);
      }
      
    } catch (error) {
      console.error(`❌ Error processing job ${job.id}:`, error);
      
      // Mark job as failed
      await storage.updateImageProcessingJob(job.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });
    }
  }

  private async processImage(job: ImageProcessingJob): Promise<{ outputPath: string }> {
    const { originalFilePath: inputPath, metadata } = job;
    
    // Security: Validate input path is within uploads directory
    const uploadsDir = path.resolve('uploads');
    const resolvedInputPath = path.resolve(inputPath);
    if (!resolvedInputPath.startsWith(uploadsDir)) {
      throw new Error(`Unauthorized file path: ${inputPath}`);
    }
    
    // Ensure the input file exists
    try {
      await fs.access(resolvedInputPath);
    } catch {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    // Parse metadata and extract processing configuration
    let parsedMetadata: any = {};
    let config: any = {};
    try {
      parsedMetadata = typeof metadata === 'string' 
        ? JSON.parse(metadata) 
        : metadata || {};
      config = parsedMetadata.processingConfig || {};
    } catch (error) {
      throw new Error(`Invalid metadata or processing configuration: ${error}`);
    }

    // Generate output path - use metadata.outputPath if provided, otherwise generate deterministic name
    const inputDir = path.dirname(resolvedInputPath);
    const inputName = path.basename(resolvedInputPath, path.extname(resolvedInputPath));
    const inputExt = path.extname(resolvedInputPath);
    
    let outputPath: string;
    if (config.outputPath) {
      // Use provided output path (validate it's also within uploads)
      const resolvedOutputPath = path.resolve(config.outputPath);
      if (!resolvedOutputPath.startsWith(uploadsDir)) {
        throw new Error(`Unauthorized output path: ${config.outputPath}`);
      }
      outputPath = resolvedOutputPath;
    } else {
      // Generate deterministic output path based on processing type
      const { processingType } = job;
      if (processingType === 'profile_picture') {
        outputPath = path.join(inputDir, `profile_${job.userId}${inputExt}`);
      } else {
        outputPath = path.join(inputDir, `${inputName}_processed${inputExt}`);
      }
    }

    console.log(`📸 Processing: ${resolvedInputPath} -> ${outputPath}`);
    console.log(`📸 Config:`, config);

    // Process image with Sharp
    let sharpInstance = sharp(resolvedInputPath);

    // Auto-rotate based on EXIF orientation
    sharpInstance = sharpInstance.rotate();

    // Apply transformations based on config
    if (config.resize) {
      const { width, height, fit } = config.resize;
      sharpInstance = sharpInstance.resize(width, height, { 
        fit: fit || 'cover',
        position: 'center'
      });
    }

    // Convert to JPEG for consistency and apply quality settings
    sharpInstance = sharpInstance.jpeg({ 
      quality: config.quality || 85,
      progressive: true
    });

    // Save the processed image
    await sharpInstance.toFile(outputPath);

    return { outputPath };
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      currentlyProcessing: this.currentlyProcessing.size,
      maxConcurrentJobs: this.MAX_CONCURRENT_JOBS
    };
  }
}

// Create singleton instance
export const backgroundImageProcessor = new BackgroundImageProcessor();