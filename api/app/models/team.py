from datetime import datetime

from pydantic import BaseModel, Field


class TeamCreate(BaseModel):
    name: str
    format: str = Field(pattern=r"^(singles|doubles)$")
    pokemon_ids: list[str] = Field(min_length=1, max_length=6)
    mega_pokemon_id: str | None = None
    mega_form_pokemon_id: int | None = None
    notes: str | None = None
    archetype_tag: str | None = None


class TeamUpdate(BaseModel):
    name: str | None = None
    format: str | None = Field(None, pattern=r"^(singles|doubles)$")
    pokemon_ids: list[str] | None = Field(None, min_length=1, max_length=6)
    mega_pokemon_id: str | None = None
    mega_form_pokemon_id: int | None = None
    notes: str | None = None
    archetype_tag: str | None = None


class TeamResponse(BaseModel):
    id: str
    user_id: str
    name: str
    format: str
    pokemon_ids: list[str]
    mega_pokemon_id: str | None = None
    mega_form_pokemon_id: int | None = None
    notes: str | None = None
    archetype_tag: str | None = None
    created_at: datetime
    updated_at: datetime


class TeamList(BaseModel):
    data: list[TeamResponse]
    count: int


class TeamBenchmarkCalc(BaseModel):
    pokemon_name: str
    pokemon_id: int
    usage_percent: float
    move: str | None = None
    damage_text: str
    damage_percent: float
    target_name: str
    severity: str


class TeamBenchmarkAnswer(BaseModel):
    pokemon_name: str
    pokemon_id: int
    usage_percent: float
    answer_pokemon: str
    move: str | None = None
    damage_text: str
    damage_percent: float
    reliability: str


class TeamBenchmarkSpeedIssue(BaseModel):
    pokemon_name: str
    pokemon_id: int
    usage_percent: float
    threat_speed: int
    fastest_team_member: str | None = None
    fastest_team_speed: int
    note: str


class TeamBenchmarkCoverageGap(BaseModel):
    pokemon_name: str
    pokemon_id: int
    usage_percent: float
    best_damage_percent: float
    best_answer: str | None = None
    note: str


class TeamBenchmarkResponse(BaseModel):
    team_id: str
    team_name: str
    format: str
    generated_at: datetime
    meta_snapshot_date: str | None = None
    threat_count: int
    defensive_dangers: list[TeamBenchmarkCalc]
    offensive_answers: list[TeamBenchmarkAnswer]
    speed_issues: list[TeamBenchmarkSpeedIssue]
    coverage_gaps: list[TeamBenchmarkCoverageGap]
