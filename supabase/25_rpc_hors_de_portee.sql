-- ==========================================================================
--  25 — LES ROUAGES DE LA RÉPARTITION NE SONT PLUS À LA PORTÉE DU PUBLIC
--  --------------------------------------------------------------------------
--  CE QUI A ÉTÉ CONSTATÉ
--
--  En vérifiant que les fichiers 23 et 24 étaient bien passés, j'ai appelé
--  les fonctions depuis l'extérieur avec la seule clé publique du site — celle
--  qui est écrite en clair dans config.js, donc celle que n'importe quel
--  visiteur possède. Elles ont toutes répondu :
--
--    POST /rest/v1/rpc/dispatch_order          → 200
--    POST /rest/v1/rpc/dispatch_waiting_orders → 200
--    POST /rest/v1/rpc/offre_en_cours          → 200
--    POST /rest/v1/rpc/expire_orders           → 200
--
--  Sans être connecté. Ce n'est pas une faute des fichiers 23 et 24 :
--  PostgreSQL accorde le droit d'exécution à TOUT LE MONDE par défaut sur
--  chaque fonction créée. Les `grant ... to authenticated` écrits jusqu'ici
--  ajoutaient un droit déjà acquis, ils n'en retiraient aucun.
--
--  CE QUE ÇA PERMETTAIT
--
--  Aucune fuite de données : la règle de lecture des commandes tient bon, et
--  claim_order refuse un inconnu (« Votre compte livreur n'est pas encore
--  validé »). Mais la répartition, elle, était pilotable de l'extérieur :
--
--   • dispatch_order(id) réélit un livreur pour la commande donnée. Appelée
--     sur une commande déjà promise à quelqu'un, elle la lui retire — parce
--     qu'un livreur qui tient une offre n'est plus candidat (fichier 23).
--     Qui connaît l'identifiant d'une commande pouvait donc la faire tourner
--     d'un livreur à l'autre indéfiniment, et le client n'aurait jamais eu
--     personne.
--   • offre_en_cours(id) dit si un livreur donné a une course à l'écran.
--   • expire_orders() et dispatch_waiting_orders() font tourner la file de
--     l'extérieur, sans limite de cadence.
--
--  Un identifiant de commande est un UUID tiré au hasard : personne ne le
--  devine. Mais il apparaît dans l'adresse de la page de suivi — il suffit
--  qu'un client partage son lien, ou qu'une capture d'écran circule.
--
--  CE QUE FAIT CE FICHIER
--
--   1. Retire le droit d'exécution à `public` et à `anon` sur tout ce qui
--      touche à la répartition, à l'argent et aux positions.
--   2. Le rend explicitement à `authenticated` pour les seules fonctions que
--      l'application appelle vraiment — relevées dans le code, une par une.
--   3. Les rouages internes (dispatch_order, dispatch_waiting_orders,
--      offre_en_cours, km_entre…) ne sont plus appelables par personne de
--      l'extérieur. Les déclencheurs continuent de les utiliser : une
--      fonction `security definer` s'exécute sous l'identité de son
--      propriétaire, à qui aucun droit n'a été retiré.
--
--  Sans risque et rejouable. Aucun changement de comportement pour un
--  utilisateur légitime.
-- ==========================================================================

-- 1. Les rouages internes : plus personne de l'extérieur --------------------
-- Ils ne sont appelés que par des déclencheurs et par d'autres fonctions
-- `security definer`. Aucune ligne de l'application ne les appelle — vérifié
-- en relevant tous les `rpc('…')` du dossier js/.
revoke execute on function public.dispatch_order(uuid)          from public, anon, authenticated;
revoke execute on function public.dispatch_waiting_orders()     from public, anon, authenticated;
revoke execute on function public.km_entre(double precision, double precision,
                                           double precision, double precision)
                                                                from public, anon, authenticated;
revoke execute on function public.course_commission(int)        from public, anon;
revoke execute on function public.wallet_write(uuid, text, int, uuid, text)
                                                                from public, anon, authenticated;

