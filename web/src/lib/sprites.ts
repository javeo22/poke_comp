const POKEAPI_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites";

export const pokeArt = (id: number) =>
  `${POKEAPI_BASE}/pokemon/other/official-artwork/${id}.png`;

export const pokeSprite = (id: number) => `${POKEAPI_BASE}/pokemon/${id}.png`;

export const itemSprite = (slug: string) =>
  `${POKEAPI_BASE}/items/${slug}.png`;
