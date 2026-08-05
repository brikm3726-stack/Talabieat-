# Maquettes

Documents de travail, pas du code livré. Rien ici n'est chargé par
l'application : `index.html` et les trois espaces ignorent ce dossier.

## refonte-mobile.html

Refonte de l'espace client, écran par écran. Ouvrir le fichier dans un
navigateur — ou en ligne : <https://talabi.shop/maquettes/refonte-mobile.html>

| Écran | Ce qu'il montre | Fichiers concernés du dépôt |
|---|---|---|
| 1a | l'accueil **actuel**, pour comparer | `js/views/landing.js`, `assets/css/app.css` |
| 1b | l'accueil refondu | `js/views/landing.js`, `js/lib/shell.js` |
| 1c | restaurants et recherche | `js/views/client.js` (`/restaurants`) |
| 1d | fiche restaurant et menu | `js/views/client.js` (`/resto/:id`) |
| 1e | fiche plat | `js/views/client.js` (`dishSheet`) |
| 1f | panier | `js/views/client.js` (`/cart`), `js/lib/store.js` |
| 1g | commandes et compte | `js/views/account.js`, `js/views/tracking.js` |
| 1h | l'accueil en arabe (RTL) | idem 1b |
| 2a | suivi en direct, carte plein écran | `js/views/tracking.js` (`startLive`) |
| 2b | valider la commande | `js/views/checkout.js`, `js/lib/mappicker.js` |

Le design system est celui du site : `--brand:#FF4D2D`, fond crème
`#F7EDE4`, barre flottante en verre. Les images viennent de `assets/img/`
du dépôt — d'où les chemins en `../assets/`, à conserver si le fichier
change de dossier.

`support.js` est le moteur de rendu de la maquette (les balises `<x-dc>`).
Il charge React depuis unpkg.com : le fichier a donc besoin d'une
connexion pour s'afficher.

### Manque encore

L'écran **2c** — l'arrivée du livreur : « J'ai bien reçu ma commande » et la
note facultative. Il n'est toujours pas dans l'export du 4 août au soir, qui
s'arrête à 2b. À redemander à Claude Design.

### Attention aux chemins d'images

Les visuels sont référencés en `../assets/` — **dans les attributs `src` comme
dans les `url()` des styles**. Un export qui les écrit en `assets/` sans le
`../` laisse la maquette s'afficher sans une seule photo : les chemins
résolvent alors vers `maquettes/assets/`, qui n'existe pas. C'est arrivé une
fois, et ça ne se voit qu'en ouvrant la page.

### Ce que ce fichier n'est pas

Ce n'est pas du code applicatif. C'est un document rendu par son propre moteur
(`support.js`, React) : on ne le « fusionne » pas dans le projet. Chaque écran
est réécrit dans le HTML, le CSS et le JS de Talabi, un par un — la maquette
sert de référence, pas de source.
