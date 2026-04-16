"""Fetch strategy notes context for AI prompt enrichment."""

from app.database import supabase


def fetch_strategy_context(
    format: str = "vgc2026",
    tags: list[str] | None = None,
    limit: int = 5,
) -> str:
    """Fetch active strategy notes and format as prompt context.

    Returns a formatted string for inclusion in AI prompts, or empty string
    if no relevant notes exist.
    """
    query = (
        supabase.table("strategy_notes")
        .select("title, category, content, tags")
        .eq("is_active", True)
        .eq("format", format)
        .order("updated_at", desc=True)
        .limit(limit * 2)  # fetch extra to filter by tag relevance
    )

    result = query.execute()
    notes: list[dict] = result.data or []  # type: ignore[assignment]

    if not notes:
        return ""

    # Sort by tag overlap if tags provided
    if tags:
        tag_set = set(t.lower() for t in tags)

        def relevance(note: dict) -> int:
            note_tags = set(t.lower() for t in (note.get("tags") or []))
            return len(tag_set & note_tags)

        notes.sort(key=relevance, reverse=True)

    # Take top N
    top_notes = notes[:limit]

    if not top_notes:
        return ""

    lines = ["=== Expert Strategy Notes ==="]
    for note in top_notes:
        cat = note.get("category", "general").upper()
        lines.append(f"\n[{cat}] {note['title']}")
        lines.append(note["content"])

    return "\n".join(lines)
