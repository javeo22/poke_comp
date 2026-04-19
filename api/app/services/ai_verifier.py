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

Verification strictness (changed 2026-04-17):
- `verified=False` is reserved for hallucinations: a name or move that
  doesn't exist in our DB at all. These are AI failures.
- Membership mismatches (real Pokemon, but not in the user's saved team
  or opponent preview) become *warnings only* with `verified` left True.
  Reason: users sometimes swap a Pokemon between draft analysis and the
  actual match -- flagging that as "broken" was misleading. The warning
  stays so the UI can still surface the inconsistency.
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


def _load_known_pokemon() -> set[str]:
    """Fetch all Pokemon names (normalized) for hallucination checks."""
    rows: list[dict] = (
        supabase.table("pokemon").select("name").execute().data  # type: ignore[assignment]
    )
    return {_normalize(r["name"]) for r in rows}


def _name_set(names: Iterable[str]) -> set[str]:
    return {_normalize(n) for n in names}


def verify_draft_analysis(
    analysis: DraftAnalysis,
    my_team_names: list[str],
    opponent_team_names: list[str],
    known_moves: set[str] | None = None,
    known_pokemon: set[str] | None = None,
) -> DraftAnalysis:
    """Annotate the analysis with per-claim `verified` flags and a
    top-level `warnings` list. Returns the same object (mutated)."""

    if known_moves is None:
        known_moves = _load_known_moves()
    if known_pokemon is None:
        known_pokemon = _load_known_pokemon()

    my_set = _name_set(my_team_names)
    opp_set = _name_set(opponent_team_names)
    warnings: list[str] = []

    # bring_four: each pokemon must exist in DB; soft-warn on team mismatch
    for pick in analysis.bring_four:
        norm = _normalize(pick.pokemon)
        if norm not in known_pokemon:
            pick.verified = False
            pick.verification_note = "Unknown Pokemon (not in database)"
            warnings.append(f"Recommended bring '{pick.pokemon}' is not a known Pokemon")
        elif norm not in my_set:
            warnings.append(
                f"Recommended bring '{pick.pokemon}' is not in your saved team "
                "(maybe you swapped it for this match?)"
            )

    # lead_pair: both leads must be in bring_four
    bring_set = _name_set(p.pokemon for p in analysis.bring_four)
    for lead in analysis.lead_pair:
        if _normalize(lead) not in bring_set:
            warnings.append(f"Lead '{lead}' is not in the recommended bring-4")

    # threats: hard-fail unknown move; soft-warn on team-membership mismatch
    for threat in analysis.threats:
        threat_issues: list[str] = []
        norm_threat = _normalize(threat.pokemon)
        if norm_threat not in known_pokemon:
            threat_issues.append("unknown Pokemon")
            warnings.append(f"Threat '{threat.pokemon}' is not a known Pokemon")
        elif norm_threat not in opp_set:
            warnings.append(f"Threat '{threat.pokemon}' is not in the opponent's team")
        unknown_moves = [m for m in threat.key_moves if _normalize(m) not in known_moves]
        if unknown_moves:
            threat_issues.append(f"unknown move(s): {', '.join(unknown_moves)}")
            warnings.append(
                f"{threat.pokemon} lists move(s) not in the moves database: "
                f"{', '.join(unknown_moves)}"
            )
        if threat_issues:
            threat.verified = False
            threat.verification_note = "; ".join(threat_issues)

    # damage_calcs: hard-fail unknown move; soft-warn on team-membership mismatch
    for calc in analysis.damage_calcs:
        calc_issues: list[str] = []
        norm_attacker = _normalize(calc.attacker)
        norm_defender = _normalize(calc.defender)

        if norm_attacker not in known_pokemon:
            calc_issues.append("unknown attacker Pokemon")
            warnings.append(f"Damage calc attacker '{calc.attacker}' is not a known Pokemon")
        elif norm_attacker not in my_set:
            warnings.append(
                f"Damage calc attacker '{calc.attacker}' is not on your saved team "
                "(maybe a mid-match swap?)"
            )

        if norm_defender not in known_pokemon:
            calc_issues.append("unknown defender Pokemon")
            warnings.append(f"Damage calc defender '{calc.defender}' is not a known Pokemon")
        elif norm_defender not in opp_set:
            warnings.append(f"Damage calc defender '{calc.defender}' is not on the opponent team")

        if _normalize(calc.move) not in known_moves:
            calc_issues.append(f"unknown move: {calc.move}")
            warnings.append(f"Damage calc move '{calc.move}' is not in the moves database")
        if calc_issues:
            calc.verified = False
            calc.verification_note = "; ".join(calc_issues)

    # Dedupe while preserving order (warnings can repeat across sections)
    seen: set[str] = set()
    analysis.warnings = [w for w in warnings if not (w in seen or seen.add(w))]
    return analysis
