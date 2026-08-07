---
name: talabi-premium
description: Amener un écran de Talabi au niveau d'une application premium — netteté des images sur écrans haute densité, bannière d'entrée, barre de navigation, mouvement à 60 images/seconde, budget de poids. À charger avant toute retouche visuelle de platforme/ (client, livreur, admin), et dès qu'on parle de « fluide », « 4K », « premium », « ça fait cheap », « ça saccade », « c'est flou ».
---

# Talabi — le niveau premium

Ce fichier existe parce qu'une application ne paraît pas chère grâce à des
dégradés supplémentaires. Elle le paraît quand **rien ne cloche** : aucune
image floue, aucun saut de mise en page, aucune saccade, aucun temps mort sans
explication. Ce sont des défauts mesurables, pas des questions de goût — et
c'est une bonne nouvelle : on peut les traiter un par un.

## Le contexte, qui commande tout le reste

Talabi tourne à Tizi Ouzou, sur des téléphones Android d'entrée de gamme, en 4G
intermittente. Un effet qui coûte 8 images par seconde sur un Galaxy A05 n'est
pas un effet premium : c'est un défaut. Un écran d'entrée de 900 Ko n'est pas
généreux : c'est trois secondes de blanc.

**Règle d'arbitrage** : entre un effet visible et la fluidité, la fluidité
gagne toujours. Une interface sobre qui glisse sans accroc passe pour chère ;
une interface riche qui hoquette passe pour bricolée.

## Les invariants du projet — les casser annule tout le reste

- **Aucune étape de compilation.** JS et CSS natifs. Pas de framework, pas de
  bundler, pas de `npm install`.
- **`livreur/` et `admin/` sont générés** depuis `index.html` par
  `node tools/generer-applications.js`. Modifier `livreur/index.html` à la main
  est perdu à la prochaine génération. Les couleurs et le fond de démarrage de
  ces applications se règlent dans le tableau `APPS` du générateur.
- **Bump obligatoire de `VERSION` dans `sw.js`** à chaque mise en ligne, sinon
  les téléphones gardent l'ancienne version.
- **Les routes rendent dans un conteneur par affichage** et renvoient une
  fonction de nettoyage. Tout `setInterval`, tout écouteur, toute carte Leaflet
  doit y être libéré.
- **Piège du bloc conteneur** : un `transform` autre que `none` sur un ancêtre
  casse tout `position:fixed` à l'intérieur. C'est ce qui avait rendu l'écran de
  suivi plein écran entièrement blanc. Avant d'ajouter un `transform` sur un
  conteneur de page, vérifier qu'aucun descendant n'est en `fixed`.
- **Ne jamais toucher à `ORDER_SELECT`** dans `js/lib/backend-supabase.js` sans
  vérifier chaque nom de colonne dans `supabase/01_schema.sql`. Une seule
  colonne inexistante et PostgREST refuse la requête entière : **toutes** les
  commandes de l'application deviennent introuvables.
- **Les tokens existent déjà** dans `:root` de `assets/css/app.css` :
  `--brand:#FF4D2D`, `--brand-grad`, `--ink`, `--muted`, `--line:#EBE3D9`,
  `--bg:#F7EDE4`, `--cream`, `--r-sm/-r/-r-lg/-r-xl`, `--sh-1/-2/-3`,
  `--nav-h`. **Ne jamais écrire une couleur en dur** : si une teinte manque,
  ajouter un token.

## 1. La netteté des images — le défaut le plus visible

C'est presque toujours **ça** quand quelqu'un dit « c'est flou » ou demande du
« 4K ». Un téléphone moderne a un rapport de pixels de 2,6 à 3,5. Une image
affichée en pleine largeur sur un écran de 1179 pixels doit **faire au moins
1179 pixels de large**, sinon le navigateur l'agrandit et le résultat est mou.

**État mesuré du projet** (à revérifier avant de conclure) :

