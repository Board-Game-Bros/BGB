#!/usr/bin/env python3
"""
Sync Arkham Horror LCG player/investigator card images from ArkhamDB and
rebuild scripts/ahlcg-standard-library.js.

Notes:
- Uses ArkhamDB public API metadata.
- Downloads images only when image URL is available in API payload.
- Keeps a deterministic filename scheme similar to the current project.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen


API_BASE = "https://arkhamdb.com"
CARDS_ENDPOINT = "/api/public/cards/"
USER_AGENT = "BGB-Arkham-Collection-Sync/1.0"


def http_get_json(url: str, timeout: float = 30.0) -> Any:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=timeout) as resp:
        payload = resp.read()
    return json.loads(payload.decode("utf-8"))


def download_file(url: str, dest: Path, timeout: float = 30.0) -> bool:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=timeout) as resp:
            data = resp.read()
    except (HTTPError, URLError):
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return True


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def slugify(text: str) -> str:
    raw = normalize_whitespace(text)
    raw = raw.replace('"', "").replace("'", "")
    raw = unicodedata.normalize("NFKD", raw)
    raw = raw.encode("ascii", "ignore").decode("ascii")
    raw = raw.lower()
    raw = re.sub(r"[^a-z0-9]+", "_", raw)
    raw = re.sub(r"_+", "_", raw).strip("_")
    return raw


def card_display_name(card: Dict[str, Any]) -> str:
    name = normalize_whitespace(str(card.get("name", "")))
    subtitle = normalize_whitespace(str(card.get("subname", ""))) if card.get("subname") else ""
    xp = card.get("xp")

    label = f"{name}: {subtitle}" if subtitle else name
    if isinstance(xp, int) and xp > 0:
        label = f"{label} ({xp})"
    return label


def image_url_for_card(card: Dict[str, Any]) -> Optional[str]:
    # ArkhamDB payloads have used imagesrc (often relative URL).
    candidates = [
        card.get("imagesrc"),
        card.get("image"),
        card.get("image_url"),
        card.get("imageSrc"),
        card.get("imageUrl"),
    ]
    for value in candidates:
        if not value or not isinstance(value, str):
            continue
        value = value.strip()
        if not value:
            continue
        return urljoin(API_BASE + "/", value.lstrip("/"))
    return None


def card_is_investigator(card: Dict[str, Any]) -> bool:
    return str(card.get("type_code", "")).strip().lower() == "investigator"


def output_filename_for_card(card: Dict[str, Any], display_name: str) -> str:
    slug = slugify(display_name)
    if not slug:
        slug = slugify(str(card.get("code", ""))) or "card"
    return f"{slug}.png"


def ensure_unique_filename(base_name: str, seen: Dict[str, int]) -> str:
    if base_name not in seen:
        seen[base_name] = 1
        return base_name
    count = seen[base_name]
    seen[base_name] = count + 1
    stem = base_name[:-4] if base_name.endswith(".png") else base_name
    return f"{stem}_{count}.png"


def fetch_cards(include_encounter: bool = False) -> List[Dict[str, Any]]:
    qs = {}
    if include_encounter:
        qs["encounter"] = 1
    url = API_BASE + CARDS_ENDPOINT
    if qs:
        url = f"{url}?{urlencode(qs)}"
    payload = http_get_json(url)
    if isinstance(payload, list):
        return [c for c in payload if isinstance(c, dict)]
    raise RuntimeError("Unexpected API payload format for cards endpoint.")


def write_standard_library(
    out_file: Path,
    card_image_files: Iterable[str],
    standard_names: Iterable[str],
    myriad_names: Iterable[str],
) -> None:
    files = sorted(set(card_image_files))
    names = sorted(set(standard_names), key=lambda s: s.lower())
    myriad = sorted(set(myriad_names), key=lambda s: s.lower())

    lines: List[str] = []
    lines.append("(function () {")
    lines.append("  window.AHLCG_STANDARD_NAME_LIBRARY = {")
    lines.append("    cardImageFiles: [")
    for idx, f in enumerate(files):
        comma = "," if idx < len(files) - 1 else ""
        lines.append(f'      "{f}"{comma}')
    lines.append("    ],")
    lines.append("    standardCardNames: [")
    for idx, n in enumerate(names):
        comma = "," if idx < len(names) - 1 else ""
        escaped = n.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'      "{escaped}"{comma}')
    lines.append("    ],")
    lines.append("    myriadCardNames: [")
    for idx, n in enumerate(myriad):
        comma = "," if idx < len(myriad) - 1 else ""
        escaped = n.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'      "{escaped}"{comma}')
    lines.append("    ]")
    lines.append("  };")
    lines.append("})();")
    lines.append("")

    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync AHLCG collection from ArkhamDB API")
    parser.add_argument(
        "--project-root",
        default=".",
        help="Project root path (default: current directory)",
    )
    parser.add_argument(
        "--include-encounter",
        action="store_true",
        help="Also include encounter cards (default: player + investigators only)",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.0,
        help="Optional delay in seconds between image downloads",
    )
    parser.add_argument(
        "--missing-report",
        default="scripts/ahlcg-missing-images.json",
        help="Path (relative to project root) to write missing image report JSON. Use empty string to disable.",
    )
    parser.add_argument(
        "--print-missing-limit",
        type=int,
        default=20,
        help="How many missing-card rows to print in terminal (default: 20).",
    )
    parser.add_argument(
        "--audit-missing-only",
        action="store_true",
        help="Do not download files. Only audit which cards are missing images in local collection.",
    )
    args = parser.parse_args()

    root = Path(args.project_root).resolve()
    cards_dir = root / "assets" / "boardgames" / "ahlcg_cards"
    investigators_dir = root / "assets" / "boardgames" / "ahlcg_investigators"
    lib_file = root / "scripts" / "ahlcg-standard-library.js"

    cards = fetch_cards(include_encounter=args.include_encounter)
    print(f"Fetched {len(cards)} cards from API.")

    files_seen: Dict[str, int] = {}
    card_image_files: List[str] = []
    standard_names: List[str] = []
    myriad_names: List[str] = []
    investigator_names: List[str] = []

    downloaded = 0
    missing_images = 0
    missing_details: List[Dict[str, Any]] = []

    for card in cards:
        display = card_display_name(card)
        if not display:
            continue
        standard_names.append(display)
        if bool(card.get("myriad")):
            myriad_names.append(display)
        if card_is_investigator(card):
            investigator_names.append(display)

        img_url = image_url_for_card(card)
        if not img_url:
            missing_images += 1
            missing_details.append(
                {
                    "code": card.get("code"),
                    "name": display,
                    "type_code": card.get("type_code"),
                    "reason": "no_image_url",
                    "image_url": None,
                }
            )
            continue

        base_name = output_filename_for_card(card, display)
        file_name = ensure_unique_filename(base_name, files_seen)
        target_dir = investigators_dir if card_is_investigator(card) else cards_dir
        dest = target_dir / file_name

        if args.audit_missing_only:
            if not dest.exists():
                missing_images += 1
                missing_details.append(
                    {
                        "code": card.get("code"),
                        "name": display,
                        "type_code": card.get("type_code"),
                        "reason": "local_file_missing",
                        "image_url": img_url,
                        "expected_path": str(dest),
                    }
                )
            continue

        ok = download_file(img_url, dest)
        if ok:
            downloaded += 1
            if target_dir == cards_dir:
                card_image_files.append(file_name)
        else:
            missing_images += 1
            missing_details.append(
                {
                    "code": card.get("code"),
                    "name": display,
                    "type_code": card.get("type_code"),
                    "reason": "download_failed",
                    "image_url": img_url,
                }
            )

        if args.sleep > 0:
            time.sleep(args.sleep)

    if not args.audit_missing_only:
        write_standard_library(lib_file, card_image_files, standard_names + investigator_names, myriad_names)

    if args.audit_missing_only:
        print("Audit mode: no image downloads performed.")
    print(f"Downloaded images: {downloaded}")
    print(f"Missing/failed images: {missing_images}")
    if args.audit_missing_only:
        print("Updated standard library: skipped (audit mode).")
    else:
        print(f"Updated standard library: {lib_file}")

    if missing_details:
        limit = max(0, int(args.print_missing_limit))
        if limit > 0:
            print(f"\nMissing detail sample (showing up to {limit}):")
            for row in missing_details[:limit]:
                code = row.get("code") or "-"
                name = row.get("name") or "-"
                reason = row.get("reason") or "-"
                print(f"- [{code}] {name} ({reason})")

        report_arg = str(args.missing_report or "").strip()
        if report_arg:
            report_path = (root / report_arg).resolve()
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_payload = {
                "total_missing": missing_images,
                "generated_at_unix": int(time.time()),
                "rows": missing_details,
            }
            report_path.write_text(
                json.dumps(report_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            print(f"Missing report written: {report_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.")
        raise SystemExit(130)
