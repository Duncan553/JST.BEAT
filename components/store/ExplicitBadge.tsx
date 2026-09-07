/**
 * PARENTAL ADVISORY — the black-and-white mark that belongs on cover art.
 *
 * Drawn, not an image file: the RIAA's mark is a specific piece of artwork and
 * shipping a copy would be using someone else's asset. This follows its
 * STRUCTURE, which is what makes it recognisable — a black field with
 * "PARENTAL ADVISORY" reversed out in white, and "EXPLICIT CONTENT" beneath it
 * in black on a white bar. My first version had that inverted (white box,
 * black text) and simply read as a sticker rather than as the advisory.
 *
 * Placement: the RIAA convention is the lower corner of the front cover, and on
 * physical sleeves that is usually lower-RIGHT. Here it sits lower-LEFT on every
 * surface, because the play control owns lower-right on the grid card — and one
 * consistent position across the site beats matching the convention on some
 * covers and dodging a button on others.
 *
 * Deliberately NOT theme-aware. The contrast is the whole point; a version that
 * softens to grey on a dark card stops reading as a warning.
 *
 * Worth knowing: digital stores do NOT sticker the artwork. Spotify and Apple
 * Music render their own "E" badge next to the title, and distributors commonly
 * reject cover files with added text or logos. So this belongs in the UI, drawn
 * over the image — never burned into the uploaded file.
 *
 * Server component: it takes a boolean and renders. No state, no effects.
 */
export function ExplicitBadge({
  explicit,
  size = 'sm',
}: {
  explicit: boolean;
  /** sm = grid cards, md = a release page's own cover */
  size?: 'sm' | 'md';
}) {
  if (!explicit) return null;

  const small = size === 'sm';
  return (
    <span
      className="absolute bottom-2 left-2 inline-flex flex-col bg-black font-sans leading-none select-none overflow-hidden"
      // The mark is a fixed-proportion lockup, so it scales as one unit rather
      // than each line picking its own size.
      style={{ width: small ? 46 : 76 }}
      // The image is decorative once the label is read out, but the information
      // itself matters — so it carries a real label instead of being hidden.
      role="img"
      aria-label="Parental advisory: explicit content"
    >
      <span
        className="text-white font-black text-center"
        style={{
          fontSize: small ? 6.5 : 10.5,
          letterSpacing: '-0.01em',
          padding: small ? '3px 2px 2px' : '5px 3px 3px',
        }}
      >
        PARENTAL
        <br />
        ADVISORY
      </span>
      {/* The reversed strip. This inversion is the part people recognise. */}
      <span
        className="bg-white text-black font-bold text-center w-full"
        style={{
          fontSize: small ? 4.2 : 6.5,
          letterSpacing: '0.02em',
          padding: small ? '1.5px 0' : '2.5px 0',
        }}
      >
        EXPLICIT CONTENT
      </span>
    </span>
  );
}
