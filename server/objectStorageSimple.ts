// Unified Object Storage service - supports both Replit and Cloudflare R2
// Automatically uses R2 if configured, falls back to Replit Object Storage
import { Storage, File } from "@google-cloud/storage";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Response } from "express";
import { randomUUID } from "crypto";
import { createR2Client, getR2BucketName } from "./config/cloudflareR2.js";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Replit Object Storage client (fallback)
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

// Cloudflare R2 client (primary if configured)
let r2Client: S3Client | null = null;
let r2BucketName = "";
let useR2 = false;

// Initialize R2 on startup
try {
  r2Client = createR2Client();
  if (r2Client) {
    r2BucketName = getR2BucketName();
    useR2 = true;
    console.log("✅ Using Cloudflare R2 for object storage");
  } else {
    console.log("ℹ️ Using Replit Object Storage (fallback)");
  }
} catch (error) {
  console.warn("⚠️ R2 initialization failed, using Replit:", (error as Error).message);
  useR2 = false;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// Unified Object Storage Service (supports R2 and Replit)
export class SimpleObjectStorageService {
  constructor() {}

  // Gets the public object search paths (Replit only)
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0 && !useR2) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' tool."
      );
    }
    return paths;
  }

  // Parse object path format: /<bucket_name>/<object_name> (Replit)
  parseObjectPath(path: string): { bucketName: string; objectName: string } {
    if (!path.startsWith("/")) {
      path = `/${path}`;
    }
    const pathParts = path.split("/");
    if (pathParts.length < 3) {
      throw new Error("Invalid path: must contain at least a bucket name");
    }

    const bucketName = pathParts[1];
    const objectName = pathParts.slice(2).join("/");

    return { bucketName, objectName };
  }

  // Search for a public object (R2 or Replit)
  async searchPublicObject(filePath: string): Promise<File | null> {
    // R2 path - use filePath directly (it already includes the folder)
    if (useR2 && r2Client) {
      try {
        const key = filePath; // Use filePath as-is (e.g., "documents/file.jpg" or "email-marketing/img.png")
        const command = new HeadObjectCommand({
          Bucket: r2BucketName,
          Key: key,
        });
        await r2Client.send(command);
        // Return a mock File object for compatibility
        return { key } as any;
      } catch (error: any) {
        if (error.name === "NotFound") {
          return null;
        }
        throw error;
      }
    }

    // Replit fallback
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = this.parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }
    return null;
  }

  // Upload a file buffer to object storage (R2 or Replit)
  async uploadPublicImage(
    buffer: Buffer,
    contentType: string,
    filename: string
  ): Promise<string> {
    // R2 upload
    if (useR2 && r2Client) {
      const key = `email-marketing/${filename}`;
      const command = new PutObjectCommand({
        Bucket: r2BucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      });

      await r2Client.send(command);
      console.log(`📦 Uploaded to R2: ${filename}`);

      // Return relative URL for database storage
      return `/public-objects/email-marketing/${filename}`;
    }

    // Replit fallback
    const searchPaths = this.getPublicObjectSearchPaths();
    if (searchPaths.length === 0) {
      throw new Error("No public search paths configured");
    }

    const publicPath = searchPaths[0];
    const fullPath = `${publicPath}/email-marketing/${filename}`;
    const { bucketName, objectName } = this.parseObjectPath(fullPath);

    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    console.log(`📦 Uploaded to Replit Object Storage: ${filename}`);
    return `/public-objects/email-marketing/${filename}`;
  }

  // Download an object to the response (R2 or Replit)
  async downloadObject(file: File | { key: string }, res: Response) {
    try {
      // R2 download
      if (useR2 && r2Client && "key" in file) {
        const command = new GetObjectCommand({
          Bucket: r2BucketName,
          Key: file.key,
        });

        const response = await r2Client.send(command);

        res.set({
          "Content-Type": response.ContentType || "application/octet-stream",
          "Content-Length": response.ContentLength?.toString() || "0",
          "Cache-Control": "public, max-age=31536000",
        });

        if (response.Body) {
          // @ts-ignore - Body is a readable stream
          response.Body.pipe(res);
        } else {
          res.status(404).json({ error: "File not found" });
        }
        return;
      }

      // Replit fallback
      const [metadata] = await (file as File).getMetadata();
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": "public, max-age=31536000",
      });

      const stream = (file as File).createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }
}
