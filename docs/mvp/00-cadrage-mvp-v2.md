# Cadrage du MVP INFLUX — version 2 : la place de marché courtée

> **Statut :** validé par le fondateur le **2026-09-18**.
> **Rédigé par :** agent `chef-de-projet`, à partir des arbitrages du fondateur.
> **⚠️ Ce document abroge et remplace `docs/cadrage-mvp.md` (2026-09-16).** L'ancien cadrage est
> **supprimé du dépôt le 2026-09-19** (il reste consultable dans l'historique git, commit `a65ac87` et antérieurs, comme mémoire des arbitrages de cette date) ; il ne doit plus servir de référence.
> **Référence :** `CLAUDE.md` reste la source de vérité du projet. En cas d'écart, `CLAUDE.md`
> prime et c'est ce document qui est corrigé.
> **Document pivot associé :** `docs/mvp/01-intermediation-courtee.md` décrit en détail le processus
> de mise en relation courtée et le suivi de la commission. Il contraint toutes les spécifications
> qui suivent.
>
> **Mise à jour du 2026-09-24 (revue de cohérence, `19-revue-de-coherence-2026-09-24.md`).** Les
> décisions **D2, D5, D12, D18, D37** (le 2026-09-18), **D39**, **D40**, **D41** (le 2026-09-18) et
> **D43** (le 2026-09-19) sont tranchées : ce document les présentait encore comme ouvertes, c'est
> corrigé ci-dessous. Le fondateur a précisé le **statut du code existant (D44)** : hors landing page,
> c'est une **maquette jetable** ; le Lot 0 repart de zéro. Les contradictions relevées entre ce
> document et les spécifications suivantes sont tranchées le même jour (**D42, D45 à D51**,
> `CLAUDE.md` §13) : révélation à la **seconde acceptation** des parties (D45) ; **jamais d'e-mail ni
> de téléphone** montrés aux membres (D46) ; **apartés** privés du commercial conservés et annoncés
> (D47) ; **aucun taux ni net estimé affiché** pendant le pilote (D48).

---

## 1. Le besoin en une phrase

**La plus petite version d'INFLUX qui permette à un commercial de faire, en ligne et à grande
échelle, le métier d'intermédiaire qu'il fait aujourd'hui de la main à la main : trouver le bon
créateur pour une marque, mettre les deux en relation lui-même, mener la négociation avec eux, et
encaisser sa commission — le contrat et le paiement restant, pour l'instant, hors de la plateforme.**

---

## 2. Ce qui change par rapport au cadrage du 2026-09-16

### 2.1 Vue d'ensemble

| Sujet | Cadrage du 2026-09-16 | Cadrage du 2026-09-18 | Arbitrage |
|---|---|---|---|
| Nature du MVP | MVP « **opéré par l'équipe** » : l'équipe fait à la main ce que l'application ne sait pas encore faire | MVP « **place de marché courtée** » : la découverte est en libre-service, la négociation est courtée par un commercial présent dans la conversation | — |
| Recherche de créateurs | **Hors périmètre** (jugée risquée pour le contournement) | **Dans le périmètre**, en version **anonymisée** | **A2** |
| Ouverture d'une conversation | Un agent propose un créateur à une marque | **File de validation** alimentée par **trois déclencheurs**, dont la proposition du commercial lui-même | **A9**, **A3bis** |
| Messagerie | Entre deux parties, supervisée a posteriori | **Conversation à trois**, le commercial **visible et nommé** dedans | **A3** |
| Contrat, signature, paiement, calcul de la commission | Dans l'application (Lot 4, 6 à 9 semaines) | **Hors application**, reportés en V2 | **A1** |
| Monétisation | À partir du Lot 4, automatisée | **Dès le premier jour, manuelle** : le commercial encaisse, la plateforme enregistre | **A8** |
| E-mails Brevo depuis le backoffice | Après le MVP | **Dans le MVP** (Lot 5), avec trois sources de destinataires encadrées | **A4** |
| Apollo.io | Annonceurs qualifiés uniquement | **Tous les inscrits**, particuliers compris — *risque juridique ouvert* | **A7** |
| Mise en ligne | À la fin du parcours de développement | **Progressive dès le Lot 1**, vers la semaine 5 | **A6** |
| Clause de non-contournement | Envisagée, non datée | **Posée dès le jour 1**, usage **suspendu** pendant le pilote | **A5** |
| Découpage | 6 lots (0 à 5), 16 à 24 semaines | **7 lots (0 à 6), 18 à 25 semaines** | — |

### 2.2 Trois choses à dire sans détour

**a) Le MVP ne raccourcit pas. Il change de nature.**
18 à 25 semaines contre 16 à 24 auparavant. Il perd le plus gros morceau de l'ancien plan — le
module de contrat et de paiement (6 à 9 semaines) — mais il gagne quatre briques qui n'y étaient
pas : la recherche anonymisée, la file de validation, la conversation à trois et le pipeline
commercial. Ce n'est pas un MVP plus petit, c'est un MVP **différent**, centré sur le geste
commercial au lieu d'être centré sur la mécanique financière.

**b) Il reste monétisé dès le premier jour.**
Il serait faux de dire que « le MVP n'encaisse rien ». INFLUX encaisse dès la première affaire —
simplement **hors de l'application**. Le commercial envoie le contrat par le moyen de son choix, le
paiement se fait à la confiance, et il saisit lui-même dans le backoffice le montant négocié et la
commission convenue. La plateforme n'encaisse pas et ne calcule pas : elle **enregistre**. Le chiffre
d'affaires commissionné existe donc dès le Lot 4, et il est mesuré.

**c) Le contexte décisif, écrit noir sur blanc.**
*L'un des fondateurs exerce déjà ce métier d'intermédiaire, de façon informelle et physique. La
plateforme ne crée pas un métier : elle le structure, le rend transmissible à d'autres commerciaux,
et le fait passer à l'échelle.*

Cette phrase change tout le raisonnement sur la protection du modèle économique. **La meilleure
protection contre le contournement n'est pas une clause juridique, c'est un humain présent dans la
conversation.** Un commercial qui suit la négociation en direct voit tout, connaît ses deux clients
et sait où en est l'affaire. Les mécanismes de preuve (registre, horodatage, détection de
coordonnées) restent utiles, mais ils deviennent **secondaires** : ils ne portent plus seuls le
risque. C'est pour cette raison que plusieurs d'entre eux sont allégés dans ce cadrage.

---

## 3. Les onze arbitrages du fondateur (2026-09-18)

