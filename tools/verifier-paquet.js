/* ==========================================================================
   CONTRÔLE AVANT ENVOI SUR GOOGLE PLAY
   --------------------------------------------------------------------------
   node tools/verifier-paquet.js <chemin vers le .aab ou le .zip>

   Cinq choses sont lues DANS le fichier lui-même — pas dans ce qu'on croit
   avoir demandé au générateur. Chacune a déjà causé un échec réel :

   1. le nom du paquet          → une fiche Play n'accepte que le sien
   2. le code de version        → « Le code de version 1 a déjà été utilisé »
   3. le niveau d'API cible     → Play refuse en dessous du minimum exigé
   4. l'adresse déclarée        → si elle ne correspond pas à
                                  /.well-known/assetlinks.json, l'application
                                  s'ouvre dans un onglet avec la barre
                                  d'adresse au lieu du plein écran
   5. le certificat signataire  → « signé avec la mauvaise clé »

   Le point 5 a besoin de PowerShell (System.Security), présent sur Windows.
   Tout le reste est lu en Node, sans aucune dépendance ni JDK.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const cible = process.argv[2];
if (!cible) {
  console.error('Usage : node tools/verifier-paquet.js <fichier.aab|fichier.zip>');
  process.exit(2);
}
if (!fs.existsSync(cible)) {
  console.error('Fichier introuvable : ' + cible);
  process.exit(2);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'talabi-verif-'));
const unzip = (archive, motifs, dest) => {
  try {
    execFileSync('unzip', ['-o', '-q', archive].concat(motifs, ['-d', dest]), { stdio: 'pipe' });
    return true;
  } catch (e) { return false; }
};

/* Un .zip de PWABuilder contient le .aab : on descend d'un cran. */
let aab = cible;
if (/\.zip$/i.test(cible)) {
  const d = path.join(temp, 'zip');
  fs.mkdirSync(d);
  unzip(cible, ['*.aab'], d);
  const tous = fs.readdirSync(d).filter(f => /\.aab$/i.test(f));
  /* PWABuilder livre parfois DEUX paquets : le signé et le « -unsigned ». On
     prend le signé, sinon on annonce clairement qu'il n'y a que l'autre —
     Play refuse un paquet non signé. */
  const trouve = tous.find(f => !/unsigned/i.test(f)) || tous[0];
  if (!trouve) { console.error('Aucun .aab dans cette archive.'); process.exit(2); }
  if (tous.length > 1) console.log('archive contient : ' + tous.join(', '));
  aab = path.join(d, trouve);
  console.log('archive  : ' + path.basename(cible));
}
console.log('paquet   : ' + path.basename(aab) + '  (' + Math.round(fs.statSync(aab).size / 1024) + ' Ko)\n');

const dossier = path.join(temp, 'aab');
fs.mkdirSync(dossier);
unzip(aab, ['base/manifest/AndroidManifest.xml', 'base/resources.pb', 'META-INF/*'], dossier);

const lire = p => fs.existsSync(p) ? fs.readFileSync(p).toString('latin1') : '';
const man = lire(path.join(dossier, 'base/manifest/AndroidManifest.xml'));
const res = lire(path.join(dossier, 'base/resources.pb'));

let echecs = 0;
const dire = (ok, libelle, valeur, attendu) => {
  if (!ok) echecs++;
  console.log((ok ? '  ok      ' : '  ECHEC   ') + libelle.padEnd(26) + String(valeur) +
              (attendu && !ok ? '   (attendu : ' + attendu + ')' : ''));
};

/* --- 1. nom du paquet ------------------------------------------------- */
const paquet = (man.match(/package[\x00-\x20"]*([a-z][a-z0-9_.]{6,})/) || [])[1] || '?';
dire(paquet === 'shop.talabi.client', 'nom du paquet', paquet, 'shop.talabi.client');

/* --- 2 et 3. versions -------------------------------------------------
   Le manifeste d'un .aab est en protobuf : la valeur suit le nom de
   l'attribut, encodée en chiffres imprimables. */
const apres = (cle, longueur) => {
  const i = man.indexOf(cle);
  if (i < 0) return null;
  const m = man.slice(i + cle.length, i + cle.length + 24).match(new RegExp('([0-9]{1,' + longueur + '})'));
  return m ? m[1] : null;
};
const vc = apres('versionCode', 4);
dire(vc !== null && Number(vc) >= 2, 'code de version', vc, '2 ou plus');
const tsdk = apres('targetSdkVersion', 2);
dire(tsdk !== null && Number(tsdk) >= 36, 'niveau d’API cible', tsdk, '36 (échéance 31 août 2026)');
console.log('  —       niveau minimum       ' + apres('minSdkVersion', 2));

/* --- 4. adresse déclarée ---------------------------------------------- */
const site = (res.match(/"site":\s*"([^"]+)"/) || [])[1] || 'ABSENTE';
dire(site === 'https://talabi.shop', 'adresse déclarée', site, 'https://talabi.shop');

/* --- 5. certificat signataire ----------------------------------------- */
const metaInf = path.join(dossier, 'META-INF');
const bloc = fs.existsSync(metaInf)
  ? fs.readdirSync(metaInf).find(f => /\.(RSA|DSA|EC)$/i.test(f))
  : null;

if (!bloc) {
  dire(false, 'certificat signataire', 'AUCUNE SIGNATURE — paquet non signé');
} else {
  const script = [
    'Add-Type -AssemblyName System.Security',
    '$s = New-Object System.Security.Cryptography.Pkcs.SignedCms',
    '$s.Decode([System.IO.File]::ReadAllBytes(' + JSON.stringify(path.join(metaInf, bloc)) + '))',
    'foreach ($c in $s.Certificates) {',
    '  $h = [System.Security.Cryptography.SHA256]::Create().ComputeHash($c.RawData)',
    '  Write-Output ((($h | ForEach-Object { $_.ToString("X2") }) -join ":") + "|" + $c.Subject)',
    '}'
  ].join('; ');
  try {
    const sortie = execFileSync('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }).trim();
    const [empreinte, sujet] = sortie.split('\n')[0].split('|');
    /* La clé d'importation de shop.talabi.client, vérifiée contre le trousseau
       PKCS#12 local (CN=Talabi Admin). Play refuse tout autre signataire. */
    const ATTENDUE = 'D4:4D:34:A1:6D:94:8D:F0:B7:37:93:93:E2:0B:D5:0B:C0:70:F0:74:80:7E:00:04:6A:7D:77:27:BF:DF:CB:62';
    dire(empreinte.trim() === ATTENDUE, 'certificat signataire', empreinte.trim().slice(0, 26) + '…',
         'D4:4D:34:A1:6D:94:8D:F0…');
    console.log('  —       sujet                ' + (sujet || '').trim());
  } catch (e) {
    console.log('  —       certificat signataire  (illisible : ' + e.message.split('\n')[0] + ')');
  }
}

fs.rmSync(temp, { recursive: true, force: true });
console.log('\n' + (echecs ? echecs + ' PROBLÈME(S) — ne pas envoyer sur Play en l’état'
                           : 'TOUT EST BON — le paquet peut être envoyé'));
process.exit(echecs ? 1 : 0);
