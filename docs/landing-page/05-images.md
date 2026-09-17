# Landing page INFLUX : images de la maquette

> **Statut :** sélection de l'étape 2 du plan validé le 2026-09-16, établie par `expert-ux` le 2026-09-17.
> **Sources :** `00-cadrage.md` (CA17, CA26), plan validé (règle transverse 8), `02-ux-wireframes.md`
> (emplacements), licence Pexels.
> **Nombre d'images : 31**, toutes issues de **Pexels**, toutes vérifiées.

## 1. Règles de sélection

| Règle | Application |
|---|---|
| Source et licence | Uniquement Pexels, licence Pexels. Aucune image de wekollab.fr. |
| Visages | **Aucun visage visible sur les 31 photos** (mains, silhouettes de dos, objets, mises en scène). Obligatoire pour les cartes créateurs (sections 3, 9, 15) ; appliqué partout par prudence. |
| Marques | Aucune marque ni logo lisible, après contrôle visuel en grand format. Photos écartées pour ce motif : chaussures à bandes d'une marque de sport, logo de fabricant de téléphone, logos de périphériques de jeu, logo de fabricant de micro, marque d'éclairage lisible sur un écran. |
| Honnêteté | Aucune photo n'est présentée comme un vrai créateur INFLUX : les photos des cartes créateurs sont décoratives (texte alternatif vide) et illustrent une thématique, pas une personne. |
| Pourquoi Pexels seul | Pexels fournit auteur, licence et URL de fichier vérifiables automatiquement. unsplash.com a refusé les requêtes de vérification depuis cet environnement (réponse 401) : aucune URL Unsplash n'a donc pu être contrôlée ni inscrite. |

### Licence Pexels : ce qui compte pour INFLUX

Usage gratuit, modification autorisée, attribution non obligatoire (le fichier `CREDITS.md` la
fait quand même, CA26). **Interdits** d'après https://www.pexels.com/license/ (consulté le
2026-09-17) :

1. montrer des personnes identifiables sous un jour défavorable ou offensant ;
2. vendre des copies non modifiées (poster, impression, objet) ;
3. **laisser entendre que les personnes ou marques visibles soutiennent le produit** ;
4. redistribuer les photos sur d'autres banques d'images ;
5. utiliser les photos dans une marque, un logo ou un nom commercial.

Le point 3 justifie l'absence de visages et de marques, et le texte alternatif vide des cartes
créateurs. Point de contrôle pour `expert-conformite-rgpd` à l'étape 4.

## 2. Vérification

Effectuée le **2026-09-17** :

- **Téléchargement** : requête `GET` complète sur chaque URL de téléchargement : les 31
  renvoient **HTTP 200**, `content-type: image/jpeg`, poids compris entre 31 Ko et 362 Ko à 1600 px.
- **Page de la photo** : les 31 pages Pexels renvoient **HTTP 200**.
- **Contrôle visuel** : chaque photo vue en vignette, et en grand format en cas de doute (logos,
  texte, visages).

**Pour le développeur** : les photos sont téléchargées dans
`apps/web/src/content/placeholders/images/` et importées **statiquement** depuis
`src/content/placeholders/index.ts` (`01-architecture.md` §6.1). **Rien dans `public/`** : une photo
placée là échapperait au module fictif (CA15) et resterait servie par URL après son retrait au
Lot 1 (revue conformité, ligne 16). Mettre l'URL entre guillemets dans le terminal (elle contient
`&`). Le paramètre `w=1600` peut être abaissé (par exemple `w=800` pour les cartes) sans changer
d'hôte ; seules les URL à `w=1600` ont été vérifiées. Exemple, depuis la racine du dépôt :
`curl -L -o apps/web/src/content/placeholders/images/img-hero-01.jpg "https://images.pexels.com/photos/7801865/pexels-photo-7801865.jpeg?auto=compress&cs=tinysrgb&w=1600"`

