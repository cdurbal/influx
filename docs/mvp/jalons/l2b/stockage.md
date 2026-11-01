# L2B — Stockage et chaîne d'images (arbitrage L2B-02, D80)
> 2026-11-01 · `architecte`, grille `integrateur` · à relire par le fondateur · prime sur les prompts
> 03, 08, 09, 12 et la revue.

**Constats.** La durée d'une URL de téléversement signée est fixée par le service Supabase
(`SIGNED_UPLOAD_URL_EXPIRATION_TIME=7200` en local, « 2 hours » dans storage-js 2.117.2) : E1-3
(≤ 5 min) est intenable. Le ré-encodage oblige `apps/api` à lire les octets : E1 n'économise rien.
Une suppression SQL dans `storage.objects` est bloquée (`protect_objects_delete`).

## 1. Ré-encodage
- **`sharp` 0.35.5** exact (libvips 1.3.4), `apps/api` seul. Binaires précompilés `@img/sharp-*` :
  linux-x64 glibc ≥ 2.28 (Railpack Debian, `ubuntu-latest`), win32-x64 (poste). **Aucun script
  d'installation** : `allowBuilds` inchangé. Importé au chargement par `src/platform/images.ts`
  seul : binaire absent = démarrage refusé, `/health` rouge, déploiement précédent gardé.
- Chaîne : type réel par octets d'en-tête (PNG, JPEG, WebP ; tout autre refusé, PDF et SVG compris :
  T9.4) ; `limitInputPixels` 4 096² ; première image seule ; plus grand côté ≥ 256 px ; orientation
  appliquée (`autoOrient`), puis **carré par marges transparentes** (`fit: contain`, 512 × 512, jamais
  rogné, sans outil de recadrage) ; sortie **WebP** qualité 90 avec alpha, ≤ 1 Mio ; deux
  traitements au plus par processus, au-delà 503.
- Retiré : EXIF (GPS, appareil, dates, vignette), XMP, IPTC, profil ICC (converti en sRGB), blocs
  texte PNG, commentaires, images secondaires, octets après la fin. Méthodes `keep*` et `with*` de
  métadonnées interdites (garde statique).
- Écartés : jimp (lent), WASM (immature), transformation Supabase (payante, original intact),
  canevas du navigateur (client non fiable).
- **T9.5** : JPEG géolocalisé, PNG à `iCCP`/`tEXt`, WebP à EXIF/XMP dans `apps/api/tests/fixtures/` ;
  octets relus : morceaux ⊆ {`VP8X` sans drapeau ICC, EXIF, XMP ; `VP8 ` ; `VP8L` ; `ALPH`}, ni
  `Exif`, ni `GPS`, ni `xmpmeta`, ni la coordonnée connue.

