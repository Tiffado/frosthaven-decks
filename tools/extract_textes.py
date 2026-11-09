"""Extrait la table de traduction du jeu (resources.assets) vers tmp/textes.json : {clé: {"en": ..., "fr": ...}}.

Format observé d'une entrée (chaînes Unity : int32 longueur, octets UTF-8, alignement sur 4) :
  "Catégorie/clé", int32 0, int32 25, commentaire, étiquette (souvent « Early Access »),
  puis les langues : [note, anglais, allemand, français, italien, espagnol, portugais, "", russe, ...].
La clé utilisée dans les YAML ($FH/clé$ ou $clé$) correspond à la partie après le premier « / ».
"""
import json
import re
import struct
import sys
from pathlib import Path

JEU = Path(r"F:/SteamLibrary/steamapps/common/Frosthaven/Frosthaven_Data")
RACINE = Path(__file__).resolve().parent.parent
LANGUES = {"en": 1, "fr": 3}
NB_CHAINES = 4  # chaînes lues après l'étiquette : suffisant pour atteindre le français
# Recherche avec chevauchement : l'alignement est relatif au début de chaque table, pas au fichier.
ANCRE = re.compile(rb"(?=\x00\x00\x00\x00\x19\x00\x00\x00)")


def lire_chaine(d: bytes, pos: int, phase: int):
    n = struct.unpack_from("<i", d, pos)[0]
    if n < 0 or n > 20000:
        raise ValueError
    s = d[pos + 4:pos + 4 + n].decode("utf8")
    return s, ((pos + 4 + n - phase + 3) & ~3) + phase


def cle_avant(d: bytes, fin: int, phase: int):
    """Retrouve la chaîne-clé qui se termine (alignée) en `fin`, ou None."""
    for debut in range(fin - 8, max(fin - 300, 0), -4):
        try:
            s, apres = lire_chaine(d, debut, phase)
        except (ValueError, UnicodeDecodeError):
            continue
        if apres == fin and "/" in s and s.isprintable() and len(s) > 2:
            return s
    return None


def extraire(d: bytes) -> dict:
    textes = {}
    for m in ANCRE.finditer(d):
        phase = m.start() % 4
        cle = cle_avant(d, m.start(), phase)
        if cle is None:
            continue
        lire = lambda p: lire_chaine(d, p, phase)  # noqa: E731
        try:
            _comm, pos = lire(m.start() + 8)
            _etiq, pos = lire(pos)
            chaines = []
            for _ in range(NB_CHAINES):
                s, pos = lire(pos)
                chaines.append(s)
        except (ValueError, UnicodeDecodeError, struct.error):
            continue
        textes[cle.split("/", 1)[1]] = {lang: chaines[i] for lang, i in LANGUES.items()}
    return textes


if __name__ == "__main__":
    jeu = Path(sys.argv[1]) if len(sys.argv) > 1 else JEU
    d = (jeu / "resources.assets").read_bytes()
    textes = extraire(d)
    sortie = RACINE / "tmp/textes.json"
    sortie.write_text(json.dumps(textes, ensure_ascii=False, indent=0), encoding="utf8")
    print(f"{len(textes)} textes extraits dans {sortie.relative_to(RACINE)}")
