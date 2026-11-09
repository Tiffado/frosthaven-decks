"use strict";
// Rendu visuel des cartes : pictogrammes SVG originaux (dessinés pour ce site, pas ceux du jeu),
// valeurs en gras, moitiés haut / bas séparées par l'initiative, pertes signalées en rouge.

// ---------- Pictogrammes (viewBox 24×24, couleur = currentColor) ----------
const SVG_TRAIT = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const PICTOS = {
  attaque: '<path d="M21 3l-1.2 5.3-8.6 8.6-4.1-4.1 8.6-8.6z" fill="currentColor"/>' +
    `<path d="M4.8 11.6l7.6 7.6M8.6 15.4 4.2 19.8" ${SVG_TRAIT} stroke-width="2.4"/><circle cx="3.6" cy="20.4" r="1.4" fill="currentColor"/>`,
  deplacement: '<ellipse cx="8.5" cy="8.5" rx="3" ry="4.5" fill="currentColor"/><ellipse cx="15.5" cy="15.5" rx="3" ry="4.5" fill="currentColor"/>',
  portee: `<circle cx="12" cy="12" r="9" ${SVG_TRAIT}/><circle cx="12" cy="12" r="4.5" ${SVG_TRAIT}/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>`,
  cible: `<circle cx="12" cy="12" r="6.5" ${SVG_TRAIT}/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" ${SVG_TRAIT}/>`,
  bouclier: `<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" ${SVG_TRAIT}/>`,
  riposte: `<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" ${SVG_TRAIT}/><path d="M9 11l3-3 3 3M12 8v8" ${SVG_TRAIT}/>`,
  soin: `<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" ${SVG_TRAIT}/><path d="M12 10.5v5M9.5 13h5" ${SVG_TRAIT}/>`,
  pv: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" fill="currentColor"/>',
  poussee: `<circle cx="5" cy="12" r="2.2" fill="currentColor"/><path d="M9 12h11M16 8l4 4-4 4" ${SVG_TRAIT}/>`,
  attraction: `<circle cx="5" cy="12" r="2.2" fill="currentColor"/><path d="M20 12H9.5M13.5 8l-4 4 4 4" ${SVG_TRAIT}/>`,
  saut: `<path d="M3 19C5 9 19 9 21 19" ${SVG_TRAIT}/><path d="M17.5 17 21 19.5l1-4" ${SVG_TRAIT}/>`,
  perforation: `<path d="M3 12h18M17 8l4 4-4 4" ${SVG_TRAIT}/><path d="M10 4v16" ${SVG_TRAIT} stroke-width="3"/>`,
  butin: `<circle cx="12" cy="12" r="8.5" ${SVG_TRAIT}/><circle cx="12" cy="12" r="4.5" fill="currentColor"/>`,
  teleport: `<path d="M5 18 19 6" ${SVG_TRAIT} stroke-dasharray="1 3.5"/><circle cx="5" cy="18" r="2.5" ${SVG_TRAIT}/><circle cx="19" cy="6" r="2.5" fill="currentColor"/>`,
  degats: '<path d="M12 2l1.9 5.3 5.2-2.5-2.5 5.2L22 12l-5.4 2 2.5 5.2-5.2-2.5L12 22l-1.9-5.3-5.2 2.5 2.5-5.2L2 12l5.4-2-2.5-5.2 5.2 2.5z" fill="currentColor"/>',
  xp: '<path d="M12 2.5l2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17l-5.9 3.4 1.4-6.6-5-4.5 6.7-.7z" fill="currentColor"/>',
  persistant: `<path d="M5.5 9a3 3 0 1 0 0 6c3 0 10-6 13-6a3 3 0 1 1 0 6c-3 0-10-6-13-6z" ${SVG_TRAIT}/>`,
  round: `<path d="M19.5 12.5A7.5 7.5 0 1 1 16.5 6" ${SVG_TRAIT}/><path d="M17.5 2.5V6.5h-4" ${SVG_TRAIT}/>`,
  invocation: `<circle cx="10" cy="8" r="3.2" ${SVG_TRAIT}/><path d="M4 21c0-4 2.7-7 6-7s6 3 6 7" ${SVG_TRAIT}/><path d="M19 2.5l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" fill="currentColor"/>`,
  allies: `<circle cx="8" cy="8" r="2.8" ${SVG_TRAIT}/><circle cx="16.5" cy="9" r="2.4" ${SVG_TRAIT}/><path d="M3 20c0-3.6 2.2-6 5-6s5 2.4 5 6M14 20c0-3 1.2-5.2 2.5-5.2S21 17 21 20" ${SVG_TRAIT}/>`,
  ennemi: `<path d="M5 3.5l3.5 5M19 3.5l-3.5 5" ${SVG_TRAIT}/><circle cx="12" cy="14" r="6.5" ${SVG_TRAIT}/><path d="M9.5 13h.01M14.5 13h.01" ${SVG_TRAIT} stroke-width="3"/>`,
  zone: `<path d="M12 2.5l4 2.3v4.6L12 11.7 8 9.4V4.8zM7.5 10.5l4 2.3v4.6l-4 2.3-4-2.3v-4.6zM16.5 10.5l4 2.3v4.6l-4 2.3-4-2.3v-4.6z" ${SVG_TRAIT} stroke-width="1.6"/>`,
  // Éléments
  feu: '<path d="M12 2.5c1.2 4 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-3 1.6-4.4 2.2-6.6.9 1.2 1.6 2.3 1.6 3.6 1.4-2.4 1.9-5 1.7-8z" fill="currentColor"/>',
  glace: `<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M12 3l-2 2M12 3l2 2M12 21l-2-2M12 21l2-2" ${SVG_TRAIT}/>`,
  air: `<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h6" ${SVG_TRAIT}/>`,
  terre: '<path d="M2.5 19.5l6.5-11 4.2 6.3 3-4.3 5.3 9z" fill="currentColor"/>',
  lumiere: `<circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" ${SVG_TRAIT}/>`,
  tenebres: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.2 6.2 0 0 0 10 10z" fill="currentColor"/>',
  joker: `<circle cx="12" cy="12" r="8.5" ${SVG_TRAIT}/><path d="M12 3.5v17M3.5 12h17" ${SVG_TRAIT}/>`,
  // Perte : carte barrée (dessin du site).
  perte: `<rect x="5" y="3" width="14" height="18" rx="2" ${SVG_TRAIT}/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" ${SVG_TRAIT} stroke-width="2.4"/>`,
};

