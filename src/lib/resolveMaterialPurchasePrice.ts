import type { PurchasePriceObjectRecord } from '../types/purchasePriceObject';

/**
 * 材料の実効仕入単価を返す。
 * 適用中の仕入れ価格オブジェクトに materialId が登録されていればその単価、なければ基準仕入単価（standardPrice）。
 */
export function resolveMaterialPurchasePrice(
  materialId: string,
  fallbackStandardPrice: number,
  objects: PurchasePriceObjectRecord[],
  activeObjectId: string | null
): number {
  if (!activeObjectId) return fallbackStandardPrice;
  const obj = objects.find((o) => o.id === activeObjectId);
  const e = obj?.entries.find((x) => x.materialId === materialId);
  return e != null ? e.purchasePrice : fallbackStandardPrice;
}