## 3. Textes alternatifs : règle retenue

| Type | Règle | Images |
|---|---|---|
| **Informative** | Texte alternatif FR/EN, factuel, sans « photo de », sans marque, 125 caractères maximum. Clé `ph.images.<id>.alt` : champ de `getPlaceholderContent(locale)` dans le module fictif, comme les photos elles-mêmes (`01-architecture.md` §6.1, `02-ux-wireframes.md` §0). | IMG-HERO-01, IMG-CASE-01 à 05, IMG-USE-01 à 04 (10 images) |
| **Décorative** | `alt=""` : l'information est déjà dans le texte voisin (titre de carte, thématique, chiffre). Pas de clé de traduction. La « description interne » sert au crédit et à la revue, jamais affichée. | IMG-HERO-02, IMG-CRE-01 à 10, IMG-RESULT-01, IMG-PROBLEM-01, IMG-METHOD-01, IMG-STEP-01 à 03, IMG-WHY-01 à 03, IMG-FORM-01 (21 images) |

Pour les **cartes créateurs**, le texte alternatif vide évite qu'un lecteur d'écran présente la
photo comme celle du créateur. Pour les autres images décoratives, il évite de répéter le titre
voisin.

**Toutes les images** : attributs `width` et `height` (pas de décalage de mise en page),
`object-fit: cover` selon le cadrage indiqué, `loading="lazy"` sauf IMG-HERO-01 (chargement
prioritaire), fond `color-surface-muted` pendant le chargement.

## 4. Liste des images

