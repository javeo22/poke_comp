-- Fix: High Resolution Meta Trends (Safer Join & Null Handling)
-- Date: 2026-06-06

DROP FUNCTION IF EXISTS get_meta_trends(TEXT, INT);

CREATE OR REPLACE FUNCTION get_meta_trends(p_format TEXT DEFAULT 'doubles', p_limit INT DEFAULT 6)
RETURNS TABLE (
    id INT,
    pokemon_name TEXT,
    usage_percent FLOAT,
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
            LAG(pu.usage_percent) OVER (PARTITION BY pu.pokemon_name ORDER BY pu.snapshot_date) as prev_usage
        FROM pokemon_usage pu
        WHERE pu.format = p_format
          AND pu.snapshot_date IN (SELECT snapshot_date FROM latest_snapshots)
    )
    SELECT 
        p.id,
        ud.pokemon_name,
        ud.usage_percent,
        (ud.usage_percent - COALESCE(ud.prev_usage, 0.0))::FLOAT as swing,
        (ud.usage_percent >= COALESCE(ud.prev_usage, 0.0))::BOOLEAN as up,
        50.0::FLOAT as win_rate, 
        'Meta'::TEXT as role,
        COALESCE((
            SELECT jsonb_agg(m) 
            FROM (SELECT * FROM jsonb_array_elements(ud.moves) LIMIT 3) m
        ), '[]'::jsonb) as top_moves,
        COALESCE((
            SELECT jsonb_agg(i) 
            FROM (SELECT * FROM jsonb_array_elements(ud.items) LIMIT 3) i
        ), '[]'::jsonb) as top_items,
        COALESCE((
            SELECT jsonb_agg(a) 
            FROM (SELECT * FROM jsonb_array_elements(ud.abilities) LIMIT 3) a
        ), '[]'::jsonb) as top_abilities
    FROM usage_data ud
    JOIN pokemon p ON p.name = ud.pokemon_name
    WHERE ud.snapshot_date = (SELECT MAX(snapshot_date) FROM latest_snapshots)
    ORDER BY ud.usage_percent DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
