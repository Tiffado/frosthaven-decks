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
    def actif(v):
        # True, ou un dictionnaire d'enchantement ({Amount: true, ...} ou sans Amount) : l'état est appliqué.
        return v is True or (isinstance(v, dict) and v.get("Amount", True) is not False)
    trouves = [e for e in ETATS if actif(ab.get(e))]
    for cle in ("Conditions", "Condition"):
        trouves += [e for e in liste(ab.get(cle)) if e in ETATS and e not in trouves]
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
        if k in ("Heal", "Shield", "Retaliate"):
            q = qualificatif(ab)  # cible : vous-même, alliés…
            if q:
                morceaux.append(q.replace("{Reconst} ", ""))
            morceaux += [e for e in etats(ab) if e not in " ".join(morceaux)]
        else:
            for p in (portee(ab), cibles(ab)):
                if p:
                    morceaux.append(p)
            morceaux += etats(ab)
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


def tous(ab) -> bool:
    t = nombre(ab.get("Target"))
    return t is not None and (t >= 99 or t < 0)


def qualificatif(ab, genre=""):
    """Complément de cible d'une capacité déjà affichée (« sur vous-même », « sur tous les alliés »…).
    `genre` : jeton déjà affiché en début de ligne, à ne pas répéter."""
    if not isinstance(ab, dict):
        return None
    filtre = liste(ab.get("Filter"))
    morceaux = []
    if filtre == ["Self"]:
        morceaux.append("sur vous-même")
    elif set(filtre) == {"Self", "Ally"}:
        morceaux.append("sur vous et tous les {Allies}" if tous(ab) else "sur vous-même ou un {Allies}")
    elif filtre == ["Ally"]:
        morceaux.append("sur tous les {Allies}" if tous(ab) else "sur un {Allies}")
    if filtre != ["Self"]:
        r = portee(ab)
        if r:
            morceaux.append(("à " if filtre in (["Ally"], ["Self", "Ally"], ["Ally", "Self"]) else "") + r)
        if not filtre or "Enemy" in filtre:
            c = cibles(ab)
            if c:
                morceaux.append(c)
    morceaux += [e for e in etats(ab) if e != "{" + genre + "}"]
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


def decrire_interne(capacites) -> str:
    """Description jointe d'un dictionnaire de capacités internes (ordres, consommations, ombres…)."""
    if not isinstance(capacites, dict):
        return ""
    morceaux = [t for t in (texte_de(a) for a in capacites.values()) if t]
    return ", ".join(morceaux)


