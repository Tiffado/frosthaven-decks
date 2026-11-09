"""Convertit les données extraites du jeu (tmp/ruleset, tmp/textes.json) en JSON pour le site (site/data/).

Chaque côté de carte devient une liste de lignes de texte français. Les icônes du jeu sont gardées sous forme de
jetons {Nom} que le site affiche en libellés. Lancer d'abord extract_ruleset.py et extract_textes.py.
"""
import json
import re
import sys
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent
RULESET = RACINE / "tmp/ruleset"
SORTIE = RACINE / "docs/data"
DEPART = ["BannerSpear", "Blinkblade", "Boneshaper", "Deathwalker", "Drifter", "Geminate"]
ELEMENTS = ["Air", "Fire", "Ice", "Earth", "Light", "Dark", "Wild", "Mixed"]
# Ordre de recherche de la valeur principale d'une capacité (*TAttack* → Attack.Amount, etc.).
TYPES = ["Attack", "Move", "Heal", "Shield", "Retaliate", "Loot", "Teleport", "Pull", "Push", "Trap", "Damage",
         "Target", "Range", "Amount"]

textes = json.loads((RACINE / "tmp/textes.json").read_text(encoding="utf8"))
inconnus = set()


def tr(cle: str, lang="fr") -> str:
    for c in (cle, "Glossary/" + cle):
        if c in textes:
            return textes[c][lang] or textes[c]["en"]
    inconnus.add(cle)
    return "{Manquant}"  # clé absente des tables de traduction du jeu


def arrondir_indentation(brut: str) -> str:
    lignes = []
    for l in brut.split("\n"):
        n = len(l) - len(l.lstrip(" "))
        lignes.append(" " * (4 * round(n / 4)) + l.lstrip(" ") if l.strip() else l)
    return "\n".join(lignes)


# Le jeu a un lecteur YAML tolérant : tabulations et indentations décalées d'un espace (quelques fichiers).
def lire_yaml(chemin: Path):
    brut = chemin.read_text(encoding="utf-8-sig").replace("\t", "    ")
    try:
        return yaml.safe_load(brut)
    except yaml.YAMLError:
        return yaml.safe_load(arrondir_indentation(brut))


# ---------- Index des capacités d'une carte ----------

def indexer(noeud, index):
    """Indexe les capacités par nom. Celles déclarées sous Abilities/SubAbilities passent avant les variantes
    conditionnelles homonymes (ConditionalOverrides), d'où les deux passes."""
    def parcourir(n, seulement_capacites):
        if isinstance(n, dict):
            for k, v in n.items():
                if k in ("Abilities", "SubAbilities") and isinstance(v, dict):
                    for nom, ab in v.items():
                        if isinstance(ab, dict) and nom not in index:
                            index[nom] = ab
                elif not seulement_capacites and isinstance(v, dict) and k not in index:
                    index[k] = v
                parcourir(v, seulement_capacites)
        elif isinstance(n, list):
            for v in n:
                parcourir(v, seulement_capacites)
    parcourir(noeud, True)
    parcourir(noeud, False)


def montant(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, dict):
        for k in ("Amount", "Value", "Damage"):
            if k in v and not isinstance(v[k], (dict, list)):
                return v[k]
    if isinstance(v, str) and re.fullmatch(r"-?\d+", v.strip()):
        return int(v)
    return None


def valeur(chemin: str, index: dict, nom_carte: str):
    parties = chemin.split(".")
    ab = index.get(parties[0])
    if ab is None:
        # Nom erroné dans la mise en page du jeu (TAttack pour TLetThemComeAttack) : même côté, même type.
        cote, genre = parties[0][:1], parties[0][1:]
        proche = [k for k in index if k.startswith(parties[0])] or \
                 [k for k in index if k.startswith(cote) and genre in k]
        ab = index[proche[0]] if proche else None
    if ab is None:
        inconnus.add(f"*{chemin}* ({nom_carte})")
        return "?"
    if len(parties) > 1:
        cible = ab.get(parties[1])
        if cible is None and parties[1] in index:
            cible = index[parties[1]]
        if cible is None:
            # La propriété peut être imbriquée (Move.Amount, Retaliate.RetaliateRange…)
            for v in ab.values():
                if isinstance(v, dict) and parties[1] in v:
                    cible = v[parties[1]]
                    break
        if cible is None:
            # Fautes de frappe du jeu (Amoount, Targe) : on compare le début du nom.
            cible = next((v for k, v in ab.items() if k[:4] == parties[1][:4]), None)
        m = montant(cible) if cible is not None else None
        if m is None and isinstance(cible, dict):
            m = valeur_principale(cible)
        if m is None and parties[1].startswith("Amo"):
            m = valeur_principale(ab, parties[0])
        if m is None:
            inconnus.add(f"*{chemin}* ({nom_carte})")
            return "?"
        return m
    m = valeur_principale(ab, parties[0])
    if m is None:
        inconnus.add(f"*{chemin}* ({nom_carte})")
        return "?"
    return m


