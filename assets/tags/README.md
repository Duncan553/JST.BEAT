# Producer tags

Drop the tag audio clips here (short vocal stamp, a few seconds), named
exactly:

- `jst-dan.mp3` (or `.wav`)
- `tisco-prodz.mp3` (or `.wav`)

`lib/audio-tag.ts` picks them up automatically at upload time — no code
change needed once the files land here. Until a file exists for a given
producer, uploads for that producer skip tagging silently (preview snippet
uploads untouched, nothing breaks).