| Fichier | Taille réelle | Verdict |
|---|---|---|
| `assets/img/bg/entrer.jpg` | **853 × 1844** | trop petit — agrandi ~1,4× sur un écran 1179 px |
| `bg/panier-vide.png` | 830 × 430, **304 Ko** | PNG pour une illustration : WebP diviserait par 3 |
| `assets/img/` (total) | **5,5 Mo** | lourd pour de la 4G intermittente |

**La méthode**, dans cet ordre :

1. **Mesurer avant d'agir.** Ne jamais supposer :
   ```
   node -e "const b=require('fs').readFileSync('CHEMIN');console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20))"   // PNG
   ```
   Pour un JPEG, parcourir les marqueurs `0xFFC0..0xFFCF`.
2. **Viser la largeur logique × 3** pour une image plein écran (donc ~1200 px
   de large minimum, 1440 confortable, au-delà de 2160 c'est du poids perdu :
   aucun téléphone n'en profite).
3. **Servir plusieurs densités** plutôt qu'une seule énorme :
   ```css
   background-image: image-set(
     url("../img/bg/entrer.avif") type("image/avif") 1x,
     url("../img/bg/entrer@2x.avif") type("image/avif") 2x,
     url("../img/bg/entrer.jpg") 1x);
   ```
   En HTML, `<picture>` avec `srcset` et `sizes`. Toujours un `.jpg` en dernier
   recours : un vieux WebView Android ignore AVIF.
4. **AVIF ou WebP, jamais PNG pour une photo.** PNG ne se justifie que pour un
   logo à fond transparent ou un aplat.
5. **Toujours `width` et `height`** (ou `aspect-ratio` en CSS) sur chaque image,
   sinon la page saute quand elle arrive — c'est le défaut qui trahit le plus
   sûrement une application bâclée.
6. **Précharger la seule image de l'écran d'entrée**, jamais les autres :
   ```html
   <link rel="preload" as="image" href="assets/img/bg/entrer.avif">
   ```
   Et la garder dans `A_PRECHARGER` de `sw.js`.
7. **`loading="lazy"` sur tout ce qui est sous la ligne de flottaison**, et
   surtout pas sur ce qui est visible immédiatement.

## 2. La bannière d'entrée

L'écran d'ouverture est un `#splash` dans `index.html`. Pour le client et le
livreur, le logo et le sous-titre sont **masqués par CSS** et l'image
`entrer.jpg` occupe tout l'écran (`body.app-client .splash::before`).

Ce qui compte :

- **Le fond derrière l'image doit être la couleur dominante de l'image.**
  `background_color` du manifeste et `.splash{background}` valent `#100C09`
  pour cette raison : Android peint cette couleur avant que le site ne s'affiche,
  et un aplat orange suivi d'une photo sombre se voit comme une cassure.
- **`center center / cover`** en portrait ; repasser en `contain` au-delà de
  1000 px de large, sinon un écran d'ordinateur ne montre qu'une bande.
- **Une seule animation** : une opacité de 0 à 1 sur 500 ms. Pas de zoom, pas
  de parallaxe. L'écran est visible 5 secondes au maximum (`DUREE_INTRO` dans
  `js/app.js`) : tout ce qui dure plus longtemps est vu à moitié.
- **La sortie est en `opacity` et `transform`**, et l'élément est **retiré du
  DOM** après (`splash.remove()`), pas seulement masqué.

## 3. La barre de navigation

Elle est déjà soignée — capsule flottante, `backdrop-filter`,
`contain:layout paint`, `translateZ(0)`, `env(safe-area-inset-bottom)`. Ne pas
la refaire ; la respecter :

- **48 × 48 px de zone tactile minimum** par bouton, même si l'icône fait 24 px.
  En dessous, on rate sa cible en marchant.
- **`env(safe-area-inset-bottom)`** partout où une barre touche le bas, sinon
  elle passe sous la barre de gestes.
- **Le retour au toucher se fait en `transform`** : `:active{transform:scale(.94)}`
  sur 90 ms. Jamais un changement de couleur seul — trop lent à percevoir.