## 2. `@supabase/storage-js`
2.117.2 exact (version d'`auth-js` ; `iceberg-js` sans dépendance). Seul importateur
`src/platform/storage.ts`, qui n'expose qu'écrire (`upload` sans `upsert`), lire (`download`, borne
1 Mio), retirer (`remove`, absent = succès) ; jamais `createSigned*`, `getPublicUrl`, `list`. Clé
`SUPABASE_SECRET_KEY`, déjà dans `api` et `worker` (`03` §6.7 point 4) : aucune variable neuve. 10 s
par appel ; erreur réduite à code et statut ; clé d'objet vérifiée `^<uuid>/<uuid>\.webp$`. Gardes :
ESLint par fichier (`auth-js` → `supabase.ts`, `storage-js` → `storage.ts`, `sharp` → `images.ts`) ;
`supabase-guards.test.ts` : un importateur par paquet, versions exactes, méthodes interdites absentes.

## 3. Dépôt : relais, pas E1
`PUT /v1/me/brand-profile/logo`, corps brut `application/octet-stream` ≤ 2 Mio par le passe-plat ;
type déclaré et nom de fichier jamais reçus. Raisons : aucune URL portable ; aucun original
géolocalisé stocké ; quota avant décodage ; CSP inchangées, aucun hôte Supabase dans un navigateur.
Coût : passe-plat `MAX_BODY_BYTES` 1 → 2 Mio (empreinte PP-12 renouvelée) ; `apps/api` garde 1 Mio
ailleurs (route : `bodyLimit` et analyseur propres, modèle `brevo-webhook.ts`) ; 09 couvert par
l'attestation de sécurité.
Ordre, ligne d'abord : (a) annonceur propriétaire, sinon réponse de l'inexistant (T14) ;
(b) transaction : quota consommé, ligne `pending` ; (c) contrôle et ré-encodage en mémoire ; refus =
ligne supprimée, 422 motif typé ; (d) écriture Storage ; échec = ligne `purging`, 503 « à redéposer »
(`06` cas limite 6) ; (e) transaction : ligne `active`, précédente `purging` ; (f) retrait immédiat
de l'ancien objet, au mieux. `DELETE` : `active` → `purging`, puis (f).

## 4. Lecture
Aucune URL signée au L2B. `GET /v1/me/brand-profile/logo` : `apps/api` relit l'objet, répond en JSON
(type, côtés, base64 borné) : filtre TM11.4 intact. M2 : source `data:` (CSP actuelle). Backoffice
(L2C) : même forme, image en `blob:`, lecture d'agent journalisée avec la fiche. Créateur (Lot 3) :
vignette ou URL signée E1-8, arbitrée avec les listes. Lecture du propriétaire non journalisée ;
journaux : issue, tailles, durée, jamais nom ni clé (D60). Test : aucune réponse du logo ne porte
d'hôte Supabase ni de jeton (remplace T9.2 au L2B).

## 5. Compartiment et lignes
`brand-logo` par `0204` (`insert into storage.buckets`) : privé, `allowed_mime_types = {image/webp}`,
`file_size_limit = 1048576`, car il ne reçoit que la sortie du ré-encodage (remplace « PNG, JPEG,
WebP, 2 Mo » de 08). `config.toml` inchangé. `storage.objects` et `storage.buckets` : politique
**restrictive** `using (false) with check (false)` pour `anon`, `authenticated` (P10.6) ; aucun droit
`influx_*` sur `storage` (création constatée possible en local). `profiles.brand_logo_objects` :
`id`, `account_id`, `object_key` **générée** `<account_id>/<id>.webp` (T9.3, T9.9), `state`
(`pending`, `active`, `purging` ; purgé = ligne supprimée), `byte_size`, côtés, dates, tentatives ;
un `active` par compte (index unique partiel) ; transitions par fonctions, aucun `UPDATE` libre.
Orphelin exclu par construction ; relevé hebdomadaire (`04` §5.11 règle 3) reporté à L2G (droits sur
`storage.objects` à éprouver sur l'hébergé). Tests : T9.1, limites, politiques, clé générée, T2.

## 6. Quotas
`profiles.storage_quotas` : `brand-logo` 10 dépôts et 20 Mio reçus par compte et par jour UTC.
`profiles.storage_daily_usage` (compte, compartiment, jour, nombre, octets), incrémentée en (b),
toute tentative comptée ; dépassement : 429 `upload_quota_exceeded`, `Retry-After` jusqu'à minuit
UTC. T9.8 à la frontière exacte.

## 7. Suppression
Effacement : `privacy.execute_request()` passe les lignes du compte à `purging` et supprime son usage
(logo injoignable aussitôt). Tâche horaire `storage_purge` de `maintenance.run_periodic` (E-4, modèle
`auth_orphan_purge`) : lignes `purging`, et `pending` de plus de 15 min ; objet retiré par l'API,
ligne supprimée après succès, compte dans `retention.purged` ; échec rejoué l'heure suivante, issue
`failed` alertée ; usage de plus de 7 jours purgé. Export : métadonnées du logo, sans octets. Tests :
privacy étendus, tâche contre un Storage réel.

## 8. CI, poste, `staging`
`ci.yml` l. 220 et 271 : `storage-api` hors de `-x`, `imgproxy` exclu (transformation désactivée).
Attendu : image de 1,3 Go et ses migrations, +30 à +60 s sur `db`, absorbé sur `e2e`. 03 vérifie
après un `db reset` neuf que `storage.buckets` porte `file_size_limit` et `allowed_mime_types`
(préalable de `0204`). Poste : déjà démarré. `staging` : compartiment par « Migrate staging » ;
`/health` d'`api` vert après 09 prouve `sharp` sur Railpack.

## 9. `packages/domain`
`@influx/domain`, forme de `@influx/contracts` (`exports` vers `src/*.ts`, sans build, syntaxe
effaçable), **aucune dépendance**. `./brand-profile` : `brandProfileCompleteness()` (RG57 à RG61,
budget et badge exclus), `BRAND_PROFILE_REQUIRED_FIELDS` (RG5, parité en 06),
`normalizeWebsiteDomain()` (RG17). Importateur au L2B : `apps/api` seul ; un front, plus tard, dans
`lib/` seulement. Garde : aucune fonction `*Completeness*` hors `packages/domain/src`.

## Effets et clôture
- 09 : routes dans `route-models.ts`, en-tête de `security-headers.ts`, tâche de purge.
- Écarts : EC-L2B-02-1 « 2 Mo » = 2 Mio ; -2 « ≥ 256 px » = plus grand côté ; -3 carré par marges.
- Amendements : `03` PP-9, §6.6 ; `02` §2.4 ; `04` §5.11 ; `06` RG15, §F, l. 968 ; `18` T9.2, T9.7 ;
  `21` §2.4.
- **Ouvert, avant L2E** : pièces et portfolio, relais généralisé (PP-9 relevé) ou E1 amendé (2 h).
