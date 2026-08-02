/* ==========================================================================
   GÉNÉRATEUR DES APPLICATIONS resto/ livreur/ admin/

   Les quatre applications partagent le même code. Seule leur page d'entrée
   diffère : le nom déclaré, la couleur, le manifeste, la profondeur des
   chemins. Écrire ces pages à la main serait s'exposer à ce qu'elles divergent
   — on corrigerait index.html en oubliant resto/index.html.

   Ce script les fabrique à partir de index.html, qui reste la seule source.

       node tools/generer-applications.js

   À relancer après toute modification de index.html (ajout d'un fichier JS,
   d'une balise…).
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');

const APPS = [
  {
    dossier: 'resto',
    app: 'restaurant',
    nom: 'Talabi Resto',
    court: 'Resto',
    description: 'Recevez vos commandes Talabi, gérez votre carte et suivez votre chiffre d’affaires.',
    couleur: '#1E6BE6',              // bleu : l'espace professionnel du restaurant
    sousTitre: 'Espace restaurant'
  },
  {
    dossier: 'livreur',
    app: 'driver',
    nom: 'Talabi Livreur',
    court: 'Livreur',
    description: 'Prenez des courses dans votre quartier, livrez et suivez vos gains.',
    /* Bleu, comme l'intérieur de l'application depuis qu'elle a changé de
       teinte. Un bleu plus profond que celui du resto (#1E6BE6) : les deux
       tournent sur les mêmes téléphones, et l'écran de démarrage est ce qu'on
       voit avant tout le reste — il doit dire laquelle des deux s'ouvre. */
    couleur: '#1552B8',
    sousTitre: 'Espace livreur'
  },
  {
    dossier: 'admin',
    app: 'admin',
    nom: 'Talabi Admin',
    court: 'Admin',
    description: 'Console d’administration de la plateforme Talabi.',
    couleur: '#101418',              // presque noir : la console
    sousTitre: 'Administration'
  }
];

const source = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');

for (const a of APPS) {
  const dossier = path.join(RACINE, a.dossier);
  fs.mkdirSync(dossier, { recursive: true });

  let html = source;

  // 1. Les chemins remontent d'un cran — sauf le manifeste et le service
  //    worker, qui sont propres à chaque application.
  html = html
    .replace(/(src|href)="(config\.js|js\/|assets\/)/g, '$1="../$2')
    .replace(/window\.TALABI_APP  = 'client';/, "window.TALABI_APP  = '" + a.app + "';")
    .replace(/window\.TALABI_BASE = '';/, "window.TALABI_BASE = '../';");

  // 2. Identité : nom, description, couleur
  html = html
    .replace(/<title>[^<]*<\/title>/, '<title>' + a.nom + '</title>')
    .replace(/<meta name="description" content="[^"]*">/,
             '<meta name="description" content="' + a.description + '">')
    .replace(/<meta name="theme-color" content="[^"]*">/,
             '<meta name="theme-color" content="' + a.couleur + '">')
    .replace(/<meta name="apple-mobile-web-app-title" content="[^"]*">/,
             '<meta name="apple-mobile-web-app-title" content="' + a.nom + '">');

  // 3. Le texte sous le logo de l'écran d'ouverture
  html = html.replace(/<div class="splash-sub">[^<]*<\/div>/,
                      '<div class="splash-sub">' + a.sousTitre + ' • Tizi Ouzou</div>');

  /* 3 bis. Marquer l'application sur <body>, en dur dans le fichier.
     L'écran d'ouverture s'affiche avant que le moindre script ait tourné :
     poser cette classe depuis le JS aurait laissé voir un logo orange une
     fraction de seconde avant qu'il ne devienne bleu. */
  html = html.replace(/<body[^>]*>/, '<body class="app-' + a.app + '">');

  // 4. Bandeau d'avertissement en tête du fichier généré
  html = html.replace('<!DOCTYPE html>',
    '<!DOCTYPE html>\n<!-- FICHIER GÉNÉRÉ — ne pas modifier à la main.\n' +
    '     Source : index.html à la racine, puis « node tools/generer-applications.js » -->');

  fs.writeFileSync(path.join(dossier, 'index.html'), html);

  // ---- manifeste : c'est lui qui fait une application distincte sur le
  //      téléphone, avec son nom et sa propre icône sur l'écran d'accueil
  const manifeste = {
    name: a.nom + ' — Tizi Ouzou',
    short_name: a.nom,
    description: a.description,
    lang: 'fr',
    dir: 'ltr',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: a.couleur,
    theme_color: a.couleur,
    icons: [
      { src: '../assets/img/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '../assets/img/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '../assets/img/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '../assets/img/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
  fs.writeFileSync(path.join(dossier, 'manifest.webmanifest'),
                   JSON.stringify(manifeste, null, 2) + '\n');

  // ---- service worker : un fichier par application, sinon les portées se
  //      chevauchent et une seule des quatre serait installable
  fs.writeFileSync(path.join(dossier, 'sw.js'),
    '/* Service worker de ' + a.nom + '.\n' +
    '   Le vrai travail est dans ../sw.js : ce fichier ne fait que dire à quelle\n' +
    '   profondeur il se trouve, pour que les chemins mis en cache soient justes.\n' +
    '   Sa portée est ce dossier, ce qui rend cette application installable\n' +
    '   séparément des trois autres. */\n' +
    "self.RACINE = '../';\n" +
    "self.APPLICATION = '" + a.dossier + "';\n" +
    "importScripts('../sw.js');\n");

  console.log('✓ ' + a.dossier + '/  (' + a.nom + ')');
}

console.log('\nTerminé. Les quatre applications partagent le même code ; seules');
console.log('leurs pages d’entrée diffèrent.');
