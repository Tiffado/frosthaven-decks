"use strict";

// Libellés français des icônes du jeu (jetons {Nom} dans les données). Classe « elem » pour les éléments.
const ELEMENTS = { Air: "Air", Fire: "Feu", Ice: "Glace", Earth: "Terre", Light: "Lumière", Dark: "Ténèbres",
  Wild: "élément au choix", Any: "élément au choix", Mixed: "élément mixte" };
const MIXTES = { A: "Air", F: "Feu", I: "Glace", E: "Terre", L: "Lumière", D: "Ténèbres" };
const ICONES = {
  Attack: "Attaque", RangedAttack: "attaque à distance", Move: "Déplacement", Range: "Portée", Target: "Cible",
  Shield: "Bouclier", Heal: "Soin", Retaliate: "Riposte", Push: "Poussée", Pull: "Attraction", Damage: "dégâts",
  Wound: "Blessure", Pierce: "Perforation", Jump: "Saut", Immobilize: "Immobilisation", Muddle: "Confusion",
  Loot: "Butin", Stun: "Étourdissement", Strengthen: "Renforcement", Poison: "Poison", Curse: "Malédiction",
  Teleport: "Téléportation", Disarm: "Désarmement", Bless: "Bénédiction", Regenerate: "Régénération",
  Ward: "Protection", Brittle: "Fragilité", Bane: "Fléau", Invisible: "Invisibilité", Flying: "Vol",
  Allies: "alliés", Enemy: "ennemis", Health: "PV", Summon: "Invocation", AA_Summon: "invocation",
  XP: "XP +", XP1: "+1 XP", XP2: "+2 XP", Persistent: "∞ Persistant", Round: "↻ Ce round",
  Zone: "zone d'effet (voir le jeu)", Advantage: "Avantage", Disadvantage: "Désavantage",
  Recover: "Récupération", RecoverIcon: "Récupération", Consume: "Coût", NullModifier: "Nul", "2x": "×2",
  HazardHex: "terrain dangereux", ObstacleHex: "obstacle", IceHex: "terrain glacé", RedHex: "hexagone ciblé",
  BlueHex: "hexagone allié", GreyHex: "hexagone", BSRedHex: "hexagone ciblé", BSYouHex: "vous",
  BBFast: "Rapide :", BBSlow: "Lent :", BBTime: "Temps",
  MMGainPressure: "+1 Pression", MMLosePressure: "−1 Pression", MMPressureOver: "Pression excessive :",
  MMPressureHigh: "Pression haute :", MMPressureRegular: "Pression normale :", MMPressureLow: "Pression basse :",
  MMSelfDamage: "dégâts à vous-même",
  HIVEMode: "Mode HIVE", HIVETransfer: "Transfert", GMMelee: "forme Mêlée", GMRanged: "forme Distance",
  GMMeleeToRanged: "passer en forme Distance", GMRangedToMelee: "passer en forme Mêlée",
  SSResonance: "Résonance", DWRTrophy: "Trophée", DWLShadow: "Ombre", CTTide: "Marée", IFInfusion: "Infusion",
  BoneShield: "Bouclier d'os", AA_Immune: "Immunité", ShieldRangedAttack: "Bouclier contre attaques à distance",
  Manquant: "⚠ texte absent des données du jeu",
};

function libelle(jeton) {
  let m;
  if ((m = jeton.match(/^(Consume|Create)(.*)$/)) && m[2]) {
    const verbe = m[1] === "Consume" ? "Consommer" : "Créer";
    let quoi = ELEMENTS[m[2]];
    const mixte = m[2].match(/^Mixed-([A-Z])([A-Z])$/);
    if (mixte) quoi = `${MIXTES[mixte[1]]} ou ${MIXTES[mixte[2]]}`;
    return { texte: `${verbe} ${quoi || m[2]}`, classe: "elem" };
  }
  if (ELEMENTS[jeton]) return { texte: ELEMENTS[jeton], classe: "elem" };
  if (ICONES[jeton]) return { texte: ICONES[jeton], classe: jeton === "Manquant" ? "manquant" : "" };
  return { texte: jeton, classe: "" };
}

