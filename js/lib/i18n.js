/* ==========================================================================
   LANGUES — français et arabe
   --------------------------------------------------------------------------
   Talabi est algérienne. Une partie de ses clients lit le français sans
   difficulté, une autre préfère l'arabe, et beaucoup passent de l'un à l'autre
   dans la même phrase. Le choix se fait donc d'un seul appui, à toute heure, et
   se retient : personne ne doit rechoisir sa langue à chaque ouverture.

   COMMENT C'EST FAIT, et pourquoi c'est fait ainsi.

   Le français reste écrit EN CLAIR dans le code — `T('Mes commandes')` et non
   `T('orders.title')`. Une clé abstraite oblige à ouvrir deux fichiers pour
   lire une phrase, et le jour où la traduction manque, elle affiche
   « orders.title » à l'écran. Ici, une traduction manquante affiche le
   français : dégradé, jamais cassé. C'est ce qui permet de traduire l'appli
   écran par écran sans jamais la laisser en morceaux.

   L'arabe algérien plutôt que l'arabe littéraire là où l'usage l'impose :
   « ماكلتك » pour « votre repas » se comprend partout, la forme classique fait
   administratif. On écrit comme les gens parlent, pas comme on écrirait une
   circulaire.

   Ce fichier ne contient QUE des mots. Aucune logique métier, aucun appel
   réseau : le remplacer ne peut rien casser d'autre que de l'affichage.
   ========================================================================== */