// Jeton du jeu → [pictogramme, libellé, classe de couleur]. Les valeurs qui suivent (« 3 », « X ») sont mises en gras.
const PICTO_JETON = {
  Attack: ["attaque", "Attaque"], RangedAttack: ["attaque", "Attaque à distance"], Move: ["deplacement", "Déplacement"],
  Range: ["portee", "Portée"], Target: ["cible", "Cibles"], Shield: ["bouclier", "Bouclier"],
  Retaliate: ["riposte", "Riposte"], Heal: ["soin", "Soin", "c-soin"], Health: ["pv", "Points de vie", "c-soin"],
  Push: ["poussee", "Poussée"], Pull: ["attraction", "Attraction"], Jump: ["saut", "Saut"],
  Pierce: ["perforation", "Perforation"], Loot: ["butin", "Butin", "c-butin"], Teleport: ["teleport", "Téléportation"],
  Damage: ["degats", "Dégâts", "c-degats"], XP: ["xp", "Expérience", "c-xp"], XP1: ["xp", "Expérience", "c-xp"],
  XP2: ["xp", "Expérience", "c-xp"], Persistent: ["persistant", "Effet persistant", "c-bonus"],
  Round: ["round", "Effet jusqu'à la fin du round", "c-bonus"], Summon: ["invocation", "Invocation"],
  AA_Summon: ["invocation", "Invocation"], Allies: ["allies", "Alliés"], Enemy: ["ennemi", "Ennemis", "c-degats"],
  Zone: ["zone", "Zone d'effet (schéma visible dans le jeu)"],
};
const ELEM_PICTO = { Fire: "feu", Ice: "glace", Air: "air", Earth: "terre", Light: "lumiere", Dark: "tenebres",
  Wild: "joker", Any: "joker", Mixed: "joker" };
const MIXTE_CODE = { A: "Air", F: "Fire", I: "Ice", E: "Earth", L: "Light", D: "Dark" };
// États : négatifs (violet) et positifs (vert), en texte court.
const ETATS_NEG = new Set(["Wound", "Poison", "Immobilize", "Muddle", "Stun", "Disarm", "Curse", "Brittle", "Bane"]);
const ETATS_POS = new Set(["Bless", "Strengthen", "Invisible", "Regenerate", "Ward", "Advantage"]);

