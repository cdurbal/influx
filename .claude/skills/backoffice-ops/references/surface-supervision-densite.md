# Surface, supervision, densité, cas limites (étapes 6 à 8 et 10, règles 21 à 39)

## Étape 6 — Surface privilégiée

Le backoffice voit **toutes les identités, toutes les conversations et toutes les affaires**. Sa
surface se traite comme telle.

21. **Hôte distinct** de l'application publique et de l'espace membres.
22. **Non-indexation** et absence de lien public.
23. **Authentification à double facteur obligatoire** sur tous les comptes agent et admin (mot de
    passe + TOTP, D37).
24. **Session courte**, avec reconnexion. Arbitrer la durée avec `expert-cybersecurite` : une
    session trop courte pousse aux contournements.
25. **Journalisation de toute lecture de donnée sensible** : conversations (cf. `messaging-spec`),
    pièces de vérification (cf. `profile-verification`), identités non révélées, données d'affaire.
26. Autorisation vérifiée **côté serveur** pour chaque rôle. Le masquage d'interface n'est jamais
    un contrôle d'accès.

Revue obligatoire : `expert-cybersecurite` (**veto**) et `security-rgpd-audit` avant mise en ligne.

---

## Étape 7 — Supervision

Ce qu'un agent doit voir sans avoir à le chercher :

27. **Files qui grossissent** : volume en attente et **délai d'attente le plus ancien**, par file.
28. **SLA dépassés** : liste dédiée, visuellement distincte, jamais noyée dans la file générale.
29. **Échecs de synchronisation Brevo / Apollo** avec la **cause en clair** — pas une trace
    technique brute — et **rejeu unitaire ou en lot** (cf. `lead-pipeline`).
30. **Leads non synchronisés par absence de consentement** : c'est un cas normal, pas une erreur,
    et l'écran doit le dire.
31. **Alertes** : coordonnées repérées dans un fil, fil silencieux depuis 14 jours sans état
    commercial mis à jour, panne durable d'un service externe, quota dépassé. Chaque alerte a un
    seuil écrit et un destinataire (catalogue des alertes : `15` §F).
32. Une alerte doit être **actionnable** : si l'agent ne peut rien faire en la lisant, elle n'a rien
    à faire là.

---

## Étape 8 — Densité et accessibilité d'un outil professionnel

Le backoffice n'obéit pas aux mêmes règles que la landing. Ici, la densité est une qualité.

33. **Tableaux plutôt que cartes.** Une carte par élément fait défiler ; un tableau fait comparer.
34. **Actions atteignables sans souris** et **raccourcis clavier** sur les gestes répétés :
    prendre en charge, valider, refuser avec motif, passer au suivant. C'est ce qui sépare un outil
    de dix décisions par jour d'un outil de cent.
35. **États vides utiles** : « Aucune demande en attente — dernière traitée il y a 12 minutes »,
    jamais une page blanche (et distincts d'une file bloquée, `15` RG32).
36. **Aucune animation décorative**, aucun délai artificiel.
37. Accessibilité WCAG AA comme partout : **la couleur n'est jamais le seul porteur
    d'information** (un SLA dépassé ne se signale pas uniquement en rouge).
38. Tokens du design system obligatoires, aucune couleur ni espacement en dur →
    `design-system-influx` ; gabarits et navigation du backoffice :
    `design-system-influx/references/gabarits-et-navigation.md` et `17b` §1.7 (D73, D74).
39. Langue du backoffice : **D36, arbitrage du fondateur**, ouvert. D'ici là, ne pas coder en dur
    une langue unique.

Mobile : vue limitée à deux gestes, répondre dans une conversation de l'agent, prendre en charge,
valider ou refuser une entrée de file (D58). Tout le reste est conçu pour un poste de travail.

---

## Étape 10 — Cas limites

| Situation | Comportement attendu |
|---|---|
| **Deux agents sur la même entrée** | Le second voit « En cours — Marie » et ne peut pas décider. Aucune décision concurrente n'est possible |
| **Agent absent, verrou orphelin** | Le verrou expire seul après un délai écrit ; un administrateur peut le lever, avec trace |
| **Reprise d'une affaire** par un autre commercial | Réattribution explicite et motivée ; l'historique des responsables est conservé ; les deux parties ne voient qu'un changement d'interlocuteur clairement annoncé dans le fil |
| **Agent qui quitte l'entreprise** | Réattribution obligatoire **avant** désactivation ; ses actions passées conservent son nom |
| **Suppression de compte demandée alors qu'une affaire est en cours** | **Hypothèse conservatrice** : suppression logique et anonymisation des données personnelles, **conservation de l'affaire et du journal sous forme pseudonymisée** au titre de la constatation et de l'exercice de droits en justice. **À faire figurer dans la politique de confidentialité dès le Lot 1**, sinon le droit de conserver la preuve n'existe pas. Arbitre : `expert-conformite-rgpd` (**veto**). Cadre tranché : D72 (suppression demandée par le membre) ; reste ouvert : DZ-2 |
| **Action passée par erreur** | **Correction avec trace, jamais effacement.** L'action erronée reste au journal, la correction s'y ajoute avec son motif |
| **File vide vs file bloquée** | Deux états distincts et distinctement affichés : rien à traiter n'est pas la même chose que rien ne remonte |
| **Décision prise hors délai SLA** | Elle reste possible et est marquée comme telle ; on ne bloque jamais une décision tardive (D49) |
| **Rejeu d'un lot déjà rejoué** | Idempotent, aucun doublon côté Brevo ou Apollo (cf. `lead-pipeline`) |
| **Agent sans les droits** sur une action | Refus côté serveur, message clair, tentative journalisée |
