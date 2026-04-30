-- Migration: RAG Retrieval Foundation
-- Date: 2026-06-02
-- Adds GIN indexes and RPCs for similarity-based retrieval from tournament data and personal history.

-- 1. GIN Indexes for fast similarity searching
-- tournament_teams.pokemon_ids (INT[]) for array overlap queries
CREATE INDEX IF NOT EXISTS idx_tournament_teams_pokemon_ids_gin ON tournament_teams USING GIN (pokemon_ids);

-- matchup_log.opponent_team_data (JSONB) for JSONB containment/overlap
CREATE INDEX IF NOT EXISTS idx_matchup_log_opponent_team_data_gin ON matchup_log USING GIN (opponent_team_data);

-- 2. RPC: get_similar_tournament_teams
-- Fetches the top 5 tournament teams that share the most Pokemon with the provided list.
CREATE OR REPLACE FUNCTION get_similar_tournament_teams(p_pokemon_ids INT[])
RETURNS SETOF tournament_teams AS $$
BEGIN
    RETURN QUERY
    SELECT t.*
    FROM tournament_teams t
    WHERE t.pokemon_ids && p_pokemon_ids
    ORDER BY (
        SELECT count(*) 
        FROM unnest(t.pokemon_ids) p 
        WHERE p = ANY(p_pokemon_ids)
    ) DESC, t.placement ASC, t.created_at DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. RPC: get_similar_matchups
-- Fetches the top 5 personal matchups where the opponent's team shares the most names with the provided list.
CREATE OR REPLACE FUNCTION get_similar_matchups(p_user_id UUID, p_opponent_names TEXT[])
RETURNS SETOF matchup_log AS $$
BEGIN
    RETURN QUERY
    SELECT m.*
    FROM matchup_log m
    WHERE m.user_id = p_user_id
      AND m.opponent_team_data IS NOT NULL
      AND jsonb_typeof(m.opponent_team_data) = 'array'
    ORDER BY (
        SELECT count(*)
        FROM jsonb_array_elements(m.opponent_team_data) AS x
        WHERE (x->>'name') = ANY(p_opponent_names)
    ) DESC, m.played_at DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql STABLE;
