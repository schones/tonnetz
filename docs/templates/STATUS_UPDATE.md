<!--
Template for a STATUS.md surface section. STATUS.md should have
one of these blocks per major surface (Cantor, Harmonograph,
Explorer, SkratchLab, Games, Theory Hub, etc.). Update in place
when state changes.

The "current state" date in parens is the date of the last update
to this block, not the original creation date.
-->

### [Surface name] — current state (updated YYYY-MM-DD)

**Landed and verified on dev:**
- Bullet list of completed, verified features. Order doesn't have
  to be chronological — group by what's most useful to read.

**In progress:**
- Active work, including which branch it's on. Include enough
  context that picking it up cold is feasible. Estimated session
  count helps.

**Open / deferred:**
- Known gaps, design questions, or future work. Distinguish
  "deferred until [trigger]" from "deferred indefinitely."

**Public surfaces (test harness / debugging) — optional:**
- For surfaces with debugging APIs, list them here so future-you
  doesn't have to re-grep for them.

**Standing rules — optional:**
- Anything specific to this surface that overrides general rules
  (e.g., "don't refactor X until Y lands").