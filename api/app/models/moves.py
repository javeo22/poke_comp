from pydantic import BaseModel


class MoveBase(BaseModel):
    id: int
    name: str
    type: str
    category: str
    power: int | None = None
    accuracy: int | None = None
    target: str | None = None
    effect_text: str | None = None
    champions_available: bool


class MoveList(BaseModel):
    data: list[MoveBase]
    count: int
