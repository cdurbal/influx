# E19 — Backoffice sur téléphone (agent, administrateur)
> Maquette : `proto-bo-mobile.html` (E19.1 : `provisoire` ; cible Lot 4 : `files`, `entree`, `prise`, `refuser`, `decide`, `convs`, `conv`) · page de comparaison `ecran-19-bo-mobile.html` · validée le 2026-11-24 (`07` l. 211 à 219) · Constats : U43.
> Seul E19.1 est dans le lot. E19.2 à E19.4 sont décrits pour mémoire (§8).

## 1. Écrans et routes

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E19.1 | Fenêtre trop petite | tout chemin de `(app)` | aucune (D36) | `Shell.tsx` (`SmallWindow`, l. 330-350), `shell-classes.ts:11-14, 157-164`, `tokens-backoffice.css:50-59` | `provisoire` | M | C67, C57 ; décision 0.9 (E6) |
| E19.2 | Geste 1 : entrées à traiter, entrée, décision | Lot 4 | Lot 4 | n'existe pas | `files`, `entree`, `prise`, `refuser`, `decide` | hors lot | D58, C06, C39 |
| E19.3 | Geste 2 : conversations | Lot 4 | Lot 4 | n'existe pas | `convs` | hors lot | D58, messagerie |
| E19.4 | Une conversation | Lot 4 | Lot 4 | n'existe pas | `conv` | hors lot | D30, D47 |

**À préserver**

| Fonction | Fichier:ligne | Règle |
|---|---|---|
| Deux seuils : moins de 768 px de large ou moins de 500 px de haut | `tokens-backoffice.css:55-59` | F7, `17b` §1.7 |
| Environnement, identité, rôle et déconnexion visibles | `Shell.tsx:330-350` | `16` RG118 |
| Connexion et activation utilisables à toute largeur | `(auth)` sans `Shell` | `17b` §1.7 |
| Session lue au montage | `Shell.tsx:98-117` | `02` §21.5 |
| Règle d'écran, pas une mesure de sécurité | — | `17b` §1.7 |

**Défaut à corriger (U43)** : `Frame` est masqué par `bo-small:hidden` mais ses enfants restent montés : une page de décision appelle `POST …/open` (verrou de 30 min, lecture journalisée) sans rien montrer. Au passage sous le seuil, une page déjà ouverte continue.

**API en E19.1** : `GET /v1/bo/me` et `POST /v1/bo/auth/logout` seulement. Aucun autre appel.

## 2. Structure

Une colonne : bande réduite, puis `main` (titre, deux phrases, bouton).

| Mesure | 375 | 768 (maquette, hors seuil réel) | 1440 (maquette, hors seuil réel) |
|---|---|---|---|
| Colonne `.ph-shell` (`max-width` 30 rem, bords `border-subtle`) | 375, intérieur 341 | 480, centrée | 480, centrée |
| Bande | 36,6 px, 12 px, `px` gouttière 16, `py` 8, collante | 36,6 | 36,6 |
| `main` : `px` 16, `pt` 24, `pb` 32, `gap` 24 | x 17, 341 | x 172,8, 422,4 | x 529, 382 |
| h1 | 20 px 700, 2 lignes, 62 px | 62 px | 62 px |

La colonne de 30 rem est l'artifice de la maquette sur poste. À l'écran, la condition est vraie sous 768 px de large ou 500 px de haut : sur un téléphone en paysage (844 × 390), largeur pleine ; proposé : contenu à 30 rem maximum, aligné à gauche (Q05).

## 3. Éléments et matrice

| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E19.1-S01 | Garde | C67 | Sous le seuil, la coquille et la page ne sont pas montées ; au-dessus, montage normal | condition de §1 | provisoire, `.ph-shell` | E19.1-CA01 | E19.1-T01 |
| E19.1-S02 | Bande | C57 | Environnement gras `tracking-overline` + « · INFLUX Backoffice » ; fond `feedback-warning-bg`, texte `feedback-warning-text`, filet `feedback-warning-border` hors production | toujours | provisoire, `.ph-band` | E19.1-CA02 | E19.1-T02 |
| E19.1-S03 | Bande | C57 | Identité et rôle à droite, 12 px | toujours | provisoire, `.ph-band span:last-child` | E19.1-CA02 | E19.1-T02 |
| E19.1-S04 | Corps | C02 | h1 20 px 700 `tracking-heading`, `tabindex="-1"` | toujours | provisoire, `.ph-h1` | E19.1-CA03 | E19.1-T02 |
| E19.1-S05 | Corps | C67 | Phrase 14 px `text-secondary` | toujours | provisoire, `p.c2` | E19.1-CA03 | E19.1-T02 |
| E19.1-S06 | Corps | C67 | Phrase 12 px `text-tertiary` : rien n'est monté | toujours | provisoire, `p.xs` | E19.1-CA03 | E19.1-T02 |
| E19.1-S07 | Corps | C10 | « Se déconnecter », secondaire, icône, 164,1 × 28 dessiné (Q06) | toujours | provisoire, `.btn--secondary` | E19.1-CA04 | E19.1-T03 |
| E19.1-S08 | Garde | C67 | Page déjà ouverte puis réduite : démontée ou masquée (Q02) | franchissement du seuil | non montré | E19.1-CA05 | E19.1-T01 |
| E19.1-S09 | Garde | C67 | Bandeaux code de secours et contrôle par les pairs : absents aujourd'hui | conditions de `me` | non montré | E19.1-CA02 | E19.1-T02 |

