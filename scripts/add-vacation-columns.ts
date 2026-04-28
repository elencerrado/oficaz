import { config } from "dotenv";
config();

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addVacationColumns() {
  try {
    console.log("Verificando si las columnas existen...");
    
    // Verificar si las columnas ya existen
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies' 
      AND column_name IN ('vacation_days_natural', 'vacation_days_working')
    `);
    
    console.log("Columnas encontradas:", checkResult.rows);
    
    if (checkResult.rows.length === 2) {
      console.log("✅ Las columnas ya existen.");
      process.exit(0);
    }
    
    console.log("Añadiendo columnas faltantes...");
    
    // Añadir vacation_days_natural si no existe
    const hasNatural = checkResult.rows.some((row: any) => row.column_name === 'vacation_days_natural');
    if (!hasNatural) {
      await db.execute(sql`
        ALTER TABLE companies 
        ADD COLUMN vacation_days_natural INTEGER DEFAULT 30
      `);
      console.log("✅ Columna vacation_days_natural añadida");
    }
    
    // Añadir vacation_days_working si no existe
    const hasWorking = checkResult.rows.some((row: any) => row.column_name === 'vacation_days_working');
    if (!hasWorking) {
      await db.execute(sql`
        ALTER TABLE companies 
        ADD COLUMN vacation_days_working INTEGER DEFAULT 22
      `);
      console.log("✅ Columna vacation_days_working añadida");
    }
    
    console.log("✅ Proceso completado exitosamente");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

addVacationColumns();
