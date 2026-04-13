/** 仕入れ価格オブジェクト内の1材料あたりの仕入単価 */
export type PurchasePriceObjectEntry = {
  materialId: string;
  purchasePrice: number;
};

/**
 * 仕入れ価格オブジェクト: 登録された材料の仕入単価をまとめて定義する。
 * 適用中のオブジェクトを選ぶと、そのオブジェクトに登録された材料は当該単価で決定される（未登録は材料マスタの基準仕入にフォールバック）。
 */
export type PurchasePriceObjectRecord = {
  id: string;
  name: string;
  memo?: string;
  entries: PurchasePriceObjectEntry[];
};