/* UNE EXCEPTION, ET ELLE COMPTE : offre_en_cours GARDE SON DROIT.
   Elle a l'air d'un rouage interne comme les autres, et j'ai commencé par la
   révoquer. C'était une erreur, attrapée avant la mise en ligne : elle est
   appelée DANS la règle de lecture des commandes (fichier 23, policy
   orders_read). Or une règle de sécurité au niveau des lignes s'évalue avec
   les droits de celui qui interroge, pas avec ceux du propriétaire. Retirer
   ce droit n'aurait pas fermé une porte : il aurait fait échouer toute
   lecture de commande, pour tout le monde, sur « permission denied for
   function offre_en_cours ».

   Ce qu'elle laisse filtrer, en échange : qui connaît l'UUID d'un livreur
   apprend qu'une course lui est proposée, et l'UUID de cette course — que la
   règle de lecture protège toujours. Aucun nom, aucune adresse, aucun
   montant. Le prix est nettement plus bas que celui de la fermer. */

-- 2. Ce que l'application appelle vraiment, et rien d'autre ------------------
-- Relevé dans js/ : claim_order, decline_order, driver_abandon,
-- driver_position, driver_recharge, expire_orders, submit_review,
-- approve_recharge, reject_recharge. Chacune vérifie déjà elle-même qui
-- appelle ; ce qu'on retire ici, c'est la possibilité de les appeler sans
-- être connecté du tout.
revoke execute on function public.claim_order(uuid)             from public, anon;
revoke execute on function public.decline_order(uuid)           from public, anon;
revoke execute on function public.driver_abandon(uuid, text)    from public, anon;
revoke execute on function public.expire_orders()               from public, anon;

grant  execute on function public.claim_order(uuid)             to authenticated;
grant  execute on function public.decline_order(uuid)           to authenticated;
grant  execute on function public.driver_abandon(uuid, text)    to authenticated;
grant  execute on function public.expire_orders()               to authenticated;
grant  execute on function public.course_commission(int)        to authenticated;

-- Les trois suivantes ont des signatures qui ont changé au fil des fichiers :
-- on les traite par nom, sans avoir à deviner leurs paramètres. Un `do` plutôt
-- qu'une ligne fixe, pour que ce fichier reste rejouable même si une signature
-- bouge encore.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure::text as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('driver_position', 'driver_recharge', 'submit_review',
                         'approve_recharge', 'reject_recharge', 'submit_recharge')
  loop
    execute 'revoke execute on function ' || f.sig || ' from public, anon';
    execute 'grant execute on function '  || f.sig || ' to authenticated';
    raise notice 'Reserve aux comptes connectes : %', f.sig;
  end loop;
end $$;

-- ---- Vérifications ---------------------------------------------------------

-- a) Qui peut exécuter quoi. « anon » ne doit plus apparaître nulle part sur
--    les rouages internes, et pas du tout sur la répartition.
select p.proname                                   as fonction,
       case when has_function_privilege('anon',          p.oid, 'execute')
            then 'OUI — A CORRIGER' else 'non' end as anonyme,
       case when has_function_privilege('authenticated', p.oid, 'execute')
            then 'oui' else 'non' end              as connecte
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('dispatch_order', 'dispatch_waiting_orders', 'offre_en_cours',
                     'km_entre', 'wallet_write', 'course_commission',
                     'claim_order', 'decline_order', 'driver_abandon',
                     'expire_orders', 'driver_position', 'submit_review')
 order by anonyme desc, p.proname;

-- b) Contre-épreuve à faire dehors, une fois ce fichier passé. Les quatre
--    appels doivent répondre 401 ou 403, et non plus 200 :
--
--    curl -X POST -H "apikey: <cle anon>" -H "Content-Type: application/json" \
--         -d '{"p_order":"00000000-0000-0000-0000-000000000000"}' \
--         https://<projet>.supabase.co/rest/v1/rpc/dispatch_order
