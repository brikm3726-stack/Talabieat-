# Publier Talabi sur Google Play

Les trois applications sont le même site, empaqueté trois fois (Trusted Web
Activity). Aucun code à réécrire : l'application ouvre `talabi.shop` en plein
écran, sans barre d'adresse, avec son icône.

| Application | Paquet | Ouvre |
|---|---|---|
| Talabi | `shop.talabi.client` | `https://talabi.shop/` |
| Talabi Resto | `shop.talabi.resto` | `https://talabi.shop/resto/` |
| Talabi Livreur | `shop.talabi.livreur` | `https://talabi.shop/livreur/` |

---

## 1. Deux choses à régler AVANT de téléverser

### Les empreintes de signature

`/.well-known/assetlinks.json` contient déjà trois empreintes SHA-256. Elles
sont ce qui prouve à Android que le site et l'application appartiennent à la
même personne. **Si elles ne correspondent pas à la clé qui signe réellement
l'application, la barre d'adresse de Chrome reste affichée en haut de
l'écran** — l'application a l'air d'un navigateur déguisé, et rien n'indique
pourquoi.

Aucun fichier de clé (`.jks` / `.keystore`) n'existe dans le projet. Les
empreintes actuelles viennent donc d'ailleurs, et il faut les vérifier :

1. Play Console → l'application → **Configuration → Intégrité de l'app →
   Signature de l'app**
2. Copier l'empreinte **SHA-256 du certificat de signature de l'application**
   (celle de Google, pas celle de téléversement)
3. La comparer à celle du paquet correspondant dans `assetlinks.json`, et
   remplacer si elle diffère

À refaire pour les trois paquets. C'est la cause n°1 des TWA qui s'ouvrent
avec une barre d'adresse.

### La suppression de compte

Google Play l'exige depuis 2023 pour toute application où l'on peut créer un
compte : **un moyen de supprimer son compte depuis l'application**, et **une
adresse web publique** pour le demander sans installer l'application.

Rien de tel n'existe aujourd'hui dans le projet — ni dans les vues, ni dans
`confidentialite.html`. C'est un motif de refus, pas un détail de confort.

---

## 2. Fiche du magasin — textes prêts à coller

### Talabi (client)

- **Titre** (30 max) : `Talabi — Livraison de repas`
- **Description courte** (80 max) :
  `Vos plats préférés livrés chez vous à Tizi Ouzou. Paiement à la livraison.`
- **Catégorie** : Alimentation et boissons
- **Description complète** :

> Talabi livre les repas des meilleurs restaurants de Tizi Ouzou, chez vous,
> en quelques minutes.
>
> • Parcourez les menus des restaurants de votre quartier
> • Composez votre commande, ajoutez vos suppléments
> • Suivez votre livreur en direct : où il est, ce qui lui reste à faire, et
>   l'heure à laquelle il arrive
> • Payez à la livraison, en espèces — aucune carte bancaire nécessaire
>
> Talabi est une plateforme algérienne. Les restaurants sont ceux de votre
> ville, les livreurs sont de votre quartier, et l'argent reste ici.

### Talabi Resto

- **Titre** : `Talabi Resto`
- **Description courte** :
  `Recevez vos commandes, gérez votre menu et suivez vos ventes en direct.`
- **Catégorie** : Entreprise
- **Description complète** :

> L'espace des restaurants partenaires de Talabi.
>
> • Recevez les commandes avec une sonnerie, même téléphone en poche
> • Acceptez ou refusez en un geste, avec un motif
> • Tenez votre menu à jour : plats, formats, suppléments, disponibilité
> • Suivez vos ventes du jour et de la semaine
>
> Réservé aux restaurants inscrits sur Talabi.

### Talabi Livreur

- **Titre** : `Talabi Livreur`
- **Description courte** :
  `Prenez des courses dans votre quartier, livrez et suivez vos gains.`
- **Catégorie** : Entreprise
- **Description complète** :

> L'espace des livreurs de Talabi.
>
> • Recevez les courses proches de vous, avec le gain annoncé avant d'accepter
> • Suivez votre course en plein écran : le restaurant, le client, ce qui reste
> • Appelez le restaurant ou le client en un geste
> • Suivez vos gains cumulés et votre crédit
>
> Réservé aux livreurs validés par Talabi.

---

## 3. Images demandées

| Élément | Format | État |
|---|---|---|
| Icône | 512 × 512 PNG | ✅ `assets/img/icons/icon-512.png` |
| Bandeau (feature graphic) | 1024 × 500 PNG/JPG | ❌ à créer, obligatoire |
| Captures téléphone | 2 minimum, 9:16, 1080 × 1920 | ❌ à faire, une par écran clé |

Captures conseillées pour le client : l'accueil, la fiche d'un restaurant, le
panier, le suivi en direct. Ce sont les quatre écrans qui décident d'un
téléchargement.

---

## 4. Formulaire « Sécurité des données »

Ce que Talabi collecte réellement, à déclarer tel quel — une déclaration
inexacte est un motif de retrait :

| Donnée | Qui | Pourquoi |
|---|---|---|
| Nom, téléphone | tous | joindre le client, le livreur, le restaurant |
| Adresse e-mail | tous | ouverture de session |
| Adresse de livraison | client | livrer |
| Position précise (GPS) | **livreur** | montrer au client où en est sa commande, attribuer la course la plus proche |

À cocher : données **chiffrées en transit** (tout passe en HTTPS), et
**l'utilisateur peut demander la suppression de ses données** — ce qui suppose
la porte de sortie décrite au point 1.

La position du livreur mérite une phrase honnête dans le formulaire : elle
n'est partagée que pendant une course, et le partage s'arrête quand le livreur
se met hors ligne. C'est vrai dans le code (`js/lib/livetrack.js`), autant le
dire.

---

## 5. Ce qui va prendre le plus de temps

Pour un compte **particulier** créé récemment, Google demande un test fermé
avec **12 testeurs pendant 14 jours** avant d'autoriser la production. Ce
n'est pas la vérification d'identité qui retarde un lancement, c'est ça.

Réunir douze comptes Gmail dès maintenant : famille, livreurs, restaurateurs
partenaires. Ils doivent rejoindre le test et garder l'application installée
pendant les quatorze jours.
