# L3F-F — recette `staging` du fondateur
Type `fondateur` : arrêt. **Préalable :** lignes 01 à 11 `fait`, U soldée, CI verte, « Migrate staging »
vert. **Q2 : oui** (fondateur, 2026-11-19) : interrupteur ouvert pour la recette, refermé après.
**Préparation par l'agent (D70, `staging` seul, rien en production) :** interrupteur ouvert par
`search.write_search_setting()` dans le contexte du compte admin de `staging` en `aal2` (même voie que
`apps/api/db-tests/creator-search-kit.ts`), jamais par écriture directe ; `search.settings_changed`
écrit ; une marque synthétique publiée (`signup_utm_source = 'seed-fake-profiles'`) et une campagne
publiée à elle ; adresse de la marque et état d'avant dans la note (aucune valeur de `.env.local`).
**Le fondateur vérifie** (poste et téléphone, FR puis EN) :
1. « Créateurs » ouvre M4 : critères seuls, aucune barre de recherche, tri nommé, nombre en tranche ;
2. un filtre trop fin : message unique, suggestions, bouton de demande, aucun compteur ;
3. une carte puis son profil : mêmes informations, 3 visuels, aucune identité, aucun montant ;
4. 3 créateurs ajoutés à une sélection rattachée à la campagne ; la demande confirme un délai ;
5. interrupteur refermé par l'agent : critères, message et bouton de demande seuls (CA59).
**Consigner :** réponse du fondateur mot pour mot dans la note (160 caractères au plus), détail dans
l'annexe § Revue ; tout constat devient une ligne `fix` ; interrupteur refermé et vérifié par lecture
SQL ; sélections et demandes de la recette gardées ou effacées selon le fondateur.
