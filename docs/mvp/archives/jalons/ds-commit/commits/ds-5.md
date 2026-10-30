# DS-5 — `feat(web): member primitives in the KEO theme`

F3 et F6 tranchés (2026-10-29) : badge vérifié en bleu (`verified-*`), jamais une coche seule ni collé
à un nom ; F6, contre la recommandation : halo d'en-tête (token de rôle KEO, défini avec `expert-ux`),
ombre lumineuse du bouton principal (token de rôle), agrandissement au survol et soulèvement des cartes
**gardés, sous `motion-safe:` seulement** pour les transformations ; panneaux flottants là où ils sont
pertinents (avis `expert-ux`) ; réduction à l'appui écartée.

Invoque le skill `design-system-influx`.

**Lire :** `20@638+65` (§11.5), `20@703+33` (§11.6), `20@758+45` (§11.8), dans `20@444+152` seulement
les couleurs de rôle et leur liste fermée, `18@1077+29` (G3g, G3h, G7, G8).

**Livrer :**

- `apps/web/src/components/member/ui` : boutons pilule principal, secondaire et danger ; carte 16 px ;
  champ ; notice ; pastille d'état avec texte ; compteur « 9+ » lu en texte ; en-tête de page avec un
  `h1` unique.
- `auth-classes.ts` et `account-classes.ts` repointés ; icônes par le seul `icons.ts`.
- G7 étendue, G3g, G3h ; TD5.4 sur le parcours à 375 px ; axe en état d'erreur.

**Règles :** jamais `transition-all` (propriétés nommées) ; transformation d'état sous `motion-safe:`
seulement, sans décalage de mise en page ; la couleur ne porte jamais seule une information (P7).
**G8 à assouplir dans ce commit** : `findStateTransforms` (`packages/test-kit/src/guards.ts`) accepte
une transformation d'état préfixée `motion-safe:` et refuse toujours la même sans préfixe, ainsi que
`transition-all` ; auto-test `charter-boundary.test.ts` mis à jour (cas accepté et cas refusé).

**Attention :** primitives partagées avec la landing, donc TD4.2 vert sans toucher sa fixture.