| # | Sujet | Décision du fondateur | Conséquence concrète |
|---|---|---|---|
| **A1** | Contrat et paiement | **Hors application.** Le commercial envoie le contrat comme il veut (e-mail, DocuSign, en main propre) et le paiement se fait à la confiance. Aucun module de contrat, de signature, d'encaissement ni de calcul de commission n'est développé. Reportés en V2, avec D25 et D9. | Aucune ligne de code ne calcule 35 %. La table `commission_rates` est **créée mais vide**. Le commercial saisit deux montants : ce qui a été négocié, et la commission convenue. En échange, le MVP n'attend ni le prestataire de paiement, ni les décisions fiscales. |
| **A2** | Recherche de créateurs | **Profils anonymisés.** D16 est maintenue et étendue : thématiques, pays, audience, formats, tarifs, portfolio et badge sont visibles ; pseudos, `@`, liens et captures d'écran restent **masqués** jusqu'à l'ouverture de la mise en relation. | La marque cherche et construit sa sélection toute seule, mais ne peut pas contacter qui que ce soit directement. L'anonymisation n'est pas un filtre d'affichage : c'est une **séparation en base**, sinon elle n'est pas garantie. |
| **A3** | Messagerie | **Conversation à trois, courtée.** Aucune conversation ne s'ouvre entre deux membres seuls : un commercial la valide, s'attribue l'affaire et y participe, **visible et nommé**. | Le commercial est un participant de première classe, pas un observateur. Une conversation compte trois participants dès son origine. C'est la protection principale du modèle économique. |
| **A3bis** | Initiative du commercial | Le commercial peut **lui-même rapprocher une marque et un créateur sur une campagne**, sans demande préalable d'aucune des deux parties. C'est le troisième déclencheur — et le geste métier qui existe déjà hors plateforme. | C'est le geste que le fondateur fait aujourd'hui au téléphone. Dans l'outil, il doit être **au moins aussi rapide** : partir d'une campagne, sélectionner plusieurs créateurs d'un coup, écrire un motif, envoyer. Si ce parcours est lent, les commerciaux retourneront au téléphone et la plateforme aura échoué. |
| **A4** | E-mails depuis le backoffice | **Saisie libre limitée à l'unitaire.** L'envoi en masse est réservé aux contacts de la plateforme et aux segments Brevo (consentement vérifié). La saisie libre est plafonnée, journalisée, avec lien de désinscription. | L'envoi Brevo depuis le backoffice **entre dans le MVP** (Lot 5) : c'est un renversement par rapport au 2026-09-16. Trois sources de destinataires, trois bases légales différentes, trois niveaux de contrôle. |
| **A5** | CGU et créance | **Clause de non-contournement posée dès le jour 1, usage suspendu pendant le pilote.** Les CGU posent la rémunération de 35 % sur toute collaboration issue d'une mise en relation ; INFLUX annonce qu'il n'en fera pas usage pendant le pilote. | Le droit est constitué dès la première inscription, mais il n'est jamais brandi. Une clause posée après coup ne serait pas rétroactive : la poser maintenant coûte une ligne de CGU et protège tout l'historique du pilote. Durée et régime asymétrique B2B/B2C : **D29**. |
| **A6** | Mise en ligne | **Progressive dès le Lot 1** (environ 5 semaines) : le site est en production pendant qu'on construit le reste. | **Impose que la société existe vers la semaine 5.** Sans société, pas de mentions légales ni de CGU, donc pas de site public et pas de contrat avec Brevo et Apollo. C'est la contrainte de calendrier la plus dure de tout le MVP (**D25**). |
| **A7** | Apollo.io | **Tous les inscrits partent vers Apollo**, particuliers compris. | **Cet arbitrage a été pris contre la recommandation qui a été faite au fondateur.** `expert-conformite-rgpd` **conserve son veto** sur ce point et doit instruire le sujet ; la **validation d'un juriste est obligatoire avant la mise en ligne du Lot 1**. Le risque est **inscrit, il n'est pas levé** (**D33**). Concrètement : l'application est construite pour envoyer tous les inscrits, avec un interrupteur par catégorie de profil permettant de restreindre immédiatement si le juriste l'exige. |
| **A8** | Suivi des affaires | **Pipeline commercial léger dans le backoffice** : état de l'affaire, montant négocié, commission due et encaissée, commercial responsable. L'application ne calcule ni ne facture rien — elle enregistre ce que le commercial saisit. | Remplace avantageusement l'idée de faire déclarer l'issue par les utilisateurs (30 à 50 % de réponses au mieux). Le commercial saisit parce que c'est son métier et son intéressement : la donnée est bien plus fiable, et obtenue sans friction pour les utilisateurs. |
| **A9** | File de validation | **Toute ouverture de conversation est validée** : demande de contact d'une marque **et** candidature d'un créateur. Rien ne circule entre deux membres sans l'accord d'un commercial. | C'est la garantie qu'aucune mise en relation n'échappe à INFLUX. C'est aussi le principal goulot d'étranglement du produit : le délai de traitement de cette file devient un indicateur vital (**D39**). |
| **A10** | Lecture des conversations | **CGU claires + chaque lecture journalisée.** Les échanges ne sont pas des correspondances privées mais des échanges hébergés et supervisés. Le commercial intermédiaire est visible et nommé ; toute lecture par un agent est horodatée et attribuée. | La supervision doit être annoncée dans les CGU et la politique de confidentialité **dès le Lot 1**, pas découverte plus tard. Techniquement, un agent non participant ne lit une conversation qu'à travers une fonction qui trace son passage. |

---

## 4. Le cœur du produit : la mise en relation courtée

C'est le mécanisme central du MVP, celui dont tout le reste découle.

```
  Marque                    INFLUX (commercial)                   Créateur
    │                              │                                 │
    │ cherche (profils anonymes)   │ cherche en vue identifiée       │ publie son profil
    │ ──── demande de contact ───► │ ◄──── candidature ──────────────│
    │                              │                                 │
    │ ◄──────────── PROPOSITION INFLUX (3e déclencheur) ────────────► │
    │     le commercial rapproche lui-même une marque et un créateur  │
    │     sur une campagne donnée, sans demande préalable d'aucun     │
    │                              │                                 │
    │                    ┌─────────▼──────────┐                      │
    │                    │ FILE DE VALIDATION │  ← le commercial     │
    │                    │ valide · s'attribue│    décide et devient │
    │                    │ · refuse + motif   │    responsable       │
    │                    │ (la proposition    │                      │
    │                    │  INFLUX la court-  │                      │
    │                    │  circuite)         │                      │
    │                    └─────────┬──────────┘                      │
    │                              │                                 │
    │   ┌──────────────────────────▼─────────────────────────────┐   │
    │◄──┤  CONVERSATION À TROIS — identités révélées aux parties │──►│
    │   │  commercial visible et nommé · tout est journalisé     │   │
    │   └──────────────────────────┬─────────────────────────────┘   │
    │                              │                                 │
    │             ┌────────────────▼─────────────────┐               │
    │             │ PIPELINE COMMERCIAL (backoffice) │               │
    │             │ contrat envoyé → signé → payé    │  hors app :   │
    │             │ montant · commission · encaissée │  e-mail /     │
    │             └──────────────────────────────────┘  DocuSign /   │
    │                                                    physique    │
```

### 4.1 Les trois déclencheurs

