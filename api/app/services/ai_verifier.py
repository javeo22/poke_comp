"""Cross-check AI draft analyses against the canonical DB.

Purpose: catch hallucinated moves, misattributed Pokemon, and lead-pair
violations before the response reaches the UI. We do NOT strip the
offending content -- removing it would lose potentially useful context
if the AI paraphrased a real name. Instead we annotate each claim with
`verified: bool` and surface a flat `warnings` list the UI can render
as a banner.

Design decisions:
- Name matching is case-insensitive and normalizes whitespace + hyphens,
  matching the project convention (stored as "Raichu Alola" but AI may
  output "Raichu-Alola" or "raichu alola").
- Move matching is case-insensitive against the `moves.name` column.
- We pass a prefetched `known_moves` set into the verifier so repeated
  calls don't hit the DB for every draft response.
- Lead-pair rule is VGC-specific: both leads must be in `bring_four`.
"""

from typing import Iterable

from app.database import supabase
from app.models.draft import DraftAnalysis


def _normalize(name: str) -> str:
    return name.strip().lower().replace("-", " ").replace("_", " ")


def _load_known_moves() -> set[str]:
    """Fetch all move names (normalized) for hallucination checks."""
    rows: list[dict] = (
        supabase.table("moves").select("name").execute().data  # type: ignore[assignment]
    )
    return {_normalize(r["name"]) for r in rows}


def _name_set(names: Iterable[str]) -> set[str]:
    return {_normalize(n) for n in names}


def verify_draft_analysis(
    analysis: DraftAnalysis,
    my_team_names: list[str],
    opponent_team_names: list[str],
    known_moves: set[str] | None = None,
) -> DraftAnalysis:
    """Annotate the analysis with per-claim `verified` flags and a
    top-level `warnings` list. Returns the same object (mutated)."""

    if known_moves is None:
        known_moves = _load_known_moves()

    my_set = _name_set(my_team_names)
    opp_set = _name_set(opponent_team_names)
    warnings: list[str] = []

    # bring_four: each pokemon must be in my team
    for pick in analysis.bring_four:
        if _normalize(pick.pokemon) not in my_set:
            pick.verified = False
            pick.verification_note = "Not in your selected team"
            warnings.append(
                f"Recommended bring '{pick.pokemon}' is not in your team"
            )

    # lead_pair: both leads must be in bring_four
    bring_set = _name_set(p.pokemon for p in analysis.bring_four)
    for lead in analysis.lead_pair:
        if _normalize(lead) not in bring_set:
            warnings.append(
                f"Lead '{lead}' is not in the recommended bring-4"
            )

    # threats: pokemon must be in opponent team; key_moves must exist in DB
    for threat in analysis.threats:
        threat_issues: list[str] = []
        if _normalize(threat.pokemon) not in opp_set:
            threat_issues.append("not in opponent preview")
            warnings.append(
                f"Threat '{threat.pokemon}' is not in the opponent's team"
            )
        unknown_moves = [
            m for m in threat.key_moves if _normalize(m) not in known_moves
        ]
        if unknown_moves:
            threat_issues.append(
                f"unknown move(s): {', '.join(unknown_moves)}"
            )
            warnings.append(
                f"{threat.pokemon} lists move(s) not in the moves database: "
                f"{', '.join(unknown_moves)}"
            )
        if threat_issues:
            threat.verified = False
            threat.verification_note = "; ".join(threat_issues)

    # damage_calcs: attacker in my team, defender in opponent, move known
    for calc in analysis.damage_calcs:
        calc_issues: list[str] = []
        if _normalize(calc.attacker) not in my_set:
            calc_issues.append("attacker not in your team")
            warnings.append(
                f"Damage calc attacker '{calc.attacker}' is not on your team"
            )
        if _normalize(calc.defender) not in opp_set:
            calc_issues.append("defender not in opponent preview")
            warnings.append(
                f"Damage calc defender '{calc.defender}' is not on the "
                "opponent team"
            )
        if _normalize(calc.move) not in known_moves:
            calc_issues.append(f"unknown move: {calc.move}")
            warnings.append(
                f"Damage calc move '{calc.move}' is not in the moves database"
            )
        if calc_issues:
            calc.verified = False
            calc.verification_note = "; ".join(calc_issues)

    # Dedupe while preserving order (warnings can repeat across sections)
    seen: set[str] = set()
    analysis.warnings = [w for w in warnings if not (w in seen or seen.add(w))]
    return analysis
