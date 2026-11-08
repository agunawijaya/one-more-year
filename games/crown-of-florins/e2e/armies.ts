// The valley's armies year by year, for tuning: tsx games/crown-of-florins/e2e/armies.ts [seed] [bot]
import { BOTS } from '../src/engine/bots.ts';
import { balanceCourt } from '../src/engine/balance.ts';
import { playGame } from '../src/engine/simulate.ts';

const seed = Number(process.argv[2] ?? 3);
const bot = BOTS[(process.argv[3] ?? 'naive') as keyof typeof BOTS];
const { frames } = playGame({
  seed,
  court: balanceCourt(seed, { bot, rivals: 'mixed', games: 1 }, 0),
  bot,
  maxSteps: 60,
  keepFrames: true,
});
for (const frame of frames.filter((_, i) => i % 3 === 0)) {
  console.warn(
    `${frame.year} ` +
      frame.realms
        .map(
          (r) =>
            `${r.controller.kind === 'ai' ? r.controller.personality.slice(0, 3) : 'you'}:${r.people.soldiers}s/${Math.round(r.land / 1000)}kha/T${r.title}${r.record.invadedCount ? `/inv${r.record.invadedCount}` : ''}`,
        )
        .join('  '),
  );
}
