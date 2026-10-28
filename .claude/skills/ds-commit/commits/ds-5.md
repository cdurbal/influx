# DS-5 — `feat(web): member primitives in the KEO theme`

Invoque le skill `design-system-influx`.

**Lire :** `20@638+56` (§11.5), `20@694+33` (§11.6), `20@748+45` (§11.8), dans `20@444+152` seulement
les couleurs de rôle et leur liste fermée, `18@1077+29` (G3g, G3h, G7, G8).

**Livrer :**

- `apps/web/src/components/member/ui` : boutons pilule principal, secondaire et danger ; carte 16 px ;
  champ ; notice ; pastille d'état avec texte ; compteur « 9+ » lu en texte ; en-tête de page avec un
  `h1` unique.
- `auth-classes.ts` et `account-classes.ts` repointés ; icônes par le seul `icons.ts`.
- G7 étendue, G3g, G3h ; TD5.4 sur le parcours à 375 px ; axe en état d'erreur.

**Règles :** transitions de couleur seulement, aucune transformation ni `transition-all` (`motion-safe:`
compris) ; la couleur ne porte jamais seule une information (P7).

**Attention :** primitives partagées avec la landing, donc TD4.2 vert sans toucher sa fixture.
