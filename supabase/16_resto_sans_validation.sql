-- ==========================================================================
--  16 — LES RESTAURANTS N'ATTENDENT PLUS DE VALIDATION
--  --------------------------------------------------------------------------
--  Un restaurateur qui s'inscrivait restait invisible jusqu'à ce qu'un
--  administrateur le valide. Sur une plateforme qui démarre, cette attente
--  décourage : celui qui a pris dix minutes pour monter sa carte veut la voir
--  en ligne, pas un bandeau « sous 24 h ».
--
--  Il crée donc sa fiche et il est visible tout de suite.
--
--  Ce que l'administrateur garde : le pouvoir de RETIRER une fiche. Passer son
--  statut à « rejected » la fait disparaître du catalogue, et bloquer le
--  compte du gérant l'empêche d'entrer. Le contrôle passe d'un filtre a priori
--  à une sanction a posteriori — c'est ce que fait tout le monde à petite
--  échelle, parce qu'un faux restaurant se repère à la première commande.
--
--  Les livreurs, eux, restent validés à la main : ils manipulent l'argent des
--  clients et le crédit de la plateforme.
--
--  Sans risque et rejouable.
-- ==========================================================================

-- 1. Les nouvelles fiches naissent validées ---------------------------------
alter table public.restaurants alter column status set default 'approved';

-- 2. Celles qui attendaient sont libérées ------------------------------------
update public.restaurants
   set status = 'approved'
 where status = 'pending';

-- 3. Le trigger de notification ne doit plus annoncer d'attente --------------
-- (02_security.sql prévient l'administrateur des inscriptions en attente ;
--  sans fiche en attente, il n'a plus rien à annoncer.)

-- ---- Vérification -----------------------------------------------------------
select status, count(*) from public.restaurants group by status;