(function (w) {
  'use strict';

  const CLE = 'talabi.langue';

  /* ------------------------------------------------------------ le lexique
     Rangé par écran plutôt qu'alphabétiquement : on traduit un écran à la fois,
     et on veut voir d'un coup d'œil ce qui manque encore. */
  const AR = {
    /* ---- navigation et barres ---- */
    'Accueil': 'الرئيسية',
    'Restaurants': 'المطاعم',
    'Panier': 'السلة',
    'Commandes': 'الطلبات',
    'Compte': 'حسابي',
    'Connexion': 'تسجيل الدخول',
    'Créer un compte': 'إنشاء حساب',
    'Paramètres': 'الإعدادات',
    'Notifications': 'الإشعارات',
    'Mes informations': 'معلوماتي',

    /* ---- accueil ---- */
    'Rechercher un restaurant ou un plat…': 'ابحث عن مطعم أو طبق…',
    'Rechercher': 'بحث',
    'Choisis ton': 'اختر',
    'restaurant': 'مطعمك',
    'Commander': 'اطلب',
    'maintenant': 'الآن',
    'Le livreur': 'الموزّع',
    't’attend': 'في انتظارك',
    'Restaurants populaires': 'مطاعم مشهورة',
    'Livraison à': 'التوصيل إلى',
    'Tout voir': 'عرض الكل',
    'Comment ça marche ?': 'كيف يعمل ؟',
    'Trois étapes, et votre repas est en route.': 'ثلاث خطوات، وماكلتك في الطريق.',
    'Votre position': 'موقعك',
    'Votre panier': 'سلّتك',
    'Votre livreur': 'موزّعك',

    /* ---- états d'une commande ---- */
    'Commande envoyée': 'تم إرسال الطلب',
    'En attente': 'في الانتظار',
    'Acceptée par le restaurant': 'المطعم قبل الطلب',
    'Acceptée': 'مقبول',
    'Préparation en cours': 'قيد التحضير',
    'En préparation': 'قيد التحضير',
    'Recherche d’un livreur': 'البحث عن موزّع',
    'En recherche': 'قيد البحث',
    'Livreur en route vers le restaurant': 'الموزّع في طريقه إلى المطعم',
    'Livreur trouvé': 'وجدنا موزّعا',
    'En cours de livraison': 'قيد التوصيل',
    'En livraison': 'قيد التوصيل',
    'Livrée': 'تم التوصيل',
    'Commande refusée': 'تم رفض الطلب',
    'Refusée': 'مرفوض',
    'Annulée': 'ملغى',

    /* ---- suivi ---- */
    'Arrivée estimée': 'الوصول المتوقّع',
    'Suivi de la commande': 'تتبّع الطلب',
    'Suivre en plein écran': 'تتبّع بملء الشاشة',
    'Prête': 'جاهز',
    'Livreur assigné': 'تم تعيين موزّع',
    'Chez vous': 'عندك',
    'Restaurant': 'المطعم',
    'Appeler': 'اتصال',
    'Message': 'رسالة',
    'Retour': 'رجوع',
    'Recentrer': 'إعادة التمركز',
    'J’ai bien reçu ma commande': 'استلمت طلبي',
    'Réception confirmée · merci !': 'تم تأكيد الاستلام · شكرا !',
    'Un problème avec la commande ?': 'مشكل في الطلب ؟',
    'À remettre en espèces': 'المبلغ نقدا',
    'Annuler la commande': 'إلغاء الطلب',

    /* ---- panier et validation ---- */
    'Mon panier': 'سلّتي',
    'Où livrer ?': 'وين نوصّلو ؟',
    'Dernière étape': 'الخطوة الأخيرة',
    'Changer': 'تغيير',
    'Fermer': 'إغلاق',
    'Aider le livreur à vous trouver': 'ساعد الموزّع يلقاك',
    'Laisser à la porte': 'خلّيه عند الباب',
    'M’appeler en arrivant': 'اتصل بيا كي توصل',
    'Paiement': 'الدفع',
    'Espèces à la réception': 'نقدا عند الاستلام',
    'Carte Edahabia / CIB': 'بطاقة الذهبية / CIB',
    'Bientôt': 'قريبا',
    'Total': 'المجموع',
    'Livraison': 'التوصيل',
    'Sous-total': 'المجموع الفرعي',

    /* ---- avis ---- */
    'Comment s’est passée la livraison ?': 'كيفاش كان التوصيل ؟',
    'Plus tard': 'لاحقا',
    'Envoyer mon avis': 'إرسال تقييمي',
    'Recommander la même chose': 'أطلب نفس الشيء',
    'Rapide': 'سريع',
    'Aimable': 'لطيف',
    'Repas encore chaud': 'الماكلة سخونة',

    /* ---- mots partagés ---- */
    'Merci !': 'شكرا !',
    'Enregistrer': 'حفظ',
    'Annuler': 'إلغاء',
    'Confirmer': 'تأكيد',
    'Continuer': 'متابعة',
    'articles': 'منتجات',
    'article': 'منتج',
    'min': 'د',
    'Gratuit': 'مجانا',
    'Ouvert': 'مفتوح',
    'Fermé': 'مغلق'
  };

  const I18n = {
    /* Le français est la langue de référence : c'est celle du code. */
    langue: 'fr',

    get rtl() { return I18n.langue === 'ar'; },

    /**
     * T('Mes commandes') → la phrase dans la langue courante.
     *
     * Une phrase absente du lexique revient telle quelle, en français. C'est
     * volontaire : un écran à moitié traduit reste utilisable, alors qu'un
     * écran affichant ses clés techniques ne l'est plus.
     */
    t(fr) {
      if (I18n.langue !== 'ar') return fr;
      const v = AR[fr];
      return v === undefined ? fr : v;
    },

    /** Bascule et retient. Le rendu est refait par l'appelant. */
    set(lang) {
      I18n.langue = (lang === 'ar') ? 'ar' : 'fr';
      try { localStorage.setItem(CLE, I18n.langue); } catch (e) {}
      I18n.appliquer();
    },

    basculer() { I18n.set(I18n.langue === 'ar' ? 'fr' : 'ar'); },

    /**
     * Pose la langue et le sens de lecture sur <html>.
     *
     * `dir` sur la racine plutôt qu'une classe : c'est l'attribut que le
     * navigateur comprend nativement. Il retourne l'alignement des textes, le
     * sens des listes et la position des barres de défilement sans qu'une seule
     * règle CSS soit écrite — et surtout il retourne aussi ce que nous n'avons
     * pas prévu.
     */
    appliquer() {
      const h = document.documentElement;
      h.setAttribute('lang', I18n.langue);
      h.setAttribute('dir', I18n.rtl ? 'rtl' : 'ltr');
    },

    /** Au démarrage : la langue retenue, sinon celle du téléphone. */
    boot() {
      let l = null;
      try { l = localStorage.getItem(CLE); } catch (e) {}
      if (!l) {
        /* Un téléphone réglé en arabe ouvre l'application en arabe : le premier
           écran est le seul qu'on ne peut pas traduire après coup. */
        const n = (navigator.language || '').toLowerCase();
        l = n.indexOf('ar') === 0 ? 'ar' : 'fr';
      }
      I18n.langue = (l === 'ar') ? 'ar' : 'fr';
      I18n.appliquer();
    }
  };

  w.I18n = I18n;
  /* Raccourci global : `T('...')` est court parce qu'il apparaît des centaines
     de fois. Un nom long rendrait le code illisible là où il compte. */
  w.T = I18n.t;
  I18n.boot();
})(window);
