# Recette L2E (fondateur, `staging`, 20 minutes)

Prérequis : lignes 01 à 23 à `fait`, CI verte, déploiement de `staging` à jour. Il faut un compte de réseau **réel**, public, que vous pouvez modifier, et une capture de son tableau de bord.

1. Avec un compte créateur de `staging`, ouvrir une ligne de réseau, puis « Faire vérifier ». Lire ce que le badge affirme : c'est clair ?
2. Copier le code, le coller dans la bio réelle, cliquer « J'ai collé le code ». Un e-mail arrive.
3. Au backoffice, connecté comme commercial, ouvrir « Vérifications créateurs », prendre la demande, ouvrir le profil public hors connexion, taper le pseudo et le code lus, accorder. Le créateur voit « Compte vérifié — {réseau}, le {date} ». Retirer le code de la bio.
4. Déposer une capture du tableau de bord (avec une photo de téléphone pour essayer aussi : aucune localisation ne doit survivre). Lire les consignes avant.
5. Au backoffice, ouvrir la pièce (journalisée), taper abonnés, période, publications, commentaires : aucun champ pré-rempli, l'écart s'affiche après. Accorder : **premier badge « Audience vérifiée » daté**.
6. Refaire une demande sur un autre réseau, la refuser avec un motif : le créateur reçoit le message et voit quoi faire.
7. Avec une marque, demander « Marque vérifiée » : raison sociale, pays, numéro, code de domaine. Traiter ou refuser.
8. Regarder ce qui n'existe pas : aucun montant, aucun nom d'agent ni chiffre exact côté public.

Réponse attendue : OK et l'identifiant de la décision (ligne 5), ou la liste des écarts, écrite ici. Absent par construction : péremption, retrait, contestation (L2F) ; publication et portfolio (L2G) ; vue d'une marque sur un créateur (Lot 3).

## Écarts

**2026-11-08, étape 6 : refus sans reprise.** Constat du fondateur : « lorsqu'on refuse la validation, le créateur n'a aucun moyen de refaire sa demande avec la correction ». Le serveur laisse redemander après tout refus (24 h, sauf `missing_evidence` ; 3 refus en 30 jours ; `0222` l. 550-572). C'est l'écran qui bloque : la suite se lit du seul motif, jamais du niveau (`verification-view.ts`, `NEXT_STEP` l. 169-186, `canRestartOwnership` l. 224-226, `canRestartAudience` l. 479-481 ; `VerificationLineState.tsx` l. 114 sans bouton si l'action est nulle). Causes :

- **C1** : propriété refusée pour un motif de pièce (`missing_evidence`, `evidence_too_old`, `evidence_unreadable`, `evidence_wrong_source`, `evidence_too_wide`, `evidence_inconsistent`) : aucun bouton, et la phrase parle d'une pièce qui n'existe pas à ce niveau ;
- **C2** : `other`, propriété et audience : « contactez INFLUX » seul, aucun bouton ;
- **C3** : audience refusée pour `ownership_not_proven`, propriété établie : la phrase renvoie à une preuve déjà faite, aucun bouton ;
- **C4** : audience refusée pour `ownership_prerequisite`, propriété établie : même impasse.

**Corrigé par la ligne 25** (validée par le fondateur le 2026-11-08). Propriété : tout motif rouvre la preuve (`restartOwnership`), sauf `account_not_public` (inchangé) et C5. Audience établie : les cinq motifs de pièce (C1 sans `evidence_inconsistent`), C3 et C4 rouvrent le dépôt (`redeposit`). C2 : la suite du niveau, puis « contactez INFLUX » (écart signé à `08` RG57). EC-L2E-25-1 : audience refusée sans propriété établie, aucun bouton (RG12) ; la phrase demande la propriété d'abord, sauf `ownership_not_proven`, `evidence_inconsistent` et C5. Option : au backoffice, les six motifs de C1 ne sont plus proposés sur une propriété.

**Inchangés (décision du fondateur)** : **C5**, `evidence_suspected_forgery`, `shared_account`, `terms_breach`, `account_unavailable` (contact) et `agency_managed`, `minor` (aucune suite) : sans bouton. **Avant production** : délai de 24 h écrit sur la ligne (L2EU-4 : contrat et route) ; date de levée du plafond de 3 refus (migration) ; phrase de suite de l'e-mail et de l'aperçu du backoffice, encore lue du seul motif (`apps/api`, `verification-email.ts` l. 65-82).
