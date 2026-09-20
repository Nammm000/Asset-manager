/** Mirrors the backend CurrencyDTO. `code` is max 3 chars. */
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}
