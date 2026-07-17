# Rebuild public/favicon.png as a perfectly centered mark.
# Redraws the exact Logo.tsx SVG geometry (octagon + chat bubble + two lines)
# with PIL at high resolution: no wordmark, even padding, crisp edges.
#   python scripts/make_favicon.py
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "favicon.png"

# Sample the octagon colour from the existing favicon so the brand hue is kept.
old = Image.open(OUT).convert("RGBA")
NAVY = old.getpixel((old.width // 2, int(old.height * 0.75)))[:3]
if sum(NAVY) > 400:  # sampled a light pixel by accident → fall back to brand navy
    NAVY = (30, 58, 95)

SS = 4                 # supersample for smooth edges
SIZE = 1008            # multiple of 48 (Google favicon guideline)
PAD = 0.11             # even padding on all sides
canvas = SIZE * SS
logo = canvas * (1 - 2 * PAD)
off = canvas * PAD
s = logo / 100.0       # SVG viewBox is 100x100

def pt(x: float, y: float) -> tuple[float, float]:
    return (off + x * s, off + y * s)

im = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
d = ImageDraw.Draw(im)

# Octagon: M29.3 0 h41.4 L100 29.3 v41.4 L70.7 100 H29.3 L0 70.7 V29.3 Z
d.polygon(
    [pt(29.3, 0), pt(70.7, 0), pt(100, 29.3), pt(100, 70.7),
     pt(70.7, 100), pt(29.3, 100), pt(0, 70.7), pt(0, 29.3)],
    fill=(*NAVY, 255),
)

# Chat bubble: rounded rect (20,30)-(70,65) r=5 + tail at (45..55, 65..75)
d.rounded_rectangle([pt(20, 30), pt(70, 65)], radius=5 * s, fill=(255, 255, 255, 255))
d.polygon([pt(45, 65), pt(55, 65), pt(45, 75)], fill=(255, 255, 255, 255))

# Two text lines inside the bubble
d.rounded_rectangle([pt(26, 40), pt(60, 44)], radius=2 * s, fill=(*NAVY, 255))
d.rounded_rectangle([pt(26, 50), pt(50, 54)], radius=2 * s, fill=(*NAVY, 255))

im = im.resize((SIZE, SIZE), Image.LANCZOS)
im.save(OUT, "PNG", optimize=True)

# Verify symmetry: content bbox margins should match on all sides
bbox = im.split()[3].getbbox()
print(f"favicon.png {SIZE}x{SIZE}, colour {NAVY}, bbox {bbox}")
print(f"margins L{bbox[0]} T{bbox[1]} R{SIZE - bbox[2]} B{SIZE - bbox[3]}")
