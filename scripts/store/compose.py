"""Store images of Arenile mobile (store/README.md): a caption on the brand navy above a real
screenshot of the app, at the sizes the App Store and Google Play ask for, plus the Google Play
feature graphic. Run: `python3 scripts/store/compose.py` (needs Pillow) after capturing the raw
screenshots into store/raw/ (git-ignored) with the names listed below."""
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
RAW, OUT = ROOT / "store/raw", ROOT / "store"
FONTS = ROOT / "store/.fonts"
# Titillium Web, the font of the Arenile brand (SIL Open Font License 1.1), downloaded once.
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/titilliumweb/{}.ttf"


def font_file(name):
    path = FONTS / f"{name}.ttf"
    if not path.exists():
        FONTS.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(FONT_URL.format(name), path)
    return str(path)


BOLD = font_file("TitilliumWeb-Bold")
REG = font_file("TitilliumWeb-Regular")
NAVY_TOP, NAVY_BOTTOM = (11, 37, 66), (24, 84, 130)
SUB = (214, 228, 241)
SAND = (240, 200, 140)

PHONE = [
    ("phone-01-map", "La spiaggia di oggi,\na colpo d'occhio", "Ogni postazione con il suo stato:\narrivi, partenze, presenze e incassi"),
    ("phone-03-availability", "Un posto libero\nin un attimo", "Fila per fila, per le date\nche chiede il cliente"),
    ("phone-04-new-booking", "Prenota al volo", "Prezzo calcolato subito,\nposto bloccato per 15 minuti"),
    ("phone-06-booking", "Il cliente\na portata di mano", "Chiama, scrivi su WhatsApp\no manda un'email dalla scheda"),
    ("phone-02-today", "La giornata\nin un riepilogo", "Arrivi, presenti, posti liberi\ne saldi da incassare"),
    ("phone-07-lifeguard", "Clienti per fila", "La lista per la spiaggia,\na caratteri grandi"),
    ("phone-05-bookings", "Tutte le prenotazioni\ndel giorno", "Cerca per codice, cliente\no postazione"),
]
IPAD = [
    ("ipad-01-map", "La spiaggia di oggi, a colpo d'occhio", "Ogni postazione con il suo stato: arrivi, partenze, presenze e incassi"),
    ("ipad-02-bookings", "Elenco e scheda, fianco a fianco", "Il cliente a portata di mano: chiama, scrivi su WhatsApp o via email"),
    ("ipad-03-availability", "Un posto libero in un attimo", "Fila per fila, per le date che chiede il cliente"),
    ("ipad-05-lifeguard", "Clienti per fila", "La lista per la spiaggia, a caratteri grandi"),
    ("ipad-04-today", "La giornata in un riepilogo", "Arrivi, presenti, posti liberi e saldi da incassare"),
]


def gradient(w, h):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1)
        d.line([(0, y), (w, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(NAVY_TOP, NAVY_BOTTOM)))
    return img


def clean_ipad(shot):
    """Hide the Expo Go name in the status bar (its corner mark falls below the canvas)."""
    d = ImageDraw.Draw(shot)
    d.rectangle([285, 8, 440, 58], fill=shot.getpixel((470, 30)))
    return shot


def rounded(shot, radius):
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width - 1, shot.height - 1], radius, fill=255)
    out = Image.new("RGBA", shot.size)
    out.paste(shot, (0, 0), mask)
    return out


def text_block(d, w, y, text, font, fill, spacing):
    for line in text.split("\n"):
        tw = d.textlength(line, font=font)
        d.text(((w - tw) / 2, y), line, font=font, fill=fill)
        y += font.size + spacing
    return y


def compose(name, title, sub, size, tablet):
    w, h = size
    shot = Image.open(RAW / f"{name}.png").convert("RGB")
    if tablet:
        shot = clean_ipad(shot)
    canvas = gradient(w, h).convert("RGBA")
    d = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(BOLD, round(w * (0.05 if tablet else 0.078)))
    sub_font = ImageFont.truetype(REG, round(w * (0.026 if tablet else 0.043)))
    y = round(h * 0.05)
    # Sand accent bar above the title.
    bar_w = round(w * 0.08)
    d.rounded_rectangle([(w - bar_w) / 2, y, (w + bar_w) / 2, y + round(w * 0.008)], 6, fill=SAND)
    y += round(w * 0.03)
    y = text_block(d, w, y, title, title_font, (255, 255, 255), round(title_font.size * 0.08))
    y += round(w * 0.03)
    y = text_block(d, w, y, sub, sub_font, SUB, round(sub_font.size * 0.25))
    y += round(h * 0.035)
    sw = round(w * (0.84 if tablet else 0.82))
    sh = round(shot.height * sw / shot.width)
    shot = rounded(shot.resize((sw, sh), Image.LANCZOS), round(sw * (0.035 if tablet else 0.075)))
    x = (w - sw) // 2
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [x, y + 18, x + sw, y + sh + 18], round(sw * 0.06), fill=(0, 0, 0, 110)
    )
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(28)))
    canvas.alpha_composite(shot, (x, y))
    return canvas.convert("RGB")


def feature_graphic():
    """Google Play feature graphic (1024 x 500): symbol, name and the line under it."""
    lines = ["Lo stabilimento balneare in tasca:", "mappa, prenotazioni e clienti"]
    w, h = 1024, 500
    img = gradient(w, h).convert("RGBA")
    sym = Image.open(ROOT / "assets/brand/symbol-dark.png").convert("RGBA")
    sym.thumbnail((200, 200))
    img.alpha_composite(sym, (80, (h - sym.height) // 2))
    d = ImageDraw.Draw(img)
    x = 80 + sym.width + 56
    size = 36
    font = ImageFont.truetype(REG, size)
    while max(d.textlength(t, font=font) for t in lines) > w - x - 50:
        size -= 1
        font = ImageFont.truetype(REG, size)
    d.text((x, 150), "Arenile", font=ImageFont.truetype(BOLD, 92), fill=(255, 255, 255))
    d.rounded_rectangle([x + 4, 268, x + 84, 276], 4, fill=SAND)
    for i, t in enumerate(lines):
        d.text((x, 296 + i * round(size * 1.25)), t, font=font, fill=SUB)
    img.convert("RGB").save(OUT / "google-play/feature-graphic.png", optimize=True)


def main():
    # Google Play tablets take the iPad 13" images as they are (4:3, under 3840 px).
    targets = {
        "app-store/iphone-6.9": ((1320, 2868), PHONE, False),
        "app-store/ipad-13": ((2064, 2752), IPAD, True),
        "google-play/phone": ((1080, 1920), PHONE, False),
    }
    for folder, (size, items, tablet) in targets.items():
        out = OUT / folder
        out.mkdir(parents=True, exist_ok=True)
        for i, (name, title, sub) in enumerate(items, 1):
            img = compose(name, title, sub, size, tablet)
            img.save(out / f"{i:02d}-{name.split('-', 2)[2]}.png", optimize=True)
    feature_graphic()
    print("ok")


if __name__ == "__main__":
    sys.exit(main())
