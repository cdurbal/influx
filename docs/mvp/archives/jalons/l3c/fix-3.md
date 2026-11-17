# L3C-X3 — `fix(web): a locked form keeps its checked choices and its values readable`
Grille `dev-react-node`. Skill : `design-system-influx`. Constat 1 de la recette F (`run.md`).
**Cause :** hors `draft`/`rejected`, `<fieldset disabled>` (`CampaignFormScreen.tsx` l. 304-307) ;
`memberChoiceInputClasses` (`member/ui/field-classes.ts` l. 42-47) n'a qu'`accent-action-primary-bg`,
ignoré sur `:disabled` : gris du navigateur, coché = non coché. `outlineClasses` l. 52 : valeur
désactivée en `text-disabled` (2,82:1, `20` l. 620).
**Portée :** contrôles `member/ui` des cinq étapes (radios dont tranches, oui/non, cases, listes,
champs) ; même verrou : profils marque et créateur. Backoffice : rien de partagé, hors champ.
**Garder `disabled` :** pas de `readonly` sur radio, case ni liste ; `aria-readonly` laisse les
flèches changer un radio, `aria-disabled` le laisse opérable. `disabled` bloque tout geste, se lit
« cochée, indisponible », la notice `form.locked` dit pourquoi. Seul le dessin change.
**Livrer**, `field-classes.ts` seul, sous `disabled:` seulement (rendu actif inchangé) :
- radio, case : `appearance-none`, contour `--border-width-thick` `border-strong` (4,7:1 sur
  `surface-card`), `radius-pill` ou `radius-sm` ; coché : contour et marque intérieure
  `text-secondary` (`bg-clip-content` + `p-1`), forme et non teinte, ni vert ni `opacity` ;
  `has-disabled:cursor-default`, libellé `text-primary` gardé ;
- champ, liste : valeur `text-secondary` (8,7:1), opacité ou remplissage du navigateur neutralisés ;
- `20` §11 : état D de « Champ » (l. 905) ; ligne « Case à cocher, bouton radio » ajoutée.
Ni token neuf, ni longueur, ni couleur littérale (`guards.test.ts`).
**Ne pas toucher :** `tokens.css`, `apps/backoffice`, `brand-campaign.spec.ts`.
**Prouver :** `member-ui.test.ts` +1 cas X3 (classes, ni `opacity-` ni `text-disabled`, radio
désactivé `checked`) ; plancher `tests/case-floors.ts` l. 28 : 11 → 12. `brand-campaign-states.spec.ts`
cas 3, `paused` ouverte (étape 1), mesure sans navigation (`computed`, `contrast`, `tokenColor`) :
radio coché ≥ 3:1 sur `surface-card`, fond distinct du non coché ; « Devise » ≥ 4,5:1. Pas d'axe
neuf (0,6 s restant sur 18) ; celui du cas 2 (fiche verrouillée) reste vert. `pnpm check:fast` ;
spec ×3, médiane ≤ avant + 0,2 s ; `brand-profile.spec.ts`, `creator-profile.spec.ts` une fois.
**Capture** avant puis après (spec jetable non commitée, `pending_review`, étapes 2 et 3, 1 440 px) :
`apps/web/test-results/x3/`. Attendu : « 48 heures » = anneau et point plein, distinct des anneaux
vides ; valeurs lisibles ; brouillon inchangé.
**Commit :** `git add` nominatif, jamais `-A`, ses seuls hunks ; note : médiane, chemins des captures.
**Arrêt si :** token ou valeur littérale nécessaire ; contrôle actif changé ; médiane dépassée ;
spec de profil rouge ; `disabled` à changer.
