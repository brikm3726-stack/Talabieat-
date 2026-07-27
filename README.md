# 🛵 Talabi — Plateforme de livraison de repas

Plateforme web multi-restaurants pour le marché algérien, avec **4 espaces** :
client, restaurant, livreur et administrateur.

Mobile-first, données réelles, sécurité par rôle.

---

## Démarrer en 10 secondes

Double-clique sur **`index.html`**. Le site s'ouvre en mode démonstration avec
des restaurants, des menus et des commandes d'exemple.

Comptes de test — mot de passe `123456` :

| Rôle | Email |
|---|---|
| 🍔 Client | `client@talabi.dz` |
| 🏪 Restaurant | `resto@talabi.dz` *(gère Melyza Tacos)* |
| 🛵 Livreur | `livreur@talabi.dz` |
| ⚙️ Admin | `admin@talabi.dz` |

**Restaurants de démonstration** — cinq établissements réels de Tizi Ouzou,
chacun avec son propre compte gérant :

| Restaurant | Quartier | Compte |
|---|---|---|
| Melyza Tacos | Centre-ville | `resto@talabi.dz` |
| L'Ambassade | Centre-ville | `ambassade@talabi.dz` |
| Maison Sadoudi | El Bordj | `sadoudi@talabi.dz` |
| L'Atelier en Ville | Nouvelle Ville | `atelier@talabi.dz` |
| The Twelve | Nouvelle Ville | `twelve@talabi.dz` |

Une commande arrive uniquement chez le gérant du restaurant choisi.

**Melyza Tacos** a sa carte complète (150 plats : pizzas, tacos, burgers,
sandwichs, chicken box, bowls, salades, desserts, boissons), reprise de ses
affiches officielles. Les quatre autres n'ont encore que des exemples de départ.

### Tester le parcours complet

Le bouton **🧪 TEST** en bas à droite change de compte en un clic et t'indique
qui doit agir maintenant. Tu peux ainsi passer une commande en client, l'accepter
en restaurant et la livrer en livreur **dans le même onglet**.

> N'utilise pas de fenêtre privée en mode démo : elle a sa propre mémoire isolée
> et ne verrait pas tes commandes.

Pour passer en production (vraie base de données partagée + connexion Google) :
👉 **[GUIDE-INSTALLATION.md](GUIDE-INSTALLATION.md)**

---

## Ce que fait la plateforme

**Client** — choisit son quartier, parcourt les restaurants ouverts, filtre par
catégorie, cherche un plat, compose son panier avec suppléments, **place sa
position exacte sur une carte** (ou via le GPS du téléphone), ajoute une note
pour le livreur, puis **suit sa commande en direct** sur 7 étapes. Pendant la
livraison, il **voit son livreur avancer sur une carte**, avec la distance
restante et le temps estimé, et confirme la réception à l'arrivée.

**Restaurant** — crée sa fiche en autonomie (logo, photo de couverture, adresse,
position sur la carte, horaires, catégories) puis monte son menu lui-même :
photo de chaque plat, description, catégorie, **formats** (Solo/Menu,
Small/Medium/Méga, M/L/XL… chacun avec son propre prix) et **suppléments**
cumulables. Il reçoit ensuite les commandes, accepte ou refuse avec motif, fait
avancer le statut, et consulte son chiffre d’affaires et ses produits les plus
vendus. Personne d’autre ne peut modifier sa carte.

**Livreur** — s'inscrit, renseigne quartier et véhicule, attend la validation de
l'admin, se met disponible, voit les courses de son quartier avec **distance GPS
réelle**, montant et **gain estimé**, accepte, ouvre l'**itinéraire dans Google
Maps** d'un tap (vers le restaurant puis vers le client), appelle les deux, puis
valide la livraison. Sa position est **partagée avec le client pendant la course
uniquement**, et s'arrête automatiquement à la livraison.

**Administrateur** — valide ou refuse restaurants et livreurs, bloque des comptes,
modifie les utilisateurs, consulte toutes les commandes et statistiques, gère les
zones, les catégories et les commissions.

---

## Architecture

