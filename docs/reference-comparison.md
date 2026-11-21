# Reference comparison notes

The supplied reference is a 738 × 2048 image. Its original browser viewport
height is not available; it appears to be a full-page design. Both 738 × 2048
captures and natural full-page captures at 738px width were reviewed locally.
The reference itself is not shipped as an asset.

Approximate visible measurements in the supplied reference:

- Content starts at x=69px and ends near x=669px: approximately 600px wide.
- Header logo starts around x=69px, y=20px. Navigation occupies the upper right.
- Hero heading begins around x=69px, y=134px; heavy italic dark serif, four lines.
- Upper-right orange organic shape starts around x=219px at the top edge.
- Hero food/rings occupy approximately x=388–670px, y=80–312px.
- Item-grid heading begins around y=372px. Three outlined horizontal food tiles
  form each row; circles are used for their photos.
- Pale blue-white page, vivid orange outlines/shapes, dark brown type and bands,
  peach supporting surfaces, white cards, and rounded primary actions.

Rendered comparison after corrections at 738px width:

- Content column: x=69px, width=599.98px.
- Hero heading: x=69px, y=135.22px; four lines of actual KiloEats text.
- Food frame: x=398.98px, y=82.63px, width=270px.
- Results heading: y=390.13px. Campus selection, accessible control sizes,
  actual restaurant coverage and real text add height compared with the mockup.
- The initial header wrapped and the cards became vertical. The header was
  corrected and image/title/description moved into horizontal capsule surfaces;
  campus coverage and working menu links remain below those surfaces.

This is a rendered visual comparison, not a pixel-difference calculation. No
pixel-perfect match is claimed. Remaining differences are intentional: original
KiloEats branding and text; licensed dish photos rather than the reference's
cut-out pan; minimum 44px controls; three real demo results rather than six
invented/repeated products; and no fake booking, newsletter, reviews, ratings,
discounts, carousel, or icon-category controls. The later requested icon band
and mirrored, left-hand Ethiopian food feature are presentational; the icons
are not category filters. Other unsupported reference sections are omitted,
so natural page length differs. Protected work screens keep efficient
layouts while sharing the same typography, palette, surfaces, focus and dialogs.

The display type uses a locally bundled Shrikhand font by Jonny Pinhorn as the
closest visual match. Source: https://github.com/google/fonts/tree/main/ofl/shrikhand.
The full SIL Open Font License 1.1 is shipped in public/fonts/Shrikhand-OFL.txt.
No runtime font service or npm dependency was added.
