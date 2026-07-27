# Guide d'installation — Talabi

Ce guide te fait passer du **mode démo** (qui marche déjà) à une **vraie plateforme en production**
avec base de données, comptes Google et données partagées entre tous les utilisateurs.

Compte environ **30 minutes**. Aucune ligne de code à écrire.

---

## Étape 0 — Tester tout de suite (mode démo)

Rien à installer.

1. Ouvre le dossier `platforme`
2. Double-clique sur **`index.html`**

Le site s'ouvre avec des restaurants, des menus et des commandes d'exemple.
Les données sont enregistrées **dans ton navigateur** (localStorage).

### Comptes de test (mot de passe : `123456`)

| Rôle | Email | Gère |
|---|---|---|
| Client | `client@talabi.dz` | — |
| Restaurant | `resto@talabi.dz` | **Meliza Tacos** |
| Restaurant | `pizza@talabi.dz` | Pizza Napoli |
| Restaurant | `chawarma@talabi.dz` | Chawarma House |
| Restaurant | `trad@talabi.dz` | Dar Djurdjura |
| Restaurant | `burger@talabi.dz` | Big Burger TO |
| Restaurant | `sweet@talabi.dz` | Sweet Corner |
| Restaurant | `wiam@talabi.dz` | Snack El Wiam *(en attente de validation)* |
| Livreur | `livreur@talabi.dz` | validé, Centre-ville |
| Livreur | `livreur2@talabi.dz` | *en attente de validation* |
| Administrateur | `admin@talabi.dz` | — |

> ⚠️ **Chaque restaurant a son propre compte gérant.** Si le client commande chez
> Pizza Napoli, c'est `pizza@talabi.dz` qui reçoit la commande — pas
> `resto@talabi.dz`. Le bouton 🧪 te bascule toujours sur le bon compte.

### Tester le parcours complet : le bouton 🧪

En bas à droite de l'écran, un bouton **🧪 TEST** ouvre un panneau qui permet de
**changer de compte en un clic**, sans mot de passe. C'est la bonne façon de
dérouler un scénario entier :

1. Connecte-toi en **client**, passe une commande
2. Ouvre 🧪 → il t'indique *« Le restaurant doit accepter la commande »* et te
   propose de basculer sur le bon compte restaurant
3. Accepte, prépare, signale « prête »
4. Ouvre 🧪 → il bascule sur un compte livreur, **le valide, le met en
   disponible et le rattache au bon quartier** automatiquement
5. Accepte la course, livre
6. Ouvre 🧪 → retour au client pour confirmer la réception

> ⚠️ **N'utilise pas de fenêtre de navigation privée pour tester.** En mode démo,
> les données vivent dans la mémoire du navigateur, et une fenêtre privée possède
> sa propre mémoire isolée : le livreur n'y verrait jamais la commande du client.
> Reste dans le même onglet et utilise le bouton 🧪.

**Trois conditions pour qu'un livreur voie une course** — c'est la cause n°1 de
« je ne vois rien » :

- son compte est **validé** par un administrateur ;
- son statut est **Disponible** ;
- son **quartier** est le même que celui de la commande.

Le bouton 🧪 règle ces trois points d'un coup.

**Limites du mode démo :** pas de connexion Google, pas d'email de réinitialisation,
et chaque appareil a ses propres données. C'est normal — la suite règle tout ça.

---

## Étape 1 — Créer la base de données (Supabase)

Supabase est gratuit jusqu'à un volume déjà confortable pour démarrer.

1. Va sur **https://supabase.com** → *Start your project* → connecte-toi avec GitHub ou Google
2. Clique **New project**
   - **Name** : `talabi`
   - **Database Password** : génère-en un et **garde-le dans un fichier à part**
   - **Region** : choisis **Frankfurt (eu-central-1)** — c'est la plus rapide depuis l'Algérie
3. Clique **Create new project** et attends ~2 minutes

### Créer les tables

1. Dans le menu de gauche : **SQL Editor** → **New query**
2. Ouvre le fichier `supabase/01_schema.sql`, copie **tout** le contenu, colle-le, clique **Run**
3. Nouvelle requête → même chose avec `supabase/02_security.sql` → **Run**
4. Nouvelle requête → même chose avec `supabase/03_seed.sql` → **Run**
5. Nouvelle requête → même chose avec `supabase/05_tracking.sql` → **Run**
   *(permet au client de suivre son livreur en direct)*

