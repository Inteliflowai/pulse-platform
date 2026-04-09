/**
 * Bandwidth throttle for sync downloads.
 * Limits download speed to avoid saturating school internet.
 *
 * Set SYNC_BANDWIDTH_LIMIT_MBPS in env (default: 0 = unlimited).
 */

import { Transform, TransformCallback } from 'stream';

const BANDWIDTH_LIMIT_MBPS = parseFloat(process.env.SYNC_BANDWIDTH_LIMIT_MBPS ?? '0');
const BYTES_PER_SECOND = BANDWIDTH_LIMIT_MBPS > 0 ? BANDWIDTH_LIMIT_MBPS * 1024 * 1024 / 8 : 0;

export class ThrottleTransform extends Transform {
  private bytesThisSecond = 0;
  private lastReset = Date.now();

  _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    if (BYTES_PER_SECOND <= 0) {
      // No throttling
      this.push(chunk);
      callback();
      return;
    }

    this.processChunk(chunk, 0, callback);
  }

  private processChunk(chunk: Buffer, offset: number, callback: TransformCallback) {
    const now = Date.now();

    // Reset counter every second
    if (now - this.lastReset >= 1000) {
      this.bytesThisSecond = 0;
      this.lastReset = now;
    }

    const remaining = BYTES_PER_SECOND - this.bytesThisSecond;
    if (remaining <= 0) {
      // Wait until next second
      const waitMs = 1000 - (now - this.lastReset);
      setTimeout(() => this.processChunk(chunk, offset, callback), waitMs);
      return;
    }

    const bytesToSend = Math.min(chunk.length - offset, remaining);
    this.push(chunk.subarray(offset, offset + bytesToSend));
    this.bytesThisSecond += bytesToSend;

    if (offset + bytesToSend < chunk.length) {
      // More data to send — wait for next second window
      const waitMs = 1000 - (Date.now() - this.lastReset);
      setTimeout(() => this.processChunk(chunk, offset + bytesToSend, callback), Math.max(waitMs, 10));
    } else {
      callback();
    }
  }
}

export function isThrottled(): boolean {
  return BANDWIDTH_LIMIT_MBPS > 0;
}

export function getThrottleInfo(): { enabled: boolean; limit_mbps: number } {
  return { enabled: BANDWIDTH_LIMIT_MBPS > 0, limit_mbps: BANDWIDTH_LIMIT_MBPS };
}
