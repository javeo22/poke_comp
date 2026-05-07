def _build_prompt(
    my_team: dict,
    opponent_pokemon: list[dict],
    opponent_usage: list[dict],
    my_usage: list[dict],
    tournament_context: str = "",
    personal_context: str = "",
    usage_snapshot_date: str | None = None,
    usage_age_days: int | None = None,
    personal_win_rates: dict[str, dict] | None = None,
) -> str:
    # Format opponent team
    opp_lines = []
    for p in opponent_pokemon:
        stats = p.get("base_stats", {})
        opp_lines.append(
            f"- {p['name']} ({'/'.join(p.get('types', []))}) "
            f"HP:{stats.get('hp', 0)} Atk:{stats.get('attack', 0)} "
            f"Def:{stats.get('defense', 0)} SpA:{stats.get('sp_attack', 0)} "
            f"SpD:{stats.get('sp_defense', 0)} Spe:{stats.get('speed', 0)}"
        )

    # Format usage context
    usage_context = ""
    if opponent_usage:
        usage_lines = []
        for u in opponent_usage:
            name = u.get("pokemon_name", "Unknown")
            usage_lines.append(f"- {name} usage data")
        usage_context = "\n\n## Competitive Usage Data\n" + "\n".join(usage_lines)

    # Format personal win rates
    win_rate_context = ""
    if personal_win_rates:
        wr_lines = []
        for name, stats in personal_win_rates.items():
            wr_lines.append(
                f"- {name}: {stats['wins']}W-{stats['losses']}L "
                f"({round(stats['win_rate'] * 100, 1)}% win rate over {stats['total']} games)"
            )
        win_rate_context = "\n\n## Historical Performance Against These Species\n" + "\n".join(
            wr_lines
        )

    opp_section = (
        "## Opponent's Team (6 shown in team preview)\n"
        f"{chr(10).join(opp_lines)}"
        f"{usage_context}"
        f"{tournament_context}"
        f"{personal_context}"
        f"{win_rate_context}"
    )
    return opp_section


# Test data
my_team = {"pokemon": [], "team_name": "Test"}
opponent_pokemon = [{"name": "Pikachu", "types": ["Electric"], "base_stats": {}}]
opponent_usage = []
personal_win_rates = {"Pikachu": {"wins": 2, "losses": 1, "total": 3, "win_rate": 0.667}}

prompt = _build_prompt(
    my_team,
    opponent_pokemon,
    opponent_usage,
    [],
    "",
    "",
    None,
    None,
    personal_win_rates,
)
print(prompt)
if (
    "## Historical Performance Against These Species" in prompt
    and "Pikachu: 2W-1L (66.7% win rate over 3 games)" in prompt
):
    print("SUCCESS: Win rates included in prompt")
else:
    print("FAILURE: Win rates missing from prompt")
