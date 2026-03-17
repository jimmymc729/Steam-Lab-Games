#!/usr/bin/env python3
from __future__ import annotations

from collections import Counter, deque
from pathlib import Path
from typing import List, Tuple

from PIL import Image, ImageDraw


NAMES = [
    "butterfly_blue_1", "butterfly_blue_2", "butterfly_pink_1", "butterfly_pink_2",
    "ladybug_idle", "dragonfly_idle", "star_badge", "honey_drop",
    "seedling_stage_1", "seedling_stage_2", "seedling_stage_3", "clover_patch",
    "wind_swirl", "mission_scroll", "combo_burst", "empty",
]


def qcolor(rgb: Tuple[int, int, int], q: int = 8) -> Tuple[int, int, int]:
    return tuple((c // q) * q for c in rgb)


def avg_color(colors: List[Tuple[int, int, int]]) -> Tuple[float, float, float]:
    if not colors:
        return (0.0, 0.0, 0.0)
    r = sum(c[0] for c in colors) / len(colors)
    g = sum(c[1] for c in colors) / len(colors)
    b = sum(c[2] for c in colors) / len(colors)
    return (r, g, b)


def color_dist(a: Tuple[int, int, int], b: Tuple[float, float, float]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def strongest_components(mask: List[List[bool]]) -> List[Tuple[int, List[Tuple[int, int]]]]:
    h = len(mask)
    w = len(mask[0]) if h else 0
    seen = [[False] * w for _ in range(h)]
    comps: List[Tuple[int, List[Tuple[int, int]]]] = []

    for y in range(h):
        for x in range(w):
            if seen[y][x] or not mask[y][x]:
                continue
            q = deque([(x, y)])
            seen[y][x] = True
            pts: List[Tuple[int, int]] = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                    nx, ny = cx + ox, cy + oy
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    if seen[ny][nx] or not mask[ny][nx]:
                        continue
                    seen[ny][nx] = True
                    q.append((nx, ny))
            comps.append((len(pts), pts))

    comps.sort(key=lambda c: c[0], reverse=True)
    return comps


def extract_cell(cell: Image.Image) -> Image.Image:
    w, h = cell.size
    rgb = cell.convert("RGB")
    px = rgb.load()

    # Ignore lower label zone; icons live in upper part.
    crop_h = int(h * 0.78)

    # Sample border pixels from the top crop to estimate checker colors.
    border = []
    border_pad = 8
    for x in range(w):
        border.append(px[x, 0])
        border.append(px[x, crop_h - 1])
    for y in range(crop_h):
        border.append(px[0, y])
        border.append(px[w - 1, y])
    for x in range(border_pad, w - border_pad):
        border.append(px[x, border_pad])
    for y in range(border_pad, crop_h - border_pad):
        border.append(px[border_pad, y])

    bucket = Counter(qcolor(c, 8) for c in border)
    top = [k for k, _ in bucket.most_common(2)]
    if len(top) < 2:
        top = [(160, 160, 160), (190, 190, 190)]

    bg1_samples = [c for c in border if qcolor(c, 8) == top[0]]
    bg2_samples = [c for c in border if qcolor(c, 8) == top[1]]
    bg1 = avg_color(bg1_samples)
    bg2 = avg_color(bg2_samples)

    def is_bg_pixel(c: Tuple[int, int, int]) -> bool:
        r, g, b = c
        bright = (r + g + b) / 3.0
        chroma = max(c) - min(c)
        # Checkerboard is neutral gray midtones. Treat that as background.
        if 85 <= bright <= 220 and chroma <= 16:
            return True
        return False

    # Initial foreground mask from non-checker pixels.
    conf = [[0.0] * w for _ in range(crop_h)]
    base_mask = [[False] * w for _ in range(crop_h)]
    for y in range(crop_h):
        for x in range(w):
            c = px[x, y]
            d = min(color_dist(c, bg1), color_dist(c, bg2))
            chroma = max(c) - min(c)
            bright = sum(c) / 3.0

            score = d + (8 if chroma > 22 else 0) + (8 if bright > 230 else 0)
            conf[y][x] = score
            if not is_bg_pixel(c):
                base_mask[y][x] = True

    comps = strongest_components(base_mask)
    if not comps:
        return Image.new("RGBA", (w, h), (0, 0, 0, 0))

    # Pick most plausible icon component in upper region.
    chosen = comps[0][1]
    best_score = -1.0
    for area, pts in comps[:6]:
        if area < 60:
            continue
        cy = sum(p[1] for p in pts) / area
        cx = sum(p[0] for p in pts) / area
        upper_bonus = 1.0 if cy < crop_h * 0.66 else 0.55
        center_bonus = 1.0 - abs(cx - (w / 2)) / (w / 2 + 1)
        score = area * upper_bonus * (0.6 + 0.4 * center_bonus)
        if score > best_score:
            best_score = score
            chosen = pts

    keep = [[False] * w for _ in range(crop_h)]
    for x, y in chosen:
        keep[y][x] = True

    core_min_x = min(p[0] for p in chosen)
    core_max_x = max(p[0] for p in chosen)
    core_min_y = min(p[1] for p in chosen)
    core_max_y = max(p[1] for p in chosen)
    guard_pad = 18
    guard_min_x = max(0, core_min_x - guard_pad)
    guard_max_x = min(w - 1, core_max_x + guard_pad)
    guard_min_y = max(0, core_min_y - guard_pad)
    guard_max_y = min(crop_h - 1, core_max_y + guard_pad)

    # Grow one pixel to keep anti-aliased edge color.
    grown = [row[:] for row in keep]
    for y in range(crop_h):
        for x in range(w):
            if keep[y][x]:
                continue
            if x < guard_min_x or x > guard_max_x or y < guard_min_y or y > guard_max_y:
                continue
            n = 0
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                nx, ny = x + ox, y + oy
                if nx < 0 or ny < 0 or nx >= w or ny >= crop_h:
                    continue
                if keep[ny][nx]:
                    n += 1
            if n >= 3 and not is_bg_pixel(px[x, y]):
                grown[y][x] = True

    # Drop detached noise: keep only the main connected component after growth.
    grown_comps = strongest_components(grown)
    if grown_comps:
        main_pts = grown_comps[0][1]
        main = [[False] * w for _ in range(crop_h)]
        for x, y in main_pts:
            main[y][x] = True
        grown = main

    # Fill tiny interior holes so light/white details (e.g., wings) remain intact.
    for _ in range(2):
        fill = []
        for y in range(1, crop_h - 1):
            for x in range(1, w - 1):
                if grown[y][x]:
                    continue
                n = 0
                for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                    if grown[y + oy][x + ox]:
                        n += 1
                if n >= 7:
                    fill.append((x, y))
        if not fill:
            break
        for x, y in fill:
            grown[y][x] = True

    # Restore bright interior pixels that are surrounded by kept sprite pixels.
    bright_fill = []
    for y in range(1, crop_h - 1):
        for x in range(1, w - 1):
            if grown[y][x]:
                continue
            r, g, b = px[x, y]
            bright = (r + g + b) / 3.0
            if bright < 170:
                continue
            n = 0
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                if grown[y + oy][x + ox]:
                    n += 1
            if n >= 5:
                bright_fill.append((x, y))
    for x, y in bright_fill:
        grown[y][x] = True

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()

    for y in range(crop_h):
        for x in range(w):
            if not grown[y][x]:
                continue
            r, g, b = px[x, y]
            alpha = 255
            opx[x, y] = (r, g, b, alpha)

    return out


def crop_alpha_bounds(img: Image.Image) -> Image.Image:
    a = img.split()[-1]
    box = a.getbbox()
    if box is None:
        return img
    return img.crop(box)


def main() -> None:
    base = Path('/Users/jamesmcnicholas/Documents/Steam Lab Games/pollinator patrol')
    src = base / 'unnamed (2).jpg'
    out_sheet = base / 'pollinator-extras-spritesheet-clean.png'
    out_preview = base / 'pollinator-extras-spritesheet-clean-preview.png'
    out_cells = base / 'output' / 'imagegen' / 'pollinator-extras-clean-cells'
    out_cells.mkdir(parents=True, exist_ok=True)

    img = Image.open(src).convert('RGB')
    w, h = img.size
    cw, ch = w // 4, h // 4

    sheet = Image.new('RGBA', (cw * 4, ch * 4), (0, 0, 0, 0))

    for idx, name in enumerate(NAMES):
        col, row = idx % 4, idx // 4
        x0, y0 = col * cw, row * ch
        cell = img.crop((x0, y0, x0 + cw, y0 + ch))

        if name == 'empty':
            cleaned = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        else:
            cleaned = extract_cell(cell)
            cleaned = crop_alpha_bounds(cleaned)

            # Re-center into the fixed grid cell so sheet math stays simple.
            recentered = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
            x = (cw - cleaned.width) // 2
            y = (ch - cleaned.height) // 2
            recentered.alpha_composite(cleaned, (x, y))
            cleaned = recentered

        sheet.alpha_composite(cleaned, (x0, y0))
        cleaned.save(out_cells / f'{name}.png')

    sheet.save(out_sheet)

    # Magenta preview to verify transparency quickly.
    preview = Image.new('RGBA', sheet.size, (255, 0, 255, 255))
    preview.alpha_composite(sheet)
    draw = ImageDraw.Draw(preview)
    for i in range(5):
        draw.line((i * cw, 0, i * cw, h), fill=(0, 0, 0, 180), width=1)
        draw.line((0, i * ch, w, i * ch), fill=(0, 0, 0, 180), width=1)
    preview.save(out_preview)

    print('Wrote', out_sheet)
    print('Wrote', out_preview)
    print('Wrote cells to', out_cells)


if __name__ == '__main__':
    main()
