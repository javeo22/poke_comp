-- Fix: Meta Trends RPC (Simplified for debugging)
-- Date: 2026-06-06

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
            COALESCE(LAG(pu.usage_percent) OVER (PARTITION BY pu.pokemon_name ORDER BY pu.snapshot_date), 0.0) as prev_usage
        FROM pokemon_usage pu
        WHERE pu.format = p_format
          AND pu.snapshot_date IN (SELECT snapshot_date FROM latest_snapshots)
    )
    SELECT 
        p.id,
        ud.pokemon_name,
        ud.usage_percent,
        (ud.usage_percent - ud.prev_usage)::FLOAT as swing,
        (ud.usage_percent >= ud.prev_usage)::BOOLEAN as up,
        50.0::FLOAT as win_rate, 
        'Meta'::TEXT as role,
        COALESCE(ud.moves, '[]'::jsonb) as top_moves,
        COALESCE(ud.items, '[]'::jsonb) as top_items,
        COALESCE(ud.abilities, '[]'::jsonb) as top_abilities
    FROM usage_data ud
    JOIN pokemon p ON p.name = ud.pokemon_name
    WHERE ud.snapshot_date = (SELECT MAX(snapshot_date) FROM latest_snapshots)
    ORDER BY ud.usage_percent DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
