# AI Draft Helper: Dual RAG Architecture

**Status:** Proposed Architecture
**Goal:** Upgrade the existing AI Draft Helper from a generic, stateless battle calculator into a personalized, stateful competitive coach by blending global tournament statistics with the user's personal matchmaking history.

---

## 1. The Core Concept: Dual Retrieval-Augmented Generation (RAG)

Currently, when the AI Draft Helper is queried, it only relies on the Claude model's pre-existing baseline knowledge. The proposed architecture shifts to a **Dual RAG pipeline**. 

Before Claude generates an answer, the FastAPI backend will actively fetch precise, supplementary knowledge from two distinct Database sources and inject it into the prompt. 

### The Two Data Streams
1. **Global Meta Context (Limitless VGC Data):** Objective, statistical truth scraped from official professional tournaments. (e.g., *What do the pros do in this matchup?*)
2. **Personal Context (User Matchup Logs):** Subjective, historical truth based on the specific user's past games and diary notes. (e.g., *What mistakes does this specific player make in this matchup?*)

---

## 2. The Architectural Flow

When a user requests draft assistance, the system performs the following sequence:

### Step 1: Input
The user pastes the opponent's 6 Pokémon into the Next.js frontend, alongside their own selected team. This payload is sent to the FastAPI backend.

### Step 2: Dual Retrieval
FastAPI connects to the Supabase PostgreSQL database and executes two parallel queries based on the opponent's team composition:

* **Query A (Limitless Data):** 
  * *Target:* `tournament_teams` / `tournament_matchups` tables.
  * *Logic:* Find recent professional matches where an opponent used a similar team composition (e.g., ≥ 3 matching Pokémon).
  * *Extracted:* Average pro win rates, standard top-cut lead pairs, and common Tera types used.
  
* **Query B (Personal Data):**
  * *Target:* `matchup_log` table.
  * *Logic:* Filter where `user_id == current_user` AND `opponent_team_data` is similar to the current opponent.
  * *Extracted:* The user's historical win rate against this team, the specific leads the user tried in the past, and free-text `notes` the user wrote detailing their mistakes or keys to victory.

### Step 3: Augmentation (Prompt Assembly)
FastAPI parses the SQL row data into readable text and assembles a "Super Prompt". 

```xml
<system>
You are an expert Pokémon Champions coach. Your job is to recommend a lead pair and Turn 1 strategy. You must synthesize the global pro meta with the user's personal skill level and history.
</system>

<limitless_pro_context>
- Pro Winrate vs this archetype: 71%
- Optimal Pro Lead: Incineroar + Rillaboom
</limitless_pro_context>

<user_personal_context>
- User's Historical Winrate vs this archetype: 0% (in 2 played games)
- User's Past Notes: "I led Incineroar + Rillaboom but messed up my Fake Out targeting against their Flutter Mane."
</user_personal_context>

<request>
Opponent Team: [Team Data]
User Team: [Team Data]
Provide a highly personalized strategy.
</request>
```

### Step 4: Generation
Claude processes the augmented prompt. Instead of regurgitating a generic Pikalytics stat, the AI synthesizes a coached response. 
*Example Outcome:* *"While the pro data suggests an Incineroar/Rillaboom lead is optimal here, your personal logs show you struggle to execute Fake Out correctly on this specific board state. Because of this, I recommend leading Amoonguss and Urshifu today as a safer, lower-execution alternative that covers your blind spots."*

---

## 3. Database & Infrastructure Impact

This architectural upgrade is designed to be highly lightweight and lean.

* **Storage:** Negligible. Personal logs and scraped JSON objects are tiny (kilobytes per match). Supabase's free tier can easily support hundreds of thousands of logs.
* **Compute / Latency:** Adding two specific `READ` queries adds less than 50ms to the FastAPI response time. 
* **Scalability:** To prevent slow JSON lookups as the database scales, GIN (Generalized Inverted Index) indexes will be created on the `JSONB` columns containing the `opponent_team_data`. This ensures search speed remains instantaneous.
* **AI Cost:** Injecting RAG text adds roughly 300 to 800 input tokens to the Claude API payload. At current Claude 3.5 Sonnet pricing, this amounts to a cost increase of roughly $0.001 per request.

## 4. Required Implementation Steps

1. **Database Adjustments:** Ensure `matchup_log` and `tournament_teams` tables have searchable JSONB structures and correct Row Level Security (RLS) applied.
2. **FastAPI Retrieval Services:** Write the Python service classes to execute the overlap queries (finding similar arrays of Pokémon).
3. **Prompt Update:** Refactor the LLM wrapper in FastAPI to accept and inject the `<limitless_pro_context>` and `<user_personal_context>` XML blocks.
4. **Empty State Handlers:** Ensure the AI gracefully falls back to generic reasoning if the user has 0 historical matches logged against an archetype.
