import { Logger } from '@nestjs/common';

export type VideoOrientation = 'landscape' | 'portrait';

const logger = new Logger('VideoOrientation');
const PROBE_BYTES = 2 * 1024 * 1024;
const PROBE_TIMEOUT_MS = 4000;
const cache = new Map<string, VideoOrientation | null>();

/**
 * Reads a video's encoded width/height from the start of the file and returns
 * its orientation. This is only a fallback for rows that did not specify one,
 * so a network failure simply leaves the value unset for the client to detect.
 */
export async function probeVideoOrientation(url?: string | null): Promise<VideoOrientation | null> {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url) ?? null;

  let result: VideoOrientation | null = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=0-${PROBE_BYTES - 1}` },
      signal: controller.signal,
    });
    if (response.ok) {
      // A server that ignores Range still works: only read the header bytes.
      const buffer = await readProbeBytes(response);
      const size = readMp4Size(buffer) ?? readWebMSize(buffer);
      if (size && size.width > 0 && size.height > 0) {
        result = size.width >= size.height ? 'landscape' : 'portrait';
      }
    }
  } catch {
    // Probing is best-effort; explicit metadata always wins.
  } finally {
    clearTimeout(timeout);
  }

  if (result) logger.debug(`Detected ${result} video orientation for ${url}`);
  cache.set(url, result);
  return result;
}

/** Fills explicit values with probed ones, keeping the array index-aligned. */
export async function resolveVideoOrientations(
  urls: string[],
  explicit?: (VideoOrientation | '' | null | undefined)[],
): Promise<(VideoOrientation | null)[]> {
  return Promise.all(
    urls.map(async (url, index) => {
      const given = explicit?.[index];
      return given === 'landscape' || given === 'portrait' ? given : probeVideoOrientation(url);
    }),
  );
}

/** Reads at most the first 2MB, even if the host ignores the Range header. */
async function readProbeBytes(response: Response): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (total < PROBE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      const remaining = PROBE_BYTES - total;
      chunks.push(chunk.length <= remaining ? chunk : chunk.subarray(0, remaining));
      total += Math.min(chunk.length, remaining);
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Stream may already be closed; nothing else to clean up.
    }
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

type VideoSize = { width: number; height: number };

/** Parses a `tkhd` box from an MP4 header (width/height are 16.16 fixed point). */
function readMp4Size(buffer: Buffer): VideoSize | null {
  const limit = buffer.length - 4;
  for (let i = 0; i <= limit - 84; i += 1) {
    if (buffer.toString('ascii', i, i + 4) !== 'tkhd') continue;
    const version = buffer[i + 4];
    // version 1 widens creation/modification/duration by 12 bytes in total.
    const widthAt = i + 4 + (version === 1 ? 88 : 76);
    if (widthAt + 8 > buffer.length) continue;
    const width = buffer.readUInt32BE(widthAt) / 65536;
    const height = buffer.readUInt32BE(widthAt + 4) / 65536;
    // The first track is often an audio track with zero dimensions.
    if (width >= 16 && height >= 16) {
      return { width: Math.round(width), height: Math.round(height) };
    }
  }
  return null;
}

/** Parses PixelWidth/PixelHeight from the head of an EBML/WebM stream. */
function readWebMSize(buffer: Buffer): VideoSize | null {
  let width: number | null = null;
  let height: number | null = null;
  for (let i = 0; i < buffer.length - 3; i += 1) {
    if (buffer[i] !== 0xb0 && buffer[i] !== 0xba) continue;
    const vint = readEbmlVint(buffer, i + 1);
    if (!vint || vint.length === 0 || vint.size < 1 || vint.size > 4) continue;
    const at = i + 1 + vint.length;
    if (at + vint.size > buffer.length) continue;
    let value = 0;
    for (let j = 0; j < vint.size; j += 1) value = value * 256 + buffer[at + j];
    if (buffer[i] === 0xb0 && width === null) width = value;
    if (buffer[i] === 0xba && height === null) height = value;
    if (width !== null && height !== null) return { width, height };
  }
  return null;
}

function readEbmlVint(buffer: Buffer, at: number): { size: number; length: number } | null {
  const first = buffer[at];
  if (first === undefined) return null;
  let mask = 0x80;
  let length = 1;
  while (length <= 8 && !(first & mask)) {
    mask >>= 1;
    length += 1;
  }
  if (length > 8 || at + length > buffer.length) return null;
  let value = first & (mask - 1);
  for (let j = 1; j < length; j += 1) value = value * 256 + buffer[at + j];
  return { size: value, length };
}
