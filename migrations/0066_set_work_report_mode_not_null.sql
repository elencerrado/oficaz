UPDATE users
SET work_report_mode = 'manual'
WHERE work_report_mode IS NULL;

ALTER TABLE users
ALTER COLUMN work_report_mode SET DEFAULT 'manual';

ALTER TABLE users
ALTER COLUMN work_report_mode SET NOT NULL;