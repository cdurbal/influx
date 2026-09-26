-- =============================================================================
-- 0003_reference_core
-- -----------------------------------------------------------------------------
-- Lot 0 / J2. Shared closed lists: countries (ISO 3166-1 alpha-2, 249 codes),
-- currencies (ISO 4217, with their minor unit) and languages (ISO 639-1).
-- Reference data is SCHEMA, loaded by migration, never by seed (04 §11.1).
-- Codes only: display labels live in the translation files, the `label_key`
-- column points to them (04 R8).
--
-- Lists written on 2026-09-26 from the published standards:
--   * countries: the 249 officially assigned ISO 3166-1 alpha-2 codes;
--   * currencies: ISO 4217 list one, circulating currencies only. Fund codes
--     (BOV, CHE, CHW, CLF, COU, MXV, USN, UYI, UYW), precious metals, SDR and
--     test codes (X..) are excluded, except the real regional currencies XAF,
--     XCD, XCG, XOF and XPF; withdrawn codes (ANG, CUC, HRK, SLL, ZWL) are
--     excluded. To re-check against the ISO 4217 maintenance agency before
--     production;
--   * languages: the 183 ISO 639-1 codes; `fr` and `en` are the UI languages
--     at launch (CLAUDE.md §2).
-- `is_active = true` means "a valid, current code", nothing more. The closed list
-- of currencies allowed on an amount (D27) and the countries open to contracts
-- (D26) are NOT modelled yet: both decisions are postponed to V2 (04 §2.3).
--
-- Access: read by the four business roles WITH a transaction context only
-- (18 T2.5: a role taken without context sees no row, 03 P4); agent and admin
-- need aal2 (03 §6.2). No write for any execution role.
--
-- ROLLBACK (before 0004, which references these tables):
--   drop table reference.languages, reference.currencies, reference.countries;
-- =============================================================================

-- 1. Tables ---------------------------------------------------------------------

