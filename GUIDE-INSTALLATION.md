# Guide d'installation — Talabi

Talabi fonctionne **uniquement en ligne**, sur une vraie base de données partagée.
Il n'y a pas de mode démonstration : tant que `config.js` n'est pas rempli,
l'application affiche « Base de données non configurée » et s'arrête.

Ce guide t'emmène de zéro à une plateforme en service. Compte environ
**30 minutes**. Aucune ligne de code à écrire.

**Le chemin le plus court :**

| Étape | Ce que tu fais | Durée |
|---|---|---|
| 1 | Créer le projet Supabase et exécuter `supabase/00_installation.sql` | 10 min |
| 2 | Coller les 2 clés dans `config.js` | 2 min |
| 3 | *(optionnel)* Activer la connexion Google | 10 min |
| 4 | Créer ton compte, puis exécuter `supabase/admin.sql` | 3 min |
| 5 | Mettre le site en ligne | 5 min |

---

## Étape 1 — Créer la base de données (Supabase)

Supabase est gratuit jusqu'à un volume déjà confortable pour démarrer.

1. Va sur **https://supabase.com** → *Start your project* → connecte-toi avec GitHub ou Google
2. Clique **New project**
   - **Name** : `talabi`
   - **Database Password** : génère-en un et **garde-le dans un fichier à part**
   - **Region** : choisis **Frankfurt (eu-central-1)** — c'est la plus rapide depuis l'Algérie
3. Clique **Create new project** et attends ~2 minutes

### Créer les tables — un seul fichier

1. Dans le menu de gauche : **SQL Editor** → **New query**
2. Ouvre le fichier **`supabase/00_installation.sql`** avec le Bloc-notes,
   sélectionne **tout** (Ctrl+A), copie (Ctrl+C), colle dans la fenêtre Supabase
3. Clique **Run** (ou Ctrl+Entrée)

Tu dois voir `Success. No rows returned`. C'est tout : ce fichier contient les
neuf scripts (`01` à `09`) déjà mis dans le bon ordre.

Vérifie dans **Table Editor** que tu as bien les tables : `profiles`, `restaurants`,
`menu_items`, `menu_variants`, `menu_options`, `orders`, `order_items`, `drivers`,
`zones`, `categories`, `addresses`, `notifications`, `platform_settings`.

**Ce que fait chaque partie :**

| Partie | Rôle |
|---|---|
| `01_schema` | Les tables et leurs relations |
| `02_security` | Sécurité par ligne (RLS) : chaque rôle ne voit que ce qui le concerne, notifications automatiques, attribution des courses sans conflit |
| `03_seed` | Les 14 quartiers de la ville de Tizi Ouzou, les catégories, le stockage des images |
| `04_geoloc` | Positions GPS des restaurants et des adresses |
| `05_tracking` | Position du livreur + fonction `driver_position` qui n'ouvre le suivi qu'au client concerné, et seulement pendant la livraison |
| `06_categories` | Pastilles illustrées des catégories |
| `07_formats` | Formats des plats (Solo/Menu, Small/Méga…) |
| `08_phone_lock` | Téléphone figé 30 jours, contrôlé en base |
| `09_delais` | Les minuteurs : 5 min au restaurant pour répondre, 30 s au livreur, puis passage automatique au livreur suivant |

> **Tu avais déjà installé la base avant ces évolutions ?** Exécute quand même
> `00_installation.sql` : il est **rejouable sans risque**, il ne supprime aucune
> donnée et n'ajoute que ce qui manque.

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

Enregistre. L'application démarre maintenant sur ta base de données.

> ⚠️ **Ouvrir `index.html` par double-clic ne suffit plus** : il faut un serveur
> web (le GPS et l'installation sur téléphone l'exigent). Le plus simple est de
> passer directement par le site en ligne — étape 5. Pour tester en local :
> ouvre un terminal dans le dossier `platforme`, lance `npx serve`, puis va sur
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

## Étape 4 — Créer l'administrateur

### 4.1 L'inscription se fait uniquement par Google

Il n'y a plus de formulaire email + mot de passe. On entre par **Continuer avec
Google**, et c'est Google qui certifie que l'adresse appartient bien à la
personne. Aucun email de confirmation n'a donc à partir, et le réglage
*Confirm email* de Supabase n'a plus d'effet sur les inscriptions.

Juste après la première connexion, l'application demande le **téléphone** et le
**quartier** — les deux choses que Google ne fournit pas et sans lesquelles on
ne peut ni livrer ni rappeler quelqu'un. Tant qu'elles manquent, toute
navigation ramène à cet écran.