def valeur_principale(ab: dict, nom: str = ""):
    nom_court = re.sub(r"^[TB]", "", nom)
    # Les clés peuvent porter un suffixe numérique (Teleport2).
    candidats = [(t, k) for t in TYPES for k in ab if re.fullmatch(t + r"\d*", k)]
    candidats.sort(key=lambda c: (c[0].lower() not in nom_court.lower(), TYPES.index(c[0])))
    for _t, k in candidats:
        m = montant(ab[k])
        if m is not None:
            return m
    return montant(ab)


# ---------- Texte riche du jeu → texte du site ----------

def nettoyer(s: str, index: dict, nom_carte: str, prof=0) -> str:
    if s is None:
        return ""
    s = str(s)
    # Clés de traduction : $FH/clé$ ou $clé$ (le texte traduit peut à son tour contenir des balises).
    def rempl_cle(m):
        cle = m.group(1)
        if cle.startswith("FH/"):
            cle = cle[3:]
        return nettoyer(tr(cle), index, nom_carte, prof + 1) if prof < 3 else tr(cle)
    s = re.sub(r"\$([A-Za-z0-9_/]+)\$", rempl_cle, s)
    s = re.sub(r"\*([A-Za-z0-9_.]+)\*", lambda m: str(valeur(m.group(1), index, nom_carte)), s)
    s = re.sub(r"@[A-Za-z0-9_.]*@", "", s)
    # Zone d'effet : £Area£ (zone du côté) ou £NomCapacité.Area£ (zone de cette capacité précise).
    s = re.sub(r"£([A-Za-z0-9_]+)\.Area£", r"{ZoneAb_\1}", s)
    s = re.sub(r"£([A-Za-z0-9_.]+)£", r"{Zone}", s)
    s = re.sub(r"<sprite name=\"?([A-Za-z0-9_+\-]+)\"?\s*>", r"{\1}", s)
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</?[a-z]+(=[^>]*)?>", "", s)
    s = re.sub(r"<(mark|color|size|voffset|font|cspace|line-height|indent|align|space)[^>]*>", "", s, flags=re.I)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    return s.strip()


def duree(nom_ab: str, index: dict) -> str:
    ab = index.get(nom_ab) or {}
    bonus = ab.get("ActiveBonus") or {}
    d = bonus.get("Duration") if isinstance(bonus, dict) else None
    return {"Persistent": "{Persistent}", "Round": "{Round}"}.get(d, "{Persistent}")


def rendre(noeud, ctx, lignes: list):
    """Parcourt un nœud de Layout et ajoute des lignes de texte."""
    index, nom = ctx["index"], ctx["nom"]
    if noeud is None:
        return
    if isinstance(noeud, str):
        t = nettoyer(noeud, index, nom)
        if t:
            lignes.append(t)
        return
    if isinstance(noeud, list):
        for el in noeud:
            rendre(el, ctx, lignes)
        return
    if not isinstance(noeud, dict):
        return
    for k, v in noeud.items():
        if k in ("ColumnWidths", "XPTracker", "Duration"):
            continue
        if k == "Row":
            if isinstance(v, list):
                sous = []
                rendre(v, ctx, sous)
                if sous:
                    lignes.append(" ".join(sous))
            else:
                rendre(v, ctx, lignes)
        elif k == "Column":
            rendre(v, ctx, lignes)
        elif k == "Divider":
            lignes.append("—")
        elif k == "AddedEffect":
            t = nettoyer(v, index, nom)
            if t and lignes:
                lignes[-1] += " " + t
            elif t:
                lignes.append(t)
        elif k == "Active":
            sous = []
            rendre(v.get("Layout"), ctx, sous)
            if sous:
                sous[0] = duree(str(v.get("Ability", "")), index) + " " + sous[0]
                # Cases d'utilisation du bonus (ActiveBonus.XPTracker : 1 = XP gagnée sur cette utilisation).
                bonus = (index.get(str(v.get("Ability", ""))) or {}).get("ActiveBonus") or {}
                suivi = bonus.get("XPTracker") if isinstance(bonus, dict) else None
                if isinstance(suivi, list) and suivi:
                    sous.append("{Suivi_" + "".join("1" if x else "0" for x in suivi) + "}")
            lignes.extend(sous)
        elif k == "Consume":
            nom_c = str(v.get("Name", ""))
            elems = (index.get(nom_c) or {}).get("Elements") or []
            elems = [elems] if isinstance(elems, str) else list(elems)
            if not elems:
                elems = [e for e in ELEMENTS if e in nom_c]
            jeton = "".join(f"{{Consume{e}}}" for e in elems) or "{Consume}"
            lignes.append(f"{jeton} : " + nettoyer(v.get("Text"), index, nom))
        elif k == "Infuse":
            lignes.append(f"{{Create{v}}}")
        elif k in ("Conditional", "MandatoryTrigger"):
            if isinstance(v, dict):
                rendre(v.get("Layout"), ctx, lignes)
            else:
                rendre(v, ctx, lignes)
        elif k == "BlinkbladeState":
            etat = "{BBFast}" if str(v.get("State")).lower() == "fast" else "{BBSlow}"
            sous = []
            if "Text" in v:
                sous.append(nettoyer(v["Text"], index, nom))
            rendre(v.get("Layout"), ctx, sous)
            if sous:
                sous[0] = etat + " " + sous[0]
            lignes.extend(sous)
        elif k == "Summon":
            lignes.extend(rendre_invocation(v, ctx))
        elif k in ("Layout", "Top", "Bottom"):
            rendre(v, ctx, lignes)
        else:
            inconnus.add(f"élément {k} ({nom})")