**Règle d'or : aucun des trois déclencheurs ne crée une conversation.** Ils créent une **entrée dans
la file de validation**. La conversation n'existe qu'après la décision d'un commercial **puis
l'acceptation des deux parties** (D45) : la partie qui n'a rien demandé accepte à l'écran, et les
identités ne sont révélées qu'à la seconde acceptation.

| Déclencheur | Qui déclenche | Point de départ | Passe par la file ? | Particularité |
|---|---|---|---|---|
| **Demande de contact** | La marque | Un profil anonyme repéré dans la recherche | **Oui** | Le créateur n'est prévenu qu'après validation. Il ne voit jamais une demande refusée. |
| **Candidature** | Le créateur | Une campagne publiée | **Oui** | Contenu et nombre plafonnés, motif obligatoire. La marque ne voit qu'une candidature validée. |
| **Proposition INFLUX** | **Le commercial, de sa propre initiative** | Une campagne + la recherche en vue identifiée | **Non — elle court-circuite la file** | Le commercial est déjà le décideur : il s'attribue l'affaire d'office. **Il peut viser plusieurs créateurs d'un coup** par sélection multiple, et chaque destinataire donne lieu à une mise en relation distincte, tracée séparément. |

La **proposition INFLUX** mérite qu'on s'y arrête : c'est le geste métier que le fondateur exerce
déjà en physique, et c'est la raison d'être de la plateforme. Le parcours cible est le suivant : le
commercial ouvre une campagne, lance la recherche **en vue identifiée** (il voit les vrais noms,
contrairement à la marque), coche trois ou cinq créateurs pertinents, écrit un motif commun, et
valide. Il vient d'ouvrir trois à cinq mises en relation. **Ce parcours doit être au moins aussi
rapide qu'un coup de fil, sinon les commerciaux retourneront au téléphone** et rien ne sera tracé.

Malgré ce raccourci, la proposition INFLUX produit exactement le même objet que les deux autres
déclencheurs : la même mise en relation enregistrée, la même révélation d'identité horodatée, la
même conversation à trois, la même traçabilité.

### 4.2 Les six conséquences de conception

1. **Les trois déclencheurs alimentent une file, pas une messagerie.** La conversation est une
   conséquence d'une décision humaine, jamais un effet direct d'un clic utilisateur.
2. **Le commercial est un participant de première classe du modèle de données**, pas un observateur
   greffé après coup. Une conversation a trois participants dès son origine. Ce point doit être vrai
   en base dès le Lot 0, sinon il faudra tout reprendre.
3. **La révélation d'identité est l'effet de la seconde acceptation**, après la validation du
   commercial (**D45**, tranchée le 2026-09-24 ; mécanique complète : `13` §F). Personne n'est révélé
   sans l'avoir accepté. Elle est horodatée et journalisée : c'est la preuve que la mise en relation
   vient d'INFLUX, et c'est elle qui fonde la commission. Après l'ouverture, chaque partie voit
   l'identité de l'autre, **jamais son e-mail ni son téléphone** (**D46**).
4. **Le délai de traitement de la file est le premier risque produit.** Une demande de contact qui
   attend 48 heures tue la conversion : les deux parties se cherchent ailleurs. À arbitrer (**D39**)
   et à instrumenter.
5. **Le plafond de croissance est le nombre de commerciaux**, pas la technique. C'est pourquoi le
   MVP doit mesurer, dès le Lot 4, **le nombre d'affaires traitées par commercial et par semaine** :
   c'est l'indicateur qui dira si la plateforme fait vraiment passer le métier à l'échelle, ou si
   elle se contente de le déplacer sur un écran.
6. **L'attribution commerciale est préparée dès maintenant.** Au MVP, tous les commerciaux voient
   tout. Mais le modèle de données porte, **dès le Lot 0**, un commercial responsable par compte et
   par affaire — pour que le passage aux portefeuilles de clients cloisonnés ne soit qu'un
   changement de règle d'accès, et pas une refonte.

### 4.3 Ce que la plateforme enregistre, et ce qu'elle ne fait pas

| Elle enregistre | Elle ne fait pas |
|---|---|
| L'origine de chaque mise en relation (lequel des trois déclencheurs) | Générer un contrat |
| Le commercial responsable | Faire signer |
| La date et l'heure exactes de la révélation d'identité | Encaisser |
| La version des CGU acceptée par chaque partie | **Calculer la commission** |
| Tous les messages échangés, et chaque lecture par un agent | Facturer |
| Le montant négocié, la devise, la commission due, la commission encaissée — **saisis par le commercial** | Vérifier l'identité bancaire d'un créateur |

> **Interdiction formelle au MVP : aucun taux et aucun calcul de commission dans le code.** Le
> commercial saisit le montant négocié et le montant de commission convenu ; l'application les
> enregistre et les additionne, elle ne les calcule pas. Un moteur de commission écrit à moitié
> violerait la règle « un seul endroit » de `CLAUDE.md` §6 et serait pire que rien.

---

## 5. Objectif et indicateurs

**Objectif du pilote :** démontrer qu'un commercial outillé par INFLUX traite plus d'affaires, plus
vite, et sur un périmètre plus large qu'un commercial qui travaille au téléphone et de mémoire.

**Hypothèse à valider :** *un commercial outillé traite significativement plus d'affaires par semaine
qu'un commercial au téléphone, et les deux parties acceptent qu'un intermédiaire nommé reste présent
dans leur négociation.*

**Mesure de départ (D53, 2026-09-24).** Pour que la comparaison ait un sens, le fondateur relève
**avant le pilote**, sur au moins quatre semaines, le nombre d'affaires traitées au téléphone par
semaine (`14` RG112). Sans ce relevé, l'indicateur n° 4 ne se compare à rien.

| # | Indicateur | Comment il est obtenu | Cible (à recaler après 4 semaines) |
|---|---|---|---|
| 1 | **Commission encaissée** — montant, devise, pays | **Déclarée par le commercial** dans le pipeline commercial | Au moins 10 affaires encaissées sur 8 à 12 semaines de pilote |
| 2 | **Taux de transformation** : mises en relation ouvertes → affaires signées | Rapprochement mise en relation → affaire | Au moins 20 % |
| 3 | **Délai de traitement de la file de validation** (délai médian et délai du 9e cas sur 10) | Horodatages de la file | **1 jour ouvré** (**D39**). C'est l'indicateur de survie du produit : au-delà du seuil, la conversion s'effondre |
| 4 | **Affaires traitées par commercial et par semaine** | Attribution commerciale | Suivi dès le Lot 4. **C'est l'indicateur du passage à l'échelle** : s'il ne monte pas, la plateforme n'apporte rien au métier |
| 5 | **Inscrits consentants synchronisés** : Brevo sous 1 h, Apollo sous 24 h | Pipeline de leads, journal des échecs | Au moins 99 %, **aucun échec laissé sans traitement** |
| 6 | **Inscriptions par pays** | Formulaire d'inscription | Suivi dès le Lot 1 ; sert à choisir dans quel ordre ouvrir les pays en V2 |

