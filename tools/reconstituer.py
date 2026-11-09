"""Rédige en français, à partir des valeurs d'une capacité du jeu, une ligne de carte absente des traductions.

Le texte produit est celui du site (pas le texte officiel) et commence par le jeton {Reconst}, affiché « ≈ ».
Renvoie None quand la capacité est trop particulière pour être décrite sans risque d'erreur.
"""

# États applicables (clés booléennes ou listes « Conditions » dans les données du jeu).
ETATS = ["Wound", "Poison", "Immobilize", "Muddle", "Stun", "Disarm", "Curse", "Brittle", "Bane",
         "Bless", "Strengthen", "Invisible", "Regenerate", "Ward"]
# Mots ignorés : animation, enchantements, réglages internes.
IGNORES = {"AnimOverload", "AnimOverload2", "MiscVars", "Vars", "SkipAnim", "AutoTrigger", "CanSkip",
           "PrintedProperties", "SquareEnhancements", "DiamondEnhancements", "MultiPassAttack", "AutoSelectValidTiles"}


def nombre(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, dict):
        for k in ("Amount", "Value"):
            if isinstance(v.get(k), (int, float)) and not isinstance(v.get(k), bool):
                return int(v[k])
    return None


def liste(v):
    if v is None:
        return []
    if isinstance(v, (list, tuple)):
        return [str(x).strip() for x in v]
    return [x.strip() for x in str(v).strip("[]").split(",") if x.strip()]


def cibles(ab) -> str:
    """« {Target}2 », « {Target} tous » ou rien."""
    t = nombre(ab.get("Target"))
    if t is None:
        return ""
    # Dans les données du jeu, 99 et -1 signifient « toutes les cibles valides ».
    return "{Target} tous" if t >= 99 or t < 0 else f"{{Target}}{t}"


def portee(ab) -> str:
    r = nombre(ab.get("Range"))
    morceaux = []
    if r is not None and r > 0:
        morceaux.append(f"{{Range}}{r}")
    rmin = nombre(ab.get("MinRange"))
    if rmin:
        morceaux.append(f"(portée minimale {rmin})")
    return " ".join(morceaux)


def etats(ab) -> list:
    """Jetons d'états infligés ou donnés par la capacité."""
    trouves = [e for e in ETATS if ab.get(e) is True]
    trouves += [e for e in liste(ab.get("Conditions")) if e in ETATS and e not in trouves]
    return [f"{{{e}}}" for e in trouves]


def sur_soi(ab) -> bool:
    return liste(ab.get("Filter")) == ["Self"]


def decrire_attaque(ab):
    a = nombre(ab.get("Attack"))
    if a is None or a <= 0:
        return None
    morceaux = [f"{{Attack}}{a}"]
    for k, jeton in (("Pierce", "Pierce"), ("Push", "Push"), ("Pull", "Pull")):
        n = nombre(ab.get(k)) or nombre((ab.get("Attack") or {}).get(k) if isinstance(ab.get("Attack"), dict) else None)
        if n:
            morceaux.append(f"{{{jeton}}}{n}")
    for p in (portee(ab), cibles(ab)):
        if p:
            morceaux.append(p)
    morceaux += etats(ab)
    if ab.get("AttackHasAdvantage") is True:
        morceaux.append("{Advantage}")
    return " ".join(morceaux)


def decrire_simple(ab):
    """Déplacement, soin, bouclier, riposte, butin, téléportation, poussée, attraction."""
    for k, jeton in (("Move", "Move"), ("Teleport", "Teleport"), ("Heal", "Heal"), ("Shield", "Shield"),
                     ("Retaliate", "Retaliate"), ("Loot", "Loot"), ("Push", "Push"), ("Pull", "Pull")):
        n = nombre(ab.get(k))
        if n is None or n <= 0:
            continue
        morceaux = [f"{{{jeton}}}{n}"]
        if k == "Move" and (ab.get("Jump") is True or (isinstance(ab.get("Move"), dict) and ab["Move"].get("Jump"))):
            morceaux.append("{Jump}")
        for p in (portee(ab), cibles(ab)):
            if p:
                morceaux.append(p)
        morceaux += etats(ab)
        if sur_soi(ab) and k in ("Heal",):
            morceaux.append("sur vous-même")
        return " ".join(morceaux)
    return None


