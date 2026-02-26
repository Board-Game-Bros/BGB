# Styles Organization

This project now uses a page-entry + module architecture.

## Folder layout

- `styles/pages/`: one entry file per HTML page.
- `styles/modules/`: reusable feature modules shared by pages.
- `styles/base.css`: global foundation (layout, header/nav, container, footer, torch mode).
- `styles/_legacy/`: archived old styles (do not edit for active pages).

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

- Legacy monolithic stylesheet has been archived to `styles/_legacy/main.css`.
- Do not re-link archived files from HTML.
