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

L'écran **2c** — l'arrivée du livreur : « J'ai bien reçu ma commande » et
la note facultative. Il a été ajouté à la maquette après l'export utilisé
ici, il faut re-télécharger le document pour l'intégrer.
