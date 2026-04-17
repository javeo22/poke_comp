-- Flag regional form Pokemon as Champions-eligible.
--
-- Context: `import_pokeapi.py` pulls 15 regional variants (Alola/Galar/Hisui/
-- Paldea breeds) with their own PokeAPI IDs (>10000) but leaves
-- `champions_eligible=false`. `seed_champions.py` only flagged base-form
-- national dex IDs, so users could never add an Alolan Raichu or Hisuian
-- Typhlosion to their roster even though the data was there.
--
-- Forms covered (15): Raichu-Alola, Ninetales-Alola, Arcanine-Hisui,
-- Typhlosion-Hisui, Samurott-Hisui, Zoroark-Hisui, Goodra-Hisui,
-- Avalugg-Hisui, Decidueye-Hisui, Slowbro-Galar, Slowking-Galar,
-- Stunfisk-Galar, Tauros-Paldea-Combat, Tauros-Paldea-Blaze, Tauros-Paldea-Aqua.
--
-- User-reported 2026-04-16: "regional forms need to be registered as a
-- separate entry of pokemon as you can have the 2 different versions in
-- the roster." Base species (e.g. Raichu id=26) remain eligible; this
-- migration adds the regional variants as additional eligible entries.

UPDATE pokemon
SET champions_eligible = TRUE
WHERE id IN (
  10100, -- Raichu Alola
  10104, -- Ninetales Alola
  10165, -- Slowbro Galar
  10172, -- Slowking Galar
  10180, -- Stunfisk Galar
  10230, -- Arcanine Hisui
  10233, -- Typhlosion Hisui
  10236, -- Samurott Hisui
  10239, -- Zoroark Hisui
  10242, -- Goodra Hisui
  10243, -- Avalugg Hisui
  10244, -- Decidueye Hisui
  10250, -- Tauros Paldea Combat Breed
  10251, -- Tauros Paldea Blaze Breed
  10252  -- Tauros Paldea Aqua Breed
);
