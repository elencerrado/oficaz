import cron from 'node-cron';
import { storage } from './storage';

type VacationAccrualTask = ReturnType<typeof cron.schedule>;

declare global {
  var vacationAccrualTask: VacationAccrualTask | undefined;
  var vacationAccrualSchedulerRunning: boolean | undefined;
}

async function runVacationAccrualSync(): Promise<void> {
  try {
    const result = await storage.syncVacationDaysForAllCompanies();

    if (result.updatedUsers > 0 || result.errorUsers > 0 || process.env.DEBUG_SCHEDULER) {
      console.log(
        `🏖️ VACATION ACCRUAL SYNC: companies=${result.processedCompanies}, users=${result.processedUsers}, updated=${result.updatedUsers}, errors=${result.errorUsers}`
      );
    }
  } catch (error) {
    console.error('❌ Vacation accrual sync failed:', error);
  }
}

export function initializeVacationAccrualScheduler(): void {
  if (global.vacationAccrualSchedulerRunning) {
    if (process.env.DEBUG_SCHEDULER) {
      console.log('⚠️ Vacation accrual scheduler already running - skipping init');
    }
    return;
  }

  if (global.vacationAccrualTask) {
    global.vacationAccrualTask.stop();
    global.vacationAccrualTask = undefined;
  }

  global.vacationAccrualTask = cron.schedule('30 2 * * *', async () => {
    await runVacationAccrualSync();
  }, {
    timezone: 'Europe/Madrid',
  });

  global.vacationAccrualSchedulerRunning = true;
  console.log('✅ Vacation accrual scheduler started (02:30 Europe/Madrid daily)');
}
