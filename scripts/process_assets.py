# Asset pipeline: "New Assets/" (raw AI-generated) -> web-optimized files.
#
#   python scripts/process_assets.py
#
# - PNGs -> resized WebP into public/media/
# - 1e   -> og-image.png composite (headline drawn on the blank panel)
# - MP4s -> H.264 web loops (muted, 1280w) into public/media/
#          + high-quality R2-only masters into "New Assets/r2-out/"
# Requires: Pillow, ffmpeg on PATH.
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "New Assets"
MEDIA = ROOT / "public" / "media"
R2OUT = SRC / "r2-out"
MEDIA.mkdir(parents=True, exist_ok=True)
R2OUT.mkdir(parents=True, exist_ok=True)

NAVY = (0, 0, 71)
SLATE = (71, 85, 105)
INDIGO = (79, 70, 229)


def webp(src: str, dst: str, width: int, quality: int = 82) -> None:
    im = Image.open(SRC / src)
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    if im.mode == "RGBA":
        # flatten: all these renders sit on opaque backgrounds anyway
        bg = Image.new("RGB", im.size, (244, 245, 247))
        bg.paste(im, mask=im.split()[3])
        im = bg
    out = MEDIA / dst
    im.save(out, "WEBP", quality=quality, method=6)
    print(f"{dst}: {im.width}x{im.height} {out.stat().st_size//1024} KB")


def og_composite() -> None:
    """Draw the headline into 1e's intentionally blank panel, output 1200x630."""
    im = Image.open(SRC / "1e.png").convert("RGB")
    d = ImageDraw.Draw(im)
    bold = "C:/Windows/Fonts/segoeuib.ttf"
    semi = "C:/Windows/Fonts/seguisb.ttf"
    f_label = ImageFont.truetype(bold, 60)
    f_head = ImageFont.truetype(bold, 140)
    f_sub = ImageFont.truetype(semi if Path(semi).exists() else bold, 70)
    f_url = ImageFont.truetype(bold, 60)

    x = 240
    d.text((x, 230), "O C T A D E Z X", font=f_label, fill=INDIGO)
    d.text((x, 420), "AI Customer Care,", font=f_head, fill=NAVY)
    d.text((x, 590), "That Sells.", font=f_head, fill=NAVY)
    d.text((x, 860), "Answers customers & captures orders", font=f_sub, fill=SLATE)
    d.text((x, 955), "24/7 — on every channel.", font=f_sub, fill=SLATE)
    d.text((x, 1115), "octadezx.com", font=f_url, fill=INDIGO)

    # cover-resize to 1200x630
    target_w, target_h = 1200, 630
    scale = max(target_w / im.width, target_h / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (im.width - target_w) // 2
    top = (im.height - target_h) // 2
    im = im.crop((left, top, left + target_w, top + target_h))
    out = ROOT / "public" / "og-image.png"
    im.save(out, "PNG", optimize=True)
    print(f"og-image.png: {im.width}x{im.height} {out.stat().st_size//1024} KB")


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, capture_output=True)


def video_loop(src: str, dst: str, width: int = 1280, crf: int = 26) -> None:
    out = MEDIA / dst
    run(["ffmpeg", "-y", "-i", str(SRC / src), "-vf", f"scale={width}:-2",
         "-c:v", "libx264", "-crf", str(crf), "-preset", "slow",
         "-movflags", "+faststart", "-an", str(out)])
    print(f"{dst}: {out.stat().st_size//1024} KB")


def video_master(src: str, dst: str, width: int = 1920, crf: int = 23) -> None:
    out = R2OUT / dst
    run(["ffmpeg", "-y", "-i", str(SRC / src), "-vf", f"scale={width}:-2",
         "-c:v", "libx264", "-crf", str(crf), "-preset", "slow",
         "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(out)])
    print(f"r2-out/{dst}: {out.stat().st_size//1024} KB")


def poster(src_video: Path, dst: str, width: int = 1280) -> None:
    tmp = R2OUT / "_poster_tmp.png"
    run(["ffmpeg", "-y", "-i", str(src_video), "-vf", f"scale={width}:-2",
         "-frames:v", "1", str(tmp)])
    im = Image.open(tmp).convert("RGB")
    out = MEDIA / dst
    im.save(out, "WEBP", quality=80, method=6)
    tmp.unlink()
    print(f"{dst}: {out.stat().st_size//1024} KB")


if __name__ == "__main__":
    webp("1a.png", "hero-chat.webp", 1600)
    webp("1b.png", "bg-grid-orb.webp", 1920, 80)
    webp("1c.png", "channels-orbit.webp", 1000)
    webp("1d.png", "store-owner.webp", 1600)
    webp("2a.png", "card-analytics.webp", 1000)
    webp("2b.png", "card-training.webp", 1000)
    webp("2c.png", "card-security.webp", 1400)
    og_composite()
    video_loop("3a.mp4", "loop-hero.mp4")
    video_loop("3b.mp4", "loop-workflow.mp4")
    poster(MEDIA / "loop-workflow.mp4", "loop-workflow-poster.webp")
    video_master("3c.mp4", "brand-sting.mp4")
    video_master("3d.mp4", "founder-promo.mp4")
    print("done")