// Libellés en toutes lettres (recherche, légende, infobulles et jetons sans pictogramme).
const ELEMENTS = { Air: "Air", Fire: "Feu", Ice: "Glace", Earth: "Terre", Light: "Lumière", Dark: "Ténèbres",
  Wild: "élément au choix", Any: "élément au choix", Mixed: "élément mixte" };
const ICONES = {
  Attack: "Attaque", RangedAttack: "attaque à distance", Move: "Déplacement", Range: "Portée", Target: "Cible",
  Shield: "Bouclier", Heal: "Soin", Retaliate: "Riposte", Push: "Poussée", Pull: "Attraction", Damage: "dégâts",
  Wound: "Blessure", Pierce: "Perforation", Jump: "Saut", Immobilize: "Immobilisation", Muddle: "Confusion",
  Loot: "Butin", Stun: "Étourdissement", Strengthen: "Renforcement", Poison: "Poison", Curse: "Malédiction",
  Teleport: "Téléportation", Disarm: "Désarmement", Bless: "Bénédiction", Regenerate: "Régénération",
  Ward: "Protection", Brittle: "Fragilité", Bane: "Fléau", Invisible: "Invisibilité", Flying: "Vol",
  Allies: "alliés", Enemy: "ennemis", Health: "PV", Summon: "Invocation", AA_Summon: "invocation",
  XP: "XP", XP1: "+1 XP", XP2: "+2 XP", Persistent: "Persistant", Round: "Ce round",
  Zone: "zone d'effet", Advantage: "Avantage", Disadvantage: "Désavantage",
  Recover: "Récupération", RecoverIcon: "Récupération", Consume: "Coût", NullModifier: "Nul", "2x": "×2",
  HazardHex: "terrain dangereux", ObstacleHex: "obstacle", IceHex: "terrain glacé", RedHex: "hexagone ciblé",
  BlueHex: "hexagone allié", GreyHex: "hexagone", BSRedHex: "hexagone ciblé", BSYouHex: "vous",
  BBFast: "Rapide", BBSlow: "Lent", BBTime: "Temps",
  MMGainPressure: "+1 Pression", MMLosePressure: "−1 Pression", MMPressureOver: "Pression excessive",
  MMPressureHigh: "Pression haute", MMPressureRegular: "Pression normale", MMPressureLow: "Pression basse",
  MMSelfDamage: "dégâts à vous-même",
  HIVEMode: "Mode HIVE", HIVETransfer: "Transfert", GMMelee: "forme Mêlée", GMRanged: "forme Distance",
  GMMeleeToRanged: "→ forme Distance", GMRangedToMelee: "→ forme Mêlée",
  SSResonance: "Résonance", DWRTrophy: "Trophée", DWLShadow: "Ombre", CTTide: "Marée", IFInfusion: "Infusion",
  BoneShield: "Bouclier d'os", AA_Immune: "Immunité", ShieldRangedAttack: "Bouclier contre attaques à distance",
  Manquant: "⚠ texte absent des données du jeu",
};
// Jetons de condition propres à une classe : affichés comme une étiquette suivie de « : ».
const CONDITIONS = new Set(["BBFast", "BBSlow", "MMPressureOver", "MMPressureHigh", "MMPressureRegular", "MMPressureLow"]);

// Formes du Géminé : une carte ne se joue que dans sa forme (champ RequiredForm du jeu).
const FORMES = { melee: "🗡 Mêlée", distance: "🏹 Distance" };
const CLASSE_FORME = { GMMelee: "f-melee", GMRangedToMelee: "f-melee", GMRanged: "f-distance", GMMeleeToRanged: "f-distance" };
const formeHtml = (c) => c.forme ? `<span class="forme ${c.forme}" title="Forme requise">${FORMES[c.forme]}</span>` : "";

// Couleur d'accent de chaque classe (choix du site).
const COULEURS_CLASSE = {
  BannerSpear: "#b8453a", Blinkblade: "#3a7bd5", Boneshaper: "#5f8a4f", Deathwalker: "#5b5f97", Drifter: "#a0763a",
  Geminate: "#8e4f9e", CrashingTide: "#2a8c8c", Deepwraith: "#45597a", FrozenFist: "#4e9ad1", HIVE: "#8a8f2d",
  Infuser: "#c06c9a", MetalMosaic: "#8a7258", PainConduit: "#9b2d4a", Pyroclast: "#d0612a", Shattersong: "#4f9a9c",
  Snowdancer: "#6f9fc9", Trapper: "#6d8b3a",
};

