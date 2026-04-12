import fp from "fastify-plugin";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageService {
  generateUploadUrl(key: string, contentType: string, maxSizeBytes: number): Promise<string>;
  generateDownloadUrl(key: string, filename: string): Promise<string>;
  deleteObject(key: string): Promise<void>;
  headObject(key: string): Promise<{ contentLength: number; contentType: string } | null>;
  getObjectBuffer(key: string): Promise<Buffer | null>;
}

declare module "fastify" {
  interface FastifyInstance {
    storage: StorageService;
  }
}

const parseBoolean = (value: string | undefined): boolean => value === "true";

const getStorageConfig = () => ({
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  region: process.env.S3_REGION ?? "us-east-1",
  accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
  bucket: process.env.S3_BUCKET ?? "aegis-attachments",
  forcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE ?? "true"),
  uploadExpiresSec: Number(process.env.S3_PRESIGN_UPLOAD_EXPIRES_SECONDS ?? "300"),
  downloadExpiresSec: Number(process.env.S3_PRESIGN_DOWNLOAD_EXPIRES_SECONDS ?? "3600"),
});

const isStorageEnabled = (): boolean => {
  const val = process.env.STORAGE_ENABLED;
  // Default to enabled unless explicitly set to false/0/no/off.
  if (val === undefined) return true;
  return val === "true" || val === "1" || val === "yes" || val === "on";
};

const makeDisabledStorage = (): StorageService => {
  const fail = (): never => {
    const err = Object.assign(new Error("File storage is disabled (STORAGE_ENABLED=false). Enable MinIO/S3 to use attachments."), { statusCode: 503 });
    throw err;
  };
  return {
    generateUploadUrl: fail,
    generateDownloadUrl: fail,
    deleteObject: fail,
    headObject: fail,
    getObjectBuffer: async () => null,
  };
};

export const storagePlugin = fp(async (app) => {
  if (!isStorageEnabled()) {
    app.log.info("Storage is disabled (STORAGE_ENABLED=false). Attachment endpoints will return 503.");
    app.decorate("storage", makeDisabledStorage());
    return;
  }

  const config = getStorageConfig();

  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  });

  // Ensure the bucket exists on startup (helpful for MinIO local dev).
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch {
    app.log.info(`Bucket "${config.bucket}" not found — creating it.`);
    try {
      await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
      app.log.info(`Bucket "${config.bucket}" created.`);
    } catch (createErr) {
      app.log.warn({ err: createErr }, `Could not create bucket "${config.bucket}". Storage operations will fail if it does not exist.`);
    }
  }

  // Configure CORS so the browser can PUT files directly to the bucket via presigned URLs.
  try {
    const corsOrigins = process.env.S3_CORS_ALLOWED_ORIGINS
      ? process.env.S3_CORS_ALLOWED_ORIGINS.split(",").map(o => o.trim())
      : ["*"];
    await client.send(new PutBucketCorsCommand({
      Bucket: config.bucket,
      CORSConfiguration: {
        CORSRules: [{
          AllowedOrigins: corsOrigins,
          AllowedMethods: ["GET", "PUT", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        }],
      },
    }));
    app.log.info(`CORS configured for bucket "${config.bucket}".`);
  } catch (corsErr) {
    app.log.warn({ err: corsErr }, `Could not configure CORS for bucket "${config.bucket}". Browser uploads may fail due to CORS restrictions.`);
  }

  const storage: StorageService = {
    async generateUploadUrl(key, contentType, _maxSizeBytes) {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
      });
      return getSignedUrl(client, command, { expiresIn: config.uploadExpiresSec });
    },

    async generateDownloadUrl(key, filename) {
      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ResponseContentDisposition: `inline; filename="${filename}"`,
      });
      return getSignedUrl(client, command, { expiresIn: config.downloadExpiresSec });
    },

    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }));
    },

    async headObject(key) {
      try {
        const result = await client.send(new HeadObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }));
        return {
          contentLength: result.ContentLength ?? 0,
          contentType: result.ContentType ?? "application/octet-stream",
        };
      } catch {
        return null;
      }
    },

    async getObjectBuffer(key) {
      try {
        const result = await client.send(new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }));
        if (!result.Body) return null;
        const chunks: Uint8Array[] = [];
        for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      } catch {
        return null;
      }
    },
  };

  app.decorate("storage", storage);
});
