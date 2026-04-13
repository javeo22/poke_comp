export interface Move {
  id: number;
  name: string;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  target: string | null;
  effect_text: string | null;
  champions_available: boolean;
}

export interface MoveListResponse {
  data: Move[];
  count: number;
}
