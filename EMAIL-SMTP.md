# Faire partir les emails de Talabi

Ce fichier ne sert qu'à une chose : faire accepter l'envoi d'emails par
Supabase, pour que le **code de confirmation à 6 chiffres** fonctionne à
l'inscription.

Tout le reste est déjà en place. Le jour où l'envoi passe, il suffit de cocher
*Confirm email* et le parcours complet se réveille : écran de saisie du code,
vérification, renvoi de code. Il n'y a aucune ligne de code à écrire.

---

## Ne pas confondre les identifiants

C'est **la** cause des échecs. On manipule plusieurs jeux d'identifiants sur ce
projet, et ils se ressemblent tous. Un seul concerne l'envoi d'emails.

| Identifiant | À quoi il sert | Où il va |
|---|---|---|
| `…apps.googleusercontent.com` + son secret | Bouton « Continuer avec Google » | Supabase → Authentication → Providers → Google |
| `eyJhbGciOi…` (clé anon) | Lecture/écriture de la base par le site | `config.js` |
| **Mot de passe d'application Gmail** (16 lettres) | **Envoi des emails** | **Supabase → SMTP Settings → Password** |
| Clé SMTP Brevo (`xkeysib-…`) | Envoi des emails, si on passe par Brevo | idem |

Le champ *Username* du SMTP attend une **adresse email** (ou un identifiant
Brevo). Jamais un identifiant d'application Google.

---

## Procédure — Gmail (recommandée)

Gmail envoie jusqu'à ~500 emails par jour gratuitement. C'est largement assez
pour démarrer, et rien ne dépend d'une validation par un tiers.

### 1. Activer la validation en deux étapes

Connecte-toi à l'adresse qui enverra les emails — par exemple
`contacttalabi@gmail.com` — et vérifie l'avatar en haut à droite : c'est bien
ce compte-là, pas un autre.

https://myaccount.google.com/security → **Validation en deux étapes** → elle
doit afficher **Activée**. Sinon, active-la : Google demande un numéro de
téléphone et envoie un SMS.

Cette étape est obligatoire. Sans elle, l'étape 2 n'existe pas.

### 2. Créer le mot de passe d'application

https://myaccount.google.com/apppasswords

- Si Google répond *« Le paramètre que vous recherchez n'est pas disponible »* :
  l'étape 1 n'est pas terminée. Reviens en arrière.
- Sinon : nom de l'application → `Talabi` → **Créer**

Google affiche 16 lettres en quatre groupes : `abcd efgh ijkl mnop`.
**Il ne les affichera plus jamais.** Copie-les tout de suite, et retire les
espaces : `abcdefghijklmnop`.

### 3. Remplir Supabase

https://supabase.com/dashboard/project/nxwgrpiubgrlvaszclmz/auth/smtp

| Champ | Valeur |
|---|---|
| Enable Custom SMTP | activé |
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | `contacttalabi@gmail.com` |
| Password | les 16 lettres, sans espaces |
| Sender email | `contacttalabi@gmail.com` |
| Sender name | `Talabi` |

**Username et Sender email doivent être la même adresse**, celle qui a généré le
mot de passe d'application : Gmail refuse d'envoyer au nom d'une autre.

Puis **Save** en bas de la section — sans ce clic, rien n'est enregistré.

### 4. Activer la confirmation

*Authentication* → *Sign In / Providers* → **Email** → coche **Confirm email**
→ *Save*.

Vérifie aussi que le modèle envoie bien un code et non un lien :
*Authentication* → *Emails* → **Confirm signup** doit contenir `{{ .Token }}`
et **pas** `{{ .ConfirmationURL }}`.

```html
<h2>Bienvenue sur Talabi 🛵</h2>
<p>Votre code de confirmation :</p>
<p style="font-size:34px;font-weight:800;letter-spacing:6px">{{ .Token }}</p>
<p>Il est valable 1 heure.</p>
```

### 5. Tester

Inscris-toi sur le site avec `ton-adresse+test1@gmail.com`. L'astuce du `+` crée
une adresse neuve pour Supabase, mais l'email arrive dans ta boîte habituelle.

---

## Lire l'erreur quand ça échoue

https://supabase.com/dashboard/project/nxwgrpiubgrlvaszclmz/logs/auth-logs

Clique la première ligne rouge, cherche le champ `"error"`.

| Message | Cause | Correction |
|---|---|---|
| `535 5.7.8 Authentication failed` | identifiant ou mot de passe refusé | ce n'est pas un mot de passe d'application, ou il vient d'un autre compte que celui du champ Username |
| `534 Application-specific password required` | mot de passe ordinaire utilisé | refaire l'étape 2 |
| `550 sender address rejected` | Sender email ≠ Username | mettre la même adresse dans les deux |
| `dial tcp … timeout` / `connection refused` | port injoignable | essayer le port `465` |
| `EOF` / `unexpected EOF` | chiffrement mal négocié | passer de `587` à `465`, ou l'inverse |

---

## Solution de repli — Brevo

Si Gmail refuse obstinément, Brevo donne 300 emails/jour gratuits.

1. https://app.brevo.com/settings/keys/smtp
2. Note le **Login** : il ressemble à `9a1b2c001@smtp-brevo.com` — ce n'est
   **pas** ton adresse email de connexion
3. **Generate a new SMTP key** → copie la valeur immédiatement, elle ne se
   réaffiche jamais
4. Dans Supabase : Host `smtp-relay.brevo.com`, Port `587`, Username = le Login
   de l'étape 2, Password = la clé de l'étape 3
5. Sender email : une adresse **vérifiée** dans
   https://app.brevo.com/senders/list

Vérifie qu'aucun bandeau « account under review » ne s'affiche sur le tableau de
bord Brevo : les comptes gratuits neufs sont parfois retenus, et aucun réglage
ne débloque l'envoi tant que Brevo n'a pas validé le compte.

---

## En attendant que l'envoi marche

La confirmation reste **désactivée** (*Confirm email* décoché) : les
inscriptions sont immédiates, mais personne ne prouve que l'adresse saisie lui
appartient.

C'est acceptable pour tester et pour un lancement entre proches — le téléphone
est obligatoire et figé 30 jours, les restaurants et les livreurs ne sont actifs
qu'après validation par un administrateur, et le paiement se fait à la
livraison. Ça ne l'est plus le jour d'une ouverture au public.

La connexion **Google**, elle, vérifie déjà l'adresse : c'est Google qui la
certifie. Un compte créé par Google n'a jamais besoin de code.
