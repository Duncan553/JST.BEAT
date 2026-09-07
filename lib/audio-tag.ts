import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

// ffmpeg-static exports a path built from its own __dirname. Next's server
// bundler rewrites that to "/ROOT/node_modules/ffmpeg-static/ffmpeg", which
// does not exist — so every upload died with `spawn ... ENOENT` even though
// the binary was sitting right there. Resolve it ourselves and, crucially,
// CHECK the file exists before trusting it.
function resolveFfmpeg(): string | null {
  const candidates = [
    ffmpegPath as string | null,
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
  ];
  for (const c of candidates) {
    if (c && !c.startsWith('/ROOT/') && fs.existsSync(c)) return c;
  }
  return null;
}

const FFMPEG_BIN = resolveFfmpeg();
if (FFMPEG_BIN) {
  ffmpeg.setFfmpegPath(FFMPEG_BIN);
} else {
  console.error('[audio-tag] No usable ffmpeg binary found — snippet creation will fail.');
}

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
  // The OUTPUT extension is fixed, not inherited. It used to be `${ext}`, which
  // meant the format of a "snippet" was whatever the producer happened to
  // upload: a WAV beat produced a WAV snippet — lossless, uncompressed, ~10x
  // the bytes — streamed to people on mobile data. Quality was an accident.
  const outPath = path.join(tmpDir, `${id}-out${PREVIEW_EXT}`);

  await fs.promises.writeFile(inPath, audioBuffer);

  try {
    const stats = await measureLoudness(inPath);
    const norm = loudnormFilter(stats);

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg().input(inPath);

      if (tagFile) {
        cmd
          .input(tagFile)
          .complexFilter([
            `[1:a]volume=${TAG_VOLUME}[tag]`,
            // Normalise AFTER the tag is mixed in, so the level being corrected
            // is the level people actually hear.
            '[0:a][tag]amix=inputs=2:duration=first:dropout_transition=0[mixed]',
            `[mixed]${norm}[aout]`,
          ])
          .outputOptions(['-map', '[aout]']);
      } else {
        cmd.audioFilters(norm);
      }

      cmd
        .outputOptions(AAC_OUTPUT_OPTIONS)
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

/* ---------------------------------------------------------------------------
   ENCODING — what every public copy on this site is made with.

   1. AAC, not MP3. Both are lossy and both are ~128 kbps here, but AAC is a
      decade newer and clearly better at the same bitrate — MP3 at 128k is
      audibly not transparent, AAC at 128k is close. Same bytes, better sound,
      so there is no trade to weigh. Spotify's own web player streams AAC; MP3
      is not on its list at any tier.

   2. AAC-LC in .m4a rather than Opus. Opus is better again per byte, but
      Safari/iOS support for it has been patchy for years, and a beat that will
      not play on somebody's iPhone is worth less than a slightly larger file.

   3. `+faststart` moves the index to the front of the file so playback can
      begin before the whole thing has downloaded. On mobile data that is the
      difference between instant and a three-second stall.

   4. 44.1 kHz stereo, never upsampled — upsampling adds bytes and no
      information.
   --------------------------------------------------------------------------- */
const STREAM_BITRATE = '128k';

/** Every public copy is .m4a now. Exported so the upload routes cannot drift. */
export const PREVIEW_EXT = '.m4a';
export const PREVIEW_CONTENT_TYPE = 'audio/mp4';

const AAC_OUTPUT_OPTIONS = [
  '-c:a', 'aac',
  '-b:a', STREAM_BITRATE,
  '-ar', '44100',
  '-ac', '2',
  '-movflags', '+faststart',
];

/* ---------------------------------------------------------------------------
   LOUDNESS — the part people actually hear as "sounds good".

   Spotify normalises every track to -14 LUFS integrated (EBU R128). This is a
   bigger perceived-quality lever than bitrate: a beat mastered at -6 LUFS next
   to one at -16 makes the quiet one sound weak and thin, however clean it is.
   Normalising means the catalogue plays at one level and nobody reaches for
   the volume between tracks.

   TWO passes, not one. Single-pass loudnorm is a live estimate and applies
   dynamic compression as it goes, which pumps on music — exactly the artefact
   we would be adding while claiming to improve quality. The first pass only
   measures; the second applies the measured numbers as a fixed, linear gain.

   It is BEST EFFORT. If measurement fails or the binary is missing, the encode
   still happens without normalisation — an upload must never fail because the
   loudness pass could not run.
   --------------------------------------------------------------------------- */
const LUFS_TARGET = -14;   // matches Spotify's default playback target
const TRUE_PEAK = -1.5;    // headroom, so lossy encoding cannot clip on decode
const LRA = 11;            // loudness range; leaves music its dynamics

type LoudnessStats = {
  input_i: string; input_tp: string; input_lra: string;
  input_thresh: string; target_offset: string;
};

/**
 * Pass 1: measure only, decode to nowhere. Resolves null on any failure, which
 * the caller treats as "skip normalisation".
 */
async function measureLoudness(inPath: string): Promise<LoudnessStats | null> {
  if (!FFMPEG_BIN) return null;
  return new Promise((resolve) => {
    let stderr = '';
    ffmpeg(inPath)
      .audioFilters(`loudnorm=I=${LUFS_TARGET}:TP=${TRUE_PEAK}:LRA=${LRA}:print_format=json`)
      .format('null')
      .output(process.platform === 'win32' ? 'NUL' : '/dev/null')
      .on('stderr', (line: string) => { stderr += line + '\n'; })
      .on('error', () => resolve(null))
      .on('end', () => {
        // loudnorm prints its JSON block last, after all the normal ffmpeg
        // chatter. Match INNERMOST brace groups (`[^{}]*`) rather than a greedy
        // `[\s\S]*`: greedy would run from the first `{` anywhere in ffmpeg's
        // output to the last `}`, swallowing unrelated lines and failing to
        // parse. loudnorm's block has no nested objects, so this is exact.
        const match = stderr.match(/\{[^{}]*\}/g);
        if (!match) return resolve(null);
        try {
          const parsed = JSON.parse(match[match.length - 1]);
          resolve(parsed?.input_i ? (parsed as LoudnessStats) : null);
        } catch {
          resolve(null);
        }
      })
      .run();
  });
}

/**
 * The pass-2 filter string, or a plain loudnorm if measuring failed.
 * `linear=true` asks for a single fixed gain rather than a compressor. ffmpeg
 * silently falls back to dynamic mode when linear gain would breach the true-peak
 * ceiling — i.e. only on material so quiet that it needs enormous gain. Real
 * masters sit close enough to the target that linear engages, which is the case
 * that matters.
 */
function loudnormFilter(stats: LoudnessStats | null): string {
  const base = `loudnorm=I=${LUFS_TARGET}:TP=${TRUE_PEAK}:LRA=${LRA}`;
  if (!stats) return base;
  return (
    `${base}:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}` +
    `:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}` +
    `:offset=${stats.target_offset}:linear=true:print_format=summary`
  );
}

/**
 * Builds the PUBLIC streaming copy of a STORE track.
 *
 * Deliberately different from createSnippet() in two ways:
 *
 *  1. FULL LENGTH, not capped. The store sells finished music, and the whole
 *     point is that anyone can play a record start to finish for free — the
 *     Audiomack model. Only the download is paid.
 *
 *  2. NO producer tag. A tag over a beat protects an unsold instrumental.
 *     Stamping one over a singer's finished record would just vandalise it.
 *
 * Protection comes from quality instead: this is a 128kbps AAC stream, while the
 * original the buyer downloads stays untouched in the private bucket. Someone
 * pulling this out of devtools gets the stream, never the master.
 */
export async function createStreamCopy(audioBuffer: Buffer, originalFilename: string): Promise<Buffer> {
  const ext = path.extname(originalFilename) || '.mp3';
  const tmpDir = os.tmpdir();
  const id = crypto.randomUUID();
  const inPath = path.join(tmpDir, `${id}-in${ext}`);
  const outPath = path.join(tmpDir, `${id}-stream${PREVIEW_EXT}`);

  await fs.promises.writeFile(inPath, audioBuffer);

  try {
    // This is the copy people listen to end to end, so it is the one that most
    // needs to sit at the same level as everything else in the catalogue.
    const stats = await measureLoudness(inPath);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(inPath)
        .audioFilters(loudnormFilter(stats))
        .outputOptions(AAC_OUTPUT_OPTIONS)
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