Tu dois voir `Success. No rows returned` à chaque fois.

Vérifie dans **Table Editor** que tu as bien les tables : `profiles`, `restaurants`,
`menu_items`, `orders`, `order_items`, `drivers`, `zones`, `categories`,
`addresses`, `notifications`, `platform_settings`.

**Ce que font ces 3 fichiers :**

| Fichier | Rôle |
|---|---|
| `01_schema.sql` | Crée les 12 tables et leurs relations |
| `02_security.sql` | Sécurité par ligne (RLS) : chaque rôle ne voit que ce qui le concerne, notifications automatiques, attribution des courses sans conflit |
| `03_seed.sql` | Les 14 quartiers de la ville de Tizi Ouzou, les 9 catégories, le stockage des images |
| `05_tracking.sql` | Position du livreur + fonction `driver_position` qui n'ouvre le suivi qu'au client concerné, et seulement pendant la livraison |

> **Tu avais déjà installé la base avant l'ajout des cartes ?**
> Lance en plus `supabase/04_geoloc.sql` (positions GPS) puis
> `supabase/05_tracking.sql` (suivi du livreur en direct). Ils ajoutent des
> colonnes sans toucher à tes données. Sur une nouvelle installation, seul
> `05_tracking.sql` reste utile : il crée la fonction `driver_position`.

---

## Étape 2 — Récupérer les clés

