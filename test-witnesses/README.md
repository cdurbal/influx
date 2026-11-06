# Witness files of the static checks (docs/mvp/18 T6 and T16)

Each file here commits exactly the infraction its name describes. The static checks run on them
and MUST report each one: an analyser that finds nothing on an empty code base always passes,
even when broken. These files live outside `apps/` and `packages/` on purpose, and use the
`.txt` extension so that no compiler, linter or formatter picks them up.

| Folder                           | Check                                                                                                             | Proven by                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `t16/`                           | T16, no commission computed in code                                                                               | `packages/test-kit/tests/t16-static.test.ts` |
| `t16-l2d/`                       | T16-L2D, no price, rate, net, currency or amount key in a creator profile contract or translation                 | `packages/test-kit/tests/t16-static.test.ts` |
| `t6/`, `t6-role/`, `t6-session/` | T6, closed list of elevated operations, no role or session state outside `src/db/`                                | `apps/api/tests/t6-static.test.ts`           |
| `s1/`                            | S-1 (21 §4, review of J3 commits 5 and 6): postgres.js `unsafe` only in `apps/api/src/db/pool.ts`, an ESLint rule | `apps/api/tests/postgres-unsafe.test.ts`     |
| `j3b/`                           | 21 J3-B: `@supabase/supabase-js` and `@supabase/postgrest-js` in no `package.json` and not in the lockfile        | `apps/api/tests/supabase-guards.test.ts`     |
