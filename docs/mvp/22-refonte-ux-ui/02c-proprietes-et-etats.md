# 02c — Propriétés et états des 68 composants

> Complète `02a` et `02b` (apparence, dimensions, responsive). **Contrat commun aux deux fronts** (RU-18) : mêmes noms,
> mêmes propriétés. `?` : facultatif. Tous acceptent `className?` (mise en place seulement : marge, grille) et
> transmettent `data-*`, `id` et `aria-*`. Tous les textes arrivent par propriété, déjà traduits ; `ReactNode` là où un texte riche est
> montré. États communs aux éléments interactifs : repos, survol, appui, focus, désactivé (`aria-disabled`, jamais
> `disabled` seul sur un bouton qui explique). `—` : sans état propre.

## 1. Fondations

| ID | Propriétés | États |
|---|---|---|
| C01 PageFrame | `variant: "wide"｜"narrow"｜"bo"`, `gap?: "page" (32)｜"reading" (24)｜"stack" (48, 32 < 1 024)`, `stickyBar?: "search"｜"reading"｜"wizard"`, `children` | — |
| C02 PageHeader | `title`, `titleSize?: "page"｜"section"`, `lead?`, `back?: {href,label}`, `crumbs?: {href?,label}[]`, `badges?`, `actions?`, `meta?` | action en cours |
| C03 Section | `title`, `as?: "h2"｜"h3"`, `variant: "page"｜"reading"｜"account"｜"bo"｜"overline"`, `count?`, `description?`, `actions?`, `divider?`, `children` | occupée (`aria-busy`) |
| C04 Card | `variant: "default"｜"compact"｜"box"｜"link"`, `href?` + `title` (variante `link`), `as?`, `children` | survol, focus (variante `link`) |
| C05 InnerPanel | `variant: "default"｜"readonly"｜"preview"｜"form"`, `title?`, `icon?`, `action?`, `children` | entrée (`rise-in`) |
| C06 RowList | `variant: "campaign"｜"feed"｜"lists"｜"tasks"｜"hub"｜"sessions"｜"todo"｜"mini"`, `items: Row[]` ; `Row = {id, href?, title, sub?, meta?, media?, end?, action?, tone?: "default"｜"done"｜"attention", current?}`, `label` | ligne : repos, survol, focus, courante, terminée, nouvelle (`flash`) |
| C07 PropertyList | `items: {label, value, empty?, sub?, mark?}[]`, `size?: "sm"｜"md"｜"xs"`, `labelWidth?` (palier de `03` §3.3), `columns?: 1｜2`, `emptyLabel?` | valeur vide, modifiée |
| C08 EmptyState | `kind: "empty"｜"filtered"｜"error"｜"closed"｜"sent"｜"inline"`, `icon?`, `title`, `body?`, `action?`, `live?: boolean` | par `kind` ; `error` : nouvelle tentative en cours |
| C09 Skeleton | `shape: "line"｜"row"｜"card"｜"photo"｜"field"`, `count?`, `label` (« Chargement… ») | visible après 1 s |
| C10 Button | `variant: "primary"｜"secondary"｜"danger"｜"text"`, `size?: "sm" (36)｜"bar" (40)｜"md" (44)｜"lg" (52)` ; BO : `"bo" (28)｜"sm"`, `icon?`, `iconEnd?`, `href?`, `type?`, `busy?`, `busyLabel?`, `disabledReason?` (`id` décrit), `pressed?`, `added?`, `block?` | communs ; `busy` (largeur figée), `added` |
| C11 ActionLink | `variant: "inline"｜"go"｜"save"`, `href?`, `onClick?`, `pressed?`, `dense?`, `external?` (texte « nouvel onglet ») | communs ; pressé |
| C12 CardActions | `stretch?: boolean` (< 480), `children` | — |
| C13 StatusBadge | `tone: "neutral"｜"success"｜"warning"｜"error"｜"info"｜"verified"`, `icon?`, `variant?: "pill"｜"text"`, `children` | — |
| C14 LayerBadge | `layer: "public"｜"revealed"｜"internal"` (existant), `label`, `wrap?`, `iconOnly?` + nom accessible | — |
| C15 RoleBadge | `role: "advertiser"｜"creator"`, `label` (existant) | — |
| C16 CounterBadge | `count`, `label` (lu), `variant?: "pill"｜"dot"｜"rail"`, `late?` | changé (`flash-strong`) |
| C17 Notice | `tone: "success"｜"warning"｜"info"`, `title?`, `action?`, `announce?` (existant) ; `size?: "md"｜"strip"` | — |
| C18 Field | existant (`FieldTexts`, `FieldIds`) + `size?: "md"｜"bo"｜"dense"`, `width?: "full"｜"number"｜"xs"｜"sm"｜"md"｜"lg"｜"xl"`, `suffix?`, `counter?: {value,max}`, `layerShown?` (RU-30) ; `FieldGrid : columns 1 à 4` | vide, rempli, erreur, avertissement, lecture seule, désactivé |
| C19 FieldMessage | `kind: "error"｜"warning"｜"seen"`, `id`, `children` | apparition sans animation |
| C20 ErrorSummary | `title`, `items: {fieldId, label, reason, reveal?: () => void}[]`, `autoFocus?` ; `MissingList : items, actionLabel` | vide (absent), affiché, focalisé |
| C21 ChoiceGroup | `legend`, `type: "checkbox"｜"radio"`, `options: {value,label,help?,disabled?,reason?}[]`, `value`, `onChange`, `dense?`, `invalid?`, `max?` | coché, non coché, désactivé expliqué, invalide |
| C22 SegmentedControl | `kind: "radio"｜"tabs"｜"views"`, `label`, `options: {value,label,count?,href?,controls?}[]`, `value`, `onChange?` | actif, inactif, focus ; flèches (`radio`, `tabs`) |
| C23 TagPicker | existant (`PickListField`) + `addLabel`, `max?`, `sortLocale`, `onAdd`, `onRemove` | vide, rempli, plafond, invalide |
| C24 InternalZone | `title`, `children` | — |
| C25 SaveStatus | `state: "idle"｜"saving"｜"saved"｜"failed"`, `savedAt?`, `retryInSeconds?`, `onRetry?`, `placement?: "foot"｜"meta"`, textes | les quatre |
| C26 Disclosure | `variant: "optional"｜"fold"｜"danger"｜"rare"｜"group"｜"change"`, `summary`, `count?`, `defaultOpen?`, `forceOpen?` (erreur interne), `children` | fermé, ouvert |
| C27 Dialog | `open`, `onClose`, `title`, `size?: "confirm" (30)｜"wide" (34)`, `children`, `actions`, `initialFocus?`, `dismissible?` (faux pendant l'envoi) ; `ShortcutsDialog : groups` | fermé, ouvert, en cours, erreur |
| C28 FiltersDialog | `open`, `onClose`, `title`, `groups: ReactNode[]`, `internalGroup?` (BO), `activeCount`, `onApply`, `onClear`, `applyLabel` | brouillon, appliqué, en cours ; fermeture sans appliquer : brouillon perdu et dit par la fiche |
| C29 Announcer | `useAnnouncer(): announce(message)` ; une région par page | — |
| C30 FilterBar | `label`, `pills: {id,label,active?,onToggle?｜onOpen?,onClear?,expanded?}[]`, `filtersButton?: {count,onOpen}`, `search?: {value,onChange,onSubmit,label}`, `selects?: InlineSelect[]`, `density?: "md"｜"bo"` | pastille : repos, active, ouverte (non dessinée, RU-27) |
| C32 Pager | `kind: "pages"｜"cursor"`, `page?`, `hasPrevious`, `hasNext`, `onPrevious`, `onNext`, `summary?`, `total?` | en cours, dernière page, plafond |
| C33 LogoPlate / Avatar | `src?`, `name`, `size: 32｜40｜48｜56｜64｜120`, `shape: "plate"｜"round"`, `missing?: "initials"｜"dashed"` | image, initiales, absent, erreur de chargement (= initiales) |
| C56 MemberShell | existant ; `role`, `profileState`, `missingCount?`, `nav`, `identity`, `locale` | chargement, déconnecté, indisponible, CGU en attente (existants) |
| C57 BoShell | existant ; `counters?: Record<queue,{count,late}>`, `crumbs`, `agent`, `environment` | compteurs chargés, indisponibles, changés |

## 2. Métier, espaces membres

| ID | Propriétés | États |
|---|---|---|
| C31 PhotoCard | `href`, `media: {src?,alt}[]`, `badge?: {label,tone}`, `name`, `verified?: {label,date?}`, `lines: ReactNode[]`, `why?`, `saved?`, `onToggleSave?`, `saveLabel`, `note?`, `variant: "search"｜"shortlist"｜"identified"`, `blocked?: string` | sans visuel, ajout en cours, ajouté, refusé (plafond), bloquée, en sortie |
| C34 MediaGallery | `items: {src,alt,caption?}[]`, `allLabel`, `title`, `emptyLabel` | aucun, 1 à 4 (RU-34), 5 et plus, ouverte |
| C35 KeyFigures | `variant: "figures"｜"essentials"｜"network"`, `items: {label,value,sub?,icon?,verified?}[]` | valeur absente (« Non renseigné » selon la fiche) |
| C36 ReasonList | `items: {icon,title,body}[]`, `gap?: "md" (16)｜"lg" (24)` | liste vide : section absente |
| C37 RangeBar | `items: {label,from,to,valueLabel}[]` | — |
| C38 ChipList | `items: string[]`, `label` | — |
| C39 StickyAside | `children`, `label` ; `MobileActionBar : label, text, action, hidden?` | collante, barre, absente |
| C40 ReadingLayout | `main`, `aside`, `asideLabel` | une ou deux colonnes |
| C41 Wizard | `title`, `name?`, `badge?`, `steps: {id,label,state:"todo"｜"current"｜"done"｜"gap",href}[]`, `remaining?`, `leave: {href,label}`, `save: SaveStatus`, `back?`, `next: {label,onClick,busy?}`, `children` | étape en fondu, envoi en cours, conflit de version, lecture seule |
| C42 Recap | `sections: {id,title,editHref,items,missing?}[]`, `editLabel` | complet, avec manques |
| C43 ActivationChecklist | `title`, `done`, `total`, `items: {state:"todo"｜"done"｜"waiting"｜"locked",title,detail?,action?}[]` | quatre états de ligne ; terminée : absente |
| C44 NetworkAccordion | `networks: {id,name,primary,complete,open,summary?,error?,children}[]`, `onToggle`, `onPrimary`, `labels` | fermé, ouvert, complet (fête une fois), en erreur, lecture seule |
| C45 PortfolioGrid | `items`, `onAdd?`, `max`, `variant: "edit"｜"thumbs"｜"stack"` | vide, en envoi, refusé, plein |
| C46 DeliverablesPicker | `networks: {id,name,formats:{code,label,quantity?}[]}[]`, `onChange`, `mode: "quantity"｜"choice"`, `max?` | zéro, choisi, plafond, réseau décoché |
| C47 DateField | `label`, `value` (ISO), `onChange`, `locale`, `min?`, `max?`, `orderNote?` ; saisie JJ/MM/AAAA ou MM/DD/YYYY | vide, valide, format refusé, ordre à vérifier |
| C48 FeedCard | `href`, `brand`, `logo?`, `verified?`, `title`, `due: {label,soon?}`, `meta` | survol, échéance proche, close |
| C49 OtpField | `value`, `onChange`, `length` 6, `label`, `invalid?`, `busy?`, `variant: "boxes"｜"line"` | vide, partiel, complet, erreur, bloqué (essais) |
| C50 AuthLayout | `width: "form"｜"wide"`, `card?`, `langSwitch`, `children` | hors ligne (notice) |
| C51 NumberedSteps | `items: {label,body?,state?:"todo"｜"current"｜"done"}[]` | trois |
| C52 CodeBox / LinkBox | `value`, `copyLabel`, `copiedLabel`, `variant: "code"｜"link"`, `once?` | repos, copié (annoncé), copie impossible |
| C54 ComparisonTable | `columns`, `rows`, `caption`, `rowHref` | défilable, vide |
| C55 InlineEdit | `value`, `label`, `onSave`, `max?`, `multiline?` | lecture, édition, envoi, échec, conflit |
| C64 FileUploadList | `files: {id,name,state:"sending"｜"done"｜"failed",detail}[]`, `onAdd`, `onRetry`, `onRemove`, `accept`, `max` | quatre, plein |
| C65 CheckLists | `columns: {title,tone:"yes"｜"no"｜"show"｜"hide",items}[]` | — |
| C66 PreviewFrame | `label`, `variant: "zone"｜"strip"`, `children` | actions inertes expliquées |
| C68 BrandHero | `name`, `logo?`, `badge?`, `meta` | sans logo |

## 3. Métier, backoffice

| ID | Propriétés | États |
|---|---|---|
| C53 Timeline | `groups: {day?,items:{time,actor?,text}[]}[]`, `reads?: {summary,items}`, `variant: "bo"｜"brand"` | vide, lectures repliées |
| C58 DenseTable | `caption`, `columns: {id,label,align?,sticky?,minWidth?}[]`, `rows: {id,href?,cells,tone?,locked?}[]`, `selectable?`, `selected?`, `onSelect?`, `footer?`, `framed?`, `state: "loading"｜"ready"｜"empty"｜"filtered"｜"error"` | cinq ; ligne : survol, focus, verrouillée, hors délai, nouvelle, sélectionnée |
| C59 DecisionLayout | `dossier`, `panel`, `skipLabel` ; `DecisionPanel : state, deadline, holder, actions, reasons, comment, confirm, shortcuts, next?` | libre, pris par moi, pris par un autre, expiré, refus ouvert, envoi, décidé, périmé, lecture seule |
| C60 ReviewChecks | `items: {label,value,meta?,changed?:{before},reasons:string[],near?}[]` | inchangé, modifié, vide |
| C61 RecordLayout | `header`, `main`, `side`, `sideLabel` | deux colonnes ≥ 1 280 |
| C62 IdentifiedView | `variant: "zone"｜"block"`, `hat`, `children` ; `IdentifiedMark : label` | — |
| C63 BatchBar | `count`, `max`, `action`, `report?` | aucun, sélection, plafond, envoi, compte rendu |
| C67 SmallScreenGuard | `title`, `body`, `children` (montés selon RU-20) | petit, grand, franchissement |

## 4. Règles de test communes

Chaque composant a : un test unitaire de rendu par état, une capture par variante à 375 et 1 440 (N3), un passage axe,
un parcours clavier s'il est interactif, une vérification sous mouvement réduit s'il est animé.
