# Styles Organization

This project now uses a page-entry + module architecture.

## Folder layout

- `styles/pages/`: one entry file per HTML page.
- `styles/modules/`: reusable feature modules shared by pages.
- `styles/base.css`: global foundation (layout, header/nav, container, footer, torch mode).
- `archive/`: archived files that are no longer part of the active styles/scripts surface.

## How to edit styles

1. Find the target page's entry file in `styles/pages/*.css`.
2. If the change is page-specific, add it directly in that page file.
3. If the change is reusable across pages, put it in `styles/modules/*.css` and import it from page entries that need it.
4. Keep `styles/base.css` for true global primitives only.

## Current page entries

- `index.html` -> `styles/pages/index.css`
- `library.html` -> `styles/pages/library.css`
- `daily.html` -> `styles/pages/daily.css`
- `news.html` -> `styles/pages/news.css`
- `arkham_horror_lcg.html` -> `styles/pages/arkham_horror_lcg.css`
- `tainted_grail_foa.html` -> `styles/pages/tainted_grail_foa.css`

## Notes

- Legacy monolithic stylesheet has been archived to `archive/styles_legacy_main.css`.
- Do not re-link archived files from HTML.

## Surface hierarchy

- Main page canvases use muted burgundy velvet and one antique-gold embroidered perimeter (`modules/velvet-canvas.css`). Inner content panels remain borderless; avoid nested decorative frames.
- Separate large sections with spacing and headings; separate cards with warm surface colors and diffuse shadows.
- Use tinted backgrounds for nested metadata, badges, and notes, keeping their contrast in torch mode.
- Preserve functional focus outlines, input boundaries, checkboxes, and meaningful list separators.
- Version local stylesheet imports and page entry URLs together when shared styles change; dynamic Arkham entries also need the bootstrap script version refreshed.

## Velvet canvas assets

- `assets/misc/burgundy_velvet_texture.png`: generated repeatable cloth grain, darkened with a CSS overlay so the brighter heading ribbon remains distinct.
- `assets/misc/antique_gold_embroidered_frame.png`: generated transparent perimeter, rendered as a nine-slice repeating border so tall pages do not stretch the stitching.
- Both use the built-in image generator; exact prompts are saved in adjacent `.prompt.txt` files.
- Cloth uses cream text. Reading cards establish their own ink colors and opaque warm backgrounds; torch mode keeps its darker reading palette.

## Buttons

- `modules/medieval-buttons.css` uses the imagegen symmetric botanical cartouche in `assets/misc/medieval_cartouche_button.png`; the side ornaments extend horizontally with a slimmer vertical profile. Its prompt is in the adjacent `.prompt.txt`.
- `medieval_cartouche_button_slice.svg` retains the source alpha and provides a tight viewport. Horizontal slicing preserves the mirrored curved botanical ends on wide action links.
- Wine ink and an underline identify the active navigation item; red ink marks destructive actions; green underlined text marks selected controls. Disabled controls are muted. Compact controls retain their original dimensions and portrait buttons retain their artwork.
- Light mode uses ivory with dark ink; torch mode uses `medieval_cartouche_button_dark.png` with cream ink. The two theme variants retain the same silhouette. Mobile navigation uses two columns to preserve the ornament instead of compressing it into pointed slivers. The previous angular bronze SVG assets remain available as earlier versions.
- The fixed torch toggle uses generated lit and extinguished medallion art in `assets/icon/medieval-torch-lit.png` and `assets/icon/medieval-torch-unlit.png`; torch mode shows the unlit state and exposes an “Extinguish the torch” label.

## Navigation banner

- `modules/nav-banner.css` hangs the sticky navigation as a cloth banner from a cast-bronze rod: `nav::before` is the generated damask cloth (acanthus embroidery, braided trim, bullion fringe and corner tassels), `nav::after` is the rod. The `nav` element itself is transparent.
- The rod is `assets/misc/medieval_banner_rod_generated.png`, created with imagegen (aged bronze, Gothic leaf finials). CSS image slices discard the transparent canvas margins and preserve each finial while stretching only the shaft. The original SVG is retained as a previous version.
- The rod replaces the header's bottom rule and highlight band; don't reintroduce horizontal stripes between header and nav.
- Size via `--rod-height`, `--cloth-width` and `--fringe` on `nav`.

- `assets/misc/medieval_nav_tapestry.png` is the imagegen source; its exact prompt is in the adjacent `.prompt.txt`. `medieval_nav_tapestry_slice.svg` embeds that PNG in a tight viewport, preserving its alpha. Nine-slice edge repetition keeps the braid and individual fringe threads proportional across screen widths.

## Card depth

`modules/card-depth.css` provides shared soft contact and cast shadows without a solid rim for cards on velvet. Nested panels use a smaller elevation; torch mode adjusts the shadow tones. Library/photo spacing reserves room for shadows. Only interactive cards lift on pointer hover, with reduced-motion support.

## Shell ornaments

`modules/shell-ornaments.css` decorates the shared header/footer with generated antique-metal vines and a central footer shield. Raster viewport wrappers preserve alpha and the end ornaments; the middle repeats at its natural aspect ratio. Mobile uses a narrower trim and smaller shield, and torch mode dims the metal. Generation prompts are recorded in `assets/misc/shell-ornaments-prompts.md`.

Button face refresh (2026-09-30): light controls use `medieval_cartouche_button_vellum.png` through its self-contained slice SVG. Honey-gold aged vellum, recessed botanical embossing and softly shaded edges add material depth while retaining the cartouche silhouette and existing slicing. The adjacent prompt records the built-in image edit. Torch mode retains its burgundy variant.
