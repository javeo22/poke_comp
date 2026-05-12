import importlib
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
validate_data = importlib.import_module("scripts.validate_data")
check_pokemon_form_guardrails = validate_data.check_pokemon_form_guardrails
CANONICAL_FORM_GUARDRAILS = validate_data.CANONICAL_POKEMON_FORM_GUARDRAILS


class _FakePokemonQuery:
    def __init__(self, db: "_FakeSupabase") -> None:
        self.db = db
        self.update_data: dict[str, Any] | None = None
        self.update_id: int | None = None

    def select(self, *_args: Any, **_kwargs: Any) -> "_FakePokemonQuery":
        return self

    def eq(self, column: str, value: Any) -> "_FakePokemonQuery":
        if column == "id":
            self.update_id = int(value)
        return self

    def update(self, data: dict[str, Any]) -> "_FakePokemonQuery":
        self.update_data = data
        return self

    def execute(self) -> SimpleNamespace:
        if self.update_data is not None:
            self.db.updates.append((self.update_id, self.update_data))
            for row in self.db.rows:
                if row["id"] == self.update_id:
                    row.update(self.update_data)
            return SimpleNamespace(data=[self.update_data])
        return SimpleNamespace(data=self.db.rows)


class _FakeSupabase:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.updates: list[tuple[int | None, dict[str, Any]]] = []

    def table(self, table_name: str) -> _FakePokemonQuery:
        assert table_name == "pokemon"
        return _FakePokemonQuery(self)


def _canonical_rows(overrides: dict[int, dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    overrides = overrides or {}
    rows = []
    for pokemon_id, expected in CANONICAL_FORM_GUARDRAILS.items():
        row = {
            "id": pokemon_id,
            "name": expected.name,
            "types": list(expected.types),
            "base_stats": dict(expected.base_stats),
            "abilities": list(expected.abilities),
        }
        row.update(overrides.get(pokemon_id, {}))
        rows.append(row)
    return rows


def test_pokemon_form_guardrail_flags_and_fixes_raichu_contamination() -> None:
    db = _FakeSupabase(
        _canonical_rows(
            {
                26: {
                    "types": ["electric", "psychic"],
                    "abilities": ["Static", "Lightning Rod", "Surge Surfer"],
                }
            }
        )
    )

    result = check_pokemon_form_guardrails(db, fix=True)

    assert result.status == "fail"
    assert result.fixed == 1
    assert any("Raichu: expected types" in detail for detail in result.details)
    assert any("Raichu: unexpected abilities" in detail for detail in result.details)
    assert db.updates == [
        (
            26,
            {
                "name": "Raichu",
                "types": ["electric"],
                "base_stats": {
                    "hp": 60,
                    "attack": 90,
                    "defense": 55,
                    "sp_attack": 90,
                    "sp_defense": 80,
                    "speed": 110,
                },
                "abilities": ["Static", "Lightning Rod"],
            },
        )
    ]


def test_pokemon_form_guardrail_repairs_known_hisuian_base_contamination() -> None:
    db = _FakeSupabase(
        _canonical_rows(
            {
                59: {
                    "types": ["fire", "rock"],
                    "abilities": ["Intimidate", "Flash Fire", "Justified", "Rock Head"],
                }
            }
        )
    )

    result = check_pokemon_form_guardrails(db, fix=True)

    assert result.status == "fail"
    assert result.fixed == 1
    assert any("Arcanine: expected types" in detail for detail in result.details)
    assert any("Arcanine: unexpected abilities" in detail for detail in result.details)
    assert db.updates == [
        (
            59,
            {
                "name": "Arcanine",
                "types": ["fire"],
                "base_stats": {
                    "hp": 90,
                    "attack": 110,
                    "defense": 80,
                    "sp_attack": 100,
                    "sp_defense": 80,
                    "speed": 95,
                },
                "abilities": ["Intimidate", "Flash Fire", "Justified"],
            },
        )
    ]


def test_pokemon_form_guardrail_flags_generic_regional_typing_mix() -> None:
    db = _FakeSupabase(
        _canonical_rows()
        + [
            {
                "id": 38,
                "name": "Ninetales",
                "types": ["ice", "fairy"],
                "base_stats": {},
                "abilities": ["Flash Fire"],
            },
            {
                "id": 10104,
                "name": "Ninetales Alola",
                "types": ["ice", "fairy"],
                "base_stats": {},
                "abilities": ["Snow Cloak"],
            },
        ]
    )

    result = check_pokemon_form_guardrails(db)

    assert result.status == "fail"
    assert result.fixed == 0
    assert result.details == ["Ninetales shares regional typing with Ninetales Alola: ice, fairy"]


def test_pokemon_form_guardrail_passes_clean_form_data() -> None:
    db = _FakeSupabase(
        _canonical_rows()
        + [
            {
                "id": 38,
                "name": "Ninetales",
                "types": ["fire"],
                "base_stats": {},
                "abilities": ["Flash Fire"],
            },
            {
                "id": 10104,
                "name": "Ninetales Alola",
                "types": ["ice", "fairy"],
                "base_stats": {},
                "abilities": ["Snow Cloak"],
            },
        ]
    )

    result = check_pokemon_form_guardrails(db)

    assert result.status == "pass"
    assert result.fixed == 0
    assert result.details == []