Licence de toutes les images : **Licence Pexels** (https://www.pexels.com/license/).
Colonnes « Cadrage » : ratio affiché mobile / desktop et point focal (`object-position`).

### 4.1 Section 1 : Hero

| ID | Emplacement | Cadrage | Page de la photo | Téléchargement (vérifié) | Auteur | Texte alternatif FR | Texte alternatif EN |
|---|---|---|---|---|---|---|---|
| IMG-HERO-01 | Hero, image principale | 4:3 / 4:5 ; `center 35%` | https://www.pexels.com/photo/woman-taking-pictures-of-putting-items-into-a-cardboard-box-7801865/ | https://images.pexels.com/photos/7801865/pexels-photo-7801865.jpeg?auto=compress&cs=tinysrgb&w=1600 | Ron Lach (https://www.pexels.com/@ron-lach/) | Mains photographiant au smartphone un produit tout juste sorti de son colis | Hands photographing a product just taken out of its parcel with a smartphone |
| IMG-HERO-02 | Hero, vignette superposée (desktop uniquement) | — / 1:1 ; `center` | https://www.pexels.com/photo/modern-photo-camera-placed-near-studio-lamp-4793158/ | https://images.pexels.com/photos/4793158/pexels-photo-4793158.jpeg?auto=compress&cs=tinysrgb&w=1600 | Anete Lusina (https://www.pexels.com/@anete-lusina/) | *(vide, décorative)* Description interne : appareil photo sur trépied devant un anneau lumineux | *(empty, decorative)* |

### 4.2 Cartes créateurs : sections 3, 9 et 15

Toutes décoratives (`alt=""`). La thématique indiquée est celle de la carte fictive, écrite en
texte dans la carte.

| ID | Emplacement et thématique de la carte | Cadrage | Page de la photo | Téléchargement (vérifié) | Auteur | Description interne (non affichée) |
|---|---|---|---|---|---|---|
| IMG-CRE-01 | Section 3, carte 1 : Beauté | 4:5 / 4:5 ; `center` | https://www.pexels.com/photo/close-up-shot-of-a-person-holding-makeup-brushes-on-pale-yellow-background-7290122/ | https://images.pexels.com/photos/7290122/pexels-photo-7290122.jpeg?auto=compress&cs=tinysrgb&w=1600 | MART PRODUCTION (https://www.pexels.com/@mart-production/) | Main tenant deux pinceaux de maquillage sur fond jaune pâle |
| IMG-CRE-02 | Section 3, carte 2 : Cuisine | 4:5 / 4:5 ; `center` | https://www.pexels.com/photo/close-up-of-a-phone-holder-8357670/ | https://images.pexels.com/photos/8357670/pexels-photo-8357670.jpeg?auto=compress&cs=tinysrgb&w=1600 | Ron Lach (https://www.pexels.com/@ron-lach/) | Smartphone sur stabilisateur filmant une préparation culinaire |
| IMG-CRE-03 | Section 3, carte 3 : Voyage | 4:5 / 4:5 ; `center 60%` | https://www.pexels.com/photo/traveler-admiring-sunrise-in-dschanub-sina-egypt-35997099/ | https://images.pexels.com/photos/35997099/pexels-photo-35997099.jpeg?auto=compress&cs=tinysrgb&w=1600 | Mido Makasardi (https://www.pexels.com/@mjlo/) | Voyageur de dos avec sac à dos face à des montagnes au lever du soleil |
| IMG-CRE-04 | Section 9, carte 1 : Sport | 4:5 / 4:5 ; `60% center` | https://www.pexels.com/photo/person-tying-a-shoe-on-a-track-8454904/ | https://images.pexels.com/photos/8454904/pexels-photo-8454904.jpeg?auto=compress&cs=tinysrgb&w=1600 | Mikhail Nilov (https://www.pexels.com/@mikhail-nilov/) | Personne laçant sa chaussure sur une piste d'athlétisme, visage hors cadre |
| IMG-CRE-05 | Section 9, carte 2 : Tech et jeux vidéo | 4:5 / 4:5 ; `35% center` | https://www.pexels.com/photo/close-up-of-mechanical-keyboard-with-custom-keycaps-35471660/ | https://images.pexels.com/photos/35471660/pexels-photo-35471660.jpeg?auto=compress&cs=tinysrgb&w=1600 | FOX ^.ᆽ.^= ∫ (https://www.pexels.com/@fox-58267/) | Clavier mécanique aux touches personnalisées colorées |
| IMG-CRE-06 | Section 9, carte 3 : Musique | 4:5 / 4:5 ; `55% center` | https://www.pexels.com/photo/close-up-shot-of-a-person-playing-guitar-7120398/ | https://images.pexels.com/photos/7120398/pexels-photo-7120398.jpeg?auto=compress&cs=tinysrgb&w=1600 | Pavel Danilyuk (https://www.pexels.com/@pavel-danilyuk/) | Main jouant d'une guitare acoustique en gros plan |
| IMG-CRE-07 | Section 9, carte 4 : Maison et déco | 4:5 / 4:5 ; `center 70%` | https://www.pexels.com/photo/a-brown-pots-with-green-plants-9707356/ | https://images.pexels.com/photos/9707356/pexels-photo-9707356.jpeg?auto=compress&cs=tinysrgb&w=1600 | cottonbro studio (https://www.pexels.com/@cottonbro/) | Plantes vertes en pots de terre cuite dans un intérieur lumineux |
| IMG-CRE-08 | Section 15, carte 1 : Mode | 4:5 / 4:5 ; `center` | https://www.pexels.com/photo/hanging-of-pink-shirt-on-a-clothing-rack-9558711/ | https://images.pexels.com/photos/9558711/pexels-photo-9558711.jpeg?auto=compress&cs=tinysrgb&w=1600 | MART PRODUCTION (https://www.pexels.com/@mart-production/) | T-shirt rose suspendu à un portant blanc |
| IMG-CRE-09 | Section 15, carte 2 : Loisirs créatifs | 4:5 / 4:5 ; `center` | https://www.pexels.com/photo/a-person-holding-a-knitting-needles-and-yarn-5806963/ | https://images.pexels.com/photos/5806963/pexels-photo-5806963.jpeg?auto=compress&cs=tinysrgb&w=1600 | Ksenia Chernaya (https://www.pexels.com/@kseniachernaya/) | Mains tricotant une pelote de laine rose |
| IMG-CRE-10 | Section 15, carte 3 : Bien-être | 4:5 / 4:5 ; `center` | https://www.pexels.com/photo/black-round-plastic-tool-on-brown-plastic-basket-4325462/ | https://images.pexels.com/photos/4325462/pexels-photo-4325462.jpeg?auto=compress&cs=tinysrgb&w=1600 | cottonbro studio (https://www.pexels.com/@cottonbro/) | Tapis de yoga roulés dans un panier |

### 4.3 Section 4 : Résultat mis en avant

| ID | Emplacement | Cadrage | Page de la photo | Téléchargement (vérifié) | Auteur | Texte alternatif |
|---|---|---|---|---|---|---|
| IMG-RESULT-01 | Section 4, colonne image | 3:2 / 3:2 ; `center` | https://www.pexels.com/photo/notebook-and-charts-669613/ | https://images.pexels.com/photos/669613/pexels-photo-669613.jpeg?auto=compress&cs=tinysrgb&w=1600 | Lukas Blazek (https://www.pexels.com/@goumbik/) | *(vide, décorative)* Description interne : graphiques imprimés et carnet à côté d'un ordinateur portable, vue de dessus |

### 4.4 Section 6 : Études de cas (carrousel)

| ID | Emplacement | Cadrage | Page de la photo | Téléchargement (vérifié) | Auteur | Texte alternatif FR | Texte alternatif EN |
|---|---|---|---|---|---|---|---|
| IMG-CASE-01 | Diapositive 1 : cosmétique | 4:3 / 1:1 ; `center` | https://www.pexels.com/photo/cosmetic-containers-on-gray-textile-8101534/ | https://images.pexels.com/photos/8101534/pexels-photo-8101534.jpeg?auto=compress&cs=tinysrgb&w=1600 | Polina, profil `polina-kovaleva` (https://www.pexels.com/@polina-kovaleva/) | Flacon de sérum à pipette posé sur un pot en verre, dans une lumière douce | Dropper serum bottle resting on a glass jar in soft light |
| IMG-CASE-02 | Diapositive 2 : café | 4:3 / 1:1 ; `center` | https://www.pexels.com/photo/a-bag-of-coffee-beans-7657837/ | https://images.pexels.com/photos/7657837/pexels-photo-7657837.jpeg?auto=compress&cs=tinysrgb&w=1600 | Cup of Couple (https://www.pexels.com/@cup-of-couple/) | Sachet ouvert rempli de grains de café torréfiés | Open bag filled with roasted coffee beans |
| IMG-CASE-03 | Diapositive 3 : audio | 4:3 / 1:1 ; `center` | https://www.pexels.com/photo/white-wireless-headphones-3394665/ | https://images.pexels.com/photos/3394665/pexels-photo-3394665.jpeg?auto=compress&cs=tinysrgb&w=1600 | Sound On (https://www.pexels.com/@sound-on/) | Casque audio sans fil blanc sur fond blanc | White wireless headphones on a white background |
| IMG-CASE-04 | Diapositive 4 : art de la table | 4:3 / 1:1 ; `center` | https://www.pexels.com/photo/plain-white-mugs-on-a-white-surface-6312177/ | https://images.pexels.com/photos/6312177/pexels-photo-6312177.jpeg?auto=compress&cs=tinysrgb&w=1600 | KATRIN BOLOVTSOVA (https://www.pexels.com/@ekaterina-bolovtsova/) | Deux tasses en céramique blanches sur fond gris clair | Two white ceramic mugs on a light grey background |
| IMG-CASE-05 | Diapositive 5 : accessoire tech | 4:3 / 1:1 ; `45% center` | https://www.pexels.com/photo/black-computer-keyboard-on-wooden-table-12561283/ | https://images.pexels.com/photos/12561283/pexels-photo-12561283.jpeg?auto=compress&cs=tinysrgb&w=1600 | An Tran (https://www.pexels.com/@an-tran-31930396/) | Clavier mécanique compact aux touches grises et orange sur une table en bois | Compact mechanical keyboard with grey and orange keys on a wooden table |

Clés : `ph.images.case01.alt` à `ph.images.case05.alt`.

### 4.5 Sections 7 et 8 : Problème, Méthode

| ID | Emplacement | Cadrage | Page de la photo | Téléchargement (vérifié) | Auteur | Texte alternatif |
|---|---|---|---|---|---|---|
| IMG-PROBLEM-01 | Section 7, derrière la maquette de conversation (desktop uniquement) | — / 4:5 ; `center` | https://www.pexels.com/photo/woman-typing-on-laptop-keyboard-at-workspace-6282022/ | https://images.pexels.com/photos/6282022/pexels-photo-6282022.jpeg?auto=compress&cs=tinysrgb&w=1600 | Monstera Production (https://www.pexels.com/@gabby-k/) | *(vide, décorative)* Description interne : mains tapant sur un ordinateur portable, carnet et documents, vue de dessus sur fond bleu nuit |
| IMG-METHOD-01 | Section 8, colonne image | 16:9 / 4:5 ; `center` | https://www.pexels.com/photo/overhead-shot-of-a-workspace-7583440/ | https://images.pexels.com/photos/7583440/pexels-photo-7583440.jpeg?auto=compress&cs=tinysrgb&w=1600 | Mikhail Nilov (https://www.pexels.com/@mikhail-nilov/) | *(vide, décorative)* Description interne : mains ouvrant un agenda à côté d'un ordinateur portable et de carnets, vue de dessus |

### 4.6 Section 10 : Cas d'usage

| ID | Emplacement | Cadrage | Page de la photo | Téléchargement (vérifié) | Auteur | Texte alternatif FR | Texte alternatif EN |
|---|---|---|---|---|---|---|---|
| IMG-USE-01 | Carte 3 : lancement de produit (`productLaunch`) | 3:2 / 3:2 ; `center` | https://www.pexels.com/photo/close-up-of-cardboard-boxes-and-lids-17260157/ | https://images.pexels.com/photos/17260157/pexels-photo-17260157.jpeg?auto=compress&cs=tinysrgb&w=1600 | Harper Sunday (https://www.pexels.com/@harper-sunday/) | Boîtes d'emballage en carton kraft sur fond orange | Kraft cardboard packaging boxes on an orange background |
| IMG-USE-02 | Carte 4 : notoriété (`awareness`) | 3:2 / 3:2 ; `center` | https://www.pexels.com/photo/cellphones-with-captured-images-7551982/ | https://images.pexels.com/photos/7551982/pexels-photo-7551982.jpeg?auto=compress&cs=tinysrgb&w=1600 | Gigxels com (https://www.pexels.com/@gigxels/) | Public en silhouette filmant un concert avec des smartphones | Silhouetted audience filming a concert on smartphones |
| IMG-USE-03 | Carte 1 : contenus UGC (`ugc`) | 3:2 / 3:2 ; `center` | https://www.pexels.com/photo/person-taking-picture-of-a-pie-using-smartphone-8902059/ | https://images.pexels.com/photos/8902059/pexels-photo-8902059.jpeg?auto=compress&cs=tinysrgb&w=1600 | ANTONI SHKRABA production (https://www.pexels.com/@anthonyshkraba-production/) | Main photographiant une tarte aux fruits avec un smartphone | Hand photographing a fruit pie with a smartphone |
| IMG-USE-04 | Carte 2 : acquisition (`acquisition`) | 3:2 / 3:2 ; `center 40%` | https://www.pexels.com/photo/person-holding-a-credit-card-6237886/ | https://images.pexels.com/photos/6237886/pexels-photo-6237886.jpeg?auto=compress&cs=tinysrgb&w=1600 | Thirdman (https://www.pexels.com/@thirdman/) | Mains tenant un smartphone et une carte bancaire pour un achat en ligne | Hands holding a smartphone and a bank card to shop online |

Clés : `ph.images.use01.alt` à `ph.images.use04.alt`.

### 4.7 Sections 11 et 13 : Comment ça marche, Pourquoi INFLUX

| ID | Emplacement | Cadrage | Page de la photo | Téléchargement (vérifié) | Auteur | Texte alternatif |
|---|---|---|---|---|---|---|
| IMG-STEP-01 | Section 11, étape 1 | 4:3 / 4:3 ; `center` | https://www.pexels.com/photo/person-using-a-silver-laptop-7382403/ | https://images.pexels.com/photos/7382403/pexels-photo-7382403.jpeg?auto=compress&cs=tinysrgb&w=1600 | Polina Tankilevitch (https://www.pexels.com/@polina-tankilevitch/) | *(vide, décorative)* Description interne : mains tapant sur un ordinateur portable posé sur une table en bois |
| IMG-STEP-02 | Section 11, étape 2 | 4:3 / 4:3 ; `center 40%` | https://www.pexels.com/photo/a-person-holding-a-smartphone-6373084/ | https://images.pexels.com/photos/6373084/pexels-photo-6373084.jpeg?auto=compress&cs=tinysrgb&w=1600 | KATRIN BOLOVTSOVA (https://www.pexels.com/@ekaterina-bolovtsova/) | *(vide, décorative)* Description interne : mains tenant un smartphone à l'écran vierge au-dessus d'un bureau noir |
| IMG-STEP-03 | Section 11, étape 3 | 4:3 / 4:3 ; `center` | https://www.pexels.com/photo/a-person-holding-a-smartphone-on-a-tripod-7514824/ | https://images.pexels.com/photos/7514824/pexels-photo-7514824.jpeg?auto=compress&cs=tinysrgb&w=1600 | Kampus Production (https://www.pexels.com/@kampus/) | *(vide, décorative)* Description interne : personne fixant un smartphone sur un trépied, visage hors cadre |
| IMG-WHY-01 | Section 13, carte 1 | 3:2 / 3:2 ; `center` | https://www.pexels.com/photo/a-person-sticking-sticky-notes-on-a-paper-7706977/ | https://images.pexels.com/photos/7706977/pexels-photo-7706977.jpeg?auto=compress&cs=tinysrgb&w=1600 | Alena Darmel (https://www.pexels.com/@a-darmel/) | *(vide, décorative)* Description interne : mains organisant des notes adhésives sur un porte-bloc |
| IMG-WHY-02 | Section 13, carte 2 | 3:2 / 3:2 ; `center` | https://www.pexels.com/photo/close-up-of-businessmen-sitting-at-the-table-with-documents-8729809/ | https://images.pexels.com/photos/8729809/pexels-photo-8729809.jpeg?auto=compress&cs=tinysrgb&w=1600 | Mikhail Nilov (https://www.pexels.com/@mikhail-nilov/) | *(vide, décorative)* Description interne : mains signant un document lors d'un rendez-vous, visages hors cadre |
| IMG-WHY-03 | Section 13, carte 3 | 3:2 / 3:2 ; `65% center` | https://www.pexels.com/photo/modern-office-hand-holding-smartphone-with-blank-screen-35052818/ | https://images.pexels.com/photos/35052818/pexels-photo-35052818.jpeg?auto=compress&cs=tinysrgb&w=1600 | Jakub Zerdzicki (https://www.pexels.com/@jakubzerdzicki/) | *(vide, décorative)* Description interne : main tenant un smartphone à l'écran vierge dans un bureau |

### 4.8 Section 16 : Formulaire

| ID | Emplacement | Cadrage | Page de la photo | Téléchargement (vérifié) | Auteur | Texte alternatif |
|---|---|---|---|---|---|---|
| IMG-FORM-01 | Section 16, colonne gauche (desktop uniquement) | — / 3:2 ; `70% center` | https://www.pexels.com/photo/blue-lined-book-2381848/ | https://images.pexels.com/photos/2381848/pexels-photo-2381848.jpeg?auto=compress&cs=tinysrgb&w=1600 | Jessica Lewis, thepaintedsquare (https://www.pexels.com/@thepaintedsquare/) | *(vide, décorative)* Description interne : carnet ouvert vierge sur une table en bois, plante au premier plan |

## 5. Récapitulatif par section

| Section | Images |
|---|---|
| 1 Hero | IMG-HERO-01, IMG-HERO-02 |
| 3 Vitrine de créateurs | IMG-CRE-01, IMG-CRE-02, IMG-CRE-03 |
| 4 Résultat mis en avant | IMG-RESULT-01 |
| 6 Études de cas | IMG-CASE-01 à IMG-CASE-05 |
| 7 Problème et conversation | IMG-PROBLEM-01 |
| 8 Méthode | IMG-METHOD-01 |
| 9 Réseau de créateurs | IMG-CRE-04 à IMG-CRE-07 |
| 10 Cas d'usage | IMG-USE-01 à IMG-USE-04 |
| 11 Comment ça marche | IMG-STEP-01 à IMG-STEP-03 |
| 13 Pourquoi INFLUX | IMG-WHY-01 à IMG-WHY-03 |
| 15 Appel final | IMG-CRE-08, IMG-CRE-09, IMG-CRE-10 |
| 16 Formulaire | IMG-FORM-01 |
| 2, 5, 12, 14, en-tête, pied de page, bandeau, bannière | Aucune photo (maquette de téléphone et conversation en HTML/CSS) |

**Nom de fichier suggéré** dans `apps/web/src/content/placeholders/images/` (jamais dans
`public/`) : identifiant en minuscules (`img-hero-01.jpg`, `img-cre-01.jpg`…), pour relier sans
ambiguïté le fichier, `src/content/placeholders/CREDITS.md` et ce document. `testeur` vérifie à
l'étape 6 que `apps/web/public/` ne contient aucune photo.

## 6. À valider

- **Fondateur** : l'ambiance générale (objets, mains, silhouettes, sans visage) plutôt que des
  portraits. Plus sobre et sans risque de droit à l'image ; moins incarné. Des portraits réels
  de créateurs INFLUX, avec leur accord écrit, pourront remplacer ces photos au Lot 1.
- **`expert-conformite-rgpd`** : lecture de la licence Pexels (point 3, pas d'impression de
  soutien) et règle des textes alternatifs vides pour les cartes créateurs.
- **Remplacement avant mise en ligne** : toutes ces photos sont des illustrations de maquette ;
  leur maintien au Lot 1 se décide avec le retrait des contenus fictifs.
- **`testeur`, étape 6 : contrôle visuel dans le cadrage réellement affiché** (revue conformité,
  suggestion 17), sur les captures 375 et 1440 px, en grand format :

  | Image | Point à vérifier |
  |---|---|
  | IMG-HERO-01 | Aucun visage visible en 4:3 (mobile) comme en 4:5 (desktop), avec le point focal `center 35%` |
  | IMG-CRE-04 | Aucun logo lisible sur la chaussure |
  | IMG-CRE-05 | Aucun logo sur les touches personnalisées |
  | IMG-USE-04 | Aucun logo de banque ni de réseau de paiement sur la carte bancaire |
  | IMG-CASE-03, IMG-CASE-05 | Aucun design de produit reconnaissable d'une marque réelle (ils illustrent une marque fictive avec des résultats inventés) |

  Toute photo douteuse est remplacée par une autre photo Pexels contrôlée selon §1 et §2, avec
  mise à jour de ce document et de `CREDITS.md`.
