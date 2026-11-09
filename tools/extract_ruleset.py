"""Extrait les fichiers YAML de l'archive Base.ruleset du jeu Frosthaven (Steam) vers tmp/ruleset/.

Format observé : en-tête de 16 octets (signature, 0, nombre d'entrées), puis une table d'entrées de 144 octets
(nom sur 128 octets, puis type, réservé, position, longueur en int32), puis les données en texte brut.
Les fichiers extraits restent locaux (tmp/ n'est pas versionné) : seules les données converties sont publiées.
"""
import struct
import sys
from pathlib import Path

JEU = Path(r"F:/SteamLibrary/steamapps/common/Frosthaven/Frosthaven_Data")
RACINE = Path(__file__).resolve().parent.parent


def extraire(archive: Path, sortie: Path) -> int:
    d = archive.read_bytes()
    nombre = struct.unpack_from("<i", d, 12)[0]
    debut = 16 + nombre * 144
    for i in range(nombre):
        base = 16 + i * 144
        nom = d[base:base + 128].split(b"\0", 1)[0].decode("utf8")
        _type, _res, pos, longueur = struct.unpack_from("<iiii", d, base + 128)
        cible = sortie / nom
        cible.parent.mkdir(parents=True, exist_ok=True)
        cible.write_bytes(d[debut + pos:debut + pos + longueur])
    return nombre


if __name__ == "__main__":
    jeu = Path(sys.argv[1]) if len(sys.argv) > 1 else JEU
    n = extraire(jeu / "StreamingAssets/Rulebase/Base.ruleset", RACINE / "tmp/ruleset")
    print(f"{n} fichiers extraits dans tmp/ruleset")
