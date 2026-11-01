# L2A-08 — Listes de départ des référentiels du Lot 2

> `expert-matching`, grille `product-owner`, 2026-11-01 ; lu par 09 (`0201`) ; relu par le fondateur.

## Règles communes

- Code anglais `^[a-z0-9]+(_[a-z0-9]+)*$` ; région : ISO 3166-2 complet (`FR-IDF`). Code servi jamais
  renommé ni réutilisé : `retired_at`, ajout par migration relue (`04` §3.1).
- `label_key` = `<table au singulier>.<code>` sous `check` (forme de `0129`) : `usage_right.none`,
  `region.FR-IDF`. Libellés FR / EN : traductions de L2B, jamais en base (R8).
- Ni « autre » ni fourre-tout (`matching-spec` A1) ; une liste pour marques, créateurs, campagnes
  (`07` RG33, `09` RG25, RG54) ; manque : migration à la demande d'un commercial.
- Tranches : bornes entières, haute incluse, contiguës, dernière ouverte (nul).

## `topics` — 17, `parent_code` nul

F1, F2, `06` RG27. Grossière à dessein : à 30 profils (D38), une liste fine met F1 sous k = 5 (A5) ;
on affinera par `parent_code` sans renommer.

`beauty` Beauté / Beauty · `fashion` Mode / Fashion · `food` Cuisine et gastronomie / Food and cooking ·
`travel` Voyage / Travel · `sport_fitness` Sport et fitness / Sport and fitness · `wellness` Bien-être et
santé / Wellness and health · `family` Famille et parentalité / Family and parenting · `home` Maison,
jardin et DIY / Home, garden and DIY · `gaming` Jeux vidéo / Gaming · `tech` High-tech / Tech ·
`entertainment` Humour et divertissement / Comedy and entertainment · `music` Musique / Music · `culture`
Cinéma, séries, livres et arts / Film, TV, books and arts · `education` Éducation et vulgarisation /
Education and learning · `business_finance` Business et finances personnelles / Business and personal
finance · `automotive` Auto et moto / Cars and motorbikes · `pets` Animaux / Pets.
Absents : `lifestyle` (fourre-tout) ; politique, religion (conviction du créateur, A12).

## `networks` — 10, `supports_ownership_proof` vrai

F3, `07` bloc 3. Entrée : contenu de marque courant, profil lisible sans connexion ni abonnement payant
(`08` RG26, D52), statistiques natives (RG31). « Vrai » constaté sur un compte réel avant `production`.

`instagram` Instagram · `tiktok` TikTok · `youtube` YouTube · `facebook` Facebook · `linkedin` LinkedIn ·
`x` X · `snapchat` Snapchat · `twitch` Twitch · `pinterest` Pinterest · `threads` Threads.

## `formats` — 24, `network_code` = préfixe du code

F11, F12 (`07` RG64), `09` RG36. Format = ce qu'une marque achète seul ; YouTube sépare vidéo dédiée et
intégration (prix du simple au triple).

- `instagram_post` Publication / Post · `instagram_carousel` Carrousel / Carousel · `instagram_reel`
  Reel · `instagram_story` Story · `instagram_live` Live
- `tiktok_video` Vidéo / Video · `tiktok_carousel` Carrousel photo / Photo carousel · `tiktok_live` Live
- `youtube_video` Vidéo dédiée / Dedicated video · `youtube_integration` Intégration dans une vidéo /
  In-video integration · `youtube_short` Short · `youtube_live` Live
- `facebook_post` Publication / Post · `facebook_reel` Reel · `facebook_story` Story
- `linkedin_post`, `x_post`, `threads_post` Publication / Post · `snapchat_story` Story ·
  `snapchat_spotlight` Spotlight · `twitch_live` Live · `pinterest_pin` Épingle / Pin
- `network_code` nul : `ugc_video` Vidéo UGC / UGC video · `ugc_photo` Photo UGC / UGC photo (livré à
  la marque, `09` RG18)

## `sectors` — 26, dont 7 sensibles

`06` RG15, `07` RG75, `09` RG25 ; `is_sensitive` : les sept de `09` RG84, elles seules.

- Sensibles : `alcohol` Alcool / Alcohol · `gambling` Jeux d'argent et paris / Gambling and betting ·
  `cbd` CBD · `finance` Finance (banque, assurance, placements) / Finance (banking, insurance,
  investing) · `health` Santé (médicaments, dispositifs, compléments) / Health (medicines, devices,
  supplements) · `crypto` Crypto-actifs / Crypto-assets · `adult` Contenu adulte / Adult content
