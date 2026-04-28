import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const statusRows = await sql`
  SELECT status, count(*)::int AS count
  FROM email_queue
  WHERE template_type = 'incomplete_session_weekly_reminder'
    AND (scheduled_for IS NULL OR scheduled_for <= NOW())
    AND (
      DATE(created_at AT TIME ZONE 'Europe/Madrid') = DATE(NOW() AT TIME ZONE 'Europe/Madrid')
      OR DATE(sent_at AT TIME ZONE 'Europe/Madrid') = DATE(NOW() AT TIME ZONE 'Europe/Madrid')
    )
  GROUP BY status
  ORDER BY status
`;

const sentRows = await sql`
  SELECT id, to_email, subject, created_at, sent_at
  FROM email_queue
  WHERE template_type = 'incomplete_session_weekly_reminder'
    AND status = 'sent'
    AND DATE(sent_at AT TIME ZONE 'Europe/Madrid') = DATE(NOW() AT TIME ZONE 'Europe/Madrid')
  ORDER BY sent_at DESC
  LIMIT 20
`;

const queuedRows = await sql`
  SELECT id, to_email, subject, created_at, status
  FROM email_queue
  WHERE template_type = 'incomplete_session_weekly_reminder'
    AND status IN ('pending', 'processing', 'failed')
    AND DATE(created_at AT TIME ZONE 'Europe/Madrid') = DATE(NOW() AT TIME ZONE 'Europe/Madrid')
  ORDER BY created_at DESC
  LIMIT 20
`;

const latestRows = await sql`
  SELECT id, status, to_email, subject, created_at, sent_at
  FROM email_queue
  WHERE template_type = 'incomplete_session_weekly_reminder'
  ORDER BY created_at DESC
  LIMIT 10
`;

console.log(
  JSON.stringify(
    {
      dateMadrid: new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }),
      statusRows,
      sentCount: sentRows.length,
      queuedCount: queuedRows.length,
      latestCount: latestRows.length,
      sentRows,
      queuedRows,
      latestRows,
    },
    null,
    2,
  ),
);