**Indicateur de vigilance, à regarder sans en faire une cible :** nombre de conversations restées
silencieuses plus de 14 jours sans état commercial mis à jour. C'est le signal simple qu'une affaire
est partie ailleurs. Au MVP, une liste d'alertes suffit — le commercial connaît ses affaires.

---

## 6. Périmètre par persona

### 6.1 Marque (annonceur)

**Dans le périmètre**

- Pages publiques en français et en anglais, à deux portes d'entrée, avec le modèle économique expliqué.
- Inscription courte : e-mail, entreprise, pays, langue, consentement marketing non pré-coché, CGU versionnées.
- Profil entreprise progressif, avec indicateur de complétude.
- Création d'une campagne, publiée **après validation par un commercial**.
- **Recherche de créateurs anonymisée** : facettes en tranches, tri explicable, shortlist.
- **Demande de contact** sur un profil, qui part en file de validation.
- **Conversation à trois** avec le créateur et le commercial INFLUX, une fois la mise en relation validée.
- Espace « mes données » : consentement, export, suppression.

**Hors périmètre**

| Exclu | Pourquoi |
|---|---|
| Contrat, signature et paiement en ligne | **A1** : le commercial envoie le contrat hors plateforme et le paiement se fait à la confiance. Reporté en V2 avec D9 et D25. |
| Contact direct d'un créateur sans validation | **A9** : rien ne circule sans l'accord d'un commercial. C'est le cœur du modèle. |
| Coordonnées directes visibles sur un profil créateur | **A2** : pseudos, `@` et liens masqués jusqu'à la mise en relation. |
| Plusieurs utilisateurs par entreprise | Confort. Un compte par marque suffit au pilote. |
| Statistiques automatiques des publications | Les agréments auprès des réseaux sociaux sont longs et incertains. Au MVP, le commercial suit la livraison dans la fiche d'affaire : date et lien de publication, validation par la marque (**D52**, `14` RG105 à RG108). |
| Avis et notations | Il faut d'abord un historique d'affaires. |
| Export de l'annuaire | **Interdit** : ce serait offrir la base de créateurs à un concurrent ou à un contournement massif. |

> **Masquage symétrique (D40) — tranché par le fondateur le 2026-09-18 : oui.** Les coordonnées
> directes de l'interlocuteur d'une marque sont masquées tant que la mise en relation n'est pas
> ouverte ; l'identité de l'entreprise (nom, logo, site, secteur) reste publique. Ce qui devient
> visible **après** l'ouverture est précisé par **D46**.

### 6.2 Créateur (influenceur majeur)

**Dans le périmètre**

- Page publique dédiée aux créateurs, en français et en anglais.
- Inscription : pays, langue, attestation de majorité, consentement non pré-coché, CGU versionnées.
- **Profil en deux couches** : une couche anonyme (visible par les marques) et une couche identifiante
  (visible seulement par INFLUX, puis par la marque après ouverture de la mise en relation). Chaque
  champ porte son étiquette.
