/* Service worker de Talabi Admin.
   Le vrai travail est dans ../sw.js : ce fichier ne fait que dire à quelle
   profondeur il se trouve, pour que les chemins mis en cache soient justes.
   Sa portée est ce dossier, ce qui rend cette application installable
   séparément des deux autres. */
self.RACINE = '../';
self.APPLICATION = 'admin';
importScripts('../sw.js');
