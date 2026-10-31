# Self-hosted fonts (D73, 02 §21.4)

Variable woff2 files (axis `wght`, normal style), **unmodified**, as Google Fonts distributes them,
through the Fontsource mirror at a pinned version. Downloaded once on a workstation; CI downloads
nothing. A modified file loses the right to the reserved font name (OFL 1.1): never re-subset them.
Guard G4f (`packages/test-kit/src/guards.ts`) checks this table against the files, in both
directions, and keeps the copies of both fronts identical.

| File                                        | Family        | Subset    | Source                                     | SHA-256                                                            | Weights | Preloaded | License                 |
| ------------------------------------------- | ------------- | --------- | ------------------------------------------ | ------------------------------------------------------------------ | ------- | --------- | ----------------------- |
| `manrope-latin-wght-normal.woff2`           | Manrope       | latin     | `@fontsource-variable/manrope@5.3.0`       | `a30ddcd349703aff7464c34bef3fffdff405ee50c113440d7c8693c02d210972` | 200–800 | yes       | `OFL-Manrope.txt`       |
| `manrope-latin-ext-wght-normal.woff2`       | Manrope       | latin-ext | `@fontsource-variable/manrope@5.3.0`       | `3911b66d9f2e005a4b989223405d0e5032619c668597ba467cc76a23c8fffcfb` | 200–800 | no        | `OFL-Manrope.txt`       |
| `source-sans-3-latin-wght-normal.woff2`     | Source Sans 3 | latin     | `@fontsource-variable/source-sans-3@5.3.1` | `19143dca075972bc84e3fd9eab7416dd40cc565dccb2435a044bdfabe060c7d5` | 200–900 | yes       | `OFL-Source-Sans-3.txt` |
| `source-sans-3-latin-ext-wght-normal.woff2` | Source Sans 3 | latin-ext | `@fontsource-variable/source-sans-3@5.3.1` | `a85a7459bdb3cdc1136751e151a506bae653fc29ada3ca86237477df6f1b59e6` | 200–900 | no        | `OFL-Source-Sans-3.txt` |

Preloaded budget: the two `latin` files weigh 53 708 bytes together (24 836 + 28 872), ceiling
120 000 bytes, pinned by G4f.

Tokens use Manrope 600–800 and Source Sans 3 400–600 (final list: `expert-ux`). Manrope carries the
`tnum` feature in its `latin` file (tabular figures for amounts).
