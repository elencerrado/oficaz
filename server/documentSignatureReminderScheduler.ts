/**
 * Document Signature Reminder Scheduler
 * 
 * Enterprise-grade escalating reminder system for unsigned documents.
 * 
 * Features:
 * - Escalating reminders: 24h, 3 days, 7 days, 14 days after upload
 * - Batch processing to prevent server overload
 * - Intelligent throttling (max emails per batch)
 * - Only sends to employees with unsigned documents
 * - Links go to login page (not direct document link)
 * - Tracks sent reminders to avoid duplicates
 * 
 * Schedule: Runs every 6 hours
 */

import { db } from './db';
import { sql, eq, and, lt, isNull, notInArray, inArray } from 'drizzle-orm';
import { documents, documentSignatureReminders, users } from '../shared/schema.js';
import { queueEmail } from './emailQueue.js';

// Reminder schedule configuration (in hours)
const REMINDER_SCHEDULE = [
  { number: 1, hoursAfterUpload: 24 },     // 1 day
  { number: 2, hoursAfterUpload: 72 },     // 3 days
  { number: 3, hoursAfterUpload: 168 },    // 7 days
  { number: 4, hoursAfterUpload: 336 },    // 14 days
];

// Throttling configuration
const MAX_EMAILS_PER_BATCH = 50; // Send max 50 emails at a time
const BATCH_DELAY_MS = 2000; // Wait 2 seconds between batches
let isSchedulerInitialized = false;

interface UnsignedDocument {
  documentId: number;
  userId: number;
  companyId: number;
  fileName: string;
  originalName: string;
  uploadedAt: Date | string | number | null;
  userEmail: string;
  userPersonalEmail: string | null;
  userName: string;
  companyAlias: string;
  requiresSignature: boolean;
}

