"""Lecture minimale des paquets Unity « UnityFS » compressés en LZ4 (sans dépendance externe).

Usage : python tools/unityfs.py <paquet> <sortie.bin>  → écrit les données décompressées brutes.
"""
import mmap
import struct
import sys
from pathlib import Path


def lz4_bloc(src: bytes, taille: int) -> bytes:
    dst = bytearray()
    i, n = 0, len(src)
    while i < n:
        jeton = src[i]
        i += 1
        lit = jeton >> 4
        if lit == 15:
            while True:
                b = src[i]
                i += 1
                lit += b
                if b != 255:
                    break
        dst += src[i:i + lit]
        i += lit
        if i >= n:
            break
        dec = src[i] | (src[i + 1] << 8)
        i += 2
        lon = jeton & 15
        if lon == 15:
            while True:
                b = src[i]
                i += 1
                lon += b
                if b != 255:
                    break
        lon += 4
        debut = len(dst) - dec
        if dec >= lon:
            dst += dst[debut:debut + lon]
        else:
            for k in range(lon):
                dst.append(dst[debut + k])
    if len(dst) != taille:
        raise ValueError(f"taille LZ4 inattendue : {len(dst)} au lieu de {taille}")
    return bytes(dst)


def decompresser(donnees: bytes, flags: int, brut: bytes, taille: int) -> bytes:
    mode = flags & 0x3F
    if mode == 0:
        return brut
    if mode in (2, 3):
        return lz4_bloc(brut, taille)
    raise ValueError(f"compression {mode} non gérée")


def lire(chemin: Path):
    """Renvoie les données décompressées concaténées de tous les blocs."""
    return b"".join(blocs(chemin))


def blocs(chemin: Path):
    """Itère sur les blocs décompressés (utile pour chercher dans un gros paquet sans tout garder en mémoire)."""
    with open(chemin, "rb") as f:
        d = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)  # pas de chargement complet en mémoire
    if d[:8] != b"UnityFS\0":
        raise ValueError("pas un paquet UnityFS")
    pos = 8
    version = struct.unpack_from(">I", d, pos)[0]
    pos += 4
    for _ in range(2):
        pos = d.find(b"\0", pos) + 1
    _taille, info_c, info_u, flags = struct.unpack_from(">qIII", d, pos)
    pos += 20
    if version >= 7:
        pos = (pos + 15) & ~15
    if flags & 0x80:
        info_brut = d[len(d) - info_c:]
    else:
        info_brut = d[pos:pos + info_c]
        pos += info_c
    info = decompresser(d, flags, info_brut, info_u)
    if flags & 0x200:
        pos = (pos + 15) & ~15
    nb = struct.unpack_from(">i", info, 16)[0]
    p = 20
    for _ in range(nb):
        u, c, f = struct.unpack_from(">IIH", info, p)
        p += 10
        yield decompresser(d, f, d[pos:pos + c], u)
        pos += c


if __name__ == "__main__":
    donnees = lire(Path(sys.argv[1]))
    Path(sys.argv[2]).write_bytes(donnees)
    print(f"{len(donnees)} octets décompressés")
