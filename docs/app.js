"use strict";

// Le rendu des cartes (pictogrammes, libellés, grilles) est dans cartes.js, chargé avant ce fichier.

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
    const r = await fetch(`data/${id}.json`, { cache: "no-cache" });  // revalide à chaque visite
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
  resume = await (await fetch("data/personnages.json", { cache: "no-cache" })).json();
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
  fiche.style.setProperty("--classe", COULEURS_CLASSE[p.id] || "#2f6f9f");
  fiche.replaceChildren(document.getElementById("tpl-fiche").content.cloneNode(true));
  const q = (s) => fiche.querySelector(s);
  q(".f-nom").textContent = p.nom;
  q(".f-complet").textContent = `${p.nom_complet} · ${p.nom_en}`;
  q(".f-main").textContent = `${p.main} cartes`;
  q(".f-pv").textContent = p.pv.join(" · ");
  q(".f-diff").textContent = p.difficulte;
  q(".f-nb").textContent = p.cartes.length;
  q(".f-gameplay").innerHTML = ligneHtml(p.gameplay).replace(/^<p[^>]*>|<\/p>$/g, "");
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
    el.dataset.forme = c.forme || "";
    grille.appendChild(el);
    return el;
  });
  const avecFormes = p.cartes.some((c) => c.forme);
  q(".bloc-forme").hidden = !avecFormes;
  const filtrer = () => {
    const n = sel.value;
    const f = q(".filtre-forme").value;
    const t = q(".filtre-texte").value.trim().toLowerCase();
    for (const el of elements) {
      el.hidden = (n && el.dataset.niveau !== n) || (f && el.dataset.forme !== f) || (t && !el.dataset.recherche.includes(t));
    }
  };
  sel.addEventListener("change", filtrer);
  q(".filtre-forme").addEventListener("change", filtrer);
  q(".filtre-texte").addEventListener("input", filtrer);
}

function remplirLegende(div) {
  div.innerHTML = legendeHtml();
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
  let ouvert = null;  // niveau de montée affiché en grand (null : le premier sans choix ; -1 : aucun)

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
    // Niveau ouvert : celui demandé (bouton « Changer » ou « Choisir »), sinon le premier niveau sans choix.
    if (ouvert > e.niveau) ouvert = null;
    const premierLibre = [...Array(e.niveau - 1).keys()].map((i) => i + 2).find((n) => !e.choix[n]);
    const niveauOuvert = ouvert === -1 ? null : (ouvert || premierLibre);

    for (let n = 2; n <= e.niveau; n++) {
      const bloc = document.createElement("section");
      bloc.className = "montee";
      const choisie = parId[e.choix[n]];
      const estOuvert = n === niveauOuvert;
      const tete = document.createElement("div");
      tete.className = "montee-tete";
      tete.innerHTML = `<h4>Montée au niveau ${n}</h4>` +
        (choisie ? `<span class="montee-choix">✓ ${echapper(choisie.nom)}</span>` : '<span class="montee-attente">à choisir</span>');
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.textContent = estOuvert ? (choisie ? "Fermer" : "") : (choisie ? "Changer" : "Choisir");
      bouton.hidden = !bouton.textContent;
      bouton.addEventListener("click", () => { ouvert = estOuvert ? -1 : n; rendreMontees(); });
      tete.appendChild(bouton);
      bloc.appendChild(tete);

      if (estOuvert) {
        // Candidats : les cartes du niveau n, puis celles des niveaux 2 à n−1 pas encore prises ailleurs.
        const prises = new Set(Object.entries(e.choix).filter(([k]) => Number(k) !== n).map(([, v]) => v));
        const candidats = p.cartes.filter((c) => Number(c.niveau) >= 2 && Number(c.niveau) <= n && !prises.has(c.id));
        const groupes = [["Nouvelles cartes du niveau " + n, candidats.filter((c) => Number(c.niveau) === n)],
          ["Cartes restantes des niveaux précédents", candidats.filter((c) => Number(c.niveau) < n)]];
        for (const [titre, liste] of groupes) {
          if (!liste.length) continue;
          bloc.insertAdjacentHTML("beforeend", `<p class="montee-groupe">${titre} (${liste.length})</p>`);
          const grille = document.createElement("div");
          grille.className = "grille-cartes";
          for (const c of liste) {
            const el = creerCarte(c, { cliquable: true });
            if (choisie && choisie.id === c.id) el.classList.add("en-main");
            el.title = choisie && choisie.id === c.id ? "Carte choisie (cliquer pour annuler)" : "Choisir cette carte";
            el.addEventListener("click", () => {
              if (e.choix[n] === c.id) delete e.choix[n]; else e.choix[n] = c.id;
              ouvert = null;  // passe au prochain niveau sans choix
              majTout();
            });
            grille.appendChild(el);
          }
          bloc.appendChild(grille);
        }
      } else if (choisie) {
        const grille = document.createElement("div");
        grille.className = "grille-cartes montee-resume";
        grille.appendChild(creerCarte(choisie));
        bloc.appendChild(grille);
      }
      div.appendChild(bloc);
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
    remplirGrille(q(".simu-pool"), pl, (c) => {
      const el = creerCarte(c, { cliquable: true });
      if (enMain.has(c.id)) el.classList.add("en-main");
      el.addEventListener("click", () => basculer(c.id));
      return el;
    });
    q(".simu-nb-pool").textContent = `(${pl.length} cartes)`;
    const cartesMain = e.main.map((id) => parId[id]).sort((a, b) => a.initiative - b.initiative);
    remplirGrille(q(".simu-main"), cartesMain, (c) => {
      const el = creerCarte(c, { cliquable: true });
      el.addEventListener("click", () => basculer(c.id));
      return el;
    });
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
  // Vue compacte (par défaut) : les longues phrases sont raccourcies dans le pool et la main.
  const caseDetail = q(".simu-detail");
  caseDetail.checked = stock.lire("fh-texte-complet", false);
  const appliquerVue = () => {
    for (const s of [".simu-colonnes", ".simu-montees"]) q(s).classList.toggle("compacte", !caseDetail.checked);
  };
  caseDetail.addEventListener("change", () => { stock.ecrire("fh-texte-complet", caseDetail.checked); appliquerVue(); });
  appliquerVue();
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
  let formes = "";
  if (cartes.some((c) => c.forme)) {
    // Le Géminé doit pouvoir jouer deux cartes de sa forme actuelle à chaque round (ou se reposer).
    const nb = (f) => cartes.filter((c) => c.forme === f).length;
    const m = nb("melee"), d = nb("distance");
    const alerte = [m, d].some((n) => n < 2)
      ? ` <span class="alerte">· moins de 2 cartes dans une forme : vous serez vite épuisé dans cette forme</span>` : "";
    formes = `<li>Forme <span class="forme melee">${FORMES.melee}</span> : ${m} · ` +
      `<span class="forme distance">${FORMES.distance}</span> : ${d}${alerte}</li>`;
  }
  return `<strong>${cartes.length} carte${cartes.length > 1 ? "s" : ""}</strong>` +
    (restants > 0 ? ` · encore ${restants} place${restants > 1 ? "s" : ""}` : " · main complète") +
    `<ul>${formes}<li>Actions du haut avec perte : ${pertes("haut")} · du bas : ${pertes("bas")}` +
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
