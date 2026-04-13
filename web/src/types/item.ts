export interface Item {
  id: number;
  name: string;
  effect_text: string | null;
  category: string | null;
  vp_cost: number | null;
  champions_shop_available: boolean;
  last_verified: string | null;
}

export interface ItemListResponse {
  data: Item[];
  count: number;
}