const echapper = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function ligneHtml(ligne) {
  if (ligne === "—") return "<hr>";
  const html = echapper(ligne).replace(/\{([A-Za-z0-9_+\-]+)\}/g, (_, j) => {
    const l = libelle(j);
    return `<span class="ic ${l.classe}">${echapper(l.texte)}</span>`;
  });
  return `<p>${html.replace(/\n/g, "<br>")}</p>`;
}

const ETIQ_DEFAUSSE = { perte: "perte", perte_definitive: "perte définitive", defausse: "défausse" };

function actionHtml(titre, action) {
  const classe = action.defausse === "defausse" ? "defausse" : "perte";
  return `<div class="action"><div class="action-titre"><span>${titre}</span>` +
    `<span class="etiq ${classe}">${ETIQ_DEFAUSSE[action.defausse] || action.defausse}</span></div>` +
    action.texte.map(ligneHtml).join("") + "</div>";
}

function carteHtml(c) {
  return `<div class="carte-tete"><div class="carte-nom">${echapper(c.nom)}<small>${echapper(c.nom_en)}</small></div>` +
    `<div class="carte-meta"><span class="carte-init" title="Initiative">${c.initiative}</span>` +
    `<span class="carte-niv">niveau ${c.niveau}</span></div></div>` +
    actionHtml("Haut", c.haut) + actionHtml("Bas", c.bas);
}

function creerCarte(c, options = {}) {
  const el = document.createElement("article");
  el.className = "carte" + (options.cliquable ? " cliquable" : "");
  el.innerHTML = carteHtml(c);
  el.dataset.id = c.id;
  return el;
}

