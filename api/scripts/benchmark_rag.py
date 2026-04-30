import logging
import os
import statistics
import sys
import time

# Add the 'api' directory to sys.path so we can import 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import supabase
from app.services.retrieval import fetch_personal_context, fetch_tournament_context

# Setup logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)


def benchmark():
    print("Fetching sample data for benchmark...")
    # 1. Get sample data from DB
    try:
        res = (
            supabase.table("pokemon")
            .select("id, name")
            .eq("champions_eligible", True)
            .limit(6)
            .execute()
        )
        if not res.data:
            print("No pokemon data found. Cannot benchmark.")
            return

        pokemon_ids = [p["id"] for p in res.data]
        pokemon_names = [p["name"] for p in res.data]

        # Get a real user_id from user_profiles to make the RPC do some work
        user_res = supabase.table("user_profiles").select("user_id").limit(1).execute()
        user_id = (
            user_res.data[0]["user_id"] if user_res.data else "00000000-0000-0000-0000-000000000000"
        )
    except Exception as e:
        print(f"Error fetching sample data: {e}")
        print("Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set correctly.")
        return

    trials = 50
    tournament_times = []
    personal_times = []

    print(f"Running {trials} trials for RAG retrieval benchmark...")

    for i in range(trials):
        # Tournament retrieval
        start = time.perf_counter()
        fetch_tournament_context(pokemon_ids)
        tournament_times.append(time.perf_counter() - start)

        # Personal retrieval
        start = time.perf_counter()
        fetch_personal_context(user_id, pokemon_names)
        personal_times.append(time.perf_counter() - start)

        if (i + 1) % 10 == 0:
            print(f"Completed {i + 1}/{trials} trials")

    def get_stats(times):
        times_ms = [t * 1000 for t in times]
        p50 = statistics.median(times_ms)
        # p95 is the 19th value in a sorted list of 20
        sorted_times = sorted(times_ms)
        idx = int(len(sorted_times) * 0.95)
        p95 = sorted_times[idx] if idx < len(sorted_times) else sorted_times[-1]
        return p50, p95

    t_p50, t_p95 = get_stats(tournament_times)
    p_p50, p_p95 = get_stats(personal_times)

    print("\n=== RAG Retrieval Benchmark Results ===")
    print(f"Tournament Context (p50): {t_p50:.2f}ms")
    print(f"Tournament Context (p95): {t_p95:.2f}ms")
    print(f"Personal Context   (p50): {p_p50:.2f}ms")
    print(f"Personal Context   (p95): {p_p95:.2f}ms")
    print("========================================")

    # Return results for easier recording
    return {"tournament": {"p50": t_p50, "p95": t_p95}, "personal": {"p50": p_p50, "p95": p_p95}}


if __name__ == "__main__":
    benchmark()
