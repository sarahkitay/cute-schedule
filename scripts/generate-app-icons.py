#!/usr/bin/env python3
"""Generate favicon / PWA / iOS icons from public/PYIcon.png."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_PATH = ROOT / "public/PYIcon.png"
FILL_RATIO = 0.96  # icon fills ~96% of square — minimal white margin


def build_master_square() -> Image.Image:
    src = Image.open(SRC_PATH).convert("RGBA")
    bbox = src.getbbox()
    if bbox:
        src = src.crop(bbox)

    w, h = src.size
    canvas_size = max(w, h)
    scale = (canvas_size * FILL_RATIO) / max(w, h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    resized = src.resize((new_w, new_h), Image.Resampling.LANCZOS)

    square = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 255))
    ox = (canvas_size - new_w) // 2
    oy = (canvas_size - new_h) // 2
    square.paste(resized, (ox, oy), resized)

    bg = Image.new("RGB", (canvas_size, canvas_size), (255, 255, 255))
    bg.paste(square, mask=square.split()[3])
    return bg


def main() -> None:
    master = build_master_square()
    outputs = {
        "public/favicon-32.png": 32,
        "public/pwa-192.png": 192,
        "public/pwa-512.png": 512,
        "public/app-icon-512.png": 512,
        "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png": 1024,
    }
    for path, dim in outputs.items():
        dest = ROOT / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        master.resize((dim, dim), Image.Resampling.LANCZOS).save(dest, format="PNG", optimize=True)
        print(f"wrote {path} ({dim}x{dim})")

    icon = master.resize((512, 512), Image.Resampling.LANCZOS)
    splash_dir = ROOT / "ios/App/App/Assets.xcassets/Splash.imageset"
    for name in ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]:
        canvas = Image.new("RGB", (2732, 2732), (255, 255, 255))
        target = int(2732 * 0.58)
        splash_icon = icon.resize((target, target), Image.Resampling.LANCZOS)
        ox = (2732 - target) // 2
        oy = (2732 - target) // 2
        canvas.paste(splash_icon, (ox, oy))
        canvas.save(splash_dir / name, format="PNG", optimize=True)
        print(f"wrote splash {name}")


if __name__ == "__main__":
    main()
