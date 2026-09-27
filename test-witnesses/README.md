# Witness files of the static checks (docs/mvp/18 T6 and T16)

Each file here commits exactly the infraction its name describes. The static checks run on them
and MUST report each one: an analyser that finds nothing on an empty code base always passes,
even when broken. These files live outside `apps/` and `packages/` on purpose, and use the
`.txt` extension so that no compiler, linter or formatter picks them up.
