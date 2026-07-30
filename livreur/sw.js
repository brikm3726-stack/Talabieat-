/* Service worker de Talabi Livreur.
   Le vrai travail est dans ../sw.js : ce fichier ne fait que dire à quelle
   profondeur il se trouve, pour que les chemins mis en cache soient justes.
   Sa portée est ce dossier, ce qui rend cette application installable
   séparément des trois autres. */
self.RACINE = '../';
self.APPLICATION = 'livreur';
importScripts('../sw.js');
