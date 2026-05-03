-- Total Fix: Meta Trends & Scraper Review Queue
-- Date: 2026-06-06

-- 1. Ensure scraper_review_queue exists (fixing the PGRST205 error)
CREATE TABLE IF NOT EXISTS scraper_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                  
  payload JSONB NOT NULL,                
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  external_id TEXT,                      
  metadata JSONB,                        
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Grant admin rights to the current user (if known) or provide the SQL
-- Note: Admin flag is checked in RLS and router depends on get_admin_user.

-- 3. Fix get_meta_trends (500 error fix with robust null handling)
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