const echapper = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function elementCode(nom) {
  const m = nom.match(/^Mixed-([A-Z])([A-Z])$/);
  return m ? [MIXTE_CODE[m[1]], MIXTE_CODE[m[2]]] : [nom];
}

function libelle(jeton) {
  let m;
  if ((m = jeton.match(/^(Consume|Create)(.+)$/))) {
    const verbe = m[1] === "Consume" ? "Consommer" : "Créer";
    return { texte: `${verbe} ${elementCode(m[2]).map((e) => ELEMENTS[e] || e).join(" ou ")}`, classe: "elem" };
  }
  if (ELEMENTS[jeton]) return { texte: ELEMENTS[jeton], classe: "elem" };
  if (ICONES[jeton]) return { texte: ICONES[jeton], classe: jeton === "Manquant" ? "manquant" : (CLASSE_FORME[jeton] || "") };
  return { texte: jeton, classe: "" };
}

const svg = (nom) => `<svg viewBox="0 0 24 24" aria-hidden="true">${PICTOS[nom]}</svg>`;

// Zone d'effet : hexagones « pointe en haut », coordonnées à pas horizontal double (x pair/impair selon la rangée).
// Types : G votre case, R case touchée, B allié ou bannière, S point d'origine, E case vide de repère.
const TYPES_HEX = { G: "votre case", R: "case touchée", B: "allié ou bannière", S: "point d'origine", E: "case vide" };
function zoneSvg(hexs) {
  const s = 10, w = Math.sqrt(3) * s;
  const pts = hexs.map(([x, y, t]) => [x * w / 2, y * 1.5 * s, t]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs) - w / 2 - 1, maxX = Math.max(...xs) + w / 2 + 1;
  const minY = Math.min(...ys) - s - 1, maxY = Math.max(...ys) + s + 1;
  const coin = (cx, cy) => [...Array(6).keys()].map((k) => {
    const a = Math.PI / 180 * (60 * k - 30);
    return `${(cx + s * .93 * Math.cos(a)).toFixed(1)},${(cy + s * .93 * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  const poly = pts.map(([cx, cy, t]) => `<polygon class="hex hex-${t}" points="${coin(cx, cy)}"><title>${TYPES_HEX[t] || t}</title></polygon>` +
    (t === "G" ? `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" class="hex-vous"/>` : "")).join("");
  const largeur = maxX - minX, hauteur = maxY - minY;
  // Échelle plafonnée : une grande zone reste dans 62 px de haut et 150 px de large.
  const echelle = Math.min(1.35, 62 / hauteur, 150 / largeur);
  return `<svg class="zone" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${largeur.toFixed(1)} ${hauteur.toFixed(1)}" ` +
    `style="width:${(largeur * echelle).toFixed(0)}px" role="img" aria-label="Zone d'effet">${poly}</svg>`;
}

// Un jeton (+ sa valeur éventuelle) en HTML. `zones` : zones d'effet du côté de carte, pour les jetons {Zone_k}.
function jetonHtml(jeton, valeur, zones) {
  const val = valeur ? `<b class="val">${echapper(valeur)}</b>` : "";
  let m;
  if ((m = jeton.match(/^Zone_(\d+)$/)) && zones && zones[Number(m[1])]) return zoneSvg(zones[Number(m[1])]) + val;
  if ((m = jeton.match(/^(Consume|Create)(.+)$/))) {
    const titre = libelle(jeton).texte;
    const elems = elementCode(m[2]).map((e) => `<span class="el el-${ELEM_PICTO[e] || "joker"}">${svg(ELEM_PICTO[e] || "joker")}</span>`);
    const signe = m[1] === "Consume" ? "−" : "+";
    return `<span class="pic elem-${m[1].toLowerCase()}" title="${echapper(titre)}">${elems.join("/")}` +
      `<span class="signe">${signe}</span></span>${val}`;
  }
  if (ELEM_PICTO[jeton]) {
    return `<span class="pic" title="${ELEMENTS[jeton]}"><span class="el el-${ELEM_PICTO[jeton]}">${svg(ELEM_PICTO[jeton])}</span></span>${val}`;
  }
  const p = PICTO_JETON[jeton];
  if (p) {
    const nombre = jeton === "XP1" ? "1" : jeton === "XP2" ? "2" : "";
    return `<span class="pic ${p[2] || ""}" title="${echapper(p[1])}">${svg(p[0])}</span>` +
      (nombre ? `<b class="val">${nombre}</b>` : "") + val;
  }
  const l = libelle(jeton);
  let classe = l.classe;
  if (ETATS_NEG.has(jeton)) classe = "etat-neg";
  if (ETATS_POS.has(jeton)) classe = "etat-pos";
  if (jeton.startsWith("MM")) classe = "mm";
  const suffixe = CONDITIONS.has(jeton) ? " :" : "";
  return `<span class="ic ${classe}">${echapper(l.texte + suffixe)}</span>${val}`;
}

// Pictogrammes qui ouvrent une ligne « principale » (affichée en grand si elle est courte).
const PRINCIPAUX = new Set(["Attack", "Move", "Heal", "Shield", "Retaliate", "Loot", "Teleport", "Push", "Pull", "Summon"]);

// Cases d'utilisation d'un bonus persistant : une case par utilisation, une étoile quand elle rapporte de l'XP.
function suiviHtml(code) {
  if (code.length < 2 && !code.includes("1")) return "";
  const cases = [...code].map((x) => `<span class="case-suivi${x === "1" ? " xp" : ""}">${x === "1" ? svg("xp") : ""}</span>`);
  return `<p class="suivi" title="${code.length} utilisations ; étoile : +1 XP">${cases.join("")}</p>`;
}

// Invocation : « {Summon} Nom : {Health}2 {Move}3 … » → encadré avec le nom et les caractéristiques.
function invocationHtml(ligne) {
  const m = ligne.match(/^((?:\{(?:Persistent|Round)\}\s*)*)\{Summon\}\s*(.*?)\s*:\s*(.*)$/s);
  if (!m) return null;
  // Les caractéristiques à 0 (bannière qui ne bouge ni n'attaque) sont masquées, sauf les PV.
  const brut = m[3].replace(/\{(Move|Attack|Range)\}0\b\s*/g, "");
  const stats = echapper(brut).replace(/\{([A-Za-z0-9_+\-]+)\}(\s*(?:[+−-]?\d+|X)\b)?/g, (_, j, v) => jetonHtml(j, v ? v.trim() : ""));
  const prefixe = [...m[1].matchAll(/\{(\w+)\}/g)].map((x) => jetonHtml(x[1], "")).join("");
  return `<div class="invoc"><div class="invoc-nom">${prefixe}${jetonHtml("Summon", "")} ${echapper(m[2])}</div>` +
    `<div class="invoc-stats">${stats}</div></div>`;
}

function ligneHtml(ligne, zones) {
  if (ligne === "—") return '<hr class="sep">';
  const suivi = ligne.match(/^\{Suivi_([01]+)\}$/);
  if (suivi) return suiviHtml(suivi[1]);
  const invoc = invocationHtml(ligne);
  if (invoc) return invoc;
  let classe = "";
  const debut = ligne.match(/^\{([A-Za-z0-9_]+)\}/);
  const texteSeul = ligne.replace(/\{[^}]+\}/g, "").replace(/[\d\s,+\-X:]/g, "");
  if (debut && PRINCIPAUX.has(debut[1]) && texteSeul.length < 22) classe = "principal";
  else if (texteSeul.length > 40) classe = "detail";
  const html = echapper(ligne).replace(/\{([A-Za-z0-9_+\-]+)\}(\s*(?:[+−-]?\d+|X)\b)?/g,
    (_, j, v) => jetonHtml(j, v ? v.trim() : "", zones));
  // Ligne qui n'est qu'une zone : affichée seule, centrée.
  if (/^\{Zone_\d+\}$/.test(ligne.trim())) return `<p class="ligne-zone">${html}</p>`;
  return `<p class="${classe}">${html.replace(/\n/g, "<br>")}</p>`;
}

const ETIQ_PERTE = { perte: "Perte", perte_definitive: "Perte définitive" };

// Une action : contenu centré, puis une rangée de coins (XP gagnée à gauche ; éléments créés et perte à droite).
function moitieHtml(cote, action) {
  const perdue = action.defausse !== "defausse";
  const corps = [], xp = [], creations = [];
  for (const l of action.texte) {
    const mXp = l.match(/^\{XP\}\s*(\d+)$/);
    if (mXp) { xp.push(mXp[1]); continue; }
    if (/^(\s*\{Create[A-Za-z\-]+\}\s*)+$/.test(l)) { creations.push(...l.match(/\{Create[A-Za-z\-]+\}/g)); continue; }
    corps.push(l);
  }
  while (corps.length && corps[corps.length - 1] === "—") corps.pop();
  const gauche = xp.map((n) => `<span class="coin-xp" title="Gagnez ${n} XP">${svg("xp")}<b>${n}</b></span>`).join("");
  const droite = creations.map((j) => `<span class="coin-elem">${jetonHtml(j.slice(1, -1), "")}</span>`).join("") +
    (perdue ? `<span class="coin-perte${action.defausse === "perte_definitive" ? " definitive" : ""}" ` +
      `title="${ETIQ_PERTE[action.defausse] || "Perte"} : la carte part dans les cartes perdues">${svg("perte")}</span>` : "");
  return `<section class="moitie ${cote}${perdue ? " perdue" : ""}"><div class="moitie-corps">${corps.map((l) => ligneHtml(l, action.zones)).join("")}</div>` +
    `<div class="coins"><span class="coin-g">${gauche}</span><span class="coin-d">${droite}</span></div></section>`;
}

function carteHtml(c) {
  return `<header class="carte-tete"><div class="carte-nom">${echapper(c.nom)}<small>${echapper(c.nom_en)}</small></div>` +
    `<div class="carte-meta"><span class="carte-niv">niv. ${c.niveau}</span>${formeHtml(c)}</div></header>` +
    moitieHtml("haut", c.haut) +
    `<div class="initiative" title="Initiative"><span>${c.initiative}</span></div>` +
    moitieHtml("bas", c.bas);
}

// Ajoute les cartes à une grille ; pour le Géminé, sous un titre par forme.
function remplirGrille(grille, cartes, fabriquer) {
  grille.replaceChildren();
  const formes = [...new Set(cartes.map((c) => c.forme).filter(Boolean))];
  const groupes = formes.length ? ["melee", "distance"].map((f) => [f, cartes.filter((c) => c.forme === f)]) : [[null, cartes]];
  for (const [f, liste] of groupes) {
    if (f) grille.insertAdjacentHTML("beforeend", `<h4 class="groupe-forme ${f}">Forme ${FORMES[f]} (${liste.length})</h4>`);
    for (const c of liste) grille.appendChild(fabriquer(c));
  }
}

function creerCarte(c, options = {}) {
  const el = document.createElement("article");
  el.className = "carte" + (options.cliquable ? " cliquable" : "") + (c.forme ? " forme-" + c.forme : "");
  el.innerHTML = carteHtml(c);
  el.dataset.id = c.id;
  return el;
}

// Légende : pictogrammes et libellés.
function legendeHtml() {
  const items = Object.entries(PICTO_JETON).filter(([j]) => !["AA_Summon", "XP1", "XP2", "RangedAttack"].includes(j))
    .map(([j, p]) => [jetonHtml(j, ""), p[1]]);
  for (const e of ["Fire", "Ice", "Air", "Earth", "Light", "Dark", "Wild"]) items.push([jetonHtml(e, ""), ELEMENTS[e]]);
  items.push([jetonHtml("CreateFire", ""), "Créer un élément (+)"], [jetonHtml("ConsumeFire", ""), "Consommer un élément (−)"]);
  items.push(['<span class="ic etat-neg">Blessure</span>', "État négatif infligé"], ['<span class="ic etat-pos">Renforcement</span>', "État positif"]);
  items.push([`<span class="coin-perte">${svg("perte")}</span>`, "Perte : l'action fait perdre la carte"]);
  items.push([zoneSvg([[0, 0, "G"], [2, 0, "R"], [1, 1, "R"], [3, 1, "B"], [4, 0, "E"]]),
    "Zone d'effet : gris = vous, rouge = cases touchées, bleu = allié ou bannière, pointillé = case vide"]);
  items.push([suiviHtml("101010").replace(/^<p/, "<span").replace(/<\/p>$/, "</span>"), "Utilisations d'un bonus (étoile : +1 XP)"]);
  return items.map(([h, t]) => `<div class="leg">${h}<span>${echapper(t)}</span></div>`).join("");
}