# ---------- Invocations ----------

invocations = {}
for f in (RULESET / "Global/HeroSummons").glob("*.yml"):
    d = lire_yaml(f)
    if isinstance(d, dict) and "ID" in d:
        invocations[d["ID"]] = d


def rendre_invocation(v, ctx):
    index, nom = ctx["index"], ctx["nom"]
    ab = index.get(str(v.get("Ability")), {})
    data = invocations.get(ab.get("Summon"), {})
    titre = nettoyer(v.get("SummonName") or data.get("LocKey"), index, nom)
    stats = []
    for cle, jeton in (("Health", "Health"), ("Move", "Move"), ("Attack", "Attack"), ("Range", "Range"),
                       ("Shield", "Shield"), ("Retaliate", "Retaliate")):
        m = montant(data.get(cle)) if cle in data else None
        if m is not None:
            stats.append(f"{{{jeton}}}{m}")
    lignes = [f"{{Summon}} {titre} : " + " ".join(stats)]
    special = v.get("SpecialText")
    if special:
        sous = []
        rendre(special, ctx, sous)
        lignes.extend(sous)
    return lignes


# ---------- Cartes et personnages ----------

PERTE = {"Discard": "defausse", "Lost": "perte", "Permanently Lost": "perte_definitive"}


def lire_zone(code: str):
    """« 0,0,G|2,0,R » → [[0, 0, "G"], [2, 0, "R"]] (coordonnées hexagonales à pas horizontal double).
    G : votre case, R : case touchée, B : allié ou bannière, S : point d'origine, E : case vide de repère."""
    hexs = []
    for morceau in str(code).split("|"):
        p = [x.strip() for x in morceau.split(",")]
        if len(p) >= 2 and re.fullmatch(r"-?\d+", p[0]) and re.fullmatch(r"-?\d+", p[1]):
            hexs.append([int(p[0]), int(p[1]), (p[2] if len(p) > 2 else "R")[:1].upper()])
    return hexs


def zones_du_cote(data) -> list:
    """Zones d'effet d'un côté de carte, dans l'ordre, sans doublon. La variante prévue pour l'affichage
    (AreaEffectLayoutOverride) est préférée quand elle existe."""
    zones, vues = [], set()

    def parcourir(n):
        if isinstance(n, dict):
            if "AreaEffect" in n:
                code = n.get("AreaEffectLayoutOverride") or n["AreaEffect"]
                if code not in vues:
                    vues.add(code)
                    z = lire_zone(code)
                    if z:
                        zones.append(z)
            for v in n.values():
                parcourir(v)
        elif isinstance(n, list):
            for v in n:
                parcourir(v)
    parcourir(data)
    return zones