1. Menu de gauche → **Project Settings** (l'engrenage) → **API**
2. Note ces deux valeurs :
   - **Project URL** → ressemble à `https://abcdefghijkl.supabase.co`
   - **anon public** (sous *Project API keys*) → une longue chaîne commençant par `eyJ...`

> ⚠️ Ne copie **jamais** la clé `service_role`. Elle contourne toute la sécurité.
> La clé `anon public` est faite pour être dans le site : c'est la RLS de l'étape 1 qui protège les données.

3. Ouvre **`config.js`** à la racine du projet et remplis les deux lignes :

```js
SUPABASE_URL:      'https://abcdefghijkl.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
```

Enregistre. Le site quitte automatiquement le mode démo.

> À partir de maintenant, ouvrir `index.html` par double-clic ne suffit plus :
> il faut un serveur web. Voir l'étape 5. Pour tester en local tout de suite :
> ouvre un terminal dans le dossier `platforme` et lance `npx serve` puis va sur
> l'adresse affichée (`http://localhost:3000`).

---

## Étape 3 — Activer la connexion Google

### 3.1 Créer les identifiants chez Google

1. Va sur **https://console.cloud.google.com**
2. En haut, crée un projet (**New Project**) nommé `Talabi`
3. Menu → **APIs & Services** → **OAuth consent screen**
   - **User Type** : *External* → **Create**
   - **App name** : `Talabi`
   - **User support email** : ton email
   - **Developer contact** : ton email
   - **Save and Continue** jusqu'au bout, puis **Back to Dashboard**
   - Clique **Publish App** (sinon seuls les comptes de test peuvent se connecter)
4. Menu → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
   - **Application type** : *Web application*
   - **Name** : `Talabi Web`
   - **Authorized JavaScript origins** — ajoute :
     - `http://localhost:3000`
     - `https://ton-site.vercel.app` *(l'adresse de l'étape 5)*
   - **Authorized redirect URIs** — ajoute l'adresse suivante, où `abcdefghijkl`
     est l'identifiant de ton projet Supabase :
     - `https://abcdefghijkl.supabase.co/auth/v1/callback`
   - **Create**
5. Google affiche un **Client ID** et un **Client Secret** → copie-les

### 3.2 Brancher Google sur Supabase

1. Supabase → **Authentication** → **Providers** → **Google**
2. Active l'interrupteur **Enable Sign in with Google**
3. Colle le **Client ID** et le **Client Secret**
4. **Save**

### 3.3 Autoriser ton site à recevoir les redirections

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL** : `https://ton-site.vercel.app`
3. **Redirect URLs** : ajoute une ligne par adresse
   - `http://localhost:3000`
   - `https://ton-site.vercel.app`
4. **Save**

Le bouton « Continuer avec Google » fonctionne maintenant.

---

## Étape 4 — Configurer les emails et créer l'administrateur

### 4.1 Confirmation d'email

Par défaut, Supabase envoie un email de confirmation à chaque inscription.

- **Pour tester rapidement** : *Authentication* → *Providers* → *Email* → décoche
  **Confirm email** → *Save*. Les comptes sont actifs immédiatement.
- **En production** : garde-la activée. Les emails gratuits de Supabase sont
  limités à quelques envois par heure ; pour un vrai lancement, branche un service
  d'envoi dans *Project Settings → Authentication → SMTP Settings*
  (Resend, Brevo ou Mailgun ont tous une offre gratuite).

### 4.2 Traduire les emails en français

*Authentication* → *Email Templates* → modifie **Confirm signup** et **Reset password**.
Tu peux y mettre ton propre texte et le logo de la plateforme.

### 4.3 Te créer un compte administrateur

Personne ne peut devenir admin depuis le site — c'est volontaire.

1. Inscris-toi normalement sur ton site (n'importe quel rôle)
2. Supabase → **SQL Editor** → nouvelle requête :

```sql
update public.profiles set role = 'admin' where email = 'ton-email@gmail.com';
```

3. **Run**, puis déconnecte-toi / reconnecte-toi sur le site

Tu as maintenant accès au tableau de bord administrateur, où tu valides les
restaurants et les livreurs qui s'inscrivent.

---

## Étape 5 — Mettre le site en ligne

### Option A — Vercel (recommandé, gratuit, HTTPS inclus)

1. Crée un dépôt sur **https://github.com** et envoie-y le dossier `platforme`
2. Va sur **https://vercel.com** → connecte-toi avec GitHub → **Add New… → Project**
3. Sélectionne ton dépôt
   - **Framework Preset** : *Other*
   - **Root Directory** : `platforme` (si le dépôt contient d'autres dossiers)
   - Laisse les commandes de build vides — c'est un site statique
4. **Deploy** → tu obtiens une adresse `https://talabi-xxxx.vercel.app`
5. **Reviens à l'étape 3.1 et 3.3** et ajoute cette adresse dans Google et Supabase

À chaque `git push`, le site se met à jour tout seul.

### Option B — Netlify

Va sur **https://app.netlify.com/drop** et glisse-dépose le dossier `platforme`. C'est tout.

### Option C — GitHub Pages

Dépôt → *Settings* → *Pages* → *Deploy from a branch* → `main` / `/root`.
L'adresse sera `https://ton-pseudo.github.io/talabi/`.

### Nom de domaine personnalisé

Sur Vercel ou Netlify : *Settings → Domains → Add domain*. Tu peux acheter un `.dz`
auprès du NIC.dz, ou un `.com` chez Namecheap / OVH. Pense à ajouter le nouveau
domaine dans Google (étape 3.1) et Supabase (étape 3.3).

---

## Étape 6 — Adapter la plateforme à ton activité

### Dans `config.js`

```js
APP_NAME: 'Talabi',                  // le nom affiché partout
APP_TAGLINE: '…',                    // le slogan sur la page d'accueil
SUPPORT_PHONE: '+213 555 00 00 00',  // ton numéro d'assistance
DEFAULT_DELIVERY_FEE: 200,           // frais de livraison par défaut
COMMISSION_RATE: 0.10,               // ta commission (10 %)
DEFAULT_WILAYA: 'Tizi Ouzou'
```

### Depuis le tableau de bord administrateur (`/a/settings`)

Une fois connecté en admin, tu peux modifier sans toucher au code :

- **Commission de la plateforme** et **part du livreur** sur les frais de livraison
- **Quartiers de livraison** — ajoute, renomme ou retire des quartiers de la ville
  au fur et à mesure que tu couvres le terrain
- **Catégories de nourriture** — ajoute-en, supprime celles qui ne servent pas

### Couleurs et identité visuelle

Ouvre `assets/css/app.css` et modifie les toutes premières lignes :

```css
--brand:#FF4D2D;        /* couleur principale */
--brand-grad:linear-gradient(135deg,#FF6A3D 0%,#FF3D2E 55%,#E62E5C 100%);
```

Tout le site suit automatiquement.

---

## Comment ça marche, côté métier

```
CLIENT                RESTAURANT              LIVREUR
──────                ──────────              ───────
passe commande  ───►  reçoit une alerte
                      accepte
                      prépare
                      signale « prête »  ───►  voit la course dans sa zone
                                               accepte (le 1er qui clique)
                                               récupère au restaurant
reçoit           ◄────────────────────────     livre et encaisse
confirme la réception
```

Le client suit chaque étape en direct depuis son espace, et les trois parties
reçoivent une notification à chaque changement.

**Répartition de l'argent sur une commande de 1 400 DA** (1 200 de plats + 200 de livraison,
avec les réglages par défaut) :

| Qui | Combien |
|---|---|
| Restaurant | 1 080 DA (1 200 − 10 % de commission) |
| Livreur | 160 DA (80 % des frais de livraison) |
| Plateforme | 160 DA (120 de commission + 40 sur la livraison) |

---

## Problèmes courants

| Symptôme | Cause et solution |
|---|---|
| « Mode démonstration actif » alors que j'ai rempli `config.js` | Une des deux valeurs est vide ou mal collée. Vide le cache (Ctrl+Maj+R). |
| Le bouton Google ouvre une page d'erreur `redirect_uri_mismatch` | L'adresse `https://…supabase.co/auth/v1/callback` n'est pas dans *Authorized redirect URIs* chez Google (étape 3.1). |
| Après Google, je reviens sur le site mais pas connecté | Ton adresse n'est pas dans *Redirect URLs* de Supabase (étape 3.3). |
| « Confirme d'abord ton email » | Va voir tes emails, ou désactive *Confirm email* (étape 4.1). |
| Je m'inscris mais rien n'apparaît dans `profiles` | Le fichier `02_security.sql` n'a pas été exécuté — c'est lui qui crée le profil automatiquement. |
| « Action non autorisée pour votre compte » | La sécurité RLS fait son travail : le rôle du compte ne permet pas cette action. |
| Le livreur ne voit aucune course | Trois conditions : compte **validé** par l'admin, statut **Disponible**, et **même quartier** que la commande. |
| Le restaurant ne reçoit pas la commande | Tu es sur le mauvais compte gérant. Chaque restaurant a le sien : une commande chez Pizza Napoli arrive chez `pizza@talabi.dz`, pas chez `resto@talabi.dz`. Le bouton 🧪 indique le bon compte. |
| La carte reste grise / ne s'affiche pas | Pas de connexion internet : les fonds de carte viennent d'OpenStreetMap. Un bouton de secours permet quand même d'enregistrer la position GPS. |
| « Autorisez l'accès à votre position » | Le navigateur bloque le GPS. Clique sur le cadenas 🔒 à gauche de l'adresse → Autoriser la position. Sur Chrome, le GPS ne marche pas toujours en ouvrant le fichier par double-clic : passe par `npx serve` ou le site en ligne. |
| Le bouton « Y aller » n'apparaît pas chez le livreur | Le restaurant n'a pas placé sa position sur la carte, ou le client a une vieille adresse sans GPS. |
| Le client ne voit pas son livreur sur la carte | Le livreur doit avoir autorisé la localisation sur son téléphone. Un bandeau « Activer » s'affiche dans son espace *Ma livraison*. Tant qu'il n'a rien partagé, le client lit « Position pas encore partagée ». |
| Le suivi s'arrête après la livraison | C'est voulu : la position d'un livreur n'est visible que pendant sa course, et uniquement par le client concerné. |
| Les images ne s'envoient pas | Le bucket `media` n'existe pas — relance `03_seed.sql`. |
| Rien ne s'affiche, page blanche | Ouvre la console (F12). Si tu vois une erreur CORS, c'est que tu as ouvert `index.html` par double-clic alors que Supabase est configuré : utilise `npx serve`. |

---

## Ce qui reste à prévoir pour un vrai lancement

La plateforme est fonctionnelle telle quelle. Voici ce qui viendra ensuite,
dans l'ordre d'utilité :

1. **Notifications push** — l'architecture est prête (table `notifications` +
   Realtime). Il reste à brancher un service Web Push ou Firebase Cloud Messaging.
2. **Itinéraire tracé sur la carte** — aujourd'hui le client voit le livreur
   avancer et la distance restante ; afficher le tracé de la route demanderait
   un service de calcul d'itinéraire (OSRM ou GraphHopper, gratuits).
3. **Paiement en ligne** (SATIM / CIB / Edahabia) — aujourd'hui tout est en
   paiement à la livraison, ce qui reste le mode dominant en Algérie.
4. **Notes et avis clients** — les colonnes `rating` et `rating_count` existent
   déjà sur `restaurants` et `drivers`.
5. **Application mobile** — le site est déjà utilisable comme application depuis
   le navigateur (« Ajouter à l'écran d'accueil »). Une vraie app native
   demanderait un projet séparé.