- `beauty_personal_care` Beauté et soins / Beauty and personal care · `fashion_accessories` Mode et
  bijoux / Fashion and jewellery · `food_beverages` Alimentation et boissons sans alcool / Food and soft
  drinks · `restaurants_hospitality` Restauration et hôtellerie / Hospitality ·
  `travel_tourism` Voyage et tourisme / Travel and tourism · `sports_leisure` Sport et loisirs / Sports
  and leisure · `home_garden` Maison et jardin / Home and garden · `consumer_electronics` Électronique /
  Consumer electronics · `software_telecom` Logiciels et télécoms / Software and telecoms ·
  `video_games` Jeux vidéo / Video games · `automotive_mobility` Automobile et mobilité / Automotive and
  mobility · `media_entertainment` Médias et divertissement / Media and entertainment ·
  `education_training` Éducation et formation / Education and training · `baby_kids` Puériculture /
  Baby and kids · `pet_care` Animalerie / Pet care · `retail_ecommerce` Distribution et e-commerce /
  Retail and e-commerce · `real_estate` Immobilier / Real estate · `business_services` Services aux
  entreprises / Business services · `nonprofit_public` Associations et organismes publics / Non-profits
  and public bodies

Absents par construction : un secteur à revue renforcée hors des sept (politique, religion, tabac,
armes, drogues) n'entre qu'en amendant RG84 (`09` Q6).

## `usage_rights` — 4 (`09` RG38, portée croissante)

F14. `none` Aucun / None · `organic_repost` Repost organique / Organic repost · `paid_whitelisting`
Whitelisting publicitaire / Paid whitelisting · `media_buy` Achat média / Media buy. Ordre 1-4
(`sort_order`, au choix de 09).

## `editorial_tones` — 7 (`07` RG34, F22)

`educational` Pédagogique / Educational · `humorous` Humoristique / Humorous · `inspiring` Inspirant /
Inspiring · `premium` Premium et élégant / Premium and elegant · `straightforward` Direct et sans détour
/ Straightforward · `family_friendly` Familial / Family-friendly · `expert` Expert et technique /
Expert and technical.

## Tranches (codes, bornes ; libellés à L2B)

- `audience_bands` (D79 (10), F4, portée `04` §5.2) : `nano` 0-9 999 · `micro` 10 000-49 999 · `mid`
  50 000-499 999 · `macro` 500 000-999 999 · `mega` 1 000 000-nul.
- `engagement_bands` (D79 (10), F5), points de base : `under_1` 0-99 · `1_3` 100-299 · `3_6` 300-599 ·
  `6_plus` 600-nul.
- `publication_frequencies` (RG114, F24), posts sur 30 j, `sort_order` : `daily` 25-nul (1) ·
  `several_per_week` 8-24 (2) · `weekly` 4-7 (3) · `biweekly` 2-3 (4) · `monthly_or_less` 0-1 (5).
- `comment_bands` (RG115, F25) : `0_9` 0-9 · `10_49` · `50_199` · `200_999` · `1000_plus` 1 000-nul.
- `age_bands` (F10, D15) : `18_24` · `25_34` · `35_44` · `45_plus` 45-nul.
- `audience_genders` (F9) : `female_majority` · `mixed` · `male_majority`, sans borne en base (60 % :
  libellé et dérivation de L2B).

## `regions` — 5 pays, 89 lignes

`07` RG37, `10` G9. Utile où le pays seul ne dit rien du déplacement (F20) : grands pays des deux
langues d'interface ; autres à la demande ; outre-mer et territoires : pays ISO 3166-1 propres.
Source : ISO 3166-2 (OBP), Debian `iso-codes` ; revue avant `production`.

- `FR` (13) : ARA BFC BRE CVL GES HDF IDF NAQ NOR OCC PAC PDL 20R · `GB` (4) : ENG NIR SCT WLS
- `US` (51) : AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ
  NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC
- `CA` (13) : AB BC MB NB NL NS NT NU ON PE QC SK YT · `AU` (8) : ACT NSW NT QLD SA TAS VIC WA

## `price_bands` — aucune ligne (fiche, réponse 2 ; D78)

## Cas limites (`product-owner`) et amendements de clôture

Code retiré : gardé, plus proposé. Créateur sans réseau listé : ne publie pas (`08` RG16). Pays sans
région : champ absent. Amendements : (1) `04` §4.2, forme
des codes et `label_key` ; (2) `matching-spec` F14 = `09` RG38 ; (3) `09` RG36, formats UGC sans
réseau (Lot 3) ; (4) `06` RG27, `07` bloc 5 : `none` non cochable en multi-choix ; (5) `07` bloc 3,
domaine de l'URL de profil (L2B) ; (6) `08` RG32 : « autre réseau » = de la liste.
