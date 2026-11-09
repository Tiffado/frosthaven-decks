"""Change le numéro de version des fichiers du site (style.css, cartes.js, app.js) dans docs/index.html.

À lancer avant chaque commit qui modifie le CSS ou le JavaScript : les navigateurs rechargent alors ces fichiers
au lieu de garder l'ancienne version en cache. Les données JSON, elles, sont revalidées à chaque visite.
"""
import re
import time
from pathlib import Path

page = Path(__file__).resolve().parent.parent / "docs/index.html"
version = time.strftime("%Y%m%d%H%M")
texte = re.sub(r'((?:style\.css|cartes\.js|app\.js)\?v=)[0-9A-Za-z]+', r"\g<1>" + version, page.read_text(encoding="utf8"))
page.write_text(texte, encoding="utf8")
print(f"version {version}")
