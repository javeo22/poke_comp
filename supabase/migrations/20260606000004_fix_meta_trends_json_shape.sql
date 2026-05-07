-- Fix Meta Trends JSON shape
-- Date: 2026-06-06
--
-- jsonb_array_elements returns rows named "value". Aggregating the row alias
-- produced [{"value": {"name": "...", "percent": ...}}], which does not match
-- the API contract. Aggregate the JSONB value itself and expose previous_usage.

DROP FUNCTION IF EXISTS get_meta_trends(TEXT, INT);

CREATE OR REPLACE FUNCTION get_meta_trends(p_format TEXT DEFAULT 'doubles', p_limit INT DEFAULT 6)
RETURNS TABLE (
    id INT,
    pokemon_name TEXT,
    usage_percent FLOAT,
    previous_usage FLOAT,
    swing FLOAT,
    up BOOLEAN,
    win_rate FLOAT,
    role TEXT,
    top_moves JSONB,
    top_items JSONB,
    top_abilities JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_snapshots AS (
        SELECT DISTINCT snapshot_date
        FROM pokemon_usage
        WHERE format = p_format
        ORDER BY snapshot_date DESC
        LIMIT 2
    ),
    usage_data AS (
        SELECT
            pu.pokemon_name,
            pu.usage_percent,
            pu.snapshot_date,
            pu.moves,
            pu.items,
            pu.abilities,
            COALESCE(
                LAG(pu.usage_percent) OVER (PARTITION BY pu.pokemon_name ORDER BY pu.snapshot_date),
                0.0
            )::FLOAT AS prev_usage
        FROM pokemon_usage pu
        WHERE pu.format = p_format
          AND pu.snapshot_date IN (SELECT snapshot_date FROM latest_snapshots)
    )
    SELECT
        p.id,
        ud.pokemon_name,
        ud.usage_percent,
        ud.prev_usage AS previous_usage,
        (ud.usage_percent - ud.prev_usage)::FLOAT AS swing,
        (ud.usage_percent >= ud.prev_usage)::BOOLEAN AS up,
        50.0::FLOAT AS win_rate,
        'Meta'::TEXT AS role,
        COALESCE((
            SELECT jsonb_agg(m.value)
            FROM (
                SELECT value
                FROM jsonb_array_elements(
                    CASE
                        WHEN jsonb_typeof(COALESCE(ud.moves, '[]'::jsonb)) = 'array'
                        THEN COALESCE(ud.moves, '[]'::jsonb)
                        ELSE '[]'::jsonb
                    END
                ) AS moves(value)
                LIMIT 3
            ) m
        ), '[]'::jsonb) AS top_moves,
        COALESCE((
            SELECT jsonb_agg(i.value)
            FROM (
                SELECT value
                FROM jsonb_array_elements(
                    CASE
                        WHEN jsonb_typeof(COALESCE(ud.items, '[]'::jsonb)) = 'array'
                        THEN COALESCE(ud.items, '[]'::jsonb)
                        ELSE '[]'::jsonb
                    END
                ) AS items(value)
                LIMIT 3
            ) i
        ), '[]'::jsonb) AS top_items,
        COALESCE((
            SELECT jsonb_agg(a.value)
            FROM (
                SELECT value
                FROM jsonb_array_elements(
                    CASE
                        WHEN jsonb_typeof(COALESCE(ud.abilities, '[]'::jsonb)) = 'array'
                        THEN COALESCE(ud.abilities, '[]'::jsonb)
                        ELSE '[]'::jsonb
                    END
                ) AS abilities(value)
                LIMIT 3
            ) a
        ), '[]'::jsonb) AS top_abilities
    FROM usage_data ud
    JOIN pokemon p ON p.name = ud.pokemon_name
    WHERE ud.snapshot_date = (SELECT MAX(snapshot_date) FROM latest_snapshots)
    ORDER BY ud.usage_percent DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
