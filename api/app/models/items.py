from pydantic import BaseModel


class ItemBase(BaseModel):
    id: int
    name: str
    effect_text: str | None = None
    category: str | None = None
    vp_cost: int | None = None
    champions_shop_available: bool
    last_verified: str | None = None


class ItemList(BaseModel):
    data: list[ItemBase]
    count: int
