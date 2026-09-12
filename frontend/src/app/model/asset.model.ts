/** Asset.AssetType enum on the backend. */
export type AssetType = "SAVINGS_PASSBOOK" | "LAND" | "CASH" | "OTHER";

/** Nested inside SavingsPassbook; never populated by the CRUD endpoints today. */
export interface AdditionalDeposit {
  id: number;
  amount: number;
  additionalDate: string;
}

/**
 * SavingsPassbookDTO. `additionalDeposits` is never populated by the CRUD
 * endpoints (only POST /additional-deposits returns anything deposit-related).
 */
export interface SavingsPassbook {
  id: number;
  userId: number;
  principalAmount: number;
  savingsPassbookName: string;
  savingsPassbookNumber: string;
  depositTerm: number;
  interestRate: number;
  maturityDate: string;
  withdrawalDate?: string;
  estimatedMaturityProceeds?: number;
  assetType: AssetType;
  createdAt: string;
  additionalDeposits?: AdditionalDeposit[];
}

/** POST /savings-passbooks body — principalAmount > 0, maturityDate ISO datetime. */
export interface CreateSavingsPassbookRequest {
  savingsPassbookName?: string;
  principalAmount: number;
  interestRate: number;
  createdAt?: string;
  depositTerm: number;
  maturityDate: string;
  estimatedMaturityProceeds?: number;
}

/** PUT /savings-passbooks/{id} body — all fields partial. */
export type UpdateSavingsPassbookRequest =
  Partial<CreateSavingsPassbookRequest>;

/** Comparison operators understood by GET /savings-passbooks/search filter params. */
export type FilterOperator = "=" | ">" | ">=" | "<" | "<=";

/** One filterable field — the operator plus the raw string value ("=" sends the bare value). */
export interface FilterCriterion {
  op: FilterOperator;
  value: string;
}

/**
 * Client shape for GET /savings-passbooks/search filters. Keys mirror the
 * backend's SavingsPassbookSearchRequestDTO query params; values stay strings
 * (parsed server-side as BigDecimal/Integer/LocalDate — invalid values 400 with
 * "Invalid Data."). Dates are yyyy-MM-dd strings, which the backend treats
 * day-inclusively. savingsPassbookName has no operator: the backend compares it
 * lexicographically, so a bare value = exact match (names starting with an
 * operator character are reinterpreted by the backend's prefix parse — no
 * escape syntax exists).
 */
export interface SavingsPassbookFilters {
  savingsPassbookName: string;
  principalAmount: FilterCriterion;
  depositTerm: FilterCriterion;
  interestRate: FilterCriterion;
  maturityDate: FilterCriterion;
  withdrawalDate: FilterCriterion;
  estimatedMaturityProceeds: FilterCriterion;
}

/** LandAssetDTO. Dates are ISO datetime strings. */
export interface LandAsset {
  id: number;
  userId: number;
  location: string;
  area: number;
  purchaseDate: string;
  saleDate?: string;
  assetType: AssetType;
  createdAt: string;
}

/** POST /land-assets body. */
export interface CreateLandAssetRequest {
  location: string;
  area: number;
  purchaseDate: string;
  saleDate?: string;
}

/** OtherAssetDTO. */
export interface OtherAsset {
  id: number;
  userId: number;
  name: string;
  amount: number;
  pricePerUnit: number;
  assetType: AssetType;
  createdAt: string;
}

/** POST /other-assets body. */
export interface CreateOtherAssetRequest {
  name: string;
  amount: number;
  pricePerUnit: number;
}

/** CashBalanceDTO. */
export interface CashBalance {
  id: number;
  cashAssetId: number;
  currencyCode: string;
  amount: number;
}

/** CashAssetDTO. `name`/`description` are never populated in responses despite being required on create. */
export interface CashAsset {
  id: number;
  name?: string;
  description?: string;
  userId: number;
  assetType: AssetType;
  createdAt: string;
  balances?: CashBalance[];
}

/** POST /cash-assets body. */
export interface CreateCashAssetRequest {
  name: string;
  description?: string;
}

/** POST /cash-balances body — amount >= 0. */
export interface CreateCashBalanceRequest {
  cashAssetId: number;
  currencyCode: string;
  amount: number;
}

/** POST /cash-balances/{id} body — signed amount, negative subtracts; currencyCode must match. */
export interface AdjustCashBalanceRequest {
  currencyCode: string;
  amount: number;
}

/** AdditionalDepositRequestDTO — email or phone must match the account's records. */
export interface AdditionalDepositRequest {
  email: string;
  phone: string;
  accountNumber: string;
  savingsPassbookNumber: string;
  amount: number;
}
