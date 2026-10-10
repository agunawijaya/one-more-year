# Credits

One More Year rebuilds the ideas of older programs in new code and new words. Nothing of their
source, screen text, messages, name lists or tables is reused. The original programs belong to
their authors and publishers.

## The originals

### Hamurabi — reborn as _Ten Harvests_ (in preparation)

- Began in 1968 as _The Sumer Game_, also known as _King of Sumeria_, written by **Doug Dyment** at
  Digital Equipment Corporation in the FOCAL language for a PDP-8.
- Inspired by _The Sumerian Game_ (1964–1966), an educational economic simulation by the teacher
  **Mabel Addis** and the IBM programmer **William McKay**.
- Around 1971 **David H. Ahl** brought it to BASIC, renamed it _Hamurabi_ and added the appraisal
  at the end of the term. It was printed in _101 BASIC Computer Games_ (1973) and again in _BASIC
  Computer Games_ (1978), the first computer book to sell a million copies.
- The single "m" comes from Dyment shortening words so the program would fit a 4K machine; Ahl kept
  the spelling. The ruler is meant to be the Babylonian king Hammurabi, although the game speaks of
  Sumeria.
- It is regarded as an ancestor of strategy, simulation and city-building games.

### Santa Paravia and Fiumaccio — reborn as _Crown of Florins_ (in preparation)

- Written by **George Blank**; first published in the December 1978 issue of _SoftSide_ magazine
  and sold on cassette by **Instant Software** for the TRS-80, Apple II, TI-99/4A and Commodore PET.
- Each player rules a young Italian city-state around the year 1400 and climbs through noble titles
  toward king or queen. It added city building to the grain-and-land formula and is counted among
  the antecedents of the city-building genre.
- The reference listing studied for this project is a later IBM PC BASIC conversion whose header
  carries a 1979 Instant Software copyright line. The listing stays outside this repository.

### Sources

- [Hamurabi (video game)](<https://en.wikipedia.org/wiki/Hamurabi_(video_game)>), Wikipedia
- [Santa Paravia en Fiumaccio](https://en.wikipedia.org/wiki/Santa_Paravia_en_Fiumaccio), Wikipedia
- [The Sumerian Game](https://en.wikipedia.org/wiki/The_Sumerian_Game), Wikipedia

## Typefaces

All self-hosted from the [Fontsource](https://fontsource.org) packages; no font is fetched from
another site at runtime.

| Typeface    | Used by                         | Authors                         | Licence                   |
| ----------- | ------------------------------- | ------------------------------- | ------------------------- |
| EB Garamond | Almanac                         | The EB Garamond Project Authors | SIL Open Font License 1.1 |
| Geist       | Situation Room                  | The Geist Project Authors       | SIL Open Font License 1.1 |
| Geist Mono  | Situation Room ticker and seeds | The Geist Project Authors       | SIL Open Font License 1.1 |
| Fraunces    | Terrarium headings and labels   | The Fraunces Project Authors    | SIL Open Font License 1.1 |
| Nunito      | Terrarium text                  | The Nunito Project Authors      | SIL Open Font License 1.1 |

## Software

The site has no runtime dependencies besides the fonts above. It is built and tested with:

| Tool                                  | Licence    |
| ------------------------------------- | ---------- |
| TypeScript                            | Apache-2.0 |
| Vite                                  | MIT        |
| Vitest                                | MIT        |
| happy-dom                             | MIT        |
| Playwright                            | Apache-2.0 |
| axe-core and @axe-core/playwright     | MPL-2.0    |
| ESLint, @eslint/js, typescript-eslint | MIT        |
| Prettier, eslint-config-prettier      | MIT        |
| tsx, cross-env, globals               | MIT        |

## This project

Code and documentation: MIT licence (see [LICENSE](LICENSE)). Every image in the site is drawn in
code; the screenshots in `docs/media/` are of the site itself.