## 4. Textes

EN : aucun (D36). Clés : `apps/backoffice/src/messages/fr.ts`.

| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| S02 | LOCAL · INFLUX Backoffice | aucun | `shell.environment` + `brand` ; le mode d'envoi est écrit aujourd'hui dans cette bande (`Shell.tsx:222-224`) et absent de la maquette (Q04) |
| S03 | {Camille D.} · commercial | aucun | `shell.identity` (e-mail) : E04-Q07 |
| S04 | Le backoffice se consulte sur un poste de travail | aucun | `shell.workstationOnly.title` |
| S05 | Cet écran demande au moins 768 px de large. Sur téléphone, vos conversations et la file de validation seront disponibles à leur mise en service. | aucun | `shell.workstationOnly.body` (dit aussi « et 500 px de haut » : à garder, Q03) |
| S06 | Aucune page n'est ouverte derrière ce message : rien n'est pris en charge, aucune lecture n'est enregistrée (U43). | aucun | nouvelle ; « (U43) » à retirer (identifiant de constat, Q03) |
| S07 | Se déconnecter | aucun | `shell.signOut` ; `logout.busy` pendant l'appel |

## 5. Interactions, états, responsive, clavier

- **Arrivée sous le seuil** : la session est lue ; aucun enfant de route n'est monté ; aucune requête métier. Le premier rendu ne doit ni monter la page, ni montrer le message puis la page : tant que la condition n'est pas connue, état de chargement actuel (`Shell.tsx:145-154`).
- **Franchissement vers le grand** : la page se monte et s'ouvre (verrou, journal) comme à une arrivée.
- **Franchissement vers le petit** : une page de décision déjà ouverte a son verrou et une saisie en cours ; ni la maquette ni la spécification ne disent quoi faire (Q02).
- **Zoom du navigateur** : 200 % sur 1440 px donne 720 px CSS ; la règle s'applique (WCAG 1.4.10 à examiner, Q07).
- **Déconnexion** : identique à la coquille ; écran déconnecté.

| État | Maquette | Comportement |
|---|---|---|
| Chargement, session illisible, déconnecté | non montré | écrans actuels de `Shell`, valables à toute taille |
| Erreur de déconnexion | non montré | état « session illisible » actuel |
| Hors ligne | non montré | idem |
| JavaScript non hydraté | non montré | aucun contenu métier servi par le serveur : la page lit tout côté client |

- **Responsive** : 375 mesuré en §2 ; 768, 1280, 1440 : écran non affiché si la hauteur est d'au moins 500 px. Cas à tester : 767 × 900, 768 × 900, 900 × 499, 900 × 500, 844 × 390.
- **Clavier** : premier Tab sur « Se déconnecter » ; pas de lien d'évitement (rien à éviter). Focus du h1 au changement de chemin.
- **Animation** : aucune.

## 6. Critères d'acceptation

- **E19.1-CA01** À 767 px de large ou 499 px de haut, ouvrir `/files/profils-marque/{id}` n'émet aucun `POST …/open` : ni verrou, ni ligne de journal ; de même pour une fiche et la recherche identifiée.
- **E19.1-CA02** L'environnement, le rôle et l'identité sont écrits ; hors production le fond et le mot changent ensemble.
- **E19.1-CA03** Un seul `main`, un seul h1, aucun `nav`, aucun contenu métier dans le DOM.
- **E19.1-CA04** La déconnexion fonctionne ; cible d'au moins 44 px de haut (Q06).
- **E19.1-CA05** La règle de franchissement retenue (Q02) ne laisse ni verrou fantôme ni saisie perdue sans avertissement.
- **E19.1-CA06** Les deux seuils restent écrits une seule fois.
- **E19.1-CA07** Connexion, activation, 404 et erreurs restent utilisables à 375 px.
- **E19.1-CA08** Aucun écart d'hydratation ni clignotement du message sur un poste.
- **E19.1-CA09** Axe WCAG 2.2 AA à 375 × 812 et 844 × 390 ; la bande est dans un repère (`header`).

## 7. Tests

| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E19.1-T01 | e2e | nouveau dans `apps/web/e2e/backoffice-queue.spec.ts` | aucune ouverture ni journal sous le seuil ; franchissement |
| E19.1-T02 | e2e | `apps/web/e2e/backoffice.spec.ts` (TD6.2, l. 1015 ; TD6.3) | seuils, texte, un seul h1 |
| E19.1-T03 | e2e | `backoffice.spec.ts` (TD6.4) | déconnexion |
| E19.1-T04 | unitaire | `apps/backoffice/tests/guards.test.ts:509-525` (interdit `matchMedia` ; à amender si E6 est accordée) | seuils uniques, exception bornée à un fichier |
| E19.1-T05 | visuel | nouveau, 375 × 812 et 844 × 390 | mesures de §2 |
| E19.1-T06 | a11y | `backoffice.spec.ts` (DS-10), nouveau | axe, repères, cibles |

## 8. Écart avec l'existant

| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| `SmallWindow` | `Shell.tsx:330-350`, affiché par CSS, `Frame` monté à côté | C67 : un seul des deux montés | faire évoluer |
| `FRAME_CLASSES` | `bo-small:hidden` | inutile si la garde ne monte pas | faire évoluer |
| Mise en page | titre 28 px, texte `LEAD_CLASSES`, plusieurs `gap` | h1 20 px, phrase 14 px, phrase 12 px | faire évoluer |
| Seuils | `@custom-variant bo-small` | même source pour le CSS et la garde (Q01) | faire évoluer |

**Données requises** : identité « Prénom N. » (E04-Q07) ; aucune autre.

**Hors lot, cible Lot 4**
- E19.2 `files` : h1 « À traiter », nombre, retards, trois groupes (profils marque, profils créateur, campagnes), lignes de 68 px, barre du bas à deux rubriques (56 px) avec compteurs.
- E19.2 `entree`, `prise` : retour, faits, « À contrôler » en liste, présentation, lien vers le poste ; barre d'action fixe : « Prendre en charge », puis « Refuser… » et « Publier ».
- E19.2 `refuser`, `decide` : motif en liste fermée, refus en rouge, notice et entrée suivante.
- E19.3 `convs` : conversations dont l'agent est participant, point « non lue », aucun extrait de message.
- E19.4 `conv` : fil à trois signé, événement système, champ et envoi, sans pièce jointe.
- À ne pas reprendre sans décision : « Prendre en charge » explicite contre ouvrir = prendre en charge (`15` RG27 C1) ; motifs différents de la liste servie ; conditions de session sur téléphone.

## 9. Contradictions, manques et décisions

| ID | Constat | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E19-Q01 | « Aucune page montée » exige de connaître la taille en JavaScript ; interdit par `20` §11.8 (l. 875), `17b` §1.7, `02` §21.5, `tokens-backoffice.css:52` et `guards.test.ts:518-523` ; décision 0.9 (E6) ouverte | toute la garde | exception écrite et bornée : un seul module lit la requête CSS de `bo-small`, testé par la garde ; sinon, variante E6 : la prise en charge attend un geste | architecte | oui |
| E19-Q02 | Franchissement vers le petit avec verrou et saisie : non spécifié | perte de saisie ou verrou fantôme | garder la page montée et masquée si elle l'était (le verrou existe déjà), ne jamais monter une nouvelle page | product-owner | oui |
| E19-Q03 | Texte : seuil de hauteur omis par la maquette ; « (U43) » dans l'interface | S05, S06 | phrase existante (768 et 500) ; U43 retiré | expert-ux | non |
| E19-Q04 | Mode d'envoi absent de la bande réduite ; aujourd'hui écrit | `16` RG118 | le garder à la ligne | expert-cybersecurite | non |
| E19-Q05 | Téléphone en paysage : aucune mesure ; colonne de 30 rem | mise en page | contenu 30 rem maximum, à gauche | expert-ux | non |
| E19-Q06 | Bouton de 28 px de haut (`.bo .btn`) sur téléphone | cible tactile 44 px du projet (`size-touch-target`) | 44 px | expert-ux | non |
| E19-Q07 | Zoom à 200 % sur poste : message à la place du contenu (WCAG 1.4.4, 1.4.10) | accessibilité | confirmer F7 pour le zoom | expert-ux | non |
| E19-Q08 | Bandeaux code de secours et contrôle par les pairs absents sous le seuil (existant et maquette) | J3S-6, CA71 | les ajouter sous la bande | expert-cybersecurite | non |
| E19-Q09 | Rendu serveur : la taille est inconnue au premier rendu | clignotement ou écart d'hydratation | état de chargement jusqu'au premier relevé | architecte | non |
| E19-Q10 | Axe : `.ph-band` hors repère (X11) ; états Lot 4 : repères, `aria-label` sur `span`, h1 absent de `decide` | a11y | corriger la bande maintenant, le reste au Lot 4 | expert-ux | non |
