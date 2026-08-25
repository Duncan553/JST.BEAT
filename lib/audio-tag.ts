import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const TAG_DIR = path.join(process.cwd(), 'assets', 'tags');
const TAG_FILENAMES: Record<'jst.dan' | 'tisco prodz', string> = {
  'jst.dan': 'jst-dan',
  'tisco prodz': 'tisco-prodz',
};

// Tag volume relative to the beat (0-1). Loud enough to make ripping the
// preview pointless, not so loud it drowns the beat out.
const TAG_VOLUME = 0.5;

// Hard ceiling on the tagged snippet, whether it's the producer's own
// uploaded clip or the auto-trim fallback (first N seconds of the full
// track when they don't upload one). This used to not exist at all — the
// "snippet" was silently the full-length file, meaning anyone could get
// the complete paid-quality track for free.
const MAX_SNIPPET_SECONDS = 120;

function findTagFile(producer: 'jst.dan' | 'tisco prodz'): string | null {
  const base = TAG_FILENAMES[producer];
  for (const ext of ['.mp3', '.wav']) {
    const candidate = path.join(TAG_DIR, base + ext);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Builds the PUBLIC tagged snippet from an audio buffer, with the
 * producer's tag mixed in if one exists yet, capped at MAX_SNIPPET_SECONDS.
 * Only ever call this for the public copy — the full file uploaded to the
 * private bucket must stay untouched, that's what the buyer is paying for.
 *
 * Works the same whether the buffer is a clip the producer chose
 * themselves or the full track being auto-trimmed as a fallback when they
 * didn't upload a separate snippet — either way it's chopped to the cap.
 */
export async function createSnippet(
  audioBuffer: Buffer,
  originalFilename: string,
  producer: 'jst.dan' | 'tisco prodz'
): Promise<Buffer> {
  const tagFile = findTagFile(producer);
  const ext = path.extname(originalFilename) || '.mp3';
  const tmpDir = os.tmpdir();
  const id = crypto.randomUUID();
  const inPath = path.join(tmpDir, `${id}-in${ext}`);
  const outPath = path.join(tmpDir, `${id}-out${ext}`);

  await fs.promises.writeFile(inPath, audioBuffer);

  try {
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg().input(inPath);

      if (tagFile) {
        cmd
          .input(tagFile)
          .complexFilter([
            `[1:a]volume=${TAG_VOLUME}[tag]`,
            '[0:a][tag]amix=inputs=2:duration=first:dropout_transition=0[aout]',
          ])
          .outputOptions(['-map', '[aout]']);
      }

      cmd
        .duration(MAX_SNIPPET_SECONDS) // caps output length regardless of the branch above
        .on('error', reject)
        .on('end', () => resolve())
        .save(outPath);
    });

    return await fs.promises.readFile(outPath);
  } finally {
    await fs.promises.rm(inPath, { force: true });
    await fs.promises.rm(outPath, { force: true });
  }
}
