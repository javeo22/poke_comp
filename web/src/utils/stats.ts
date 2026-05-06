export const NATURE_EFFECTS: Record<string, Record<string, number>> = {
  Adamant: { attack: 1.1, sp_attack: 0.9 },
  Bold: { defense: 1.1, attack: 0.9 },
  Brave: { attack: 1.1, speed: 0.9 },
  Calm: { sp_defense: 1.1, attack: 0.9 },
  Careful: { sp_defense: 1.1, sp_attack: 0.9 },
  Gentle: { sp_defense: 1.1, defense: 0.9 },
  Hasty: { speed: 1.1, defense: 0.9 },
  Impish: { defense: 1.1, sp_attack: 0.9 },
  Jolly: { speed: 1.1, sp_attack: 0.9 },
  Lax: { defense: 1.1, sp_defense: 0.9 },
  Lonely: { attack: 1.1, defense: 0.9 },
  Mild: { sp_attack: 1.1, defense: 0.9 },
  Modest: { sp_attack: 1.1, attack: 0.9 },
  Naive: { speed: 1.1, sp_defense: 0.9 },
  Naughty: { attack: 1.1, sp_defense: 0.9 },
  Quiet: { sp_attack: 1.1, speed: 0.9 },
  Rash: { sp_attack: 1.1, sp_defense: 0.9 },
  Relaxed: { defense: 1.1, speed: 0.9 },
  Sassy: { sp_defense: 1.1, speed: 0.9 },
  Timid: { speed: 1.1, attack: 0.9 },
};

export function calcFinalSpeed(
  base: number,
  investment: number,
  nature?: string | null,
  level: number = 50
): number {
  if (base <= 0) return 0;
  const naked = Math.floor(((2 * base + 31) * level) / 100) + 5;
  const withInvestment = naked + investment;
  const mult =
    nature && NATURE_EFFECTS[nature]?.speed ? NATURE_EFFECTS[nature].speed : 1.0;
  return Math.floor(withInvestment * mult);
}
