// Script de migración temporal: Subir archivos de uploads/ a Cloudflare R2
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

// Validar configuración R2
function validateR2Config() {
  const required = {
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing R2 config: ${missing.join(", ")}`);
  }

  return required as Record<string, string>;
}

// Crear cliente R2
function createR2Client() {
  const config = validateR2Config();

  return new S3Client({
    region: "auto",
    endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
  });
}

// Migrar archivos a R2
async function migrateFiles() {
  console.log("=== MIGRACIÓN DE ARCHIVOS A CLOUDFLARE R2 ===\n");

  const r2Client = createR2Client();
  const bucketName = process.env.R2_BUCKET_NAME!;
  const uploadsDir = "uploads";

  try {
    // Leer archivos en uploads/
    console.log("📂 Leyendo archivos de uploads/...");
    const files = await readdir(uploadsDir);
    console.log(`✅ Encontrados ${files.length} archivos\n`);

    let uploaded = 0;
    let skipped = 0;
    let errors = 0;

    // Subir cada archivo a R2
    for (const filename of files) {
      const filePath = join(uploadsDir, filename);
      
      // Verificar que sea archivo (no directorio)
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        continue;
      }

      try {
        // Leer archivo
        const buffer = await readFile(filePath);
        
        // Detectar content type básico
        const ext = filename.split('.').pop()?.toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
        else if (ext === "png") contentType = "image/png";
        else if (ext === "pdf") contentType = "application/pdf";
        else if (ext === "txt") contentType = "text/plain";
        
        // Subir a R2 en la carpeta "documents/"
        const key = `documents/${filename}`;
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000",
        });

        await r2Client.send(command);
        
        uploaded++;
        const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
        console.log(`✅ [${uploaded}/${files.length}] ${filename} (${sizeMB} MB)`);
      } catch (error) {
        errors++;
        console.error(`❌ Error subiendo ${filename}:`, (error as Error).message);
      }
    }

    console.log("\n=== RESUMEN DE MIGRACIÓN ===");
    console.log(`✅ Archivos migrados: ${uploaded}`);
    console.log(`⏭️  Archivos omitidos: ${skipped}`);
    console.log(`❌ Errores: ${errors}`);

    // Verificar archivos en R2
    console.log("\n📊 Verificando archivos en R2...");
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: "documents/",
    });

    const listResponse = await r2Client.send(listCommand);
    const r2Files = listResponse.Contents || [];
    
    console.log(`✅ Total de archivos en R2 (documents/): ${r2Files.length}`);
    
    const totalSizeMB = r2Files.reduce((sum, file) => sum + (file.Size || 0), 0) / 1024 / 1024;
    console.log(`📦 Tamaño total en R2: ${totalSizeMB.toFixed(2)} MB`);

    console.log("\n🎉 ¡MIGRACIÓN COMPLETADA!");
  } catch (error) {
    console.error("❌ Error durante la migración:", error);
    process.exit(1);
  }
}

// Ejecutar migración
migrateFiles().catch(console.error);
