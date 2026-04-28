import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no configurado');
}

const sql = neon(process.env.DATABASE_URL);

function isoDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toTime(hours, minutes = 0) {
  return `${pad2(hours)}:${pad2(minutes)}:00`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('🏭 Reseteando datos de Servited con dataset industrial...');

  const companyRows = await sql`
    SELECT id, name, company_alias
    FROM companies
    WHERE lower(name) = 'servited' OR lower(company_alias) = 'servited'
    ORDER BY id
    LIMIT 1
  `;

  if (companyRows.length === 0) {
    throw new Error('Empresa Servited no encontrada');
  }

  const company = companyRows[0];
  const companyId = company.id;

  const adminRows = await sql`
    SELECT id, full_name, company_email
    FROM users
    WHERE company_id = ${companyId}
      AND role = 'admin'
      AND is_active = true
    ORDER BY id
    LIMIT 1
  `;

  if (adminRows.length === 0) {
    throw new Error('No se encontró un admin activo en Servited');
  }

  const admin = adminRows[0];

  console.log(`✅ Empresa objetivo: ${company.name} (ID ${companyId})`);
  console.log(`✅ Admin conservado: ${admin.full_name} (ID ${admin.id})`);

  const allCompanyUsers = await sql`
    SELECT id
    FROM users
    WHERE company_id = ${companyId}
  `;
  const allCompanyUserIds = allCompanyUsers.map((u) => u.id);

  const nonAdminRows = await sql`
    SELECT id
    FROM users
    WHERE company_id = ${companyId}
      AND role <> 'admin'
  `;
  const nonAdminIds = nonAdminRows.map((u) => u.id);

  await sql`BEGIN`;
  try {
    if (allCompanyUserIds.length > 0) {
      await sql`DELETE FROM messages WHERE sender_id = ANY(${allCompanyUserIds}::int[]) OR receiver_id = ANY(${allCompanyUserIds}::int[])`;
      await sql`DELETE FROM notifications WHERE user_id = ANY(${allCompanyUserIds}::int[])`;
      await sql`DELETE FROM adverse_weather_hours_pool WHERE user_id = ANY(${allCompanyUserIds}::int[])`;
    }

    await sql`DELETE FROM work_reports WHERE company_id = ${companyId}`;
    await sql`DELETE FROM work_shifts WHERE company_id = ${companyId}`;
    await sql`DELETE FROM reminders WHERE company_id = ${companyId}`;
    await sql`DELETE FROM document_signature_reminders WHERE company_id = ${companyId}`;
    await sql`DELETE FROM documents WHERE company_id = ${companyId}`;
    await sql`DELETE FROM work_session_audit_log WHERE company_id = ${companyId}`;
    await sql`DELETE FROM work_session_modification_requests WHERE company_id = ${companyId}`;
    await sql`DELETE FROM adverse_weather_incidents WHERE company_id = ${companyId}`;

    if (nonAdminIds.length > 0) {
      await sql`DELETE FROM break_periods WHERE user_id = ANY(${nonAdminIds}::int[])`;
      await sql`DELETE FROM work_sessions WHERE user_id = ANY(${nonAdminIds}::int[])`;
      await sql`DELETE FROM hour_based_absences WHERE user_id = ANY(${nonAdminIds}::int[])`;
      await sql`DELETE FROM vacation_requests WHERE user_id = ANY(${nonAdminIds}::int[])`;
      await sql`DELETE FROM image_processing_jobs WHERE user_id = ANY(${nonAdminIds}::int[])`;
      await sql`DELETE FROM push_subscriptions WHERE user_id = ANY(${nonAdminIds}::int[])`;
      await sql`DELETE FROM refresh_tokens WHERE user_id = ANY(${nonAdminIds}::int[])`;
      await sql`DELETE FROM employee_activation_tokens WHERE user_id = ANY(${nonAdminIds}::int[])`;
      await sql`DELETE FROM work_alarms WHERE user_id = ANY(${nonAdminIds}::int[])`;
      await sql`DELETE FROM signed_urls WHERE user_id = ANY(${nonAdminIds}::int[])`;

      await sql`DELETE FROM users WHERE id = ANY(${nonAdminIds}::int[])`;
    }

    const sharedPasswordHash = await bcrypt.hash('Servited2026!', 10);
    const today = new Date();

    const newPeople = [
      {
        fullName: 'Samuel Ortega Prieto',
        dni: '72839145K',
        role: 'manager',
        position: 'Jefe de Operaciones HVAC',
        companyEmail: 'samuel.ortega@servited-industrial.es',
        startOffsetDays: -520,
      },
      {
        fullName: 'Irene Moya Castillo',
        dni: '51640832L',
        role: 'employee',
        position: 'Tecnica de Frio Industrial',
        companyEmail: 'irene.moya@servited-industrial.es',
        startOffsetDays: -420,
      },
      {
        fullName: 'Raul Benitez Duran',
        dni: '43912087P',
        role: 'employee',
        position: 'Tecnico SAT de Climatizacion',
        companyEmail: 'raul.benitez@servited-industrial.es',
        startOffsetDays: -390,
      },
      {
        fullName: 'Lucia Ferrer Navas',
        dni: '38457196H',
        role: 'employee',
        position: 'Tecnica de Mantenimiento Preventivo',
        companyEmail: 'lucia.ferrer@servited-industrial.es',
        startOffsetDays: -260,
      },
      {
        fullName: 'Victor Prado Sanz',
        dni: '29164358T',
        role: 'employee',
        position: 'Tecnico Frigorista',
        companyEmail: 'victor.prado@servited-industrial.es',
        startOffsetDays: -190,
      },
      {
        fullName: 'Noelia Campos Rios',
        dni: '31780264M',
        role: 'employee',
        position: 'Tecnica de Puesta en Marcha',
        companyEmail: 'noelia.campos@servited-industrial.es',
        startOffsetDays: -150,
      },
      {
        fullName: 'Hector Salas Vera',
        dni: '45829613R',
        role: 'employee',
        position: 'Tecnico de Averias Urgentes',
        companyEmail: 'hector.salas@servited-industrial.es',
        startOffsetDays: -120,
      },
    ];

    const insertedUsers = [];
    for (const person of newPeople) {
      const startDate = addDays(today, person.startOffsetDays);
      const inserted = await sql`
        INSERT INTO users (
          company_id, full_name, dni, role, company_email, password, position,
          start_date, status, is_active, is_pending_activation, activated_at,
          total_vacation_days, used_vacation_days, vacation_days_adjustment,
          created_by, created_at, updated_at
        ) VALUES (
          ${companyId}, ${person.fullName}, ${person.dni}, ${person.role}, ${person.companyEmail}, ${sharedPasswordHash}, ${person.position},
          ${startDate.toISOString()}, 'active', true, false, now(),
          '22.0', '0.0', '0.0',
          ${admin.id}, now(), now()
        )
        RETURNING id, full_name, role, position
      `;
      insertedUsers.push(inserted[0]);
    }

    const manager = insertedUsers.find((u) => u.role === 'manager');
    const technicians = insertedUsers.filter((u) => u.role === 'employee');

    const sessionCountByUser = new Map();

    for (const user of insertedUsers) {
      let createdSessions = 0;
      for (let i = 50; i >= 1; i--) {
        const dayDate = addDays(today, -i);
        if (isWeekend(dayDate)) continue;

        const startHourBase = user.role === 'manager' ? 8 : 7;
        const startMinute = randomInt(0, 20);
        const durationHours = user.role === 'manager' ? randomInt(8, 9) : randomInt(8, 10);
        const endMinute = randomInt(0, 20);

        const clockIn = new Date(dayDate);
        clockIn.setHours(startHourBase, startMinute, 0, 0);

        const clockOut = new Date(clockIn);
        clockOut.setHours(clockOut.getHours() + durationHours, endMinute, 0, 0);

        const totalBreakHours = user.role === 'manager' ? 0.5 : 0.75;
        const netHours = ((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) - totalBreakHours).toFixed(2);

        const insertedSession = await sql`
          INSERT INTO work_sessions (
            user_id, clock_in, clock_out, total_hours, total_break_time,
            status, auto_completed, is_manually_created, created_at
          ) VALUES (
            ${user.id}, ${clockIn.toISOString()}, ${clockOut.toISOString()}, ${netHours}, ${String(totalBreakHours.toFixed(2))},
            'completed', false, false, now()
          )
          RETURNING id
        `;

        if (Math.random() < 0.9) {
          const breakStart = new Date(clockIn);
          breakStart.setHours(13, randomInt(5, 25), 0, 0);
          const breakEnd = new Date(breakStart);
          breakEnd.setMinutes(breakEnd.getMinutes() + randomInt(25, 45));
          const breakDuration = ((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60)).toFixed(2);

          await sql`
            INSERT INTO break_periods (work_session_id, user_id, break_start, break_end, duration, status, created_at)
            VALUES (${insertedSession[0].id}, ${user.id}, ${breakStart.toISOString()}, ${breakEnd.toISOString()}, ${breakDuration}, 'completed', now())
          `;
        }

        createdSessions++;
      }
      sessionCountByUser.set(user.id, createdSessions);
    }

    const shiftTemplates = [
      { title: 'Mantenimiento Preventivo', startHour: 7, endHour: 15, color: '#0ea5e9' },
      { title: 'SAT Correctivo', startHour: 8, endHour: 17, color: '#f97316' },
      { title: 'Urgencias Industriales', startHour: 10, endHour: 19, color: '#ef4444' },
      { title: 'Puesta en Marcha', startHour: 9, endHour: 18, color: '#22c55e' },
    ];

    const monday = new Date(today);
    const delta = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - delta);
    monday.setHours(0, 0, 0, 0);

    let shiftCount = 0;
    for (let d = 0; d < 28; d++) {
      const day = addDays(monday, d);
      if (isWeekend(day)) continue;

      for (const tech of technicians) {
        const t = randomFrom(shiftTemplates);
        const startAt = new Date(day);
        startAt.setHours(t.startHour, randomInt(0, 15), 0, 0);
        const endAt = new Date(day);
        endAt.setHours(t.endHour, randomInt(0, 15), 0, 0);

        await sql`
          INSERT INTO work_shifts (
            company_id, employee_id, start_at, end_at, title, location, notes, color, created_by_user_id, created_at
          ) VALUES (
            ${companyId}, ${tech.id}, ${startAt.toISOString()}, ${endAt.toISOString()}, ${t.title},
            ${randomFrom(['Planta Logistica Getafe', 'Centro Datos Alcobendas', 'Fabrica Coslada'])},
            ${randomFrom(['Revisar presiones y sobrecalentamiento', 'Inspeccion de fugas en circuito secundario', 'Verificar consumo en compresores'])},
            ${t.color}, ${admin.id}, now()
          )
        `;
        shiftCount++;
      }

      if (manager) {
        const mStart = new Date(day);
        mStart.setHours(8, 30, 0, 0);
        const mEnd = new Date(day);
        mEnd.setHours(17, 30, 0, 0);
        await sql`
          INSERT INTO work_shifts (
            company_id, employee_id, start_at, end_at, title, location, notes, color, created_by_user_id, created_at
          ) VALUES (
            ${companyId}, ${manager.id}, ${mStart.toISOString()}, ${mEnd.toISOString()}, 'Coordinacion SAT y rutas',
            'Oficina Central Servited', 'Validacion de partes y planificacion semanal', '#6366f1', ${admin.id}, now()
          )
        `;
        shiftCount++;
      }
    }

    const reportLocations = [
      'Planta Embotelladora Sur',
      'Hospital Comarcal Norte',
      'Centro Logistico M-50',
      'Industria Alimentaria Vicalvaro',
      'Data Center San Fernando',
    ];

    const reportDescriptions = [
      'Diagnostico y sustitucion de presostato en enfriadora industrial.',
      'Limpieza de bateria condensadora y ajuste de carga de refrigerante.',
      'Revision de variador en UTA, reapriete de bornes y prueba funcional.',
      'Cambio de filtro deshidratador y prueba de estanqueidad con nitrogeno.',
      'Mantenimiento preventivo trimestral en rooftop de zona de produccion.',
    ];

    let reportCount = 0;
    for (const tech of technicians) {
      for (let i = 35; i >= 1; i -= 2) {
        const day = addDays(today, -i);
        if (isWeekend(day)) continue;

        const startHour = randomInt(7, 10);
        const startMinute = randomFrom([0, 15, 30, 45]);
        const duration = randomFrom([120, 150, 180, 210]);

        const endTotalMinutes = startHour * 60 + startMinute + duration;
        const endHour = Math.floor(endTotalMinutes / 60);
        const endMinute = endTotalMinutes % 60;

        await sql`
          INSERT INTO work_reports (
            company_id, employee_id, report_date, ref_code, location, location_coords,
            start_time, end_time, duration_minutes, description, client_name, notes,
            signed_by, status, created_at, updated_at
          ) VALUES (
            ${companyId}, ${tech.id}, ${isoDateOnly(day)},
            ${`SAT-${day.getFullYear()}-${randomInt(1000, 9999)}`},
            ${randomFrom(reportLocations)}, ${'40.4168,-3.7038'},
            ${toTime(startHour, startMinute)}, ${toTime(endHour, endMinute)}, ${duration},
            ${randomFrom(reportDescriptions)}, ${randomFrom(['FrioLogix', 'TecnoFarma', 'InoxPack', 'DistriCold'])},
            ${randomFrom(['Equipo operativo tras puesta en marcha', 'Pendiente seguimiento en 30 dias', 'Se recomienda cambio preventivo de valvula de expansion'])},
            ${randomFrom(['Jefe de Mantenimiento', 'Responsable de Planta', 'Encargado de Turno'])}, 'submitted', now(), now()
          )
        `;

        reportCount++;
      }
    }

    const approvedStart = addDays(today, 12);
    const approvedEnd = addDays(today, 18);
    const pendingStart = addDays(today, 30);
    const pendingEnd = addDays(today, 34);

    const vacUserA = technicians[0];
    const vacUserB = technicians[1];

    await sql`
      INSERT INTO vacation_requests (
        user_id, start_date, end_date, reason, status, reviewed_by, reviewed_at,
        admin_comment, absence_type, deduct_from_vacation, created_at
      ) VALUES (
        ${vacUserA.id}, ${approvedStart.toISOString()}, ${approvedEnd.toISOString()},
        'Vacaciones planificadas tras campaña de verano', 'approved', ${admin.id}, now(),
        'Aprobado por cobertura de cuadrante', 'vacation', true, now()
      )
    `;

    await sql`
      INSERT INTO vacation_requests (
        user_id, start_date, end_date, reason, status, absence_type, deduct_from_vacation, created_at
      ) VALUES (
        ${vacUserB.id}, ${pendingStart.toISOString()}, ${pendingEnd.toISOString()},
        'Solicitud pendiente por rotacion de guardias', 'pending', 'vacation', true, now()
      )
    `;

    await sql`
      INSERT INTO hour_based_absences (
        user_id, absence_date, hours_start, hours_end, total_hours,
        absence_type, reason, status, reviewed_by, reviewed_at, admin_comment,
        auto_approve, created_at, updated_at
      ) VALUES
      (
        ${technicians[2].id}, ${addDays(today, -9).toISOString()}, '09.00', '12.00', '3.00',
        'family_illness', 'Acompanamiento medico familiar', 'approved', ${admin.id}, now(), 'Justificante valido', false, now(), now()
      ),
      (
        ${technicians[3].id}, ${addDays(today, -6).toISOString()}, '08.00', '10.00', '2.00',
        'public_duty', 'Comparecencia administrativa', 'approved', ${admin.id}, now(), 'No computa incidencias', false, now(), now()
      )
    `;

    await sql`
      INSERT INTO adverse_weather_incidents (
        company_id, incident_date, description, lost_hours, recovery_hours, recovery_percentage, created_at, created_by
      ) VALUES (
        ${companyId}, ${isoDateOnly(addDays(today, -20))},
        'Corte de suministro electrico por tormenta en zona industrial sur',
        '4.00', '2.80', 70, now(), ${admin.id}
      )
    `;

    for (const user of insertedUsers) {
      await sql`
        INSERT INTO adverse_weather_hours_pool (
          user_id, period_start, period_end, total_hours, used_hours, created_at, updated_at
        ) VALUES (
          ${user.id}, ${isoDateOnly(new Date(today.getFullYear(), 0, 1))}, ${isoDateOnly(new Date(today.getFullYear(), 11, 31))},
          '2.80', '0.00', now(), now()
        )
      `;
    }

    const reminderRows = [
      {
        title: 'Revision mensual enfriadora Planta Embotelladora',
        content: 'Comprobar presion de aspiracion, estado de filtros y vibracion de compresor.',
        priority: 'high',
        date: addDays(today, 2),
        assigned: technicians.slice(0, 2).map((u) => u.id),
      },
      {
        title: 'Planificar guardias de fin de semana',
        content: 'Cerrar turnos SAT de urgencias para las proximas 3 semanas.',
        priority: 'high',
        date: addDays(today, 1),
        assigned: insertedUsers.map((u) => u.id),
      },
      {
        title: 'Inventario de gases refrigerantes',
        content: 'Validar stock de R410A, R32 y nitrogeno para pruebas de estanqueidad.',
        priority: 'medium',
        date: addDays(today, 4),
        assigned: technicians.slice(3).map((u) => u.id),
      },
      {
        title: 'Enviar partes firmados al cliente FrioLogix',
        content: 'Revisar firmas pendientes y remitir PDF consolidado.',
        priority: 'medium',
        date: addDays(today, 3),
        assigned: [manager ? manager.id : insertedUsers[0].id],
      },
      {
        title: 'Formacion interna: deteccion de fugas',
        content: 'Sesion tecnica sobre detectores ultrasonicos y protocolos F-Gas.',
        priority: 'low',
        date: addDays(today, 8),
        assigned: technicians.map((u) => u.id),
      },
    ];

    let reminderCount = 0;
    for (const r of reminderRows) {
      await sql`
        INSERT INTO reminders (
          user_id, company_id, title, content, reminder_date, priority, color,
          task_status, context_type, context_name, is_completed, is_archived,
          is_pinned, enable_notifications, notification_shown, show_banner,
          assigned_user_ids, completed_by_user_ids, assigned_by, assigned_at,
          responsible_user_id, created_by, created_at, updated_at
        ) VALUES (
          ${admin.id}, ${companyId}, ${r.title}, ${r.content}, ${r.date.toISOString()}, ${r.priority}, '#FFF7ED',
          'pending', 'area', 'Operaciones SAT', false, false,
          true, true, false, true,
          ${r.assigned}, ${[]}, ${admin.id}, now(),
          ${r.assigned[0]}, ${admin.id}, now(), now()
        )
      `;
      reminderCount++;
    }

    const messagePairs = [
      {
        senderId: admin.id,
        receiverId: technicians[0].id,
        subject: 'Prioridad alta - Planta Embotelladora',
        content: 'Necesitamos validar consumo anomalo en compresor 2 antes de las 14:00.',
      },
      {
        senderId: technicians[0].id,
        receiverId: admin.id,
        subject: 'Re: Prioridad alta - Planta Embotelladora',
        content: 'Incidencia localizada en valvula de expansion, envio parte y propuesta de sustitucion.',
      },
      {
        senderId: manager ? manager.id : admin.id,
        receiverId: technicians[3].id,
        subject: 'Cambio de ruta viernes',
        content: 'Pasa primero por Data Center San Fernando y despues por InoxPack.',
      },
      {
        senderId: admin.id,
        receiverId: null,
        subject: 'Recordatorio EPIs y bloqueo electrico',
        content: 'Mañana auditoria interna de seguridad. Revisad checklist de EPIs y procedimiento LOTO.',
        isToAllEmployees: true,
      },
    ];

    let messageCount = 0;
    for (const m of messagePairs) {
      await sql`
        INSERT INTO messages (
          sender_id, receiver_id, subject, content, is_read, is_to_all_employees, created_at
        ) VALUES (
          ${m.senderId}, ${m.receiverId ?? null}, ${m.subject}, ${m.content}, false, ${m.isToAllEmployees === true}, now()
        )
      `;
      messageCount++;
    }

    const documentUsers = technicians.slice(0, 4);
    let documentCount = 0;
    for (const docUser of documentUsers) {
      await sql`
        INSERT INTO documents (
          company_id, user_id, file_name, original_name, file_size, mime_type,
          file_path, uploaded_by, requires_signature, is_viewed, is_accepted,
          created_at
        ) VALUES (
          ${companyId}, ${docUser.id},
          ${`parte_mantenimiento_${docUser.id}.pdf`}, ${`Parte mantenimiento ${docUser.full_name}.pdf`},
          ${randomInt(85000, 240000)}, 'application/pdf',
          ${`documents/servited/partes/${docUser.id}-${Date.now()}.pdf`}, ${admin.id}, true, false, false,
          now()
        )
      `;
      documentCount++;
    }

    await sql`
      UPDATE companies
      SET has_demo_data = false, updated_at = now()
      WHERE id = ${companyId}
    `;

    await sql`COMMIT`;

    console.log('✅ Regeneracion completada para Servited.');
    console.log('Resumen generado:');
    console.log(`   • Usuarios nuevos: ${insertedUsers.length}`);
    console.log(`   • Fichajes (work_sessions): ${Array.from(sessionCountByUser.values()).reduce((a, b) => a + b, 0)}`);
    console.log(`   • Turnos (work_shifts): ${shiftCount}`);
    console.log(`   • Partes (work_reports): ${reportCount}`);
    console.log(`   • Recordatorios: ${reminderCount}`);
    console.log(`   • Mensajes: ${messageCount}`);
    console.log(`   • Documentos: ${documentCount}`);
    console.log('🔐 Contraseña común de usuarios nuevos: Servited2026!');
  } catch (error) {
    await sql`ROLLBACK`;
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error regenerando Servited:', error);
    process.exit(1);
  });
