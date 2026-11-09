# Frosthaven : cartes et decks

Site statique de fan (non officiel) pour le jeu vidéo **Frosthaven** (accès anticipé Steam) :

- un bouton par personnage, avec le style de jeu, la taille de main, les points de vie et la difficulté ;
- toutes les cartes de chaque personnage : actions du haut et du bas, initiative, niveau, perte ou défausse ;
- un **simulateur de deck** : niveau 1 à 9, une carte ajoutée à chaque montée de niveau, composition d'une main
  limitée par la taille de main, bilan (pertes, effets persistants, initiatives) et lien de partage ;
- les classes à débloquer masquées derrière un avertissement de spoiler, avec un bouton « Comment le débloquer ? ».

Les cartes sont dessinées par le site : pictogrammes SVG originaux (`docs/cartes.js`), valeurs en gras, initiative au centre, pertes en rouge. Ce ne sont ni les images ni les icônes du jeu.

Le site est dans `docs/` (HTML, CSS, JavaScript sans dépendance), prêt pour GitHub Pages (branche `main`,
dossier `/docs`).

## Règles du deck (Frosthaven)

Vérifiées dans les données du jeu : chaque classe a ses cartes de niveau 1 et de niveau X (pool de départ), puis
deux cartes par niveau de 2 à 9. À chaque montée de niveau, on ajoute une carte de son nouveau niveau ou d'un niveau
inférieur. La taille de main dépend de la classe (de 8 à 14 cartes).

## Voir le site en local

```bash
python -m http.server 8765 --bind 127.0.0.1 --directory docs
```

Puis ouvrir <http://127.0.0.1:8765>. Ouvrir `index.html` directement ne marche pas : le navigateur bloque le
chargement des fichiers JSON.

## Régénérer les données depuis le jeu installé

Les données viennent des fichiers du jeu Steam installé (lecture seule). Les fichiers intermédiaires vont dans
`tmp/`, qui n'est pas versionné.

```bash
python tools/extract_ruleset.py   # règles du jeu (YAML) → tmp/ruleset/
python tools/extract_textes.py    # textes anglais et français → tmp/textes.json
python tools/convertir.py         # → docs/data/*.json
```

Le chemin du jeu par défaut est `F:/SteamLibrary/steamapps/common/Frosthaven/Frosthaven_Data`. Un autre chemin peut
être passé en argument aux deux scripts d'extraction. `tools/deblocages.json` contient les conditions de déblocage,
rédigées à partir des scénarios et des événements du jeu. `tools/unityfs.py` lit les paquets Unity compressés ; il a
servi à vérifier que les lignes manquantes (voir plus bas) ne s'y trouvent pas.

## Limites connues

- Environ 270 lignes de texte de cartes (sur 198 cartes) sont référencées par le jeu mais absentes de ses tables de
  traduction locales. Le site les signale par « ⚠ texte absent des données du jeu ».
- Les zones d'effet sont dessinées à partir des coordonnées du jeu (AreaEffect) ; une seule carte n'en a pas dans les données.
- Les données suivent la version installée du jeu et peuvent changer avec les mises à jour.

## Droits

*Frosthaven* et ses textes appartiennent à Cephalofair Games (jeu de plateau) et à Snapshot Games (jeu vidéo). Ce
site gratuit, sans publicité et sans affiliation, ne reproduit aucune image officielle. Il ne garde que le texte
nécessaire pour planifier ses decks. Sur demande des ayants droit, le contenu sera retiré.
