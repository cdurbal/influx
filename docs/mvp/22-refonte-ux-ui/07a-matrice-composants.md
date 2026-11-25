# 07a — Matrice composants vers écrans

> Produite par script depuis le §3 des fiches, complétée par les classes relevées dans les maquettes. N nouveau, E à faire
> évoluer, R réutilisé.

| ID | Composant | Nature | Description | Écrans | Nombre |
|---|---|---|---|---|---|
| C01 | PageFrame | N | `02a` | E04.1 E07.1 E10.1 E12.1 E18.1 | 5 |
| C02 | PageHeader | E | `02a` | E01.1 E01.2 E02.1 E02b.1 E03.1 E03.6 E03.7 E04.1 E05.1 E06.1 E06.2 E07.1 E07.6 E07.7 E08.1 E08.2 E09.1 E09.2 E10.1 E10.4 E10.5 E10.6 E11.1 E11.2 E11.3 E11.4 E11.5 E11.7 E12.1 E13.1 E14.1 E15.1 E16.1 E16.2 E17.1 E18.1 E19.1 E20.1 E20.2 E20.4 E20.5 E20.6 E21.1 E21.2 E21.3 E21.4 E21.5 E21.6 E21.7 | 49 |
| C03 | Section | N | `02a` | E01.1 E01.2 E02b.1 E04.1 E05.1 E05.2 E05.3 E05.4 E05.7 E05.8 E05.9 E05b.1 E06.1 E08.2 E12.1 E14.1 E18.1 E20.2 E20.4 E20.5 E20.6 E21.6 | 22 |
| C04 | Card | E | `02a` | E01.1 E01.2 E02b.1 E09.3 E10.4 E11.1 E12.1 | 7 |
| C05 | InnerPanel | N | `02a` | E03.1 E03.3 E03.5 E03.7 E05.1 E06.1 E07.1 E09.1 E09.2 E09.3 E10.1 E11.4 E14.1 E14.2 E14.3 E14.4 E15.1 E20.2 E20.4 E21.4 E21.5 | 21 |
| C06 | RowList | N | `02a` | E01.1 E01.2 E03.7 E04.1 E05b.1 E06.1 E06.2 E09.1 E10.6 E12.1 E17.1 E20.1 E20.5 E20.6 | 14 |
| C07 | PropertyList | N | `02a` | E02b.1 E04.1 E05.1 E05.2 E05.3 E05.4 E05.5 E05.6 E05.7 E05.8 E05.9 E05b.1 E05b.2 E06.1 E06.2 E07.6 E08.2 E10.4 E14.3 E14.4 E17.1 E18.1 E21.3 E21.6 E21.7 | 25 |
| C08 | EmptyState / StateMessage | N | `02a` | E01.1 E01.2 E02.1 E04.1 E06.1 E08.1 E09.1 E10.2 E12.1 E13.1 E16.1 E16.2 E17.1 E21.2 | 14 |
| C09 | Skeleton | N | `02a` | E01.1 E01.2 E02.1 E04.1 E13.1 E16.1 E16.2 | 7 |
| C10 | Button | E | `02a` | E01.1 E01.2 E02.1 E02b.1 E03.1 E03.6 E03.7 E03.8 E04.1 E05.1 E05b.1 E06.1 E07.1 E07.6 E07.7 E09.1 E10.1 E10.4 E10.5 E10.6 E10.7 E11.1 E11.2 E11.4 E11.5 E11.7 E12.1 E13.1 E14.1 E14.2 E14.3 E16.1 E16.2 E17.1 E18.1 E19.1 E20.1 E20.2 E20.3 E20.4 E20.5 E20.6 E20.7 E21.3 E21.4 | 45 |
| C11 | ActionLink | N | `02a` | E01.1 E01.2 E02.1 E02b.1 E03.1 E03.6 E03.8 E04.1 E05.1 E05b.1 E06.1 E06.2 E07.1 E07.6 E07.7 E08.2 E09.2 E10.1 E10.4 E10.5 E11.1 E11.2 E11.3 E11.4 E12.1 E13.1 E14.1 E15.1 E17.1 E18.1 E20.2 E20.3 E21.4 E21.5 | 34 |
| C12 | CardActions | N | `02a` | E05.1 E09.1 E09.3 E14.4 | 4 |
| C13 | StatusBadge | E | `02a` | E01.1 E01.2 E03.3 E03.7 E04.1 E05.1 E05.2 E05.3 E05b.1 E06.1 E07.1 E07.7 E08.2 E09.1 E10.1 E10.5 E10.6 E10.7 E12.1 E13.1 E14.1 E14.3 E16.1 E16.2 E17.1 E18.1 E20.5 E21.4 E21.5 | 29 |
| C14 | LayerBadge | E | `02a` | E05.1 E05b.2 E07.1 E07.4 E07.6 E10.1 E10.4 | 7 |
| C15 | RoleBadge | R | `02a` | E06.1 E06.2 | 2 |
| C16 | CounterBadge | E | `02a` | E02.1 E04.1 E12.1 | 3 |
| C17 | Notice | R | `02a` | E01.1 E03.1 E03.7 E04.1 E05.1 E05.3 E06.1 E07.1 E07.6 E07.7 E09.3 E10.1 E10.4 E10.5 E10.6 E11.7 E12.1 E13.1 E14.1 E14.2 E14.3 E14.4 E15.1 E16.1 E16.2 E17.1 E18.1 E20.3 E20.4 E21.1 E21.3 E21.4 E21.5 E21.6 | 34 |
| C18 | Field | E | `02a` | E02.1 E02b.1 E03.1 E03.2 E03.3 E03.4 E03.5 E05.1 E05.3 E05.5 E05.6 E05.7 E05.8 E07.1 E07.2 E07.4 E07.5 E07.6 E09.1 E09.3 E10.1 E10.2 E10.3 E10.4 E10.6 E11.2 E11.3 E11.4 E11.5 E11.6 E12.1 E14.4 E16.2 E18.1 E20.2 E20.3 E20.4 E20.5 E20.6 E20.7 E21.3 | 41 |
| C19 | FieldMessage | N | `02a` | E02b.1 E03.3 E03.4 E05.1 E06.1 E07.5 E09.1 E10.1 E10.7 E11.2 E11.4 E11.5 E11.6 E12.1 E17.1 E20.3 E20.7 E21.4 | 18 |
| C20 | ErrorSummary / MissingList | N | `02a` | E03.6 E07.6 E10.4 E11.5 | 4 |
| C21 | ChoiceGroup | E | `02a` | E02.1 E03.1 E03.5 E05.1 E05.2 E05.4 E05.5 E05.6 E05.7 E05.9 E07.2 E07.3 E07.4 E07.6 E09.3 E10.2 E11.5 E11.6 E14.4 E18.1 E20.2 | 21 |
| C22 | SegmentedControl | N | `02a` | E02b.1 E03.4 E07.2 E09.2 E10.2 E11.5 E11.6 E15.1 E20.2 E21.1 | 10 |
| C23 | TagPicker | E | `02a` | E03.2 E03.3 E07.2 E07.3 E10.1 E10.2 E21.6 | 7 |
| C24 | InternalZone | N | `02a` | E03.1 E05.3 E07.1 E07.4 E10.3 E17.1 E18.1 | 7 |
| C25 | SaveStatus | E | `02a` | E03.1 E07.1 E10.1 E20.2 | 4 |
| C26 | Disclosure | E | `02a` | E02b.1 E03.1 E03.2 E03.3 E03.5 E04.1 E05.1 E05b.1 E06.1 E06.2 E07.1 E07.3 E07.5 E09.2 E10.1 E10.2 E10.3 E11.2 E11.4 E12.1 E14.2 E14.3 E15.1 E17.1 E18.1 E20.5 E20.6 E20.7 | 28 |
| C27 | Dialog | N | `02a` | E04.1 E05.1 E16.1 E21.1 | 4 |
| C28 | FiltersDialog | N | `02a` | E02.1 E13.1 | 2 |
| C29 | Announcer | N | `02a` | E02.1 E02b.1 E04.1 E07.1 E07.7 E09.3 E18.1 E21.3 | 8 |
| C30 | FilterBar | N | `02a` | E02.1 E08.1 E13.1 E16.1 E16.2 E21.1 | 6 |
| C31 | PhotoCard | N | `02b` | E02.1 E09.2 E13.1 | 3 |
| C32 | Pager / pied de liste | E | `02a` | E02.1 E08.1 E13.1 E16.1 E16.2 | 5 |
| C33 | LogoPlate / Avatar | N | `02a` | E01.2 E02b.1 E05b.1 E06.1 E08.1 E08.2 E10.1 E10.4 E10.6 E17.1 E18.1 | 11 |
| C34 | MediaGallery | N | `02b` | E02b.1 E05.2 E05.4 E15.1 | 4 |
| C35 | KeyFigures | N | `02b` | E02b.1 E05.2 E05b.1 E08.2 E15.1 E18.1 | 6 |
| C36 | ReasonList | N | `02b` | E02b.1 E05b.1 E08.2 E13.1 E15.1 | 5 |
| C37 | RangeBar | N | `02b` | E02b.1 E15.1 | 2 |
| C38 | ChipList | N | `02b` | E01.2 E02b.1 E05.9 E05b.1 E10.4 E15.1 | 6 |
| C39 | StickyAside + MobileActionBar | N | `02b` | E02.1 E02b.1 E05b.1 E08.2 E15.1 E18.1 | 6 |
| C40 | ReadingLayout | N | `02b` | E05b.2 E18.1 | 2 |
| C41 | Wizard | N | `02b` | E03.1 E03.6 E03.8 E07.1 E07.6 E10.1 E10.4 E10.7 E14.2 | 9 |
| C42 | Recap | N | `02b` | E03.6 E07.6 E10.4 | 3 |
| C43 | ActivationChecklist | N | `02b` | E01.1 E01.2 | 2 |
| C44 | NetworkAccordion | N | `02b` | E02b.1 E03.3 E15.1 | 3 |
| C45 | PortfolioGrid / MediaThumbs | E | `02b` | E03.5 E06.2 E09.1 | 3 |
| C46 | DeliverablesPicker / formats par réseau | E | `02b` | E03.5 E07.2 E10.2 | 3 |
| C47 | DateField | N | `02b` | E05.5 E07.5 E16.1 | 3 |
| C48 | FeedCard | E | `02b` | E01.2 E07.1 E07.6 E08.1 | 4 |
| C49 | OtpField / CodeField | N | `02b` | E11.4 E20.3 E20.7 E21.3 | 4 |
| C50 | AuthLayout | E | `02b` | E11.1 E11.2 E11.4 E11.5 E11.6 E11.7 | 6 |
| C51 | NumberedSteps | N | `02b` | E07.5 E07.7 E10.5 E11.4 E14.2 E20.3 | 6 |
| C52 | CodeBox / LinkBox | E | `02b` | E14.2 E21.4 | 2 |
| C53 | Timeline | E | `02b` | E05.1 E06.1 E06.2 E17.1 E18.1 | 5 |
| C54 | ComparisonTable | N | `02b` | E09.2 | 1 |
| C55 | InlineEdit / note | N | `02b` | E09.2 | 1 |
| C56 | MemberShell | E | `02a` | E12.1 E14.1 | 2 |
| C57 | BoShell | E | `02a` | E04.1 E05.1 E06.1 E13.1 E16.1 E16.2 E17.1 E19.1 E21.1 | 9 |
| C58 | DenseTable | E | `02b` | E04.1 E05.4 E06.1 E06.2 E16.1 E16.2 E21.1 E21.2 E21.4 E21.5 E21.7 | 11 |
| C59 | DecisionLayout + DecisionPanel | E | `02b` | E05.1 E05.2 E05.3 E05.4 E05.5 E05.6 E05.7 E05.8 E05.9 | 9 |
| C60 | ReviewChecks | N | `02b` | E05.1 E05.2 E05.4 E17.1 | 4 |
| C61 | RecordLayout | N | `02b` | E06.1 E06.2 E17.1 | 3 |
| C62 | IdentifiedView | E | `02b` | E05.1 E05.2 E05.5 E05.8 E06.1 E06.2 E13.1 E17.1 | 8 |
| C63 | BatchBar | N | `02b` | E21.1 | 1 |
| C64 | FileUploadList | E | `02b` | E05.5 E05.7 E14.3 | 3 |
| C65 | CheckLists | N | `02b` | E05.5 E05.6 E08.2 E14.2 E14.3 E18.1 E20.4 E20.7 | 8 |
| C66 | PreviewFrame | N | `02b` | E05b.2 E15.1 | 2 |
| C67 | SmallScreenGuard | E | `02b` | E19.1 | 1 |
| C68 | BrandHero | N | `02b` | E05b.1 | 1 |

**68 composants** : 41 nouveaux, 25 à faire évoluer, 2 réutilisés tels quels.
