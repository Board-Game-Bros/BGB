# Board Game Bros (BGB)

Static website for the BGB board game club.

The repo currently mixes hand-authored pages with small data-driven renderers for Arkham Horror and Tainted Grail tracking pages.

## Structure

```text
.
├── archive/                         # Archived files no longer used by active pages
├── assets/
│   ├── Arkham_Horror_Decks/         # Linked deck PDFs
│   ├── boardgames/                  # Game covers, investigator art, card images
│   ├── daily/                       # Photo assets
│   ├── data/                        # JSON data for rendered pages
│   ├── icon/
│   └── misc/
├── arkham_horror_lcg*/              # Arkham directory pages and record pages
├── arkham_horror_lcg*.html          # Compatibility redirects to directory pages
├── scripts/
│   ├── main.js                      # Shared site interactions
│   ├── shell-layout.js              # Shared header/nav/footer shell
│   ├── redirect-page.js             # Shared redirect-page bootstrap
│   ├── arkham-page-bootstrap.js     # Shared Arkham page bootstrap
│   ├── create_arkham_deck_page.py   # Scaffold Arkham deck JSON/page/redirect files
│   ├── shared-edit-sync-gate.js     # Shared edit/sync UI controls
│   ├── shared-local-state-envelope.js
│   ├── shared-github-sync.js        # Shared GitHub sync helpers
│   ├── arkham-campaign-page.js      # Arkham index page renderer
│   ├── arkham-deck-page.js          # Investigator deck renderer
│   ├── arkham-deck-preview.js       # Investigator deck hover panel
│   ├── ahlcg-standard-library.js
│   ├── ahlcg-upgrade-manager.js
│   ├── tg-session-editor.js
│   └── sync_arkhamdb_collection.py
├── styles/
│   ├── base.css
│   ├── modules/
│   └── pages/
└── */index.html                     # Page entry points
```

## Active Pages

- `/`
- `/library/`
- `/news/`
- `/daily/`
- `/arkham_horror_lcg/`
- `/arkham_horror_lcg_tcu_20260215/`
- `/arkham_horror_lcg_tcu_harvey_walters_20260214/`
- `/arkham_horror_lcg_tcu_michael_mcglen_20260214/`
- `/arkham_horror_lcg_tcu_wendy_adams_20260214/`
- `/arkham_horror_lcg_tde_20260503/`
- `/arkham_horror_lcg_tde_silas_marsh_20260503/`
- `/tainted_grail_foa/`

## Data-Driven Pages

Arkham campaign index is rendered from:

- `assets/data/arkham_horror_lcg_index.json`

Arkham investigator deck pages are rendered from JSON:

- `assets/data/arkham_harvey_walters_20260214.json`
- `assets/data/arkham_michael_mcglen_20260214.json`
- `assets/data/arkham_silas_marsh_20260503.json`
- `assets/data/arkham_wendy_adams_20260214.json`

Library page is rendered from:

- `assets/data/library_index.json`

Simple content pages are rendered from:

- `assets/data/daily_index.json`
- `assets/data/news_index.json`

Template for new investigator deck pages:

- `assets/data/templates/arkham_investigator_deck_template.json`
- `archive/arkham_investigator_page_shell.template.html`
- `archive/redirect_page.template.html`

## Arkham Page Conventions

Lightweight Arkham pages now use shared bootstraps instead of repeating static HTML shells.

- `scripts/arkham-page-bootstrap.js` loads shared CSS, shell, base scripts, and the correct page renderer based on `data-arkham-page`.
- `scripts/redirect-page.js` handles root-level compatibility redirects based on `data-redirect-to`.
- `scripts/create_arkham_deck_page.py` scaffolds the standard JSON page, directory page, and root-level redirect for new investigator deck pages, and can optionally append the investigator to an existing campaign session in the index JSON.
- `arkham_horror_lcg/index.html` is the campaign index entry page.
- Investigator deck pages such as `arkham_horror_lcg_tcu_harvey_walters_20260214/index.html` are thin wrappers that only declare page type, title, and JSON source.
- Root-level `arkham_horror_lcg*.html` files are thin wrappers that only declare a redirect target.

Recommended workflow for adding a new investigator deck page:

1. Run the scaffold script:

```bash
python3 scripts/create_arkham_deck_page.py \
  --project-root . \
  --campaign-code tde \
  --investigator "Silas Marsh" \
  --date 2026-05-03 \
  --builder Yan \
  --class-name Survivor \
  --image-src /assets/boardgames/ahlcg_investigators/silas_marsh_the_sailor.png \
  --pdf-path assets/Arkham_Horror_Decks/Silas-Marsh-DeckBuild-20260503-Yan.pdf \
  --packs-required 11 \
  --main-deck-size 30 \
  --total-deck-size 33 \
  --xp-required 0 \
  --index-campaign-title "The Dream-Eaters Campaign" \
  --index-session-label "05/03/2026 Campaign"
```

2. Fill in the generated JSON deck contents.
3. If you did not pass the optional index arguments, add the new deck link/card to `assets/data/arkham_horror_lcg_index.json`.

The script creates:

- `assets/data/arkham_<investigator>_<yyyymmdd>.json`
- `arkham_horror_lcg_<campaign>_<investigator>_<yyyymmdd>/index.html`
- `arkham_horror_lcg_<campaign>_<investigator>_<yyyymmdd>.html`

Optional index-update arguments:

- `--index-campaign-title` targets an existing campaign entry in `assets/data/arkham_horror_lcg_index.json`
- `--index-session-label` targets an existing session within that campaign
- `--index-json` overrides the default index file path if needed

When both index arguments are supplied, the script adds or replaces the investigator card entry under that existing session using the generated deck page URL.

Manual fallback if you do not want to use the script:

- `assets/data/templates/arkham_investigator_deck_template.json`
- `archive/arkham_investigator_page_shell.template.html`
- `archive/redirect_page.template.html`

Typical workflow for adding a new Arkham campaign session:

1. Add or update the campaign entry inside `assets/data/arkham_horror_lcg_index.json`
2. Add a new session object under that campaign's `sessions` array
3. Create the detailed campaign record page under its own directory, for example `arkham_horror_lcg_tde_20260503/index.html`
4. Add the matching root-level redirect file if you need compatibility with non-directory URLs

## AHLCG Collection Sync

Refresh AHLCG images and the standard-name library from ArkhamDB:

```bash
python3 scripts/sync_arkhamdb_collection.py --project-root .
```

Optional:

```bash
python3 scripts/sync_arkhamdb_collection.py --project-root . --include-encounter
```

## Local Run

No build step is required.

```bash
python3 -m http.server
```

Then visit:

- `http://localhost:8000`

## Notes

- Root-level `arkham_horror_lcg*.html` files are compatibility redirects to directory pages.
- Long-form campaign record pages like `arkham_horror_lcg_tcu_20260215/index.html` are still largely hand-authored content pages.
- Lightweight Arkham pages should prefer the shared bootstraps over inline shell/redirect code.
- Archived files should go under `archive/`, not back into active `styles/` or `scripts/`.
- `tainted_grail_foa/` and `arkham_horror_lcg_tcu_20260215/` contain edit/sync flows that can write back to GitHub when configured with a token.
