#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import List

from PIL import Image


def fit_image(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    if img.width <= max_w and img.height <= max_h:
        return img
    scale = min(max_w / img.width, max_h / img.height)
    target = (max(1, int(img.width * scale)), max(1, int(img.height * scale)))
    return img.resize(target, Image.Resampling.LANCZOS)


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    project_dir = script_dir.parent

    layout_path = project_dir / "pollinator-extras-layout.json"
    src_dir = project_dir / "output" / "imagegen" / "pollinator-extras"
    out_path = project_dir / "pollinator-extras-spritesheet-v2.png"

    layout = json.loads(layout_path.read_text(encoding="utf-8"))
    cols = int(layout["grid"]["cols"])
    rows = int(layout["grid"]["rows"])
    cell = int(layout["grid"]["cell_size"])
    names_grid: List[List[str]] = layout["cells"]

    sheet = Image.new("RGBA", (cols * cell, rows * cell), (0, 0, 0, 0))

    # Keep clear padding so no sprite touches cell edges.
    target_max = int(cell * 0.76)

    missing = []
    for row in range(rows):
        for col in range(cols):
            name = names_grid[row][col]
            if name == "empty":
                continue

            candidate = src_dir / f"{name}.png"
            if not candidate.exists():
                missing.append(str(candidate))
                continue

            img = Image.open(candidate).convert("RGBA")
            img = fit_image(img, target_max, target_max)

            x = col * cell + (cell - img.width) // 2
            y = row * cell + (cell - img.height) // 2
            sheet.alpha_composite(img, (x, y))

    sheet.save(out_path)
    print(f"Wrote {out_path}")

    if missing:
        print("Missing inputs:")
        for item in missing:
            print(f"  - {item}")


if __name__ == "__main__":
    main()
