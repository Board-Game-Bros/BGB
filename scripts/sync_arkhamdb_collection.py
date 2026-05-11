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
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
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


def normalize_catalog_key(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", normalize_whitespace(text).lower())).strip()


def parse_customizable_groups(card: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw_text = str(card.get("customization_text") or "").strip()
    raw_options = card.get("customization_options")
    options = raw_options if isinstance(raw_options, list) else []
    if not raw_text:
        return []

    groups: List[Dict[str, Any]] = []
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    for idx, line in enumerate(lines):
        match = re.match(r"^(□+)\s*(.*)$", line)
        if not match:
          continue
        boxes = len(match.group(1))
        body = match.group(2).strip()
        label_match = re.match(r"^<b>(.*?)</b>\s*(.*)$", body)
        label = normalize_whitespace(label_match.group(1)) if label_match else normalize_whitespace(body.split(".", 1)[0])
        text = normalize_whitespace(label_match.group(2)) if label_match else normalize_whitespace(body)
        text = re.sub(r"^[:.]\s*", "", text)
        option = options[idx] if idx < len(options) and isinstance(options[idx], dict) else {}
        slug = slugify(label) or f"option_{idx + 1}"
        groups.append({
            "id": slug,
            "label": label,
            "boxes": boxes,
            "xpTotal": int(option.get("xp")) if isinstance(option.get("xp"), int) else boxes,
            "text": text,
        })
    return groups


def write_customizable_library(out_file: Path, cards: Iterable[Dict[str, Any]]) -> None:
    rows: List[Dict[str, Any]] = []
    for card in cards:
        groups = parse_customizable_groups(card)
        if not groups:
            continue
        display_name = card_display_name(card)
        rows.append({
            "displayName": display_name,
            "catalogKey": normalize_catalog_key(display_name),
            "groups": groups,
        })

    rows.sort(key=lambda row: row["displayName"].lower())

    payload = {
        row["catalogKey"]: {
            "displayName": row["displayName"],
            "groups": row["groups"],
        }
        for row in rows
    }

    lines: List[str] = []
    lines.append("(function () {")
    lines.append("  window.AHLCG_CUSTOMIZABLE_LIBRARY = {")
    lines.append("    cards: " + json.dumps(payload, ensure_ascii=False, indent=4).replace("\n", "\n    "))
    lines.append("  };")
    lines.append("})();")
    lines.append("")
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text("\n".join(lines), encoding="utf-8")


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


def card_identity_signature(card: Dict[str, Any]) -> Tuple[Any, ...]:
    fields = (
        "type_code",
        "subtype_code",
        "faction_code",
        "faction2_code",
        "faction3_code",
        "cost",
        "slot",
        "xp",
        "health",
        "sanity",
        "skill_willpower",
        "skill_intellect",
        "skill_combat",
        "skill_agility",
        "traits",
        "text",
        "real_name",
    )
    return tuple(card.get(field) for field in fields)


def card_exact_signature(card: Dict[str, Any]) -> Tuple[Any, ...]:
    return (
        card_display_name(card),
        card_identity_signature(card),
        normalize_whitespace(str(card.get("imagesrc") or "")),
    )


def build_variant_display_names(cards: Iterable[Dict[str, Any]]) -> Set[str]:
    signatures_by_display: Dict[str, Set[Tuple[Any, ...]]] = {}
    for card in cards:
        display_name = card_display_name(card)
        if not display_name:
            continue
        signatures_by_display.setdefault(display_name, set()).add(card_exact_signature(card))
    return {
        display_name
        for display_name, signatures in signatures_by_display.items()
        if len(signatures) > 1
    }


def output_filename_for_card(card: Dict[str, Any], display_name: str, variant_display_names: Set[str]) -> str:
    if display_name in variant_display_names:
        pack_code = normalize_whitespace(str(card.get("pack_code") or ""))
        suffix = pack_code if pack_code else str(card.get("code") or "")
        slug = slugify(f"{display_name} {suffix}")
    else:
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


def parse_library_array(text: str, key: str) -> List[str]:
    pattern = rf"{re.escape(key)}:\s*\[(.*?)\]"
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        return []
    body = match.group(1)
    return re.findall(r'"((?:\\.|[^"])*)"', body)


def read_existing_library(path: Path) -> Dict[str, List[str]]:
    if not path.exists():
        return {
            "cardImageFiles": [],
            "standardCardNames": [],
            "myriadCardNames": [],
            "exceptionalCardNames": [],
            "customizableCardNames": [],
        }
    text = path.read_text(encoding="utf-8")
    return {
        "cardImageFiles": [bytes(s, "utf-8").decode("unicode_escape") for s in parse_library_array(text, "cardImageFiles")],
        "standardCardNames": [bytes(s, "utf-8").decode("unicode_escape") for s in parse_library_array(text, "standardCardNames")],
        "myriadCardNames": [bytes(s, "utf-8").decode("unicode_escape") for s in parse_library_array(text, "myriadCardNames")],
        "exceptionalCardNames": [bytes(s, "utf-8").decode("unicode_escape") for s in parse_library_array(text, "exceptionalCardNames")],
        "customizableCardNames": [bytes(s, "utf-8").decode("unicode_escape") for s in parse_library_array(text, "customizableCardNames")],
    }


def matches_pack_filter(card: Dict[str, Any], pack_codes: Set[str]) -> bool:
    if not pack_codes:
        return True
    pack_code = str(card.get("pack_code") or "").strip().lower()
    return pack_code in pack_codes


def write_standard_library(
    out_file: Path,
    card_image_files: Iterable[str],
    standard_names: Iterable[str],
    myriad_names: Iterable[str],
    exceptional_names: Iterable[str],
    customizable_names: Iterable[str],
) -> None:
    files = sorted(set(card_image_files))
    names = sorted(set(standard_names), key=lambda s: s.lower())
    myriad = sorted(set(myriad_names), key=lambda s: s.lower())
    exceptional = sorted(set(exceptional_names), key=lambda s: s.lower())
    customizable = sorted(set(customizable_names), key=lambda s: s.lower())

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
    lines.append("    ],")
    lines.append("    exceptionalCardNames: [")
    for idx, n in enumerate(exceptional):
        comma = "," if idx < len(exceptional) - 1 else ""
        escaped = n.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'      "{escaped}"{comma}')
    lines.append("    ],")
    lines.append("    customizableCardNames: [")
    for idx, n in enumerate(customizable):
        comma = "," if idx < len(customizable) - 1 else ""
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
        "--customizable-library",
        default="scripts/ahlcg-customizable-library.js",
        help="Path (relative to project root) to write customizable metadata library JS.",
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
    parser.add_argument(
        "--pack-codes",
        default="",
        help="Optional comma-separated ArkhamDB pack_code filter, for example 'core_2026,tom,car,and,mar,mig'.",
    )
    parser.add_argument(
        "--skip-existing-standard-names",
        action="store_true",
        help="Skip downloads when the resolved target filename already exists locally. This avoids exact duplicate files while still allowing same-name variants to download.",
    )
    args = parser.parse_args()

    root = Path(args.project_root).resolve()
    cards_dir = root / "assets" / "boardgames" / "ahlcg_cards"
    investigators_dir = root / "assets" / "boardgames" / "ahlcg_investigators"
    lib_file = root / "scripts" / "ahlcg-standard-library.js"
    customizable_lib_file = (root / str(args.customizable_library)).resolve()
    pack_codes = {
        code.strip().lower()
        for code in str(args.pack_codes or "").split(",")
        if code.strip()
    }

    all_cards = fetch_cards(include_encounter=args.include_encounter)
    cards = [card for card in all_cards if matches_pack_filter(card, pack_codes)] if pack_codes else list(all_cards)
    print(f"Fetched {len(cards)} cards from API.")

    existing_library = read_existing_library(lib_file)
    variant_display_names = build_variant_display_names(all_cards)
    files_seen: Dict[str, int] = {}
    card_image_files: List[str] = list(existing_library["cardImageFiles"])
    standard_names: List[str] = list(existing_library["standardCardNames"])
    myriad_names: List[str] = list(existing_library["myriadCardNames"])
    exceptional_names: List[str] = list(existing_library["exceptionalCardNames"])
    customizable_names: List[str] = list(existing_library["customizableCardNames"])
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
        if re.match(r"^Customizable\.", str(card.get("text") or "").strip()):
            customizable_names.append(display)
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

        base_name = output_filename_for_card(card, display, variant_display_names)
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

        if args.skip_existing_standard_names and dest.exists():
            if target_dir == cards_dir:
                card_image_files.append(file_name)
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
        write_standard_library(
            lib_file,
            card_image_files,
            standard_names + investigator_names,
            myriad_names,
            exceptional_names,
            customizable_names,
        )
        write_customizable_library(customizable_lib_file, all_cards)

    if args.audit_missing_only:
        print("Audit mode: no image downloads performed.")
    print(f"Downloaded images: {downloaded}")
    print(f"Missing/failed images: {missing_images}")
    if args.audit_missing_only:
        print("Updated standard library: skipped (audit mode).")
    else:
        print(f"Updated standard library: {lib_file}")
        print(f"Updated customizable library: {customizable_lib_file}")

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
