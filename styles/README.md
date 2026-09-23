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

- Page shells and content panels are borderless. Avoid adding nested decorative frames.
- Separate large sections with spacing and headings; separate cards with warm surface colors and diffuse shadows.
- Use tinted backgrounds for nested metadata, badges, and notes, keeping their contrast in torch mode.
- Preserve functional focus outlines, input boundaries, checkboxes, and meaningful list separators.
- Version local stylesheet imports and page entry URLs together when shared styles change; dynamic Arkham entries also need the bootstrap script version refreshed.