def decrire_etats(ab):
    """Capacité qui ne fait qu'appliquer des états (à des ennemis à portée, ou à vous-même)."""
    jetons = etats(ab)
    if not jetons:
        return None
    if sur_soi(ab):
        return "Vous subissez " + ", ".join(jetons) if any(e.strip("{}") in ETATS[:9] for e in jetons) \
            else ", ".join(jetons) + " sur vous-même"
    suite = " ".join(p for p in (portee(ab), cibles(ab)) if p)
    return " ".join(jetons) + (" " + suite if suite else "")


def decrire_degats(ab):
    """Dégâts directs : à vous-même, ou aux ennemis ciblés."""
    n = nombre(ab.get("Damage"))
    if not n:
        return None
    if sur_soi(ab):
        return f"Subissez {{Damage}}{n}"
    suite = " ".join(p for p in (cibles(ab), portee(ab)) if p)
    if suite:
        return f"{suite} : les {{Enemy}} ciblés subissent {{Damage}}{n}"
    return f"Les {{Enemy}} ciblés subissent {{Damage}}{n}"


def qualificatif(ab):
    """Complément de cible d'une capacité déjà affichée (« sur vous-même », « sur un allié »…)."""
    filtre = liste(ab.get("Filter")) if isinstance(ab, dict) else []
    morceaux = []
    if filtre == ["Self"]:
        morceaux.append("sur vous-même")
    elif set(filtre) == {"Self", "Ally"}:
        morceaux.append("sur vous-même ou un {Allies}")
    elif filtre == ["Ally"]:
        morceaux.append("sur un {Allies}")
    for p in (portee(ab), cibles(ab)):
        if p:
            morceaux.append(p)
    morceaux += etats(ab)
    return "{Reconst} " + " ".join(morceaux) if morceaux else None


def decrire_bonus(ab):
    """Bonus actif (persistant ou pour le round) qui améliore vos attaques, déplacements, etc."""
    bonus = ab.get("ActiveBonus")
    if not isinstance(bonus, dict):
        return None
    comportement = str(bonus.get("Behaviour", ""))
    effets = []
    effet = ab.get("AttackEffect") or {}
    if isinstance(effet, dict):
        for k, jeton in (("Strength", "Attack"), ("Pierce", "Pierce"), ("Push", "Push"), ("Pull", "Pull")):
            n = nombre(effet.get(k))
            if n:
                effets.append(f"+{n}{{{jeton}}}" if jeton == "Attack" else f"{{{jeton}}}{n}")
    effets += etats(ab)
    if ab.get("AttackHasAdvantage") is True:
        effets.append("{Advantage}")
    if not effets:
        return None
    sujet = {"BuffAttack": "Vos attaques gagnent", "BuffMove": "Vos déplacements gagnent"}.get(comportement)
    if not sujet:
        return None
    if str(bonus.get("Duration")) == "Round":
        sujet = sujet.replace("Vos attaques", "Toutes vos attaques ce round").replace("Vos déplacements",
                                                                                        "Tous vos déplacements ce round")
    return f"{sujet} " + " et ".join(effets)


def decrire_consommation(conso):
    """Bonus obtenu en consommant un élément : modifications de la capacité parente, plus l'XP."""
    morceaux = []
    for over in (conso.get("AbilityOverrides") or {}).values():
        if not isinstance(over, dict):
            continue
        n = nombre(over.get("Strength"))
        if n:
            morceaux.append(f"+{n}{{Attack}}")
        for k, jeton in (("Range", "Range"), ("Target", "Target"), ("Pierce", "Pierce"), ("Push", "Push"),
                         ("Pull", "Pull"), ("Heal", "Heal"), ("Move", "Move"), ("Shield", "Shield")):
            n = nombre(over.get(k))
            if n:
                morceaux.append(f"{{{jeton}}}{n}")
        if over.get("AttackHasAdvantage") is True:
            morceaux.append("{Advantage}")
        morceaux += etats(over)
    xp = nombre(conso.get("XP"))
    if xp:
        morceaux.append(f"{{XP{xp}}}" if xp in (1, 2) else f"{{XP}}{xp}")
    return ", ".join(morceaux) if morceaux else None


def decrire(ab, est_consommation=False):
    """Texte reconstitué pour une capacité, ou None."""
    if not isinstance(ab, dict) or ab.get("Null") is True:
        return None
    if est_consommation or "Elements" in ab and "AbilityOverrides" in ab:
        texte = decrire_consommation(ab)
    else:
        texte = (decrire_bonus(ab) or decrire_attaque(ab) or decrire_simple(ab) or decrire_degats(ab)
                 or decrire_etats(ab))
    return "{Reconst} " + texte if texte else None