- **L'onglet actif doit être lisible sans la couleur** (trait, graisse, pastille) :
  un utilisateur sur trois distingue mal l'orange du gris.
- **`--nav-h`** réserve la place en bas des pages. Toute page qui défile doit
  finir par `padding-bottom: calc(var(--nav-h) + 16px)`, sinon le dernier bouton
  reste sous la barre.
- **Ne jamais animer `backdrop-filter`, `box-shadow`, `filter` ou `height`.**
  Chacun force un nouveau rendu à chaque image.

## 4. Le mouvement

- **`transform` et `opacity` exclusivement.** Tout le reste passe par la mise en
  page ou le dessin et coûte des images perdues. Pas de `top`, `left`, `width`,
  `margin`, `box-shadow`, `filter` animés.
- **Durées** : 90 ms pour un retour au toucher, 160–220 ms pour une apparition,
  300 ms pour une transition d'écran. Au-delà de 350 ms l'application paraît
  lente, pas élégante.
- **Une seule courbe** : `cubic-bezier(.22,.61,.36,1)`. Les rebonds font jouet.
- **`prefers-reduced-motion` est déjà respecté 15 fois** dans `app.css`. Toute
  nouvelle animation doit l'être aussi.
- **`will-change` uniquement pendant l'animation**, retiré après. Laissé en
  place, il consomme de la mémoire vidéo en permanence.

## 5. Ce qui trahit une application bon marché

À reconnaître et à ne pas produire :

- une image qui arrive après le texte et **décale la page**
- un bouton qui ne réagit pas au doigt pendant 200 ms
- un écran vide sans explication pendant un chargement — préférer un squelette
  (`.skel`, déjà dans le projet) ou une phrase qui dit ce qu'on attend
- un message d'erreur technique en anglais ; **tout message visible est en
  français, et dit quoi faire**
- des ombres portées épaisses et des dégradés partout : le premium est
  **sobre**, la richesse vient de la netteté et de la fluidité
- des polices chargées depuis le réseau sans `font-display:swap`
- du texte sur une photo sans voile de contraste — illisible en plein soleil,
  ce qui est la condition normale d'un livreur

## 6. Vérifier, sinon ça ne compte pas

Aucune retouche visuelle n'est terminée avant :

1. **Un vrai téléphone**, pas le simulateur du navigateur. La netteté et les
   saccades ne se voient que là.
2. **`node -e` sur les fichiers modifiés** pour la syntaxe :
   ```
   node -e "new Function(require('fs').readFileSync('js/views/X.js','utf8'))"
   ```
3. **Le poids** : `du -sh assets/img/` ne doit pas augmenter sans raison. Une
   image ajoutée doit être compensée par une conversion en AVIF/WebP ailleurs.
4. **`sw.js` VERSION incrémentée**, commit, push.
5. **Les trois applications** : une retouche de `app.css` touche le client, le
   livreur et l'administration. Vérifier que le thème sombre du livreur
   (`body.app-driver`) et celui de la console n'ont pas été abîmés.

## 7. L'ordre des travaux, si on veut le maximum d'effet

À faire dans cet ordre — le premier point apporte plus que les cinq suivants
réunis :

1. **Régénérer `entrer.jpg` en 1440 × 3120**, en AVIF avec repli JPEG, la
   précharger. C'est l'image que 100 % des utilisateurs voient, et elle est
   actuellement agrandie.
2. **Convertir les illustrations `bg/*.png` en WebP** — environ 1,5 Mo gagnés
   sur 5,5, donc autant de secondes gagnées sur la première ouverture.
3. **Vérifier chaque `<img>`** : `width`, `height`, `loading`, `decoding="async"`.
4. **Passer en revue les zones tactiles** de la barre de navigation et des
   boutons de carte.
5. **Traquer les animations hors `transform`/`opacity`** dans `app.css` et les
   convertir.