def convertir_carte(chemin: Path):
    c = lire_yaml(chemin)
    index = {}
    indexer(c.get("Data"), index)
    nom = tr(c["Name"].strip("$")[3:]) if str(c["Name"]).startswith("$FH/") else str(c["Name"])
    ctx = {"index": index, "nom": nom}
    defausse = [PERTE.get(str(x).strip(), str(x)) for x in c.get("Discard", ["Discard", "Discard"])]
    cotes = {}
    for cote, cle in (("haut", "Top"), ("bas", "Bottom")):
        lignes = []
        rendre((c.get("Layout") or {}).get(cle), ctx, lignes)
        xp = ((c.get("Data") or {}).get(cle) or {}).get("XP")
        if xp and not any("{XP" in l and "{Consume" not in l for l in lignes):
            lignes.append(f"{{XP}}{xp}")
        lignes = [l for l in lignes if l.strip()]
        while lignes and lignes[-1] == "—":
            lignes.pop()
        cotes[cote] = {"texte": lignes, "defausse": defausse[0 if cote == "haut" else 1]}
        # Zones d'effet : {ZoneAb_X} reçoit la zone de la capacité X ; le k-ième {Zone} anonyme reçoit
        # la k-ième zone trouvée dans les données de ce côté.
        zones = zones_du_cote((c.get("Data") or {}).get(cle))
        compteur = iter(range(10 ** 6))

        def zone_nommee(m):
            z = zones_du_cote(index.get(m.group(1)))
            if not z:
                inconnus.add(f"zone de {m.group(1)} ({nom})")
                return "{Zone}"
            if z[0] not in zones:
                zones.append(z[0])
            return "{Zone_%d}" % zones.index(z[0])

        texte = [re.sub(r"\{ZoneAb_([A-Za-z0-9_]+)\}", zone_nommee, l) for l in lignes]
        if zones:
            texte = [re.sub(r"\{Zone\}", lambda _m: "{Zone_%d}" % min(next(compteur), len(zones) - 1), l)
                     for l in texte]
            if not any("{Zone_" in l for l in texte):
                texte.append("{Zone_0}")  # zone présente dans les données mais pas dans la mise en page du jeu
            cotes[cote]["zones"] = zones
        cotes[cote]["texte"] = texte
    return {
        "id": c["ID"],
        "nom": nom,
        "nom_en": tr(c["Name"].strip("$")[3:], "en") if str(c["Name"]).startswith("$FH/") else nom,
        "niveau": str(c["Level"]),
        "forme": {"Melee": "melee", "Range": "distance"}.get(str(c.get("RequiredForm", ""))),
        "initiative": c["Initiative"],
        "haut": cotes["haut"],
        "bas": cotes["bas"],
    }


def nom_classe(ident: str, lang="fr") -> str:
    """Le nom court de la classe n'est pas rangé sous la même clé pour toutes les classes."""
    for cle in (ident, f"Glossary/CODEX_Hero_{ident}_Title", f"FS_Character_{ident}"):
        if cle in textes:
            return textes[cle][lang] or textes[cle]["en"]
    return ident


def convertir_personnage(dossier: Path, deblocages: dict):
    ident = dossier.name
    p = lire_yaml(dossier / f"{ident}.yml")
    cartes = [convertir_carte(f) for f in sorted((dossier / "AbilityCards").glob("*.yml"))]
    ordre = {"1": 1, "X": 1.5}
    # Tri : niveau, puis forme du Géminé (Mêlée avant Distance), puis numéro de carte.
    cartes.sort(key=lambda k: (ordre.get(k["niveau"], float(k["niveau"]) if k["niveau"].isdigit() else 99),
                               {"melee": 0, "distance": 1}.get(k.get("forme"), 2), k["id"]))
    for k in cartes:
        if k.get("forme") is None:
            k.pop("forme", None)
    return {
        "id": ident,
        "nom": nom_classe(ident),
        "nom_en": nom_classe(ident, "en"),
        "nom_complet": tr(f"{ident}_FullName"),
        "main": p["NumberAbilityCardsInBattle"],
        "pv": p["HealthTable"],
        "depart": ident in DEPART,
        "difficulte": tr(str(p.get("Difficulty", "")).strip("$")),
        "gameplay": nettoyer(tr(f"CODEX_HeroInfo_{ident}"), {}, ident),
        "histoire": nettoyer(tr(f"{ident}_DESCRIPTION"), {}, ident),
        "deblocage": deblocages.get(ident),
        "cartes": cartes,
    }


def main():
    sys.stdout.reconfigure(encoding="utf8")
    deblocages = json.loads((RACINE / "tools/deblocages.json").read_text(encoding="utf8"))
    SORTIE.mkdir(parents=True, exist_ok=True)
    resume = []
    for dossier in sorted((RULESET / "Global/Characters").iterdir()):
        if not (dossier / "AbilityCards").is_dir():
            continue
        perso = convertir_personnage(dossier, deblocages)
        (SORTIE / f"{perso['id']}.json").write_text(json.dumps(perso, ensure_ascii=False, indent=1), encoding="utf8")
        resume.append({k: perso[k] for k in ("id", "nom", "nom_en", "main", "depart")}
                      | {"cartes": len(perso["cartes"])})
    (SORTIE / "personnages.json").write_text(json.dumps(resume, ensure_ascii=False, indent=1), encoding="utf8")
    print(f"{len(resume)} personnages, {sum(r['cartes'] for r in resume)} cartes → docs/data/")
    if inconnus:
        print(f"{len(inconnus)} éléments non résolus :")
        for i in sorted(inconnus)[:80]:
            print("  ", i)
    return 0


if __name__ == "__main__":
    sys.exit(main())