// ---------- Stockage local (préférences de chaque visiteur) ----------
const stock = {
  lire(cle, defaut) {
    try { const v = localStorage.getItem(cle); return v === null ? defaut : JSON.parse(v); } catch { return defaut; }
  },
  ecrire(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
};

// ---------- Chargement ----------
let resume = [];
const cache = {};
let courant = null;

async function chargerPerso(id) {
  if (!cache[id]) {
    const r = await fetch(`data/${id}.json`);
    cache[id] = await r.json();
  }
  return cache[id];
}

function boutonPerso(p) {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.id = p.id;
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `${echapper(p.nom)}<span class="main-badge">main ${p.main}</span>`;
  b.addEventListener("click", () => afficherPerso(p.id, true));
  return b;
}

function afficherSpoilers() {
  document.getElementById("avert-spoiler").hidden = true;
  document.getElementById("liste-verrou").hidden = false;
  stock.ecrire("fh-spoilers", true);
}

async function init() {
  resume = await (await fetch("data/personnages.json")).json();
  const depart = document.getElementById("liste-depart");
  const verrou = document.getElementById("liste-verrou");
  for (const p of resume) (p.depart ? depart : verrou).appendChild(boutonPerso(p));
  document.getElementById("btn-spoiler").addEventListener("click", afficherSpoilers);
  if (stock.lire("fh-spoilers", false)) afficherSpoilers();
  window.addEventListener("hashchange", lireAdresse);
  lireAdresse();
}

function lireAdresse() {
  const [id, deck] = decodeURIComponent(location.hash.slice(1)).split("/");
  const p = resume.find((r) => r.id === id);
  if (!p) return;
  if (!p.depart) afficherSpoilers();
  if (deck) {
    importerDeck(id, deck);
    history.replaceState(null, "", "#" + id);  // un rechargement ne réimporte pas le lien par-dessus les modifs
  }
  if (deck || !courant || courant.id !== id) afficherPerso(id, false, deck ? "simu" : null);
}

// ---------- Fiche personnage ----------
async function afficherPerso(id, majAdresse, onglet = null) {
  const p = await chargerPerso(id);
  courant = p;
  if (majAdresse && location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id);
  document.querySelectorAll(".boutons-perso button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.id === id)));

  const fiche = document.getElementById("fiche");
  fiche.hidden = false;
  fiche.replaceChildren(document.getElementById("tpl-fiche").content.cloneNode(true));
  const q = (s) => fiche.querySelector(s);
  q(".f-nom").textContent = p.nom;
  q(".f-complet").textContent = `${p.nom_complet} · ${p.nom_en}`;
  q(".f-main").textContent = `${p.main} cartes`;
  q(".f-pv").textContent = p.pv.join(" · ");
  q(".f-diff").textContent = p.difficulte;
  q(".f-nb").textContent = p.cartes.length;
  q(".f-gameplay").innerHTML = ligneHtml(p.gameplay).slice(3, -4);
  q(".f-histoire").textContent = p.histoire;
  if (p.deblocage) {
    q(".f-deblocage").hidden = false;
    q(".texte-debloc").textContent = p.deblocage;
    q(".btn-debloc").addEventListener("click", (e) => {
      const t = q(".texte-debloc");
      t.hidden = !t.hidden;
      e.target.textContent = t.hidden ? "Comment le débloquer ?" : "Masquer la condition";
    });
  }

  fiche.querySelectorAll(".onglets button").forEach((b) =>
    b.addEventListener("click", () => choisirOnglet(b.dataset.onglet)));
  remplirCartes(p, q);
  remplirLegende(q(".legende"));
  initSimulateur(p, q);
  choisirOnglet(onglet || stock.lire("fh-onglet", "cartes"));
  if (majAdresse) fiche.scrollIntoView({ behavior: "smooth", block: "start" });
}

function choisirOnglet(nom) {
  const fiche = document.getElementById("fiche");
  fiche.querySelectorAll(".onglets button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.onglet === nom)));
  fiche.querySelectorAll(".panneau").forEach((p) => { p.hidden = p.dataset.panneau !== nom; });
  stock.ecrire("fh-onglet", nom);
}

function niveauxDe(p) {
  return [...new Set(p.cartes.map((c) => c.niveau))];
}

function remplirCartes(p, q) {
  const sel = q(".filtre-niveau");
  for (const n of niveauxDe(p)) sel.add(new Option(`Niveau ${n}`, n));
  const grille = q(".grille-cartes");
  const elements = p.cartes.map((c) => {
    const el = creerCarte(c);
    const brut = [c.nom, c.nom_en, ...c.haut.texte, ...c.bas.texte].join(" ");
    el.dataset.recherche = brut.replace(/\{([^}]+)\}/g, (_, j) => libelle(j).texte).toLowerCase();
    el.dataset.niveau = c.niveau;
    grille.appendChild(el);
    return el;
  });
  const filtrer = () => {
    const n = sel.value;
    const t = q(".filtre-texte").value.trim().toLowerCase();
    for (const el of elements) el.hidden = (n && el.dataset.niveau !== n) || (t && !el.dataset.recherche.includes(t));
  };
  sel.addEventListener("change", filtrer);
  q(".filtre-texte").addEventListener("input", filtrer);
}

function remplirLegende(div) {
  const vus = new Set();
  for (const p of Object.values(cache)) {
    for (const c of p.cartes) for (const l of [...c.haut.texte, ...c.bas.texte]) {
      for (const m of l.matchAll(/\{([A-Za-z0-9_+\-]+)\}/g)) vus.add(m[1]);
    }
  }
  const items = [...vus].map((j) => libelle(j).texte).sort((a, b) => a.localeCompare(b, "fr"));
  div.innerHTML = [...new Set(items)].map((t) => `<div><span class="ic">${echapper(t)}</span></div>`).join("");
}

// ---------- Simulateur de deck ----------
// État par personnage : { niveau, choix: {niveauMontee: idCarte}, main: [idCarte] }
const cleDeck = (id) => "fh-deck-" + id;

function etatDeck(id) {
  const e = stock.lire(cleDeck(id), null) || {};
  return { niveau: e.niveau || 1, choix: e.choix || {}, main: e.main || [] };
}

function importerDeck(id, texte) {
  // Format du lien : n5.c12-15-20-31.m1-2-3
  const e = { niveau: 1, choix: {}, main: [] };
  for (const part of texte.split(".")) {
    if (part[0] === "n") e.niveau = Math.min(9, Math.max(1, parseInt(part.slice(1), 10) || 1));
    if (part[0] === "c") part.slice(1).split("-").forEach((v, i) => { if (v) e.choix[i + 2] = Number(v); });
    if (part[0] === "m") e.main = part.slice(1).split("-").filter(Boolean).map(Number);
  }
  stock.ecrire(cleDeck(id), e);
}

function exporterDeck(e) {
  const choix = [];
  for (let n = 2; n <= e.niveau; n++) choix.push(e.choix[n] || "");
  return `n${e.niveau}.c${choix.join("-")}.m${e.main.join("-")}`;
}

function initSimulateur(p, q) {
  const parId = Object.fromEntries(p.cartes.map((c) => [c.id, c]));
  const base = p.cartes.filter((c) => c.niveau === "1" || c.niveau === "X");
  let e = etatDeck(p.id);

  const selNiv = q(".simu-niveau");
  for (let n = 1; n <= 9; n++) selNiv.add(new Option(String(n), n));

  const sauver = () => stock.ecrire(cleDeck(p.id), e);

  function pool() {
    const choisis = [];
    for (let n = 2; n <= e.niveau; n++) if (parId[e.choix[n]]) choisis.push(parId[e.choix[n]]);
    return [...base, ...choisis];
  }

  function nettoyer() {
    // Retire les choix au-delà du niveau ou invalides, puis les cartes de main hors du pool.
    for (const k of Object.keys(e.choix)) {
      const n = Number(k);
      const c = parId[e.choix[k]];
      if (n > e.niveau || !c || !(Number(c.niveau) >= 2 && Number(c.niveau) <= n)) delete e.choix[k];
    }
    const ids = new Set(pool().map((c) => c.id));
    e.main = e.main.filter((id) => ids.has(id)).slice(0, p.main);
  }

  function rendreMontees() {
    const div = q(".simu-montees");
    div.replaceChildren();
    if (e.niveau === 1) {
      div.innerHTML = '<p class="aide">Niveau 1 : le pool contient seulement les cartes de niveau 1 et X.</p>';
      return;
    }
    for (let n = 2; n <= e.niveau; n++) {
      const lab = document.createElement("label");
      lab.textContent = `Montée au niveau ${n}`;
      const sel = document.createElement("select");
      sel.add(new Option("— choisir une carte —", ""));
      const prises = new Set(Object.entries(e.choix).filter(([k]) => Number(k) !== n).map(([, v]) => v));
      for (const c of p.cartes) {
        const nv = Number(c.niveau);
        if (!(nv >= 2 && nv <= n) || prises.has(c.id)) continue;
        sel.add(new Option(`Niv. ${c.niveau} · ${c.nom} (init. ${c.initiative})`, c.id));
      }
      sel.value = e.choix[n] ? String(e.choix[n]) : "";
      sel.addEventListener("change", () => {
        if (sel.value) e.choix[n] = Number(sel.value); else delete e.choix[n];
        majTout();
      });
      lab.appendChild(sel);
      div.appendChild(lab);
    }
  }

  function basculer(id) {
    const i = e.main.indexOf(id);
    if (i >= 0) e.main.splice(i, 1);
    else if (e.main.length < p.main) e.main.push(id);
    else { alert(`La main est pleine (${p.main} cartes). Retirez d'abord une carte.`); return; }
    majCartes();
  }

  function majCartes() {
    sauver();
    const pl = pool();
    const enMain = new Set(e.main);
    const divPool = q(".simu-pool");
    divPool.replaceChildren();
    for (const c of pl) {
      const el = creerCarte(c, { cliquable: true });
      if (enMain.has(c.id)) el.classList.add("en-main");
      el.addEventListener("click", () => basculer(c.id));
      divPool.appendChild(el);
    }
    q(".simu-nb-pool").textContent = `(${pl.length} cartes)`;
    const divMain = q(".simu-main");
    divMain.replaceChildren();
    const cartesMain = e.main.map((id) => parId[id]).sort((a, b) => a.initiative - b.initiative);
    for (const c of cartesMain) {
      const el = creerCarte(c, { cliquable: true });
      el.addEventListener("click", () => basculer(c.id));
      divMain.appendChild(el);
    }
    const nb = q(".simu-nb-main");
    nb.textContent = `(${e.main.length} / ${p.main})`;
    nb.classList.toggle("plein", e.main.length === p.main);
    q(".simu-bilan").innerHTML = bilan(cartesMain, p.main);
  }

  function majTout() {
    nettoyer();
    selNiv.value = String(e.niveau);
    rendreMontees();
    majCartes();
  }

  selNiv.addEventListener("change", () => { e.niveau = Number(selNiv.value); majTout(); });
  q(".simu-raz").addEventListener("click", () => {
    if (confirm("Effacer les choix de montée de niveau et la main de ce personnage ?")) {
      e = { niveau: 1, choix: {}, main: [] };
      majTout();
    }
  });
  q(".simu-lien").addEventListener("click", async (ev) => {
    const url = `${location.origin}${location.pathname}#${p.id}/${exporterDeck(e)}`;
    try { await navigator.clipboard.writeText(url); ev.target.textContent = "Lien copié !"; }
    catch { prompt("Copiez ce lien :", url); }
    setTimeout(() => { ev.target.textContent = "Copier le lien de ce deck"; }, 2000);
  });
  majTout();
}

function bilan(cartes, taille) {
  if (!cartes.length) return `Main vide : cliquez sur des cartes du pool (jusqu'à ${taille}).`;
  const pertes = (cote) => cartes.filter((c) => c[cote].defausse !== "defausse").length;
  const persist = cartes.filter((c) => [...c.haut.texte, ...c.bas.texte].some((l) => l.includes("{Persistent}"))).length;
  const doubles = cartes.filter((c) => c.haut.defausse !== "defausse" && c.bas.defausse !== "defausse").length;
  const inits = cartes.map((c) => c.initiative);
  const xp = cartes.filter((c) => [...c.haut.texte, ...c.bas.texte].some((l) => /\{XP/.test(l))).length;
  const restants = taille - cartes.length;
  return `<strong>${cartes.length} carte${cartes.length > 1 ? "s" : ""}</strong>` +
    (restants > 0 ? ` · encore ${restants} place${restants > 1 ? "s" : ""}` : " · main complète") +
    `<ul><li>Actions du haut avec perte : ${pertes("haut")} · du bas : ${pertes("bas")}` +
    (doubles ? ` (${doubles} carte${doubles > 1 ? "s" : ""} perdue${doubles > 1 ? "s" : ""} des deux côtés)` : "") + "</li>" +
    `<li>Cartes avec un effet persistant : ${persist}</li>` +
    `<li>Cartes qui rapportent de l'XP : ${xp}</li>` +
    `<li>Initiatives : ${Math.min(...inits)} à ${Math.max(...inits)} (moyenne ${Math.round(inits.reduce((a, b) => a + b, 0) / inits.length)})</li></ul>`;
}

init().catch((err) => {
  document.querySelector("main").insertAdjacentHTML("afterbegin",
    `<p class="spoiler">Impossible de charger les données (${echapper(String(err))}). ` +
    "Si vous ouvrez le fichier directement, lancez plutôt un petit serveur local (voir README).</p>");
});
