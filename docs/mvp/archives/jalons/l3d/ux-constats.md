# L3D-U — constats `expert-ux` (C5 fil, C6 fiche)
> `expert-ux`, 2026-11-18, commits 202493b, 3bab80a, dbefe32. Relu : fiche `ux.md`, `modele.md` §7, `17` §5.5-5.6,
> `09` l. 868-880, `11` RG26, code des deux écrans, `campaign.json` FR et EN, `creator-campaigns.spec.ts`.
> **Limite :** aucune capture ni exécution (pas d'accès au shell) ; rendu 375 et 1 440 jugé sur le code et les
> tokens. Les deux points marqués « à confirmer en capture » doivent l'être par la recette F.
> **Tenus :** aucun montant ni coordonnée ; carte close sans lien ; fil vide explicite ; nombre avant la liste ;
> D74 ; tokens seuls ; FR/EN sur chaque clé.

## Décompte
Bloquant 0 · Jalon 4 · Avant production 9 · Plus tard 6.

## Jalon

**L3DU-1 — jalon — impasse : une fiche sans suite ni explication, sous une carte qui promet une date.**
`CampaignRecordScreen.tsx` l. 148-158 (le corps s'arrête sur le bloc marque) ; `CampaignFeedCard.tsx` l. 141-144
et l. 146-154. *Scénario :* sur 375 px, la créatrice lit « Candidatures avant le 28 novembre », touche le bouton vert
« Voir la campagne », lit tout, et ne trouve rien à faire : ni bouton, ni phrase. Elle conclut à une panne ou à
une page cassée. EC-L3D-3 retire à juste titre le bouton, mais « sans impasse ni promesse » exige de le dire.
*Correctif :* un `Notice` info, factuel, sans date, sous le titre de la fiche et au-dessus de la liste du fil
(à valider par `product-owner`, hors catalogue `09`) — FR « Vous ne pouvez pas encore candidater depuis INFLUX : cette
page sert à découvrir la campagne. » · EN « You cannot apply through INFLUX yet: this page lets you read the
campaign. » — retiré au Lot 4.

**L3DU-2 — jalon — « vous diffusez » lu par le créateur : le pronom est inversé.**
`locales/fr/campaign.json` l. 503, `en/campaign.json` l. 503 (`usage_right.media_buy`), affiché par
`CampaignReadBody` (ligne « Droits d'usage »). *Scénario :* le libellé est écrit pour la marque qui choisit l'option
(« Achat média : vous diffusez le contenu comme votre propre publicité ») ; sur la fiche, la créatrice lit que
c'est elle qui diffuse le contenu comme sa publicité, au point le plus lourd de la fiche (RG40).
*Correctif :* un libellé sans pronom, valable pour la marque comme pour le créateur — « Achat média : le contenu
est diffusé comme publicité de la marque » · « Media buy: the content runs as the brand's own advertising ».

**L3DU-3 — jalon — encart RG40 écrit par l'agent (EC-L3D-05-3) : plus fort que le catalogue, sans suite.**
`locales/fr/campaign.json` l. 62, `en` l. 62 ; `CampaignReadBody.tsx` l. 45-57. Le catalogue (`09` l. 877) dit
« Vos contenus pourront être diffusés sans limite de durée ni de pays ». Le texte livré ajoute « comme sa propre
publicité, partout et sans fin » (affirmation juridique non validée, plus large que RG40), « media buying » en EN
(terme du catalogue : « paid media rights »), et « Assurez-vous de l'avoir bien compris » : un ordre, sans personne à
qui poser la question. *Tranché :* revenir au catalogue, garder l'intitulé de `17` et finir par une consigne
réalisable. FR « Ce que devient votre contenu : cette campagne demande un achat média illimité et mondial. Votre
contenu pourra être diffusé sans limite de durée ni de pays. Vérifiez ces conditions avant de vous engager. » · EN
« What becomes of your content: this campaign requires unlimited worldwide paid media rights. Your content may
be used with no time or country limit. Check these conditions before you commit. » Ton `warning` et icône conservés.

**L3DU-4 — jalon — titres de métadonnées (EC-L3D-04-2, à revoir) : faux pour le créateur.**
`AuthPage.tsx` l. 27-28 (`advertiserCampaigns` → `campaign.meta.list`, `advertiserCampaign` → `campaign.meta.form`).
*Scénario :* l'onglet du créateur dit « Mes campagnes » sur le fil et « Ma campagne » sur la fiche d'une marque
tierce, alors que le `h1` dit « Campagnes » ; écart entre titre et `h1` (WCAG 2.4.2), lecteur d'écran trompé.
*Tranché :* le serveur ignore le rôle (`modele.md` §7) : titres neutres, partagés, le `h1` restant propre à
l'écran. *Correctif :* `meta.list` = « Campagnes » / « Campaigns », `meta.form` = « Campagne » / « Campaign »
(les `h1` de la marque restent « Mes campagnes », « Ma campagne » ; test e2e de titre de la marque à ajuster).

## Avant production (une ligne chacun)
- **L3DU-5** — Libellé « Candidatures closes » et son statut visuel : voir « Points tranchés » ci-dessous ; en
  correctif de rendu, `CampaignFeedCard.tsx` l. 95-106 et `campaign-classes.ts` l. 99.
- **L3DU-6** — Carte : deux liens de même cible (titre l. 99 et bouton l. 147-153) doublent les arrêts clavier et la
  liste des liens ; garder le titre en lien, le bouton devient un appui de la carte entière ou disparaît.
- **L3DU-7** — Retour de la fiche au fil (`CampaignRecordScreen.tsx` l. 103-112, `use-open-campaigns.ts`) : le tri et
  « Voir la suite » repartent de zéro (page 1, « Plus récentes ») ; mettre le tri et le rang dans l'adresse.
- **L3DU-8** — Fiche : les deux encarts (RG32 toujours affiché pour une campagne rémunérée, RG40) passent avant tout
  contenu (`CampaignReadBody.tsx` l. 45-57) ; sur 375 px, le brief est sous deux bandeaux ; poser RG32 sous la section
  rémunération, garder RG40 en tête.
- **L3DU-9** — Encart RG32 (`campaign.json` l. 65) : texte propre à l'agent, absent du catalogue (`09` l. 878), avec une
  mise en garde juridique (« sans en garantir la conformité locale ») ; à faire relire par `expert-conformite-rgpd`
  (Lot 6) ou à aligner sur le catalogue.
- **L3DU-10** — Fiche : la marque, son logo et son badge arrivent après les six sections (`CampaignReadBody.tsx`
  l. 81-112) ; la carte les met en tête ; remonter le bloc marque (l'aperçu de la marque suit, attendus à ajuster).
- **L3DU-11** — Badge de marque : pastille `VerifiedBadge` sur la carte (phrase de 70 signes dans une pilule, à
  confirmer en capture 375), simple `<p>` gris sur la fiche (l. 106-108) ; même composant des deux côtés.
- **L3DU-12** — Fiche « n'est plus ouverte » : deux liens « Campagnes » (en-tête et carte, `CampaignRecordScreen.tsx`
  l. 121-126) et « D'autres campagnes vous attendent » promet un fil peut-être vide ; lien « Voir les campagnes
  ouvertes », phrase « Elle n'accepte plus de candidatures ou a été retirée. ».
- **L3DU-13** — Refus 403 (`feed.forbidden`, `record.forbidden`) : « état actuel de votre compte » sans issue ;
  ajouter où agir (lien vers « Mon compte »).

## Plus tard
- **L3DU-14** — « Voir la suite » (`CampaignFeedScreen.tsx` l. 151-159) : ajout silencieux de cartes ; annoncer
  « 12 campagnes affichées sur 14 » dans une zone `status`.
- **L3DU-15** — Tri « Plus récentes » : une carte close peut ouvrir le fil (`11` RG33, à relire par `product-owner`).
- **L3DU-16** — Le nombre (RG35) compte les campagnes closes : « 4 campagnes » pour 3 ouvertes ; il faut le nombre
  d'ouvertes dans la réponse.
- **L3DU-17** — Plafond de pages (`feed.capReached`) : le créateur ne peut plus rien affiner tant que les filtres
  (EC-L3D-2) manquent ; impasse à traiter avec les filtres, Lot 6bis.
- **L3DU-18** — Vocabulaire de la nature : « numéraire », « dotation », « Affiliation » nu (`campaign.json` l. 487-491)
  est jargon pour un créateur ; « en argent », « produit offert », « commission sur ventes », avec `product-owner`.
- **L3DU-19** — Créateur d'un pays non ouvert aux contrats (principe 9) : le fil n'en dit rien ; à poser avec la
  candidature (Lot 4).

## Points tranchés
1. **Titre « Mes campagnes » (EC-L3D-04-2)** : retiré, remplacé par un titre neutre (L3DU-4).
2. **Encart RG40 (EC-L3D-05-3)** : l'écriture de l'agent est écartée au profit du catalogue plus une consigne
   (L3DU-3) ; le texte reste à faire valider par le fondateur (aucune couleur ni token nouveau).
3. **« Candidatures closes »** : garder ce libellé (celui de `17` l. 1593 et de RG26, « clos » étant le mot de la
   spec ; EN « Applications closed »), refuser « Candidatures fermées ». Le statut visuel est trop faible : le fond
   de la carte close (`surface-page` #0a0b0a contre `surface-card` #121413) ne se voit presque pas et le badge neutre
   arrive après le titre. Correctif : badge **au-dessus de la marque**, doublé d'une icône (cadenas ou horloge, via
   `icons.ts`) et de la date (« Candidatures closes le 16 nov. »), qui remplace « Candidatures avant le … » sur
   cette carte seule. Texte à pleine opacité, pas de grisé par transparence (contraste AA tenu). Aucun token neuf.

## Accessibilité
Étiquette du tri, titres, listes, `status` du nombre, alt du logo, cibles de 44 px : conformes. L'axe des e2e ne
couvre ni la tabulation du fil, ni le focus après « Voir la suite », ni la carte close.

## À valider par le fondateur
Textes de L3DU-1, L3DU-3, L3DU-9 (juriste) et titre de L3DU-4. Aucune nouvelle couleur.
