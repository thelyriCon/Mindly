/**
 * Storage Service Abstraction
 * Manages file uploads (PDFs, DOCX, images, avatar pictures)
 * Provides local disk storage with strict path-traversal protection and cloud-ready interface.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StoredFileResult {
  url: string;
  fileKey: string;
  size: number;
  mimeType: string;
  originalName: string;
}

export interface IStorageService {
  saveFile(buffer: Buffer, originalName: string, mimeType: string, folder?: string): Promise<StoredFileResult>;
  getFile(fileKey: string): Promise<{ buffer: Buffer; mimeType: string }>;
  deleteFile(fileKey: string): Promise<boolean>;
}

export class LocalStorageService implements IStorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), 'data', 'uploads');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async saveFile(buffer: Buffer, originalName: string, mimeType: string, folder = ''): Promise<StoredFileResult> {
    const targetDir = folder ? path.join(this.baseDir, folder) : this.baseDir;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const ext = path.extname(originalName) || '.bin';
    const randomHash = crypto.randomBytes(12).toString('hex');
    const sanitizedBase = this.sanitizeFilename(path.basename(originalName, ext)).slice(0, 30);
    const fileKey = folder ? `${folder}/${sanitizedBase}_${randomHash}${ext}` : `${sanitizedBase}_${randomHash}${ext}`;

    const fullPath = path.resolve(this.baseDir, fileKey);
    // Strict path traversal check
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error('Invalid file path traversal attempt.');
    }

    fs.writeFileSync(fullPath, buffer);

    return {
      url: `/api/uploads/${encodeURIComponent(fileKey)}`,
      fileKey,
      size: buffer.length,
      mimeType,
      originalName,
    };
  }

  async getFile(fileKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const safeKey = decodeURIComponent(fileKey);
    const fullPath = path.resolve(this.baseDir, safeKey);

    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error('Access denied: path traversal.');
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found.');
    }

    const buffer = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === '.txt') mimeType = 'text/plain';

    return { buffer, mimeType };
  }

  async deleteFile(fileKey: string): Promise<boolean> {
    const safeKey = decodeURIComponent(fileKey);
    const fullPath = path.resolve(this.baseDir, safeKey);

    if (!fullPath.startsWith(this.baseDir)) return false;
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  }
}

export const storageService = new LocalStorageService();