- Réseaux, thématiques, audience (en tranches, avec pays principal de l'audience), formats, tarifs
  indicatifs avec leur devise, portfolio.
- Dépôt de preuves en **stockage privé** ; les chiffres affichés portent leur date de dernière mise à jour.
- **Badge « Audience vérifiée » à deux niveaux**, attribué par un commercial, avec **péremption à 90 jours**.
- Recherche des campagnes ouvertes et **candidature**, qui part en file de validation.
- **Conversation à trois** avec la marque et le commercial INFLUX.
- Espace « mes données ».

**Hors périmètre**

| Exclu | Pourquoi |
|---|---|
| Connexion automatique à Instagram, TikTok, YouTube | Agréments longs et incertains. Vérification manuelle par un commercial au MVP. |
| Contrat en ligne, net créateur calculé par l'application, reversement | **A1**. Le montant et la commission sont négociés dans la conversation et portés au contrat hors plateforme. |
| Mineurs | Régimes légaux spécifiques impossibles à outiller sans risque (**D15**). |
| Agences et managers gérant plusieurs créateurs | Parcours et contrats différents. |
| Pièces jointes dans la messagerie | Vecteur de contournement évident (un PDF contenant un numéro de téléphone) et surface de sécurité inutile. |
| Portugais et autres langues | Français et anglais au lancement. Le portugais est le premier candidat, avant l'ouverture du Brésil. |

### 6.3 Commercial et administrateur (backoffice)

**Dans le périmètre**

- Accès sur un hôte distinct, non référencé, avec authentification renforcée et session courte.
- **Rôles `agent` (commercial) et `admin` distincts dès le Lot 0**, même si une seule personne occupe
  les deux : la saisie libre d'e-mails est plafonnée par rôle (**A4**), et rétro-adapter une
  séparation de rôles coûte cher.
- **Files de validation** : demandes de contact et candidatures, avec prise en charge, attribution,
  refus motivé par un motif typé, et **verrou empêchant deux commerciaux de traiter la même demande**.
- **Recherche de créateurs en vue identifiée**, avec sélection multiple.
- **Proposition INFLUX** : ouvrir une ou plusieurs mises en relation depuis une campagne.
- **Conversation à trois** : y participer, en être visible et nommé, ajouter un autre agent en cours
  de route. Toute lecture par un agent non participant est **horodatée et attribuée**.
- **Pipeline commercial** : état de l'affaire, montant négocié, devise, **commission due et commission
  encaissée**, dates, mode d'envoi du contrat, commercial responsable, relances.
- Validation des profils, attribution et retrait du badge, suspension, notes internes, validation des campagnes.
- **Supervision des leads** : état de synchronisation Brevo / Apollo, cause des échecs en clair, rejeu
  unitaire ou en lot.
- **Envoi d'e-mails Brevo** depuis le backoffice, à partir de trois sources : contacts de la
  plateforme, segments Brevo, saisie libre plafonnée (**A4**).
- Traitement des demandes relatives aux données personnelles ; exports.
- Tableau de bord : demandes en attente et leur ancienneté, affaires en cours, commission encaissée.
- **Invitation nominative** d'une marque ou d'un créateur du réseau du commercial, qui en devient le
  commercial responsable (**D54**, `05` RG116 à RG119).
- **Suivi de la livraison** après signature et **registre des relations préexistantes** (**D52**,
  **D53**, `14` additif du 2026-09-24).

**Hors périmètre**

| Exclu | Pourquoi |
|---|---|
| Calcul, facturation et encaissement de la commission | **A1**. Le backoffice enregistre et additionne ce que le commercial saisit. |
| Algorithme de mise en relation | **D11** : aucune donnée pour le régler. Les mises en relation du pilote constituent précisément le jeu de données qui permettra de le construire. |
| Portefeuilles de clients cloisonnés par commercial | Le modèle de données les prépare (commercial responsable partout), la règle d'accès reste ouverte au MVP. |
| Score de contournement pondéré, calculé chaque nuit | Trop lourd et prématuré : le commercial est dans le fil, il voit tout. Une liste d'alertes suffit. |
| Gestion des pays ouverts aux contrats | Sans contrat dans l'application, l'objet n'a pas de sens au MVP. Revient en V2 avec **D26**. |
| Backoffice en anglais | L'équipe travaille en français — **à confirmer (D36)**. |
| Statistiques avancées, droits fins par agent | Confort. |

---

## 7. Découpage en sept lots — 18 à 25 semaines

**Hypothèses :** l'équivalent d'un développeur à plein temps, et des validations du fondateur sous 48 h.

> **Le calendrier réel dépend d'abord de la création de la société (D25).** Avec la mise en ligne
> progressive dès le Lot 1 (**A6**), la société doit exister **vers la semaine 5** : sans elle, pas de
> mentions légales ni de CGU, donc pas de site public et pas de contrat avec Brevo et Apollo.

Chaque lot passe la définition du « prêt à livrer » (skill `test-strategy`).
`expert-cybersecurite` et `expert-conformite-rgpd` disposent d'un **veto bloquant**.

### Vue d'ensemble

| Lot | Contenu | Valeur observable | Durée |
|---|---|---|---|
| **0 — Socle** | Décisions techniques, dépôt, environnements, premières tables, droits | Un compte de démonstration par rôle se connecte **réellement** dans les trois espaces ; le déploiement est automatique | 1-2 sem. |
| **1 — Inscription et leads** ▸ *1re mise en ligne* | Inscription réelle, pipeline de leads, documents légaux | Toute inscription, partout dans le monde, devient un compte réel **et** un lead dans Brevo sous 1 h et dans Apollo sous 24 h (indicateur n° 5) | 3-4 sem. |
| **2 — Profils, réseaux, audience, badge** | Profils marque et créateur, preuves, badge | Une offre et une demande structurées ; le premier badge « Audience vérifiée » existe et il est daté | 3-4 sem. |
| **3 — Campagnes et recherche anonymisée** | Campagnes, recherche côté marque et côté commercial | Une marque construit sa sélection ; le commercial trouve les bons créateurs d'une campagne en 30 secondes au lieu de fouiller sa mémoire | 3-4 sem. |
| **4 — Mise en relation courtée et messagerie à trois** | Les trois déclencheurs, la file, la conversation | **Le cœur du produit.** Le métier informel du fondateur devient un processus outillé, tracé et reproductible | 4-5 sem. |
| **5 — Backoffice complet, pipeline commercial et e-mails** | Pilotage, affaires, e-mails Brevo | L'équipe pilote son activité et **sait enfin combien elle gagne, sur quoi et avec qui** | 3-4 sem. |
| **6 — Recette, audit, ouverture** | Parcours complet, audits, procédures | Cycle complet vérifié de bout en bout ; lancement du pilote | 1-2 sem. |

### Lot 0 — Socle (1 à 2 semaines)

- **Contenu :** trancher **D2** (framework backend), **D5** (accès aux données), **D12** (place du
  backoffice), **D18** (file des leads) et **D37** (méthode d'authentification) ; dépôt GitHub privé,
  vérifications automatiques, environnements `staging` et `production` sur Railway, projet Supabase,
  gestion des secrets ; création de `apps/api`, `apps/backoffice`, `packages/` et `supabase/` ;
  premières tables (identité, rôles, **commercial responsable**, versions de CGU, journal d'audit
  chaîné, table des taux de commission **créée et vide**) ; droits d'accès testés. **Départ de
  zéro** : le code existant, hors landing page, est une maquette jetable qui n'est ni reprise ni
  adaptée (**D44**, `CLAUDE.md` §16).
- **Valeur :** un compte de démonstration par rôle se connecte réellement dans les trois espaces, et
  le déploiement est automatique.
- **Dépendances :** documents `00` (celui-ci), `01`, `02`, `03` et `04` validés ; **accord explicite
  du fondateur** pour créer le dépôt distant et les comptes externes. Peut démarrer **sans société**
  (comptes transférables ensuite).
- **Agents, dans l'ordre :** `architecte` → `expert-cybersecurite` → `expert-database` →
  `integrateur` → `testeur`.
- **Skills :** `supabase-schema`, `security-rgpd-audit`, `railway-deploy`, `env-secrets`, `test-strategy`.

### Lot 1 — Inscription et leads (3 à 4 semaines) ▸ première mise en ligne

- **Contenu :** inscription réelle avec CGU versionnées et consentement non pré-coché ; confirmation
  d'adresse e-mail ; routage par rôle après connexion ; pipeline de leads (`lead.created`) vers
  **Brevo et Apollo**, avec nouvelles tentatives et rejeu ; désinscriptions synchronisées dans les
  deux sens ; premier backoffice (liste des inscrits, état de synchronisation, rejeu des échecs) ;
  **documents légaux en français et en anglais**, incluant la clause de non-contournement, la mention
  de la supervision des conversations (**A10**) et la conservation probatoire des journaux.
- **Valeur :** toute inscription, partout dans le monde, devient un compte réel **et** un lead dans
  Brevo sous une heure et dans Apollo sous 24 heures (indicateur n° 5, `05`).
- **Dépendances :** Lot 0 ; **D25 — société créée (semaine 5)** ; **D33 / A7 validé par un juriste
  avant la mise en ligne** ; **D29** (durée de la fenêtre de non-contournement) ; **D21** au niveau de
  base ; comptes Brevo et Apollo au nom de la société ; domaine authentifié (SPF, DKIM, DMARC) ;
  trames légales relues par un juriste.
- **Agents, dans l'ordre :** `product-owner` → `expert-marketing` → `expert-conformite-rgpd` →
  `expert-integrations-api` → `expert-ux` → `dev-react-node` → `expert-cybersecurite` → `testeur` →
  `integrateur`.
- **Skills :** `feature-spec`, `lead-pipeline`, `brevo-campaign`, `apollo-lead-sync`,
  `design-system-influx`, `security-rgpd-audit`, `test-strategy`.

### Lot 2 — Profils, réseaux, audience, badge (3 à 4 semaines)

- **Contenu :** profil marque ; **profil créateur en deux couches** (anonyme et identifiante), avec
  étiquette par champ ; réseaux et audience en tranches ; dépôt de preuves en stockage privé ;
  indicateur de complétude ; file de validation des profils dans le backoffice, avec motifs typés ;
  **badge à deux niveaux, avec péremption à 90 jours**, contestation et retrait.
- **Valeur :** une offre et une demande structurées ; le premier badge « Audience vérifiée » existe et
  il est daté.
- **Dépendances :** Lot 1 ; **D34** (libellé, niveaux et péremption du badge) ; **D40** si le
  masquage symétrique est retenu ; **D24** (créateurs particuliers) instruite.
- **Agents, dans l'ordre :** `product-owner` + `expert-matching` → `expert-conformite-rgpd` →
  `expert-ux` → `expert-database` → `dev-react-node` → `expert-cybersecurite` → `testeur`.
- **Skills :** **`profile-verification`** (créée), `feature-spec`, `matching-spec`,
  `supabase-schema`, `design-system-influx`, `test-strategy`.

### Lot 3 — Campagnes et recherche anonymisée (3 à 4 semaines)

- **Contenu :** création et description d'une campagne, validée avant publication ; **recherche de
  créateurs anonymisée** côté marque (facettes en tranches, tri explicable, k-anonymat, limitation de
  débit, pagination plafonnée, export interdit, recherches journalisées) ; **la même recherche en vue
  identifiée côté commercial, avec sélection multiple** — c'est le socle de la proposition INFLUX du
  Lot 4 ; recherche de campagnes côté créateur ; shortlist.
- **Valeur :** une marque construit sa sélection seule ; le commercial trouve les bons créateurs d'une
  campagne en 30 secondes au lieu de fouiller sa mémoire.
- **Dépendances :** Lot 2 ; **D38** (masse critique de profils avant d'ouvrir la recherche) ;
  modération de chaque visuel de portfolio en place — c'est la fuite d'anonymisation la plus probable.
- **Agents, dans l'ordre :** `expert-matching` → `product-owner` → `expert-ux` →
  `expert-cybersecurite` → `dev-react-node` → `testeur`.
- **Skills :** `matching-spec` (étendue), `feature-spec`, `design-system-influx`,
  `security-rgpd-audit`, `test-strategy`.

### Lot 4 — Mise en relation courtée et messagerie à trois (4 à 5 semaines)

- **Contenu :** les trois déclencheurs, dont la **proposition INFLUX initiée par le commercial**
  (depuis une campagne, vers un ou plusieurs créateurs sélectionnés dans la recherche identifiée) ;
  **file de validation commerciale** (prise en charge, attribution, refus motivé, délai de traitement
  mesuré) ; objet « mise en relation » ; **révélation d'identité horodatée** et e-mail de confirmation
  aux deux parties avec une référence ; **conversation à trois**, commercial visible et nommé ; ajout
  d'un agent en cours de route ; lecture journalisée ; signalement des coordonnées (signaler, pas
  masquer) ; liste d'alertes.
- **Valeur :** **le cœur du produit.** Le métier informel du fondateur devient un processus outillé,
  tracé et reproductible par un nouveau commercial.
- **Dépendances :** Lot 3 ; **D39 (délai maximal de traitement de la file) tranchée** ; **D30**
  (politique de signalement des coordonnées) ; `docs/mvp/01-intermediation-courtee.md` validé.
- **Agents, dans l'ordre :** `product-owner` + `expert-paiement-facturation` →
  `expert-conformite-rgpd` → `expert-ux` → `expert-database` → `dev-react-node` →
  `expert-cybersecurite` → `testeur`.
- **Skills :** **`intermediation-tracking`**, **`messaging-spec`**, **`backoffice-ops`** (les trois
  créées), `feature-spec`, `design-system-influx`, `test-strategy`.

### Lot 5 — Backoffice complet, pipeline commercial et e-mails (3 à 4 semaines)

- **Contenu :** tableau de bord ; **pipeline commercial** (états de l'affaire, montant, devise,
  commission due et encaissée, mode d'envoi du contrat, relances) ; files de validation avec verrou
  anti-double-traitement ; fiches de compte, suspension, notes ; supervision des leads ; **envoi
  d'e-mails avec les trois sources et leurs bases légales** (**A4**) ; traitement des demandes RGPD ;
  exports.
- **Valeur :** l'équipe pilote son activité et **sait enfin combien elle gagne, sur quoi et avec qui**.
- **Dépendances :** Lot 4 ; **D35** (plafonds et conditions de la saisie libre d'e-mails — veto
  `expert-conformite-rgpd`) ; **D36** (langue du backoffice).
- **Agents, dans l'ordre :** `expert-paiement-facturation` → `product-owner` → `expert-ux` →
  `expert-marketing` + `expert-integrations-api` + `expert-conformite-rgpd` → `dev-react-node` →
  `testeur`.
- **Skills :** **`intermediation-tracking`**, **`backoffice-ops`**, `brevo-campaign` (étendue),
  `design-system-influx`, `test-strategy`.

### Lot 6 — Recette, audit, ouverture (1 à 2 semaines)

- **Contenu :** parcours complet vérifié de bout en bout — inscription → badge → campagne → recherche
  → demande → validation → conversation à trois → affaire signée et commission encaissée ; audit de
  sécurité et audit de conformité ; **procédures écrites** permettant à un nouveau commercial de
  prendre le poste ; lancement du pilote.
- **Valeur :** le cycle complet est vérifié ; le pilote démarre.
- **Dépendances :** tous les lots précédents ; levée des vetos `expert-cybersecurite` et
  `expert-conformite-rgpd` ; **mise en production uniquement sur accord explicite du fondateur**.
- **Agents, dans l'ordre :** `testeur` → `expert-cybersecurite` + `expert-conformite-rgpd` →
  `dev-react-node` → `integrateur`.
- **Skills :** `test-strategy`, `security-rgpd-audit`, `railway-deploy`.

---

## 8. Ce qui sort du périmètre, et pourquoi

| Exclu du MVP | Pourquoi | Quand cela revient |
|---|---|---|
| Module de contrat, signature électronique, encaissement, calcul et facturation de la commission | **A1**. Le commercial fait tout cela hors plateforme. Les tables « affaires » et « taux de commission » existent déjà, pour ne pas avoir à tout reprendre | **V2**, avec D9 (prestataire) et D25 (société) |
| Algorithme de mise en relation | **D11** : aucune donnée pour le régler aujourd'hui. Le pilote la produit | Après le pilote |
| Connexion aux API des réseaux sociaux | Agréments longs et incertains | Après le pilote |
| Pièces jointes libres dans la messagerie | Vecteur de contournement évident et surface de sécurité inutile | À rouvrir si un vrai besoin apparaît |
| Messagerie en temps réel | Le rafraîchissement suffit au volume du pilote | Après le pilote |
| Portefeuilles de clients cloisonnés | Le modèle de données les prépare, la règle d'accès reste ouverte | Dès que l'équipe dépasse 2-3 commerciaux |
| Agences, comptes multi-utilisateurs | Parcours et contrats différents | Après le pilote |
| Avis et notations | Il faut d'abord un historique d'affaires | Après le pilote |
| Mineurs | **D15** : régimes légaux spécifiques | Non planifié |
| Portugais | Français et anglais au lancement | Avant l'ouverture du Brésil |
| Export de l'annuaire de créateurs | **Interdit** : ce serait offrir la base à un concurrent | Jamais |
| Pays ouverts aux contrats, multi-devises, règles fiscales | Sans contrat dans l'application, l'objet n'existe pas | **V2**, avec D26 et D27 |

---

## 9. Si le délai dérape

**À retirer, dans cet ordre :**

1. **Recherche de campagnes côté créateur** → remplacée par un simple fil chronologique des campagnes
   ouvertes.
2. **Alertes automatiques de coordonnées** → remplacées par le contrôle visuel du commercial, qui est
   déjà dans le fil et voit tout passer.
3. **Actions de masse dans le backoffice** → traitement unitaire, acceptable au volume du pilote.
4. **Tableau de bord** → remplacé par des exports.

**À ne jamais retirer, sous aucun prétexte :**

- L'objet « mise en relation » et son origine.
- La file de validation.
- La conversation à trois avec le commercial visible et nommé.
- L'horodatage de la révélation d'identité.
- Le registre inaltérable (append-only).
- Le pipeline commercial.
- Les CGU versionnées et la clause de non-contournement.
- Le pipeline de synchronisation des leads.

Retirer l'un de ces huit éléments ne raccourcit pas le projet : il le vide de sa valeur ou le rend
juridiquement indéfendable.

---

## 10. Risques

### 10.1 Les quatre risques majeurs

| # | Risque | Nature | Parade |
|---|---|---|---|
| **R1** | **Le plafond de croissance est le nombre de commerciaux, pas la technique.** Chaque conversation mobilise un humain. Si la plateforme ne rend pas le commercial plus rapide, elle ne sert à rien | Produit / business | L'indicateur n°4 (**affaires par commercial et par semaine**) est le juge de paix. La proposition INFLUX en sélection multiple et la file bien conçue sont les deux leviers de vitesse |
| **R2** | **Le délai de traitement de la file de validation (D39).** Rien ne circule sans validation : si une demande attend 48 h, la conversion s'effondre et les deux parties se cherchent ailleurs | Produit | **D39 à arbitrer avant le Lot 4** : délai maximal, ce qui se passe au-delà, horaires couverts. Délai mesuré et affiché dans le tableau de bord dès le premier jour |
| **R3** | **D25 (pays de la société) conditionne la mise en ligne dès la semaine 5.** Sans société : pas de mentions légales, pas de CGU, pas de contrat avec Brevo ni Apollo, donc pas de site public | Légal / calendrier | Mandater l'avocat fiscaliste **immédiatement**. Le Lot 0 démarre sans attendre, mais le Lot 1 ne peut pas être mis en ligne |
| **R4** | **A7 (Apollo pour tous les inscrits) est un risque juridique ouvert, non levé.** L'arbitrage a été pris **contre la recommandation** faite au fondateur | Légal | `expert-conformite-rgpd` **conserve son veto** et instruit le sujet (**D33**) ; **validation d'un juriste obligatoire avant la mise en ligne du Lot 1** ; interrupteur par catégorie de profil prévu dès la conception pour pouvoir restreindre sans redéveloppement |

### 10.2 Les autres risques

| Risque | Nature | Parade |
|---|---|---|
| **Paiement à la confiance** : une commission convenue n'est jamais versée | Financier | Assumé au MVP (**A1**). Le pipeline commercial suit explicitement « commission due » et « commission encaissée » : l'écart entre les deux est visible et mesuré dès le premier jour. C'est aussi l'argument chiffré qui justifiera l'encaissement en V2 |
| **Contournement malgré la présence du commercial** | Business | Le commercial dans le fil est la protection principale. En appui : clause de non-contournement posée dès le jour 1 (**A5**), signalement des coordonnées, pièces jointes interdites, liste des fils silencieux |
| **Statut juridique des conversations supervisées (A10)** : un utilisateur conteste la lecture de ses échanges | Légal | CGU et politique de confidentialité explicites **dès le Lot 1** : ce ne sont pas des correspondances privées mais des échanges hébergés et supervisés. Intermédiaire visible et nommé. Chaque lecture horodatée et attribuée |
| **Fuite de l'anonymisation par le portfolio** : un visuel laisse deviner le compte | Produit / business | Anonymisation **séparée en base**, pas filtrée en code ; **modération de chaque visuel** avant publication ; k-anonymat à 5 sur les facettes ; pagination plafonnée ; export interdit |
| **Pas assez de profils pour que la recherche soit utile** | Produit | **D38** : masse critique à atteindre avant d'ouvrir la recherche (ordre de grandeur : 30 profils publiés, 5 par thématique). Jusque-là, seule la vue commerciale identifiée sert |
| **Marque « INFLUX » déjà déposée dans une zone visée** | Légal / commercial | Recherche d'antériorité en UE, aux États-Unis, au Canada et au Brésil **avant** d'investir dans la marque |
| **Créateurs particuliers** : fiscalité, droit de la consommation, requalification | Légal | **D24**, instruit dès le Lot 2 avec l'expert-comptable et le juriste. Renforcé par le fait que la commission est perçue hors plateforme au MVP |
| **E-mail envoyé par erreur depuis l'environnement de test**, ou e-mails classés en indésirables | Technique / commercial | Intégrations Brevo et Apollo désactivées en `staging` ; domaine authentifié tôt (SPF, DKIM, DMARC) ; montée en volume progressive ; fenêtre d'annulation avant envoi |
| **Saisie libre d'e-mails détournée en prospection de masse** | Légal | **A4** : plafonds, journalisation nominative, désinscription obligatoire, double confirmation (**D35**, veto `expert-conformite-rgpd`) |
| **Fuite de données entre utilisateurs** | Sécurité | Droits d'accès au niveau de la base, **testés et non supposés** ; backoffice sur un hôte distinct ; fichiers en stockage privé ; veto `expert-cybersecurite` |
| **Le périmètre grossit en cours de route** | Projet | Tout ajout passe par `chef-de-projet` et **remplace** quelque chose. Ce document fait foi |

---

## 11. Décisions ouvertes

Le suivi officiel est dans `CLAUDE.md` §13. Ce tableau reprend les décisions nées de ce cadrage.

### 11.1 Nouvelles décisions

| # | Sujet | Arbitre | Statut | Échéance |
|---|---|---|---|---|
| **D29** | Durée de la fenêtre de non-contournement, régime asymétrique B2B / B2C | Fondateur + juriste | Ouverte | Lot 1 |
| **D30** | Politique de signalement des coordonnées ; pièces jointes interdites | `product-owner` + `expert-ux` + Fondateur | Ouverte | Lot 4 |
| **D31** | *Sans objet* — remplacée par **A8** : le commercial saisit lui-même l'issue de l'affaire, on ne la demande pas aux utilisateurs | — | Fermée | — |
| **D32** | Portée rétroactive de la commission en V2 | Fondateur | **Tranchée (A5)** : clause posée dès le jour 1, usage suspendu pendant le pilote | — |
| **D33** | Apollo et créateurs particuliers | `expert-conformite-rgpd` (**veto maintenu**) + juriste | **Orientation du fondateur (A7) : tous les inscrits**, prise contre la recommandation. `expert-conformite-rgpd` instruit ; **validation d'un juriste obligatoire avant la mise en ligne**. Risque inscrit, non levé | Lot 1 |
| **D34** | Libellé, niveaux et péremption du badge | `product-owner` + `expert-conformite-rgpd` | Ouverte | Lot 2 |
| **D35** | Plafonds et conditions de la saisie libre d'e-mails | `expert-conformite-rgpd` (**veto**) + Fondateur | Ouverte | Lot 5 |
| **D36** | Langue du backoffice | Fondateur | Ouverte | Lot 5 |
| **D37** | Méthode d'authentification (mot de passe, lien magique, connexion via un tiers) | `architecte` + `expert-cybersecurite` + `expert-ux` | **Tranchée (2026-09-18)** : code à 6 chiffres par e-mail pour les membres, mot de passe + TOTP au backoffice (`CLAUDE.md` §13) | — |
| **D38** | Masse critique de profils avant d'ouvrir la recherche (ordre de grandeur : 30 publiés, 5 par thématique) | `chef-de-projet` + Fondateur | Ouverte | Lot 3 |
| **D39** | **Délai maximal de traitement de la file de validation** : combien de temps au maximum, ce qui se passe au-delà, horaires couverts | **Fondateur** + `product-owner` | **Tranchée (2026-09-18)** : **1 jour ouvré** ; au-delà, voir D49 | — |
| **D40** | **Masquage symétrique des coordonnées.** D16 masque aujourd'hui les pseudos et liens des créateurs seulement. Faut-il masquer de la même façon les coordonnées directes des marques tant que la mise en relation n'est pas ouverte ? L'identité de l'entreprise resterait publique | **Fondateur** + `expert-ux` + `expert-conformite-rgpd` | **Tranchée (2026-09-18) : oui.** Ce qui est visible après l'ouverture : **D46** | — |

### 11.2 Décisions à re-trancher ou à confirmer

| # | Sujet | Arbitre | Échéance |
|---|---|---|---|
| **D12** | Place du backoffice : application séparée ou espace protégé — à re-trancher à la lumière de ce cadrage | `architecte` + Fondateur | **Faite (2026-09-18)** : application séparée `apps/backoffice` |
| **D13** | Périmètre du MVP — **re-tranchée le 2026-09-18** : place de marché courtée, 7 lots, ce document | `chef-de-projet` + Fondateur | **Faite** |
| **D2**, **D5**, **D18** | Framework backend, accès aux données, file des leads — à confirmer | `architecte` | **Faites (2026-09-18)** : Fastify 5, Drizzle + migrations SQL relues, `outbox_events` (`02`) |

### 11.3 Décisions reportées en V2 avec A1

Elles ne bloquent plus le MVP, mais elles bloqueront la V2 : **D7** (fiscalité de la commission),
**D9** (prestataire de paiement), **D10** (signature électronique), **D19** (règle d'arrondi),
**D20** (moment du paiement, litiges, remboursements), **D22** (facturation électronique),
**D23** (structure des factures), **D26** (pays ouverts aux contrats), **D27** (devises).

**Attention :** **D25** (pays de la société) n'est **pas** reportée. Elle conditionne la mise en ligne
du Lot 1 en semaine 5.

---

## 12. Prérequis externes

> Aucun agent ne lance ces actions sans l'accord explicite du fondateur.

| Ordre | Action | Nécessaire pour | Urgence |
|---|---|---|---|
| 1 | **Mandater un avocat fiscaliste international et choisir le pays de la société (D25)** | Lot 1, mise en ligne semaine 5 | **Immédiate** |
| 2 | **Faire valider par un juriste l'envoi de tous les inscrits vers Apollo (A7 / D33)** | Mise en ligne du Lot 1 | **Immédiate** — `expert-conformite-rgpd` garde son veto |
| 3 | Recherche d'antériorité et dépôt de la marque INFLUX (UE, États-Unis, Canada, Brésil) ; réservation des noms de domaine | Avant d'investir dans la marque | Élevée |
| 4 | Créer la société | Mentions légales, CGU, contrats Brevo et Apollo | **Semaine 5** |
| 5 | Mandater un juriste (numérique, consommation, influence commerciale) pour les documents en français et en anglais, **dont la clause de non-contournement (A5) et la mention de supervision des conversations (A10)** | Lot 1 | Élevée |
| 6 | Ouvrir GitHub, Supabase et Railway (possible avant la société, transférables ensuite ; hébergement UE par défaut, à confirmer après D25) | Lot 0 | Immédiate |
| 7 | Ouvrir Brevo et Apollo.io au nom de la société ; authentifier **les trois sous-domaines d'envoi** — transactionnel, newsletter, prospection (SPF, DKIM, DMARC, `16` RG9) | Lot 1 | Semaine 4 |
| 8 | Signer les contrats de sous-traitance des données (Brevo, Apollo, Supabase, Railway) et tenir le registre des traitements | Avant la mise en ligne du Lot 1 | Élevée |
| 9 | Désigner un représentant dans l'UE (et au Royaume-Uni si nécessaire) si la société est établie hors UE | Avant la mise en ligne du Lot 1 | Dépend de D25 |
| 10 | Mandater un expert-comptable dans le pays de la société | D24 au Lot 2, puis toute la V2 | Moyenne |
| 11 | Recruter les marques et les créateurs pilotes | Lots 3 à 6 | À démarrer au Lot 2 |
| 12 | **Ouvrir le compte chez le prestataire de paiement (D9)** | **V2 uniquement** — plus sur le chemin critique du MVP | Reportée |

---

## 13. Prochaines étapes

1. **Fondateur :** lancer les prérequis 1 à 4 ; trancher les six sujets listés ci-dessous ; relire et
   corriger ce document.
2. **En parallèle, agents :**
   - `expert-paiement-facturation` + `expert-conformite-rgpd` → skill `intermediation-tracking` puis
     `docs/mvp/01-intermediation-courtee.md`, **le document qui contraint tous les autres**.
   - `architecte` → `docs/mvp/02-architecture-3-espaces.md` (D2, D5, D12, D18, D37).
   - `expert-cybersecurite` + `architecte` → matrice des droits et règles d'accès.
   - `expert-database` → modèle de données du MVP (première tranche).
   - `testeur` → plan de test, première tranche (« prêt à livrer » des Lots 0 et 1).
3. **Ensuite :** spécifications fonctionnelles lot par lot, dans l'ordre du §7.

**Aucun code applicatif n'est écrit avant la validation des documents `00` à `04`.** *(La maquette
de démonstration n'est pas du code applicatif du produit : elle est jetable, D44.)*

### Les six sujets qui attendent l'arbitrage du fondateur

| Ordre d'urgence | Sujet | Conséquence si la réponse tarde |
|---|---|---|
| 1 | **D25 — pays de la société** | Pas de mise en ligne en semaine 5 : tout le calendrier glisse |
| 2 | **A7 / D33 — Apollo pour tous** | Le Lot 1 ne peut pas être mis en ligne sans validation d'un juriste ; le veto RGPD reste actif |
| 3 | ~~**D39 — délai maximal de traitement de la file**~~ | **Tranchée le 2026-09-18** : 1 jour ouvré |
| 4 | ~~**D40 — masquage symétrique des coordonnées côté marque**~~ | **Tranchée le 2026-09-18** : oui ; portée après l'ouverture en D46 |
| 5 | **D38 — masse critique de profils avant d'ouvrir la recherche** | La date d'ouverture de la recherche du Lot 3 reste indéterminée |
| 6 | **D36 — langue du backoffice** | Le chiffrage du Lot 5 reste approximatif |
