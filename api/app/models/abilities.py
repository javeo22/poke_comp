from pydantic import BaseModel


class AbilityBase(BaseModel):
    id: int
    name: str
    effect_text: str | None = None


class AbilityList(BaseModel):
    data: list[AbilityBase]
    count: int