def decrire_special(ab):
    """Mécaniques particulières bien décrites par les données du jeu."""
    # Utilisations des bonus actifs (Vagabond)
    n = nombre(ab.get("MoveActiveBonusTracker"))
    if n:
        combien = nombre((ab.get("Vars") or {}).get("NumberOfCardsToSelect")) or 1
        de = "d'un de vos" if combien == 1 else f"de {combien} de vos"
        return (f"Récupérez une utilisation {de} bonus actifs" if n < 0
                else f"Perdez une utilisation {de} bonus actifs")
    # Jetons (temps du Vivelame, trophées du Spectre des Profondeurs)
    jetons = nombre(ab.get("Tokens"))
    drapeaux = liste(ab.get("Flags"))
    if jetons and "ModifiesTimeTokens" in drapeaux:
        return f"Gagnez {jetons}{{BBTime}}"
    if jetons and "ModifiesTrophyTokens" in drapeaux:
        return f"Gagnez {jetons}{{DWRTrophy}}"
    # Cartes perdues récupérées
    rec = ab.get("RecoverLostCards")
    if isinstance(rec, dict):
        k = nombre(rec.get("Strength")) or 1
        return f"{{Recover}} {k} de vos cartes perdues"
    # Création de terrain
    terrain = ab.get("CreateTerrain")
    if terrain:
        quoi = {"Ice": "{IceHex}", "Water": "eau"}.get(str(terrain), str(terrain))
        k = nombre(ab.get("Target")) or 1
        suite = portee(ab)
        if k < 0 or ab.get("AreaEffect"):
            return f"Créez de l'{quoi} sur les hexagones de la zone" if quoi == "eau" else \
                f"Créez {quoi} sur les hexagones de la zone"
        return f"Créez {k} {quoi if quoi != 'eau' else 'hexagone(s) d’eau'}" + (f" à {suite}" if suite else "")
    # Les attaquants ont un désavantage
    if ab.get("AttackersGainDisadvantage") is True:
        return "Les attaques qui vous ciblent ont {Disadvantage}"
    # Ordre donné à une invocation
    ordre = ab.get("ControlActor")
    if isinstance(ordre, dict):
        interne = decrire_interne(ordre.get("Abilities"))
        if interne:
            k = nombre(ab.get("Target")) or 1
            filtre = ab.get("Filter")
            filtre = liste(filtre.get("TargetType")) if isinstance(filtre, dict) else liste(filtre)
            if "OwnSummon" in filtre:
                qui = "une de vos {AA_Summon}" if k == 1 else f"{k} de vos {{AA_Summon}}"
                return f"Commandez {qui} : {interne}"
            if "Ally" in filtre:
                r = portee(ab)
                qui = "Un {Allies}" if k == 1 else f"{k} {{Allies}}"
                return f"{qui}{' à ' + r if r else ''} effectue : {interne}"
            return None  # cible du contrôle trop particulière
    # Capacité effectuée depuis une ombre (Arpenteuse des Ombres)
    ombre = ab.get("PerformFromShadow")
    if isinstance(ombre, dict):
        interne = decrire_interne(ombre.get("Abilities"))
        if interne:
            return interne
    return None


def texte_de(ab):
    """Texte (sans le marqueur) d'une capacité, en essayant les descriptions dans l'ordre."""
    if not isinstance(ab, dict) or ab.get("Null") is True or ab.get("null") is True:
        return None
    if any(str(k).startswith("Remove") for k in ab):
        return None  # retrait d'états : la liste « Conditions » désigne alors ce qui est retiré, pas infligé
    texte = (decrire_bonus(ab) or decrire_attaque(ab) or decrire_simple(ab) or decrire_degats(ab)
             or decrire_special(ab) or decrire_etats(ab))
    if not texte and isinstance(ab.get("SubAbilities"), dict):
        # Ex. invocation dont le coût est « subissez 2 dégâts » : on décrit les sous-capacités.
        texte = decrire_interne(ab["SubAbilities"]) or None
    return texte


def decrire_consommation_interne(ab, avec_element=False):
    """Consommation au format « Consume: {Elements, Abilities, XP} » (et trophées).
    `avec_element` : préfixer par l'élément consommé quand la ligne du jeu ne l'affiche pas déjà."""
    conso = ab.get("Consume")
    if not isinstance(conso, dict):
        return None
    morceaux = []
    if avec_element:
        elems = liste(conso.get("Elements") or conso.get("Element"))
        if elems:
            morceaux.append("".join(f"{{Consume{e}}}" for e in elems) + " :")
    trophees = nombre(conso.get("Trophies"))
    if trophees:
        morceaux.append(f"Dépensez {trophees}{{DWRTrophy}} :")
    interne = decrire_interne(conso.get("Abilities"))
    if interne:
        morceaux.append(interne)
    xp = nombre(conso.get("XP")) or nombre(ab.get("XP"))
    if xp:
        morceaux.append(f"{{XP{xp}}}" if xp in (1, 2) else f"{{XP}}{xp}")
    return " ".join(morceaux) if interne else None


def decrire(ab, est_consommation=False, avec_element=False):
    """Texte reconstitué pour une capacité, ou None."""
    if not isinstance(ab, dict) or ab.get("Null") is True:
        return None
    if isinstance(ab.get("Consume"), dict):
        texte = decrire_consommation_interne(ab, avec_element)
    elif est_consommation or "Elements" in ab and "AbilityOverrides" in ab:
        texte = decrire_consommation(ab)
    else:
        texte = texte_de(ab)
    return "{Reconst} " + texte if texte else None
