from pydantic import BaseModel


class ItemBase(BaseModel):
    id: int
    name: str
    effect_text: str | None = None
    category: str | None = None
    vp_cost: int | None = None
    champions_shop_available: bool = False
    last_verified: str | None = None
    top_holders: list[str] | None = None


class ItemList(BaseModel):
    data: list[ItemBase]
    count: int