```
platforme/
├── index.html                 point d'entrée (application monopage)
├── config.js                  ⚙️ LES 2 CLÉS SUPABASE VONT ICI
├── assets/
│   ├── css/app.css            design system complet
│   └── img/                   logo Talabi + logos & couvertures des restaurants
│
├── supabase/                  base de données PostgreSQL
│   ├── 01_schema.sql          12 tables + relations
│   ├── 02_security.sql        RLS par rôle, triggers, notifications
│   ├── 03_seed.sql            quartiers de Tizi Ouzou ville, catégories, stockage
│   ├── 04_geoloc.sql          mise à jour GPS (bases déjà installées)
│   ├── 05_tracking.sql        suivi du livreur en direct
│   ├── 06_categories.sql      pastilles illustrées, retrait de « Poulet »
│   └── 07_formats.sql         formats des plats (Solo/Menu, Small/Méga…)
│
└── js/
    ├── app.js                 démarrage
    ├── lib/
    │   ├── utils.js           formatage DZD, dates, validations DZ
    │   ├── ui.js              toasts, modales, upload d'images
    │   ├── components.js      cartes restaurant, plats, timeline
    │   ├── mappicker.js       choix de position sur carte + GPS + Google Maps
    │   ├── livetrack.js       partage de la position du livreur pendant la course
    │   ├── testpanel.js       bouton 🧪 : changer de rôle (mode démo seulement)
    │   ├── router.js          navigation + gardes par rôle
    │   ├── shell.js           barre du haut, navigation, notifications
    │   ├── store.js           état global (profil, zone, panier)
    │   ├── api.js             point d'entrée unique
    │   ├── backend-supabase.js  ← production
    │   ├── backend-demo.js      ← mode démo (localStorage)
    │   └── demo-data.js         données d'exemple
    └── views/
        ├── landing.js  auth.js  client.js  checkout.js  tracking.js
        └── restaurant.js  driver.js  admin.js  account.js
```

**Le point clé :** `backend-supabase.js` et `backend-demo.js` exposent exactement
les mêmes méthodes. Le reste de l'application ne sait pas lequel tourne — c'est
ce qui permet de basculer de la démo à la production en remplissant deux lignes
de `config.js`.

Aucune dépendance à installer, aucune étape de compilation. Le site se déploie
tel quel sur Vercel, Netlify ou GitHub Pages.

---

## Sécurité

- **Row Level Security PostgreSQL** sur les 12 tables : un client ne peut pas
  lire les commandes d'un autre, un restaurant ne voit que les siennes, un
  livreur ne voit que les courses libres de sa zone.
- **Le rôle ne peut pas être choisi librement** : `admin` est refusé à
  l'inscription, il ne s'attribue qu'en base de données.
- **Attribution des courses atomique** (fonction `claim_order`) : deux livreurs
  qui cliquent en même temps ne peuvent pas obtenir la même commande.
- **Transitions de statut contrôlées** : un restaurant ne peut pas marquer une
  commande « livrée », un livreur ne peut pas l'accepter à la place du restaurant.
- **Échappement HTML systématique** de toute donnée saisie par un utilisateur.
- **La position d'un livreur n'est lisible que pendant sa course**, et seulement
  par le client concerné, son restaurant et l'administration (fonction SQL
  `driver_position`). Le partage s'arrête de lui-même à la livraison.

---

## Base de données

| Table | Contenu |
|---|---|
| `profiles` | Utilisateurs et leur rôle (lié à l'authentification) |
| `restaurants` | Fiches, horaires, frais, statut de validation |
| `restaurant_categories` | Catégories de chaque restaurant |
| `menu_items` | Plats : nom, prix, photo, disponibilité |
| `menu_variants` | Formats d’un plat (Solo/Menu, Small/Méga…), un seul au choix |
| `menu_options` | Suppléments payants, cumulables |
| `drivers` | Véhicule, zone, disponibilité, validation, gains |
| `addresses` | Carnet d'adresses des clients |
| `orders` | Commandes, statuts, montants, horodatage de chaque étape |
| `order_items` | Lignes de commande (figées à l'achat) |
| `notifications` | Alertes par utilisateur |
| `zones` | Communes et quartiers |
| `categories` | Types de nourriture |
| `platform_settings` | Commission, part livreur, frais par défaut |

---

## Modèle économique par défaut

Sur une commande de 1 200 DA de plats + 200 DA de livraison :

| Qui | Combien | Réglable dans |
|---|---|---|
| Restaurant | 1 080 DA | commission 10 % |
| Livreur | 160 DA | part livreur 80 % |
| Plateforme | 160 DA | — |

Modifiable à tout moment depuis le tableau de bord administrateur, sans toucher
au code.
