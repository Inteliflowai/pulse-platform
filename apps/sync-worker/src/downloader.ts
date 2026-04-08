import { createWriteStream, existsSync, mkdirSync, statSync, renameSync, createReadStream, copyFileSync, unlinkSync } from 'fs';
import { dirname } from 'path';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { log } from './logger';

export async function downloadFile(url: string, destPath: string, expectedSize?: number): Promise<void> {
  const dir = dirname(destPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Support resume via Range header
  let startByte = 0;
  if (existsSync(destPath)) {
    const stat = statSync(destPath);
    startByte = stat.size;
    if (expectedSize && startByte >= expectedSize) {
      log('info', 'File already fully downloaded', { destPath });
      return;
    }
  }

  const headers: Record<string, string> = {};
  if (startByte > 0) {
    headers['Range'] = `bytes=${startByte}-`;
    log('info', 'Resuming download', { destPath, startByte });
  }

  const res = await fetch(url, { headers });

  if (!res.ok && res.status !== 206) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  if (!res.body) throw new Error('No response body');

  const fileStream = createWriteStream(destPath, { flags: startByte > 0 ? 'a' : 'w' });
  const reader = res.body.getReader();
  const readable = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) { this.push(null); return; }
      this.push(Buffer.from(value));
    },
  });

  await pipeline(readable, fileStream);
}

export async function verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => {
      const actual = hash.digest('hex');
      if (actual === expectedChecksum) {
        resolve(true);
      } else {
        log('error', 'Checksum mismatch', { filePath, expected: expectedChecksum, actual });
        resolve(false);
      }
    });
    stream.on('error', reject);
  });
}

export function moveFile(src: string, dest: string) {
  const dir = dirname(dest);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  try {
    renameSync(src, dest);
  } catch (err: any) {
    if (err.code === 'EXDEV') {
      // Cross-device move: copy then delete
      copyFileSync(src, dest);
      unlinkSync(src);
    } else {
      throw err;
    }
  }
}

export function getDiskFreeGb(path: string): number {
  try {
    // Use statfs if available (Node 18.15+)
    const { statfsSync } = require('fs');
    const stats = statfsSync(path);
    return (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);
  } catch {
    return Infinity; // Can't determine, assume OK
  }
}