function normalizeToDate(value: Date | string | number | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Get all unsigned documents that need reminders
 */
async function getUnsignedDocuments(): Promise<UnsignedDocument[]> {
  const result = await db.execute(sql`
    SELECT 
      d.id as "documentId",
      d.user_id as "userId",
      d.company_id as "companyId",
      d.file_name as "fileName",
      d.original_name as "originalName",
      d.created_at as "uploadedAt",
      d.requires_signature as "requiresSignature",
      u.company_email as "userEmail",
      u.personal_email as "userPersonalEmail",
      u.full_name as "userName",
      c.company_alias as "companyAlias"
    FROM documents d
    INNER JOIN users u ON d.user_id = u.id
    INNER JOIN companies c ON d.company_id = c.id
    WHERE 
      d.signed_at IS NULL 
      AND d.requires_signature = true
      AND u.role = 'employee'
      AND c.is_deleted = false
    ORDER BY d.created_at ASC
  `);

  return (result.rows as any[]).map((row) => ({
    ...row,
    uploadedAt: normalizeToDate(row.uploadedAt),
  })) as UnsignedDocument[];
}

/**
 * Get reminders already sent for a document
 */
async function getSentReminders(documentId: number, userId: number): Promise<number[]> {
  const result = await db
    .select({ reminderNumber: documentSignatureReminders.reminderNumber })
    .from(documentSignatureReminders)
    .where(
      and(
        eq(documentSignatureReminders.documentId, documentId),
        eq(documentSignatureReminders.userId, userId)
      )
    );

  return result.map(r => r.reminderNumber);
}

/**
 * Calculate which reminder should be sent based on time elapsed
 */
function calculateDueReminder(uploadedAt: Date | string | number | null, sentReminders: number[]): number | null {
  const uploadedDate = normalizeToDate(uploadedAt);
  if (!uploadedDate) {
    return null;
  }

  const now = new Date();
  const hoursElapsed = (now.getTime() - uploadedDate.getTime()) / (1000 * 60 * 60);

  // Find the highest reminder number that should have been sent
  for (let i = REMINDER_SCHEDULE.length - 1; i >= 0; i--) {
    const reminder = REMINDER_SCHEDULE[i];
    
    // If enough time has passed and this reminder hasn't been sent yet
    if (hoursElapsed >= reminder.hoursAfterUpload && !sentReminders.includes(reminder.number)) {
      return reminder.number;
    }
  }

  return null;
}

/**
 * Send reminder email for a document
 */
async function sendReminderEmail(doc: UnsignedDocument, reminderNumber: number): Promise<number | null> {
  try {
    // Use personal email if available, otherwise company email
    const toEmail = doc.userPersonalEmail || doc.userEmail;
    
    if (!toEmail) {
      console.error(`❌ No email found for user ${doc.userId}`);
      return null;
    }

    // Build login URL (not direct to document)
    const loginUrl = `${process.env.VITE_APP_URL || 'http://localhost:5000'}/${doc.companyAlias}/inicio`;

    const reminderLabels = {
      1: 'primer recordatorio',
      2: 'segundo recordatorio',
      3: 'tercer recordatorio',
      4: 'recordatorio final'
    };

    // Queue the email
    const emailId = await queueEmail({
      userId: doc.userId,
      toEmail,
      toName: doc.userName,
      subject: reminderNumber === 4 
        ? '⚠️ Recordatorio Final: Documento Pendiente de Firma'
        : '📄 Recordatorio: Documento Pendiente de Firma',
      templateType: 'signature_reminder',
      templateData: {
        userName: doc.userName,
        documentName: doc.originalName || doc.fileName,
        documentId: doc.documentId,
        loginUrl,
        reminderNumber,
        reminderLabel: reminderLabels[reminderNumber as keyof typeof reminderLabels] || 'recordatorio',
        isUrgent: reminderNumber >= 3
      },
      companyId: doc.companyId,
      priority: reminderNumber >= 3 ? 2 : 3, // Urgent for 3rd and 4th reminders
    });

    console.log(`📧 Reminder ${reminderNumber} queued for document ${doc.documentId} to ${toEmail} (email queue ID: ${emailId})`);

    return emailId;
  } catch (error) {
    console.error(`❌ Error queueing reminder for document ${doc.documentId}:`, error);
    return null;
  }
}

/**
 * Record that a reminder was sent
 */
async function recordReminderSent(
  documentId: number,
  userId: number,
  companyId: number,
  reminderNumber: number,
  emailQueueId: number | null
): Promise<void> {
  await db.insert(documentSignatureReminders).values({
    documentId,
    userId,
    companyId,
    reminderNumber,
    emailQueueId,
    sentAt: new Date(),
  });
}

/**
 * Process reminders in batches with throttling
 */
async function processRemindersInBatches(
  remindersToSend: Array<{ doc: UnsignedDocument; reminderNumber: number }>
): Promise<void> {
  const batches: typeof remindersToSend[] = [];
  
  // Split into batches
  for (let i = 0; i < remindersToSend.length; i += MAX_EMAILS_PER_BATCH) {
    batches.push(remindersToSend.slice(i, i + MAX_EMAILS_PER_BATCH));
  }

  console.log(`📧 Processing ${remindersToSend.length} reminders in ${batches.length} batch(es)`);

  // Process each batch with delay between batches
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    console.log(`📧 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} reminders)`);

    // Process all reminders in this batch in parallel
    const batchPromises = batch.map(async ({ doc, reminderNumber }) => {
      try {
        const emailQueueId = await sendReminderEmail(doc, reminderNumber);
        if (!emailQueueId) {
          console.warn(`⚠️ Reminder #${reminderNumber} for document ${doc.documentId} was not queued. It will be retried in the next run.`);
          return;
        }

        await recordReminderSent(doc.documentId, doc.userId, doc.companyId, reminderNumber, emailQueueId);
      } catch (error) {
        console.error(`❌ Error processing reminder for document ${doc.documentId}:`, error);
      }
    });

    await Promise.all(batchPromises);

    // Wait before processing next batch (except for last batch)
    if (batchIndex < batches.length - 1) {
      console.log(`⏳ Waiting ${BATCH_DELAY_MS}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }
}

/**
 * Main function: Check and send signature reminders
 */
export async function checkAndSendSignatureReminders(): Promise<void> {
  console.log('\n📧 ====== DOCUMENT SIGNATURE REMINDER CHECK ======');
  console.log(`⏰ Started at: ${new Date().toISOString()}`);

  try {
    // Get all unsigned documents
    const unsignedDocs = await getUnsignedDocuments();
    console.log(`📄 Found ${unsignedDocs.length} unsigned documents requiring signature`);

    if (unsignedDocs.length === 0) {
      console.log('✅ No unsigned documents found. Exiting.');
      return;
    }

    // For each document, check if a reminder is due
    const remindersToSend: Array<{ doc: UnsignedDocument; reminderNumber: number }> = [];

    for (const doc of unsignedDocs) {
      const sentReminders = await getSentReminders(doc.documentId, doc.userId);
      const dueReminder = calculateDueReminder(doc.uploadedAt, sentReminders);

      if (dueReminder !== null) {
        remindersToSend.push({ doc, reminderNumber: dueReminder });
        console.log(`📝 Document ${doc.documentId} (${doc.originalName}) needs reminder #${dueReminder}`);
      }
    }

    console.log(`📬 Total reminders to send: ${remindersToSend.length}`);

    if (remindersToSend.length === 0) {
      console.log('✅ No reminders due at this time. Exiting.');
      return;
    }

    // Process reminders in batches
    await processRemindersInBatches(remindersToSend);

    console.log(`✅ Reminder check completed successfully`);
    console.log(`📊 Summary: ${remindersToSend.length} reminders queued for delivery`);

  } catch (error) {
    console.error('❌ Error in signature reminder scheduler:', error);
    throw error;
  }
}

/**
 * Initialize the scheduler (called from server startup)
 */
export function initializeSignatureReminderScheduler(): void {
  if (isSchedulerInitialized) {
    console.warn('⚠️ Document signature reminder scheduler already initialized. Skipping duplicate init.');
    return;
  }

  isSchedulerInitialized = true;

  console.log('📧 Initializing Document Signature Reminder Scheduler');
  console.log(`⏰ Schedule: Every 6 hours`);
  console.log(`📬 Reminder schedule:`, REMINDER_SCHEDULE);
  console.log(`⚡ Batch size: ${MAX_EMAILS_PER_BATCH} emails`);
  console.log(`⏱️  Batch delay: ${BATCH_DELAY_MS}ms`);

  // Run immediately on startup
  checkAndSendSignatureReminders().catch(err => {
    console.error('❌ Error in initial reminder check:', err);
  });

  // Schedule to run every 6 hours
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(() => {
    checkAndSendSignatureReminders().catch(err => {
      console.error('❌ Error in scheduled reminder check:', err);
    });
  }, SIX_HOURS);

  console.log('✅ Document Signature Reminder Scheduler initialized');
}
