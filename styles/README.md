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

- `modules/medieval-buttons.css` gives every control (navigation, action links, native buttons, dynamically created editor controls) a cast-bronze relief plate: acanthus-leaf corners, engraved rims, and a chamfered outline.
- Plates are hand-drawn SVGs in `assets/misc/medieval_button_{light,dark,danger,selected}.svg`, applied as nine-slice `border-image` so the corners keep their size on wide links and 23px editor controls alike. They share one frame and differ only in the face gradient; edit all four together.
- Light brass is the default and the current page; dark bronze is navigation, secondary/cancel, read-only chips, and the torch toggle; copper-red is destructive; green is selected/owned. Disabled controls are desaturated.
- The plates are chamfered, so use `filter: drop-shadow()` for depth, not `box-shadow` (a rectangular shadow shows at the cut corners).
- Compact controls keep their original dimensions with a thinner rim (`border-image-width: 6px 7px`).
- Keep button surfaces separate from the velvet canvas; do not reuse the cloth texture for buttons.
