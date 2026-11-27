"""Builds the crest pages' self-hosted woff2 subsets (bus 176 P1b) from the Google Fonts sources (OFL):
  https://github.com/google/fonts/raw/main/ofl/manrope/Manrope[wght].ttf
  https://github.com/google/fonts/raw/main/ofl/playfairdisplay/PlayfairDisplay[wght].ttf
  https://github.com/google/fonts/raw/main/ofl/playfairdisplay/PlayfairDisplay-Italic[wght].ttf

The latin files are Google's latin subset; the cyrillic files add the punctuation, digits and space of running text
(CORE), so a Russian page needs no Latin file for its spaces and commas: app/lib/crestFonts.ts declares CORE on the
cyrillic file on /ru only (an English page never fetches Cyrillic for a space). Small "mark" files hold the other script's few characters: on /ru KARTEL and the Roman
numerals (Playfair) and the basic Latin letters (Manrope), on /en «Русский» (Manrope), and on both the motto
«Virtus et Potestas» (Playfair italic). Axes are limited to the weights the CSS uses (Playfair: static 600 and 700 files).

  python3 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install fonttools brotli
  /tmp/fontenv/bin/python scripts/build-crest-fonts.py <dir with the three .ttf>
"""
import io, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

SRC = sys.argv[1]
OUT = "public/fonts"
COMMON = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"  # Google's latin range
# The punctuation a Russian page sets in running text (space, digits, ASCII signs, «» · © №, dashes, quotes, …, arrows).
CORE = "U+0020-0040,U+005B-0060,U+007B-007E,U+00A0,U+00A9,U+00AB,U+00B7,U+00BB,U+00D7,U+2010-2014,U+2018-201E,U+2022,U+2026,U+2039-203A,U+2116,U+2190-2193,U+2212"
CYRILLIC = "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1"

def build(src, out, wght, unicodes=None, text=None):
    f = TTFont(f"{SRC}/{src}", lazy=False)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=subset.parse_unicodes(unicodes) if unicodes else [], text=text or "")
    s.subset(f)
    f = instancer.instantiateVariableFont(f, {"wght": wght})
    f.flavor = "woff2"
    f.save(f"{OUT}/{out}")
    buf = io.BytesIO(); f.save(buf)
    print(f"{out}: {len(buf.getvalue())} bytes")

M, P, PI = "Manrope[wght].ttf", "PlayfairDisplay[wght].ttf", "PlayfairDisplay-Italic[wght].ttf"
build(M, "manrope-latin-v2.woff2", (300, 700), COMMON)
build(M, "manrope-cyrillic-v2.woff2", (300, 700), f"{CYRILLIC},{CORE}")
# Playfair as static 600 (every heading) and 700 (the explorer numeral, the 404 code — fetched only where set):
# a static instance is a third smaller than the 600–700 variable file.
build(P, "playfair-latin-600-v2.woff2", 600, COMMON)
build(P, "playfair-cyrillic-600-v2.woff2", 600, f"{CYRILLIC},{CORE}")
build(P, "playfair-latin-700-v2.woff2", 700, COMMON)
build(P, "playfair-cyrillic-700-v2.woff2", 700, f"{CYRILLIC},{CORE}")
build(P, "playfair-mark-600-v2.woff2", 600, text="KARTELIVX")
build(PI, "playfair-italic-mark-v2.woff2", 500, text="Virtus et Potestas")
build(M, "manrope-latin-basic-v2.woff2", (300, 700), "U+0041-005A,U+0061-007A")  # /ru: the few Latin words (A–Z, a–z)
build(M, "manrope-ru-mark-v2.woff2", (300, 700), text="Русский")  # /en: the language link
build(PI, "playfair-italic-latin-v2.woff2", 500, COMMON)
build(PI, "playfair-italic-cyrillic-v2.woff2", 500, f"{CYRILLIC},{CORE}")