> Une page de secours existe pour les comptes créés avant ce changement, qui ont
> encore un mot de passe : elle n'est liée nulle part et s'atteint en ajoutant
> `#/motdepasse` à l'adresse du site.

Configurer l'envoi d'emails (SMTP) reste utile pour la réinitialisation de mot
de passe de ces anciens comptes — voir **EMAIL-SMTP.md**. Ce n'est plus
bloquant pour ouvrir la plateforme.

### 4.2 Te créer un compte administrateur

Personne ne peut devenir admin depuis le site — c'est bloqué dans la base, pas
seulement dans le formulaire. C'est volontaire : sinon n'importe quel visiteur
s'inscrirait comme administrateur de la plateforme.

1. Connecte-toi sur ton site avec **Continuer avec Google**, et complète l'écran de bienvenue
2. Ouvre **`supabase/admin.sql`**, remplace l'email par le tien
3. Supabase → **SQL Editor** → nouvelle requête → colle le fichier → **Run**
4. La requête de vérification doit afficher ta ligne avec `role = admin`
5. Déconnecte-toi puis reconnecte-toi sur le site

Tu as maintenant accès au tableau de bord administrateur : tu valides les
restaurants et les livreurs qui s'inscrivent, tu vois toutes les commandes, le
chiffre d'affaires, et tu peux bloquer un compte.

Le fichier `admin.sql` contient aussi, en commentaires, des **requêtes de
surveillance** prêtes à l'emploi : derniers comptes créés, restaurants en attente,
livreurs et leur disponibilité, 50 dernières commandes, chiffres du jour.
Décommente celle qui t'intéresse et clique **Run**.

### 4.3 Dérouler un vrai parcours à plusieurs comptes

Il n'y a plus de bouton de bascule de compte : les données sont réelles et
partagées. Pour tester le parcours complet, utilise **plusieurs navigateurs ou
plusieurs téléphones en même temps** (par exemple Chrome pour le client, Firefox
pour le restaurant, ton téléphone pour le livreur) — la fenêtre de navigation
privée fonctionne aussi, puisque tout passe par la base de données.

1. **Client** : inscris-toi, place ton adresse sur la carte, commande
2. **Restaurant** : inscris-toi en « restaurant », crée ta fiche et ton menu.
   ⚠️ un administrateur doit **valider** le restaurant pour qu'il soit visible
3. **Livreur** : inscris-toi en « livreur », puis fais-toi **valider** par l'admin

**Trois conditions pour qu'un livreur voie une course** — c'est la cause n°1 de
« je ne vois rien » :

- son compte est **validé** par un administrateur ;
- son statut est **Disponible** ;
- son **quartier** est le même que celui de la commande.

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
SUPPORT_PHONE: '+213 792 779 320',       // ton numéro d'assistance
SUPPORT_EMAIL: 'contacttalabi@gmail.com',// ton email d'assistance
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
| « Base de données non configurée » | `SUPABASE_URL` ou `SUPABASE_ANON_KEY` est vide ou mal collée dans `config.js` (étape 2). Recharge en vidant le cache (Ctrl+Maj+R). |
| Le bouton Google ouvre une page d'erreur `redirect_uri_mismatch` | L'adresse `https://…supabase.co/auth/v1/callback` n'est pas dans *Authorized redirect URIs* chez Google (étape 3.1). |
| Après Google, je reviens sur le site mais pas connecté | Ton adresse n'est pas dans *Redirect URLs* de Supabase (étape 3.3). |
| « Confirme d'abord ton email » | Va voir tes emails, ou désactive *Confirm email* (étape 4.1). |
| Je m'inscris mais rien n'apparaît dans `profiles` | Le script `00_installation.sql` n'est pas passé en entier (c'est la partie `02_security` qui crée le profil automatiquement). Relance-le. |
| Une commande reste bloquée en « en attente » | Normal après 5 minutes : elle est refusée d'office. Ce sont les minuteurs de `09_delais`. Les délais se règlent dans *Admin → Réglages*. |
| « Action non autorisée pour votre compte » | La sécurité RLS fait son travail : le rôle du compte ne permet pas cette action. |
| Le livreur ne voit aucune course | Trois conditions : compte **validé** par l'admin, statut **Disponible**, et **même quartier** que la commande. |
| Le restaurant ne reçoit pas la commande | Tu es connecté avec le mauvais compte gérant : chaque restaurant a le sien, et la commande n'arrive que chez le gérant du restaurant choisi par le client. |
| Les images ne s'affichent pas après l'envoi | Le bucket `media` manque — relance `00_installation.sql`. |
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
