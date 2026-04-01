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
├── scripts/
│   ├── main.js                      # Shared site interactions
│   ├── shell-layout.js              # Shared header/nav/footer shell
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
- `/tainted_grail_foa/`

## Data-Driven Pages

Arkham investigator deck pages are now rendered from JSON:

- `assets/data/arkham_harvey_walters_20260214.json`
- `assets/data/arkham_michael_mcglen_20260214.json`
- `assets/data/arkham_wendy_adams_20260214.json`

Arkham campaign index is rendered from:

- `assets/data/arkham_horror_lcg_index.json`

Library page is rendered from:

- `assets/data/library_index.json`

Simple content pages are rendered from:

- `assets/data/daily_index.json`
- `assets/data/news_index.json`

Template for new investigator deck pages:

- `assets/data/templates/arkham_investigator_deck_template.json`
- `archive/arkham_investigator_page_shell.template.html`

Typical workflow for adding a new investigator deck page:

1. Copy `assets/data/templates/arkham_investigator_deck_template.json`
2. Fill in the investigator/deck data
3. Create a thin `index.html` page pointing `data-source` to that JSON
4. Add the new deck link/card to `assets/data/arkham_horror_lcg_index.json`

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

- Root-level `*.html` files are mostly compatibility redirects to directory pages.
- Archived files should go under `archive/`, not back into active `styles/` or `scripts/`.
- `tainted_grail_foa/` and `arkham_horror_lcg_tcu_20260215/` contain edit/sync flows that can write back to GitHub when configured with a token.
