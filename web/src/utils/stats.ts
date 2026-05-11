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

export const STAT_KEYS = ["hp", "attack", "defense", "sp_attack", "sp_defense", "speed"] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type StatTable = Record<StatKey, number>;

export function calcFinalStats(
  baseStats: Partial<StatTable> | null | undefined,
  investment: Partial<StatTable> | null | undefined = {},
  nature?: string | null,
  level: number = 50
): StatTable {
  const natureMap = nature ? NATURE_EFFECTS[nature] ?? {} : {};

  const calcNonHpStat = (key: Exclude<StatKey, "hp">) => {
    const base = baseStats?.[key] ?? 0;
    if (base <= 0) return 0;
    const naked = Math.floor(((2 * base + 31) * level) / 100) + 5;
    const withInvestment = naked + (investment?.[key] ?? 0);
    return Math.floor(withInvestment * (natureMap[key] ?? 1));
  };

  const hpBase = baseStats?.hp ?? 0;
  const hp =
    hpBase > 0
      ? Math.floor(((2 * hpBase + 31) * level) / 100) + level + 10 + (investment?.hp ?? 0)
      : 0;

  return {
    hp,
    attack: calcNonHpStat("attack"),
    defense: calcNonHpStat("defense"),
    sp_attack: calcNonHpStat("sp_attack"),
    sp_defense: calcNonHpStat("sp_defense"),
    speed: calcNonHpStat("speed"),
  };
}

export function calcFinalSpeed(
  base: number,
  investment: number,
  nature?: string | null,
  level: number = 50
): number {
  return calcFinalStats({ speed: base }, { speed: investment }, nature, level).speed;
}
