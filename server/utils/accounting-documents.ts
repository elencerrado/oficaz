import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface CreateAccountingDocumentParams {
  companyId: number;
  userId: number;
  entryDate: string; // Format: "2025-12-31"
  concept: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Creates or finds the accounting folder structure: contabilidad/YYYY/MM
 * Returns the folder ID for the month folder
 */
async function ensureAccountingFolder(companyId: number, userId: number, date: Date): Promise<number> {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  // Check if root "contabilidad" folder exists
  let [contabilidadFolder] = await db.select()
    .from(schema.documentFolders)
    .where(and(
      eq(schema.documentFolders.companyId, companyId),
      eq(schema.documentFolders.path, 'contabilidad')
    ));
  
  if (!contabilidadFolder) {
    [contabilidadFolder] = await db.insert(schema.documentFolders)
      .values({
        companyId,
        name: 'Contabilidad',
        parentId: null,
        path: 'contabilidad',
        createdBy: userId,
      })
      .returning();
  }
  
  // Check if year folder exists
  const yearPath = `contabilidad/${year}`;
  let [yearFolder] = await db.select()
    .from(schema.documentFolders)
    .where(and(
      eq(schema.documentFolders.companyId, companyId),
      eq(schema.documentFolders.path, yearPath)
    ));
  
  if (!yearFolder) {
    [yearFolder] = await db.insert(schema.documentFolders)
      .values({
        companyId,
        name: year,
        parentId: contabilidadFolder.id,
        path: yearPath,
        createdBy: userId,
      })
      .returning();
  }
  
  // Check if month folder exists
  const monthPath = `contabilidad/${year}/${month}`;
  let [monthFolder] = await db.select()
    .from(schema.documentFolders)
    .where(and(
      eq(schema.documentFolders.companyId, companyId),
      eq(schema.documentFolders.path, monthPath)
    ));
  
  if (!monthFolder) {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    [monthFolder] = await db.insert(schema.documentFolders)
      .values({
        companyId,
        name: monthNames[date.getMonth()],
        parentId: yearFolder.id,
        path: monthPath,
        createdBy: userId,
      })
      .returning();
  }
  
  return monthFolder.id;
}

/**
 * Creates a document entry in the accounting folder with proper naming
 * Format: "25.12.31 - Concepto - Usuario"
 */
export async function createAccountingDocument(params: CreateAccountingDocumentParams): Promise<void> {
  const { companyId, userId, entryDate, concept, fileName, filePath, fileSize, mimeType } = params;
  
  const date = new Date(entryDate);
  const year = date.getFullYear().toString().slice(-2); // Last 2 digits of year
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // Get user name
  const [user] = await db.select()
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  
  const userName = user?.fullName || 'Usuario';
  
  // Get or create the folder structure
  const folderId = await ensureAccountingFolder(companyId, userId, date);
  
  // Create formatted document name: "25.12.31 - Concepto - Usuario"
  const formattedName = `${year}.${month}.${day} - ${concept} - ${userName}`;
  
  // Create document entry
  await db.insert(schema.documents)
    .values({
      companyId,
      folderId,
      userId,
      fileName: formattedName,
      originalName: fileName,
      fileSize,
      mimeType,
      filePath,
      uploadedBy: userId,
      requiresSignature: false,
      isViewed: false,
      isAccepted: false,
    });
}
