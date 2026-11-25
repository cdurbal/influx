# L3B-fix-2 — `fix(web): step 4 asks what is paid per creator`
Grille `dev-react-node`. Constat : L3BU-2.
**Préalable :** formulation validée par `expert-paiement-facturation` (consulté avant `valider`,
cité dans la note de la ligne). Proposée : « Combien payez-vous par créateur, commission INFLUX
incluse ? » / « How much do you pay per creator, INFLUX commission included? ».
**Lire :** `l3b/ux-constats.md` L3BU-2 ; `09` l. 483-496 (D78 : tranche par créateur, coût total
annonceur, commission incluse), l. 524-526 (RG57) ; `apps/web/src/locales/{fr,en}/campaign.json`
l. 106-109.
**Livrer :**
- `campaign.form.steps.4.question`, FR et EN : la formulation validée, mot pour mot ;
- aucun autre texte ; aucun pourcentage, taux, net ni montant (D48, `CLAUDE.md` §2).
**Ne pas toucher :** `budget.bandBrand`, `budget.internalPilot` (figés : RG57, RG109), composants,
API.
**Prouver :** aucun cas neuf, planchers inchangés ; e2e **0 s** (aucune assertion ne lit cette clé :
`Grep "question" apps/web/e2e apps/web/tests` le confirme) ; `pnpm check:fast` (parité FR/EN).
**Arrêt si :** la note ne cite aucune validation `expert-paiement-facturation` ; la formulation
validée contient un chiffre, un taux ou un net.
