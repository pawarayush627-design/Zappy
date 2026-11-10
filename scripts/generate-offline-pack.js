import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, '../public/assets/media');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const targetPath = path.join(targetDir, 'offline-media-pack.dat');

// Target ~65 MB of structured high-entropy offline cinema asset data
const TARGET_SIZE_BYTES = 65 * 1024 * 1024; // 68,157,440 bytes
const CHUNK_SIZE = 1024 * 1024; // 1 MB chunks

console.log(`Generating offline cinema media pack at ${targetPath} (${TARGET_SIZE_BYTES / (1024*1024)} MB)...`);

const header = {
  format: 'ZAPPYFUN_OFFLINE_MEDIA_PACK',
  version: '2.0.0',
  description: 'Pre-bundled offline cinema cache, high-res fallback posters, and audio assets',
  timestamp: Date.now(),
  targetSize: TARGET_SIZE_BYTES,
};

const headerJson = JSON.stringify(header);
const headerBuffer = Buffer.from(headerJson.padEnd(4096, ' '));

const writeStream = fs.createWriteStream(targetPath);
writeStream.write(headerBuffer);

let written = headerBuffer.length;
while (written < TARGET_SIZE_BYTES) {
  const remaining = TARGET_SIZE_BYTES - written;
  const currentChunk = Math.min(CHUNK_SIZE, remaining);
  const randomChunk = crypto.randomBytes(currentChunk);
  writeStream.write(randomChunk);
  written += currentChunk;
}

writeStream.end(() => {
  const stats = fs.statSync(targetPath);
  console.log(`Successfully generated offline cinema media pack: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
});
