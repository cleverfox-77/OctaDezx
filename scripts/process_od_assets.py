# OD Assets pipeline: "New Assets/OD Assets/" (raw generated) -> web-optimized.
#
#   python scripts/process_od_assets.py
#
# - PNGs -> resized WebP into public/media/
# - MP4s -> muted H.264 web loops (1280w) into public/media/ + WebP posters
# Requires: Pillow, ffmpeg on PATH.
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "New Assets" / "OD Assets"
MEDIA = ROOT / "public" / "media"
TMP = ROOT / "New Assets" / "r2-out"
MEDIA.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)


def webp(src: str, dst: str, width: int, quality: int = 82) -> None:
    im = Image.open(SRC / src)
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    if im.mode == "RGBA":
        bg = Image.new("RGB", im.size, (244, 245, 247))
        bg.paste(im, mask=im.split()[3])
        im = bg
    elif im.mode != "RGB":
        im = im.convert("RGB")
    out = MEDIA / dst
    im.save(out, "WEBP", quality=quality, method=6)
    print(f"{dst}: {im.width}x{im.height} {out.stat().st_size // 1024} KB")


def run(cmd: list) -> None:
    subprocess.run(cmd, check=True, capture_output=True)


def video_loop(src: str, dst: str, width: int = 1280, crf: int = 26) -> None:
    out = MEDIA / dst
    run(["ffmpeg", "-y", "-i", str(SRC / src), "-vf", f"scale={width}:-2",
         "-c:v", "libx264", "-crf", str(crf), "-preset", "slow",
         "-movflags", "+faststart", "-an", str(out)])
    print(f"{dst}: {out.stat().st_size // 1024} KB")


def poster(src_video: str, dst: str, width: int = 1280, at: str = "0.1") -> None:
    tmp = TMP / "_od_poster_tmp.png"
    run(["ffmpeg", "-y", "-ss", at, "-i", str(SRC / src_video), "-vf", f"scale={width}:-2",
         "-frames:v", "1", str(tmp)])
    im = Image.open(tmp).convert("RGB")
    out = MEDIA / dst
    im.save(out, "WEBP", quality=80, method=6)
    tmp.unlink()
    print(f"{dst}: {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    # Images
    webp("Platform hero.png",        "platform-hero.webp",       1600)
    webp("Solutions  industries.png", "solutions-industries.webp", 1400)
    webp("Section background.png",   "section-bg.webp",          1920, 80)
    webp("Customer story.png",       "customer-story.webp",      1600)
    webp("Social share.png",         "social-share.webp",        1600, 80)
    # Videos + posters
    video_loop("Ambient product loop.mp4", "loop-product.mp4")
    poster("Ambient product loop.mp4",     "loop-product-poster.webp")
    video_loop("Hero background.mp4",      "loop-herobg.mp4")
    poster("Hero background.mp4",          "loop-herobg-poster.webp")
    video_loop("How-it-works.mp4",         "loop-howitworks.mp4")
    poster("How-it-works.mp4",             "loop-howitworks-poster.webp")
    print("done")
