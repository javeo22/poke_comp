-- Pokemon competitive usage data from Pikalytics
CREATE TABLE pokemon_usage (
  id SERIAL PRIMARY KEY,
  pokemon_name TEXT NOT NULL,
  format TEXT NOT NULL,                              -- doubles, singles
  usage_percent FLOAT NOT NULL,
  moves JSONB,                                       -- [{name, percent}, ...]
  items JSONB,                                       -- [{name, percent}, ...]
  abilities JSONB,                                   -- [{name, percent}, ...]
  teammates JSONB,                                   -- [{name, percent}, ...]
  spreads JSONB,                                     -- [{spread, percent}, ...]
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'pikalytics',
  UNIQUE (pokemon_name, format, snapshot_date)
);

CREATE INDEX idx_pokemon_usage_lookup ON pokemon_usage(format, snapshot_date DESC);
CREATE INDEX idx_pokemon_usage_name ON pokemon_usage(pokemon_name);
