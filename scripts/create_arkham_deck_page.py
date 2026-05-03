#!/usr/bin/env python3
"""Scaffold a data-driven Arkham investigator deck page.

Creates three files following the current repo conventions:
1. assets/data/arkham_<investigator>_<yyyymmdd>.json
2. arkham_horror_lcg_<campaign>_<investigator>_<yyyymmdd>/index.html
3. arkham_horror_lcg_<campaign>_<investigator>_<yyyymmdd>.html
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from copy import deepcopy
from pathlib import Path


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_")


def display_date(iso_date: str) -> str:
    year, month, day = iso_date.split("-")
    return f"{month}/{day}/{year}"


def compact_date(iso_date: str) -> str:
    return iso_date.replace("-", "")


def repo_relative_path(path: Path, root: Path) -> str:
    return "/" + path.relative_to(root).as_posix()


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def write_text(path: Path, content: str, force: bool) -> None:
    if path.exists() and not force:
        raise FileExistsError(f"{path} already exists. Use --force to overwrite.")
    ensure_parent(path)
    path.write_text(content, encoding="utf-8")


def write_json(path: Path, payload: dict, force: bool) -> None:
    text = json.dumps(payload, indent=2, ensure_ascii=True) + "\n"
    write_text(path, text, force)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", default=".", help="Repo root path. Defaults to current directory.")
    parser.add_argument("--campaign-code", required=True, help="Short campaign code used in page paths, for example tcu or tde.")
    parser.add_argument("--investigator", required=True, help="Investigator display name, for example 'Silas Marsh'.")
    parser.add_argument("--date", required=True, help="Deck build date in YYYY-MM-DD format.")
    parser.add_argument("--builder", required=True, help="Builder display name.")
    parser.add_argument("--class-name", required=True, help="Investigator class label, for example Survivor.")
    parser.add_argument("--image-src", required=True, help="Investigator image source path, repo-relative web path.")
    parser.add_argument("--pdf-path", required=True, help="Deck PDF path relative to repo root.")
    parser.add_argument("--packs-required", default="X", help="Packs required display value.")
    parser.add_argument("--main-deck-size", type=int, default=30, help="Main deck size used in overview.")
    parser.add_argument("--total-deck-size", type=int, default=33, help="Total deck size used in overview.")
    parser.add_argument("--xp-required", type=int, default=0, help="XP required display value.")
    parser.add_argument("--page-dir-prefix", default="arkham_horror_lcg", help="Directory prefix for generated page folders.")
    parser.add_argument("--template-json", default="assets/data/templates/arkham_investigator_deck_template.json", help="Template JSON path relative to repo root.")
    parser.add_argument("--deck-template", default="archive/arkham_investigator_page_shell.template.html", help="Deck page template path relative to repo root.")
    parser.add_argument("--redirect-template", default="archive/redirect_page.template.html", help="Redirect page template path relative to repo root.")
    parser.add_argument("--index-json", default="assets/data/arkham_horror_lcg_index.json", help="Campaign index JSON to update when index arguments are provided.")
    parser.add_argument("--index-campaign-title", help="Existing campaign title inside the index JSON, for example 'The Dream-Eaters Campaign'.")
    parser.add_argument("--index-session-label", help="Existing session label inside the chosen campaign, for example '05/03/2026 Campaign'.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing generated files.")
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> None:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args.date):
        raise ValueError("--date must use YYYY-MM-DD format.")
    if bool(args.index_campaign_title) != bool(args.index_session_label):
        raise ValueError("--index-campaign-title and --index-session-label must be provided together.")


def build_json_payload(template: dict, args: argparse.Namespace, pdf_href: str) -> dict:
    investigator = args.investigator.strip()
    formatted_date = display_date(args.date)
    payload = deepcopy(template)
    payload["pageTitle"] = f"{investigator} - Deck Build ({formatted_date})"
    payload["title"] = f"{investigator} Deck - {formatted_date}"

    overview = payload.setdefault("overview", {})
    overview["imageSrc"] = args.image_src
    overview["imageAlt"] = investigator
    overview["heading"] = investigator
    overview["details"] = [
        f"{args.main_deck_size} cards ({args.total_deck_size} total)",
        f"{args.xp_required} experience required",
        f"{args.packs_required} packs required",
        f"Class: {args.class_name}",
        f"Built by {args.builder} on {formatted_date}",
    ]

    pdf = payload.setdefault("pdf", {})
    pdf["href"] = pdf_href
    first_name = investigator.split()[0]
    pdf["label"] = f"Open {first_name} Deck PDF"
    return payload


def render_template(path: Path, replacements: dict[str, str]) -> str:
    text = path.read_text(encoding="utf-8")
    for needle, replacement in replacements.items():
        text = text.replace(needle, replacement)
    return text


def update_campaign_index(
    index_path: Path,
    campaign_title: str,
    session_label: str,
    investigator_entry: dict,
) -> bool:
    data = load_json(index_path)
    campaigns = data.get("campaigns")
    if not isinstance(campaigns, list):
        raise ValueError(f"Invalid campaign index format in {index_path}")

    for campaign in campaigns:
        if str(campaign.get("title", "")).strip() != campaign_title:
            continue
        sessions = campaign.get("sessions")
        if not isinstance(sessions, list):
            raise ValueError(f"Campaign '{campaign_title}' has no valid sessions array.")
        for session in sessions:
            if str(session.get("label", "")).strip() != session_label:
                continue
            investigators = session.setdefault("investigators", [])
            if not isinstance(investigators, list):
                raise ValueError(f"Session '{session_label}' has no valid investigators array.")

            href = str(investigator_entry.get("href", "")).strip()
            replaced = False
            for idx, existing in enumerate(investigators):
                if str(existing.get("href", "")).strip() == href:
                    investigators[idx] = investigator_entry
                    replaced = True
                    break
            if not replaced:
                investigators.append(investigator_entry)

            index_path.write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
            return replaced

    raise ValueError(
        f"Could not find campaign '{campaign_title}' with session '{session_label}' in {index_path}"
    )


def main() -> int:
    args = parse_args()
    try:
        validate_args(args)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2

    root = Path(args.project_root).resolve()
    template_json_path = root / args.template_json
    deck_template_path = root / args.deck_template
    redirect_template_path = root / args.redirect_template
    index_json_path = root / args.index_json
    pdf_path = (root / args.pdf_path).resolve()

    if not template_json_path.is_file():
        print(f"Missing template JSON: {template_json_path}", file=sys.stderr)
        return 1
    if not deck_template_path.is_file():
        print(f"Missing deck template: {deck_template_path}", file=sys.stderr)
        return 1
    if not redirect_template_path.is_file():
        print(f"Missing redirect template: {redirect_template_path}", file=sys.stderr)
        return 1
    if not pdf_path.is_file():
        print(f"Missing PDF: {pdf_path}", file=sys.stderr)
        return 1

    date_compact = compact_date(args.date)
    date_display = display_date(args.date)
    investigator_slug = slugify(args.investigator)
    campaign_slug = slugify(args.campaign_code)

    data_filename = f"arkham_{investigator_slug}_{date_compact}.json"
    page_basename = f"{args.page_dir_prefix}_{campaign_slug}_{investigator_slug}_{date_compact}"

    data_path = root / "assets" / "data" / data_filename
    page_dir = root / page_basename
    page_index_path = page_dir / "index.html"
    redirect_path = root / f"{page_basename}.html"

    pdf_href = repo_relative_path(pdf_path, root)
    payload = build_json_payload(load_json(template_json_path), args, pdf_href)

    data_href = repo_relative_path(data_path, root)
    page_href = f"/{page_basename}/"

    deck_html = render_template(
        deck_template_path,
        {
            "Investigator Name Deck - MM/DD/YYYY": f"{args.investigator} Deck - {date_display}",
            "/assets/data/your_deck_file.json": data_href,
        },
    )
    redirect_html = render_template(
        redirect_template_path,
        {
            "/target-directory/": page_href,
        },
    )

    try:
        write_json(data_path, payload, args.force)
        write_text(page_index_path, deck_html, args.force)
        write_text(redirect_path, redirect_html, args.force)
    except FileExistsError as error:
        print(error, file=sys.stderr)
        return 1

    print(f"Created {data_path.relative_to(root)}")
    print(f"Created {page_index_path.relative_to(root)}")
    print(f"Created {redirect_path.relative_to(root)}")

    if args.index_campaign_title and args.index_session_label:
        investigator_entry = {
            "href": page_href,
            "imageSrc": args.image_src,
            "imageAlt": args.investigator.strip(),
            "builderName": f"Built by {args.builder}",
            "buildDate": f"Built: {date_display} · XP: 0",
        }
        replaced = update_campaign_index(
            index_json_path,
            args.index_campaign_title.strip(),
            args.index_session_label.strip(),
            investigator_entry,
        )
        action = "Updated existing" if replaced else "Added new"
        print(f"{action} investigator entry in {index_json_path.relative_to(root)}")
    else:
        print("Next step: add the new investigator link to assets/data/arkham_horror_lcg_index.json")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
