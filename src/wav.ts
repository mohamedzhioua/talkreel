// Minimal RIFF/WAVE header reader (PCM), for narration duration without spawning ffprobe.
import { closeSync, openSync, readSync, statSync } from "node:fs";

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  /** Seconds. */
  duration: number;
}

export function readWavInfo(path: string): WavInfo {
  const fd = openSync(path, "r");
  try {
    const size = statSync(path).size;
    const head = Buffer.alloc(12);
    readSync(fd, head, 0, 12, 0);
    if (head.toString("ascii", 0, 4) !== "RIFF" || head.toString("ascii", 8, 12) !== "WAVE") throw new Error(`${path} is not a WAV file`);
    let pos = 12;
    let fmt: { channels: number; sampleRate: number; byteRate: number; bits: number } | null = null;
    const chunk = Buffer.alloc(8);
    while (pos + 8 <= size) {
      readSync(fd, chunk, 0, 8, pos);
      const id = chunk.toString("ascii", 0, 4);
      const len = chunk.readUInt32LE(4);
      if (id === "fmt ") {
        const b = Buffer.alloc(16);
        readSync(fd, b, 0, 16, pos + 8);
        fmt = { channels: b.readUInt16LE(2), sampleRate: b.readUInt32LE(4), byteRate: b.readUInt32LE(8), bits: b.readUInt16LE(14) };
      } else if (id === "data") {
        if (!fmt) throw new Error(`${path}: data chunk before fmt chunk`);
        const dataLen = Math.min(len, size - pos - 8);
        return { sampleRate: fmt.sampleRate, channels: fmt.channels, bitsPerSample: fmt.bits, duration: dataLen / fmt.byteRate };
      }
      pos += 8 + len + (len % 2);
    }
    throw new Error(`${path}: no data chunk`);
  } finally {
    closeSync(fd);
  }
}