create table if not exists reference.countries (
  code        char(2)     not null primary key
                          check (code ~ '^[A-Z]{2}$'),
  label_key   text        not null
                          check (label_key ~ '^country\.[A-Z]{2}$'),
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table reference.countries is
  'ISO 3166-1 alpha-2 countries (249). Account country, parties'' countries recorded on an '
  'introduction. Sign-up is open worldwide (CLAUDE.md §2); countries open to contracts (D26) are a '
  'V2 decision.';
comment on column reference.countries.label_key is
  'Translation key of the country name (04 R8). No label is stored in the database.';

create table if not exists reference.currencies (
  code        char(3)     not null primary key
                          check (code ~ '^[A-Z]{3}$'),
  minor_unit  smallint    not null
                          check (minor_unit between 0 and 4),
  label_key   text        not null
                          check (label_key ~ '^currency\.[A-Z]{3}$'),
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table reference.currencies is
  'ISO 4217 circulating currencies. Every amount of the model is a bigint in the minor unit, '
  'always paired with one of these codes (04 §8.1).';
comment on column reference.currencies.minor_unit is
  'Number of decimals of the minor unit: 2 for EUR (200000 = 2 000,00 EUR), 0 for JPY, 3 for TND. '
  'The ONLY source of the factor used by the single unit-conversion function of packages/domain '
  '(03 §8, T16 named exemption). Never assume two decimals.';

create table if not exists reference.languages (
  code            char(2)     not null primary key
                              check (code ~ '^[a-z]{2}$'),
  label_key       text        not null
                              check (label_key ~ '^language\.[a-z]{2}$'),
  is_ui_language  boolean     not null default false,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- target of the composite foreign key that restricts accounts.preferred_language
  -- to a UI language (0004): declarative, no trigger
  constraint languages_ui_key unique (code, is_ui_language)
);

comment on table reference.languages is
  'ISO 639-1 languages. Publication languages of creators and campaigns (Lots 2, 3); UI languages '
  'flagged by is_ui_language (fr and en at launch, Portuguese first candidate).';
comment on column reference.languages.is_ui_language is
  'True when the product is translated into this language. An account''s preferred_language must be '
  'one of them (composite foreign key from identity.accounts). Turning it off while accounts use it '
  'is refused by that key.';

drop trigger if exists countries_touch_updated_at on reference.countries;
create trigger countries_touch_updated_at
  before update on reference.countries
  for each row execute function influx.touch_updated_at();

drop trigger if exists currencies_touch_updated_at on reference.currencies;
create trigger currencies_touch_updated_at
  before update on reference.currencies
  for each row execute function influx.touch_updated_at();

drop trigger if exists languages_touch_updated_at on reference.languages;
create trigger languages_touch_updated_at
  before update on reference.languages
  for each row execute function influx.touch_updated_at();

-- 2. Data --------------------------------------------------------------------------

insert into reference.countries (code, label_key) values
  ('AD', 'country.AD'), ('AE', 'country.AE'), ('AF', 'country.AF'), ('AG', 'country.AG'), ('AI', 'country.AI'), ('AL', 'country.AL'),
  ('AM', 'country.AM'), ('AO', 'country.AO'), ('AQ', 'country.AQ'), ('AR', 'country.AR'), ('AS', 'country.AS'), ('AT', 'country.AT'),
  ('AU', 'country.AU'), ('AW', 'country.AW'), ('AX', 'country.AX'), ('AZ', 'country.AZ'), ('BA', 'country.BA'), ('BB', 'country.BB'),
  ('BD', 'country.BD'), ('BE', 'country.BE'), ('BF', 'country.BF'), ('BG', 'country.BG'), ('BH', 'country.BH'), ('BI', 'country.BI'),
  ('BJ', 'country.BJ'), ('BL', 'country.BL'), ('BM', 'country.BM'), ('BN', 'country.BN'), ('BO', 'country.BO'), ('BQ', 'country.BQ'),
  ('BR', 'country.BR'), ('BS', 'country.BS'), ('BT', 'country.BT'), ('BV', 'country.BV'), ('BW', 'country.BW'), ('BY', 'country.BY'),
  ('BZ', 'country.BZ'), ('CA', 'country.CA'), ('CC', 'country.CC'), ('CD', 'country.CD'), ('CF', 'country.CF'), ('CG', 'country.CG'),
  ('CH', 'country.CH'), ('CI', 'country.CI'), ('CK', 'country.CK'), ('CL', 'country.CL'), ('CM', 'country.CM'), ('CN', 'country.CN'),
  ('CO', 'country.CO'), ('CR', 'country.CR'), ('CU', 'country.CU'), ('CV', 'country.CV'), ('CW', 'country.CW'), ('CX', 'country.CX'),
  ('CY', 'country.CY'), ('CZ', 'country.CZ'), ('DE', 'country.DE'), ('DJ', 'country.DJ'), ('DK', 'country.DK'), ('DM', 'country.DM'),
  ('DO', 'country.DO'), ('DZ', 'country.DZ'), ('EC', 'country.EC'), ('EE', 'country.EE'), ('EG', 'country.EG'), ('EH', 'country.EH'),
  ('ER', 'country.ER'), ('ES', 'country.ES'), ('ET', 'country.ET'), ('FI', 'country.FI'), ('FJ', 'country.FJ'), ('FK', 'country.FK'),
  ('FM', 'country.FM'), ('FO', 'country.FO'), ('FR', 'country.FR'), ('GA', 'country.GA'), ('GB', 'country.GB'), ('GD', 'country.GD'),
  ('GE', 'country.GE'), ('GF', 'country.GF'), ('GG', 'country.GG'), ('GH', 'country.GH'), ('GI', 'country.GI'), ('GL', 'country.GL'),
  ('GM', 'country.GM'), ('GN', 'country.GN'), ('GP', 'country.GP'), ('GQ', 'country.GQ'), ('GR', 'country.GR'), ('GS', 'country.GS'),
  ('GT', 'country.GT'), ('GU', 'country.GU'), ('GW', 'country.GW'), ('GY', 'country.GY'), ('HK', 'country.HK'), ('HM', 'country.HM'),
  ('HN', 'country.HN'), ('HR', 'country.HR'), ('HT', 'country.HT'), ('HU', 'country.HU'), ('ID', 'country.ID'), ('IE', 'country.IE'),
  ('IL', 'country.IL'), ('IM', 'country.IM'), ('IN', 'country.IN'), ('IO', 'country.IO'), ('IQ', 'country.IQ'), ('IR', 'country.IR'),
  ('IS', 'country.IS'), ('IT', 'country.IT'), ('JE', 'country.JE'), ('JM', 'country.JM'), ('JO', 'country.JO'), ('JP', 'country.JP'),
  ('KE', 'country.KE'), ('KG', 'country.KG'), ('KH', 'country.KH'), ('KI', 'country.KI'), ('KM', 'country.KM'), ('KN', 'country.KN'),
  ('KP', 'country.KP'), ('KR', 'country.KR'), ('KW', 'country.KW'), ('KY', 'country.KY'), ('KZ', 'country.KZ'), ('LA', 'country.LA'),
  ('LB', 'country.LB'), ('LC', 'country.LC'), ('LI', 'country.LI'), ('LK', 'country.LK'), ('LR', 'country.LR'), ('LS', 'country.LS'),
  ('LT', 'country.LT'), ('LU', 'country.LU'), ('LV', 'country.LV'), ('LY', 'country.LY'), ('MA', 'country.MA'), ('MC', 'country.MC'),
  ('MD', 'country.MD'), ('ME', 'country.ME'), ('MF', 'country.MF'), ('MG', 'country.MG'), ('MH', 'country.MH'), ('MK', 'country.MK'),
  ('ML', 'country.ML'), ('MM', 'country.MM'), ('MN', 'country.MN'), ('MO', 'country.MO'), ('MP', 'country.MP'), ('MQ', 'country.MQ'),
  ('MR', 'country.MR'), ('MS', 'country.MS'), ('MT', 'country.MT'), ('MU', 'country.MU'), ('MV', 'country.MV'), ('MW', 'country.MW'),
  ('MX', 'country.MX'), ('MY', 'country.MY'), ('MZ', 'country.MZ'), ('NA', 'country.NA'), ('NC', 'country.NC'), ('NE', 'country.NE'),
  ('NF', 'country.NF'), ('NG', 'country.NG'), ('NI', 'country.NI'), ('NL', 'country.NL'), ('NO', 'country.NO'), ('NP', 'country.NP'),
  ('NR', 'country.NR'), ('NU', 'country.NU'), ('NZ', 'country.NZ'), ('OM', 'country.OM'), ('PA', 'country.PA'), ('PE', 'country.PE'),
  ('PF', 'country.PF'), ('PG', 'country.PG'), ('PH', 'country.PH'), ('PK', 'country.PK'), ('PL', 'country.PL'), ('PM', 'country.PM'),
  ('PN', 'country.PN'), ('PR', 'country.PR'), ('PS', 'country.PS'), ('PT', 'country.PT'), ('PW', 'country.PW'), ('PY', 'country.PY'),
  ('QA', 'country.QA'), ('RE', 'country.RE'), ('RO', 'country.RO'), ('RS', 'country.RS'), ('RU', 'country.RU'), ('RW', 'country.RW'),
  ('SA', 'country.SA'), ('SB', 'country.SB'), ('SC', 'country.SC'), ('SD', 'country.SD'), ('SE', 'country.SE'), ('SG', 'country.SG'),
  ('SH', 'country.SH'), ('SI', 'country.SI'), ('SJ', 'country.SJ'), ('SK', 'country.SK'), ('SL', 'country.SL'), ('SM', 'country.SM'),
  ('SN', 'country.SN'), ('SO', 'country.SO'), ('SR', 'country.SR'), ('SS', 'country.SS'), ('ST', 'country.ST'), ('SV', 'country.SV'),
  ('SX', 'country.SX'), ('SY', 'country.SY'), ('SZ', 'country.SZ'), ('TC', 'country.TC'), ('TD', 'country.TD'), ('TF', 'country.TF'),
  ('TG', 'country.TG'), ('TH', 'country.TH'), ('TJ', 'country.TJ'), ('TK', 'country.TK'), ('TL', 'country.TL'), ('TM', 'country.TM'),
  ('TN', 'country.TN'), ('TO', 'country.TO'), ('TR', 'country.TR'), ('TT', 'country.TT'), ('TV', 'country.TV'), ('TW', 'country.TW'),
  ('TZ', 'country.TZ'), ('UA', 'country.UA'), ('UG', 'country.UG'), ('UM', 'country.UM'), ('US', 'country.US'), ('UY', 'country.UY'),
  ('UZ', 'country.UZ'), ('VA', 'country.VA'), ('VC', 'country.VC'), ('VE', 'country.VE'), ('VG', 'country.VG'), ('VI', 'country.VI'),
  ('VN', 'country.VN'), ('VU', 'country.VU'), ('WF', 'country.WF'), ('WS', 'country.WS'), ('YE', 'country.YE'), ('YT', 'country.YT'),
  ('ZA', 'country.ZA'), ('ZM', 'country.ZM'), ('ZW', 'country.ZW')
on conflict (code) do nothing;

insert into reference.currencies (code, minor_unit, label_key) values
  ('AED', 2, 'currency.AED'), ('AFN', 2, 'currency.AFN'), ('ALL', 2, 'currency.ALL'), ('AMD', 2, 'currency.AMD'),
  ('AOA', 2, 'currency.AOA'), ('ARS', 2, 'currency.ARS'), ('AUD', 2, 'currency.AUD'), ('AWG', 2, 'currency.AWG'),
  ('AZN', 2, 'currency.AZN'), ('BAM', 2, 'currency.BAM'), ('BBD', 2, 'currency.BBD'), ('BDT', 2, 'currency.BDT'),
  ('BHD', 3, 'currency.BHD'), ('BIF', 0, 'currency.BIF'), ('BMD', 2, 'currency.BMD'), ('BND', 2, 'currency.BND'),
  ('BOB', 2, 'currency.BOB'), ('BRL', 2, 'currency.BRL'), ('BSD', 2, 'currency.BSD'), ('BTN', 2, 'currency.BTN'),
  ('BWP', 2, 'currency.BWP'), ('BYN', 2, 'currency.BYN'), ('BZD', 2, 'currency.BZD'), ('CAD', 2, 'currency.CAD'),
  ('CDF', 2, 'currency.CDF'), ('CHF', 2, 'currency.CHF'), ('CLP', 0, 'currency.CLP'), ('CNY', 2, 'currency.CNY'),
  ('COP', 2, 'currency.COP'), ('CRC', 2, 'currency.CRC'), ('CUP', 2, 'currency.CUP'), ('CVE', 2, 'currency.CVE'),
  ('CZK', 2, 'currency.CZK'), ('DJF', 0, 'currency.DJF'), ('DKK', 2, 'currency.DKK'), ('DOP', 2, 'currency.DOP'),
  ('DZD', 2, 'currency.DZD'), ('EGP', 2, 'currency.EGP'), ('ERN', 2, 'currency.ERN'), ('ETB', 2, 'currency.ETB'),
  ('EUR', 2, 'currency.EUR'), ('FJD', 2, 'currency.FJD'), ('FKP', 2, 'currency.FKP'), ('GBP', 2, 'currency.GBP'),
  ('GEL', 2, 'currency.GEL'), ('GHS', 2, 'currency.GHS'), ('GIP', 2, 'currency.GIP'), ('GMD', 2, 'currency.GMD'),
  ('GNF', 0, 'currency.GNF'), ('GTQ', 2, 'currency.GTQ'), ('GYD', 2, 'currency.GYD'), ('HKD', 2, 'currency.HKD'),
  ('HNL', 2, 'currency.HNL'), ('HTG', 2, 'currency.HTG'), ('HUF', 2, 'currency.HUF'), ('IDR', 2, 'currency.IDR'),
  ('ILS', 2, 'currency.ILS'), ('INR', 2, 'currency.INR'), ('IQD', 3, 'currency.IQD'), ('IRR', 2, 'currency.IRR'),
  ('ISK', 0, 'currency.ISK'), ('JMD', 2, 'currency.JMD'), ('JOD', 3, 'currency.JOD'), ('JPY', 0, 'currency.JPY'),
  ('KES', 2, 'currency.KES'), ('KGS', 2, 'currency.KGS'), ('KHR', 2, 'currency.KHR'), ('KMF', 0, 'currency.KMF'),
  ('KPW', 2, 'currency.KPW'), ('KRW', 0, 'currency.KRW'), ('KWD', 3, 'currency.KWD'), ('KYD', 2, 'currency.KYD'),
  ('KZT', 2, 'currency.KZT'), ('LAK', 2, 'currency.LAK'), ('LBP', 2, 'currency.LBP'), ('LKR', 2, 'currency.LKR'),
  ('LRD', 2, 'currency.LRD'), ('LSL', 2, 'currency.LSL'), ('LYD', 3, 'currency.LYD'), ('MAD', 2, 'currency.MAD'),
  ('MDL', 2, 'currency.MDL'), ('MGA', 2, 'currency.MGA'), ('MKD', 2, 'currency.MKD'), ('MMK', 2, 'currency.MMK'),
  ('MNT', 2, 'currency.MNT'), ('MOP', 2, 'currency.MOP'), ('MRU', 2, 'currency.MRU'), ('MUR', 2, 'currency.MUR'),
  ('MVR', 2, 'currency.MVR'), ('MWK', 2, 'currency.MWK'), ('MXN', 2, 'currency.MXN'), ('MYR', 2, 'currency.MYR'),
  ('MZN', 2, 'currency.MZN'), ('NAD', 2, 'currency.NAD'), ('NGN', 2, 'currency.NGN'), ('NIO', 2, 'currency.NIO'),
  ('NOK', 2, 'currency.NOK'), ('NPR', 2, 'currency.NPR'), ('NZD', 2, 'currency.NZD'), ('OMR', 3, 'currency.OMR'),
  ('PAB', 2, 'currency.PAB'), ('PEN', 2, 'currency.PEN'), ('PGK', 2, 'currency.PGK'), ('PHP', 2, 'currency.PHP'),
  ('PKR', 2, 'currency.PKR'), ('PLN', 2, 'currency.PLN'), ('PYG', 0, 'currency.PYG'), ('QAR', 2, 'currency.QAR'),
  ('RON', 2, 'currency.RON'), ('RSD', 2, 'currency.RSD'), ('RUB', 2, 'currency.RUB'), ('RWF', 0, 'currency.RWF'),
  ('SAR', 2, 'currency.SAR'), ('SBD', 2, 'currency.SBD'), ('SCR', 2, 'currency.SCR'), ('SDG', 2, 'currency.SDG'),
  ('SEK', 2, 'currency.SEK'), ('SGD', 2, 'currency.SGD'), ('SHP', 2, 'currency.SHP'), ('SLE', 2, 'currency.SLE'),
  ('SOS', 2, 'currency.SOS'), ('SRD', 2, 'currency.SRD'), ('SSP', 2, 'currency.SSP'), ('STN', 2, 'currency.STN'),
  ('SVC', 2, 'currency.SVC'), ('SYP', 2, 'currency.SYP'), ('SZL', 2, 'currency.SZL'), ('THB', 2, 'currency.THB'),
  ('TJS', 2, 'currency.TJS'), ('TMT', 2, 'currency.TMT'), ('TND', 3, 'currency.TND'), ('TOP', 2, 'currency.TOP'),
  ('TRY', 2, 'currency.TRY'), ('TTD', 2, 'currency.TTD'), ('TWD', 2, 'currency.TWD'), ('TZS', 2, 'currency.TZS'),
  ('UAH', 2, 'currency.UAH'), ('UGX', 0, 'currency.UGX'), ('USD', 2, 'currency.USD'), ('UYU', 2, 'currency.UYU'),
  ('UZS', 2, 'currency.UZS'), ('VED', 2, 'currency.VED'), ('VES', 2, 'currency.VES'), ('VND', 0, 'currency.VND'),
  ('VUV', 0, 'currency.VUV'), ('WST', 2, 'currency.WST'), ('XAF', 0, 'currency.XAF'), ('XCD', 2, 'currency.XCD'),
  ('XCG', 2, 'currency.XCG'), ('XOF', 0, 'currency.XOF'), ('XPF', 0, 'currency.XPF'), ('YER', 2, 'currency.YER'),
  ('ZAR', 2, 'currency.ZAR'), ('ZMW', 2, 'currency.ZMW'), ('ZWG', 2, 'currency.ZWG')
on conflict (code) do nothing;

insert into reference.languages (code, label_key, is_ui_language) values
  ('aa', 'language.aa', false), ('ab', 'language.ab', false), ('ae', 'language.ae', false), ('af', 'language.af', false),
  ('ak', 'language.ak', false), ('am', 'language.am', false), ('an', 'language.an', false), ('ar', 'language.ar', false),
  ('as', 'language.as', false), ('av', 'language.av', false), ('ay', 'language.ay', false), ('az', 'language.az', false),
  ('ba', 'language.ba', false), ('be', 'language.be', false), ('bg', 'language.bg', false), ('bi', 'language.bi', false),
  ('bm', 'language.bm', false), ('bn', 'language.bn', false), ('bo', 'language.bo', false), ('br', 'language.br', false),
  ('bs', 'language.bs', false), ('ca', 'language.ca', false), ('ce', 'language.ce', false), ('ch', 'language.ch', false),
  ('co', 'language.co', false), ('cr', 'language.cr', false), ('cs', 'language.cs', false), ('cu', 'language.cu', false),
  ('cv', 'language.cv', false), ('cy', 'language.cy', false), ('da', 'language.da', false), ('de', 'language.de', false),
  ('dv', 'language.dv', false), ('dz', 'language.dz', false), ('ee', 'language.ee', false), ('el', 'language.el', false),
  ('en', 'language.en', true), ('eo', 'language.eo', false), ('es', 'language.es', false), ('et', 'language.et', false),
  ('eu', 'language.eu', false), ('fa', 'language.fa', false), ('ff', 'language.ff', false), ('fi', 'language.fi', false),
  ('fj', 'language.fj', false), ('fo', 'language.fo', false), ('fr', 'language.fr', true), ('fy', 'language.fy', false),
  ('ga', 'language.ga', false), ('gd', 'language.gd', false), ('gl', 'language.gl', false), ('gn', 'language.gn', false),
  ('gu', 'language.gu', false), ('gv', 'language.gv', false), ('ha', 'language.ha', false), ('he', 'language.he', false),
  ('hi', 'language.hi', false), ('ho', 'language.ho', false), ('hr', 'language.hr', false), ('ht', 'language.ht', false),
  ('hu', 'language.hu', false), ('hy', 'language.hy', false), ('hz', 'language.hz', false), ('ia', 'language.ia', false),
  ('id', 'language.id', false), ('ie', 'language.ie', false), ('ig', 'language.ig', false), ('ii', 'language.ii', false),
  ('ik', 'language.ik', false), ('io', 'language.io', false), ('is', 'language.is', false), ('it', 'language.it', false),
  ('iu', 'language.iu', false), ('ja', 'language.ja', false), ('jv', 'language.jv', false), ('ka', 'language.ka', false),
  ('kg', 'language.kg', false), ('ki', 'language.ki', false), ('kj', 'language.kj', false), ('kk', 'language.kk', false),
  ('kl', 'language.kl', false), ('km', 'language.km', false), ('kn', 'language.kn', false), ('ko', 'language.ko', false),
  ('kr', 'language.kr', false), ('ks', 'language.ks', false), ('ku', 'language.ku', false), ('kv', 'language.kv', false),
  ('kw', 'language.kw', false), ('ky', 'language.ky', false), ('la', 'language.la', false), ('lb', 'language.lb', false),
  ('lg', 'language.lg', false), ('li', 'language.li', false), ('ln', 'language.ln', false), ('lo', 'language.lo', false),
  ('lt', 'language.lt', false), ('lu', 'language.lu', false), ('lv', 'language.lv', false), ('mg', 'language.mg', false),
  ('mh', 'language.mh', false), ('mi', 'language.mi', false), ('mk', 'language.mk', false), ('ml', 'language.ml', false),
  ('mn', 'language.mn', false), ('mr', 'language.mr', false), ('ms', 'language.ms', false), ('mt', 'language.mt', false),
  ('my', 'language.my', false), ('na', 'language.na', false), ('nb', 'language.nb', false), ('nd', 'language.nd', false),
  ('ne', 'language.ne', false), ('ng', 'language.ng', false), ('nl', 'language.nl', false), ('nn', 'language.nn', false),
  ('no', 'language.no', false), ('nr', 'language.nr', false), ('nv', 'language.nv', false), ('ny', 'language.ny', false),
  ('oc', 'language.oc', false), ('oj', 'language.oj', false), ('om', 'language.om', false), ('or', 'language.or', false),
  ('os', 'language.os', false), ('pa', 'language.pa', false), ('pi', 'language.pi', false), ('pl', 'language.pl', false),
  ('ps', 'language.ps', false), ('pt', 'language.pt', false), ('qu', 'language.qu', false), ('rm', 'language.rm', false),
  ('rn', 'language.rn', false), ('ro', 'language.ro', false), ('ru', 'language.ru', false), ('rw', 'language.rw', false),
  ('sa', 'language.sa', false), ('sc', 'language.sc', false), ('sd', 'language.sd', false), ('se', 'language.se', false),
  ('sg', 'language.sg', false), ('si', 'language.si', false), ('sk', 'language.sk', false), ('sl', 'language.sl', false),
  ('sm', 'language.sm', false), ('sn', 'language.sn', false), ('so', 'language.so', false), ('sq', 'language.sq', false),
  ('sr', 'language.sr', false), ('ss', 'language.ss', false), ('st', 'language.st', false), ('su', 'language.su', false),
  ('sv', 'language.sv', false), ('sw', 'language.sw', false), ('ta', 'language.ta', false), ('te', 'language.te', false),
  ('tg', 'language.tg', false), ('th', 'language.th', false), ('ti', 'language.ti', false), ('tk', 'language.tk', false),
  ('tl', 'language.tl', false), ('tn', 'language.tn', false), ('to', 'language.to', false), ('tr', 'language.tr', false),
  ('ts', 'language.ts', false), ('tt', 'language.tt', false), ('tw', 'language.tw', false), ('ty', 'language.ty', false),
  ('ug', 'language.ug', false), ('uk', 'language.uk', false), ('ur', 'language.ur', false), ('uz', 'language.uz', false),
  ('ve', 'language.ve', false), ('vi', 'language.vi', false), ('vo', 'language.vo', false), ('wa', 'language.wa', false),
  ('wo', 'language.wo', false), ('xh', 'language.xh', false), ('yi', 'language.yi', false), ('yo', 'language.yo', false),
  ('za', 'language.za', false), ('zh', 'language.zh', false), ('zu', 'language.zu', false)
on conflict (code) do nothing;

do $$
begin
  if (select count(*) from reference.countries)  <> 249 then
    raise exception 'reference.countries must hold the 249 ISO 3166-1 codes';
  end if;
  if (select count(*) from reference.currencies) <> 155 then
    raise exception 'reference.currencies must hold the 155 codes of this migration';
  end if;
  if (select count(*) from reference.languages)  <> 183 then
    raise exception 'reference.languages must hold the 183 ISO 639-1 codes';
  end if;
  if (select array_agg(code::text order by code) from reference.languages where is_ui_language)
       is distinct from array['en', 'fr'] then
    raise exception 'UI languages at launch are exactly en and fr';
  end if;
end
$$;

-- 3. Row level security and privileges ----------------------------------------------

alter table reference.countries  enable row level security;
alter table reference.countries  force  row level security;
alter table reference.currencies enable row level security;
alter table reference.currencies force  row level security;
alter table reference.languages  enable row level security;
alter table reference.languages  force  row level security;

revoke all on reference.countries, reference.currencies, reference.languages
  from public, anon, authenticated, service_role;

grant usage  on schema reference to influx_advertiser, influx_creator, influx_agent, influx_admin;
grant select on reference.countries, reference.currencies, reference.languages
  to influx_advertiser, influx_creator, influx_agent, influx_admin;

drop policy if exists countries_read_members on reference.countries;
create policy countries_read_members on reference.countries
  for select to influx_advertiser, influx_creator
  using ((select influx.current_account_id()) is not null);

drop policy if exists countries_read_internal on reference.countries;
create policy countries_read_internal on reference.countries
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists currencies_read_members on reference.currencies;
create policy currencies_read_members on reference.currencies
  for select to influx_advertiser, influx_creator
  using ((select influx.current_account_id()) is not null);

drop policy if exists currencies_read_internal on reference.currencies;
create policy currencies_read_internal on reference.currencies
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists languages_read_members on reference.languages;
create policy languages_read_members on reference.languages
  for select to influx_advertiser, influx_creator
  using ((select influx.current_account_id()) is not null);

drop policy if exists languages_read_internal on reference.languages;
create policy languages_read_internal on reference.languages
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));
