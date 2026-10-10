# <Simulation title> — notes

<!--
Working notes that the other documents cite. Verified facts about the original, read from its code
outside this repository, written in our own words (no quoted lines, no copied tables). Then the
simulations we ran and the balance decisions they led to, with numbers. Copy to
games/<id>/docs/NOTES.md.
-->

## Sources

- <The reference file name and where it lives (outside the repo, read-only).>
- <Published sources, as listed in CREDITS.md.>

## Verified behaviour of the original

<One bullet per fact, each saying how it was verified ("read in the turn loop", "traced by hand").
Rules, ranges, order of operations, endings.>

- <fact>

## Quirks and bugs

- <quirk or bug, and whether CHANGES-FROM-ORIGINAL.md keeps or fixes it>

## Simulations

<Bot runs used to tune the model: the bot, the number of seeded runs, the results. Each table that a
test locks in names the test.>

| Scenario   | Bot       | Runs   | Result                   | Target   | Locked by   |
| ---------- | --------- | ------ | ------------------------ | -------- | ----------- |
| <standard> | <careful> | <1000> | <median verdict, spread> | <target> | <test name> |

## Balance decisions

| Decision       | Before   | After    | Evidence         |
| -------------- | -------- | -------- | ---------------- |
| <what changed> | <number> | <number> | <simulation row> |
