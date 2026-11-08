# Prompts

Prompts for Claude Code, written by the project architect. Run them in order, one per session,
from the repo root (`E:\Projects\simulation\web`). Do not edit a prompt while it runs; report
deviations in the final reply.

Status checked against the repository on 2026-11-02 (branch `main`, pushed to origin).

| # | File | What it builds | Status |
|---|---|---|---|
| 00 | `00-foundation.md` | Repo, simulation kit (turns, forecast, runs, signals, chronicles), Legacy gamification, Hall "the Almanac" with three themes in light and dark, docs | done — committed |
| 01 | `01-ten-harvests.md` | Ten Harvests (inspired by Hamurabi): three.js city diorama, grain budget bar, honest ledger, The Year Turns cinematic, carved stele chronicle; Classic, Daily, 6 scenarios, Dynasty, 1978 Ledger | done — approved 2026-10-10, committed |
| 02 | `02-crown-of-florins.md` | Crown of Florins (inspired by Santa Paravia and Fiumaccio): reconstructed economy, glass-box title road, 1–6 hot-seat plus AI rival personalities, dynasty; "Affresco" living fresco, valley map with banner invasions, illuminated obituary, gold-leaf coronation | built 2026-10-13 — architect review 2026-11-07: polish needed (see 02a), not committed |
| 02a | `02a-crown-of-florins-polish.md` | Polish of Crown of Florins from the hero-frame review: a true fresco pass (brushwork, plaster, pigment, hand-drawn edges, painted hills), real gold leaf, valley night and invasion, artefacts, year-screen overflow and UI truth (title names, treasury, rival crowned) | done 2026-11-08 — architect check passed; ready for the owner's play-test and commit |

Simulation prompts are written one by one after each design brief is agreed with the owner.
Planned: Ten Harvests *(title agreed, from Hamurabi)* · Crown of Florins *(title agreed, from
Santa Paravia and Fiumaccio)*. More simulations will be added to `E:\Projects\simulation\src`.

Conventions:

- Recommended model: Opus 5.5; effort xhigh unless the prompt's header says otherwise.
- Reference material lives outside the repo and is read-only: `E:\Projects\simulation\src`.
- Ports: Hall dev 4479, Playwright 5479; simulation sessions get their own ports in their prompts.
- No commits, no pushes: the owner reviews and commits.
- Each session updates `docs/PROGRESS.md` once, at the end.
