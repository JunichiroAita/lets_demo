import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  ShoppingCart,
  FileText,
  Package,
  Building2,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
} from 'lucide-react';
import PurchaseHistory from './Purchase_history';
import type { PurchaseOrderRecord, PurchaseOrderMaterial, PurchaseMaterialRow, Supplier } from './Purchase_history';
import type { EstimateRecord, OrderTemplateRecord, OrderTemplateItem } from '../App';
import { useAudit } from '../contexts/AuditContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * 購買管理 - 仕様概要
 * 概要と主要機能: システムの目的と2タブ構成（新規発注 / 発注履歴）
 * 新規発注フロー: ステップ1 プロジェクト選択（複数可）→ ステップ2&3 材料一覧・仕入先 → ステップ4 発注内容確認
 * 発注履歴: 2段階ステータス（未発注 / 発注済み）。発注確定は備忘として発注済みにするのみ（発注方法・メール送付なし）
 * データ構造: Supplier, PurchaseMaterialRow, PurchaseOrder（Purchase_historyで定義）
 * バリデーション: ステップ1は1件以上プロジェクト選択、ステップ2は1件以上材料（品目+数量）
 * UI/UX: Atlassian風（#172b4d, #0052cc, #006644, #f4f5f7, #dfe1e6）
 * 改善履歴: 4ステップウィザード化、プロジェクト複数選択、発注履歴タブ統合
 * 今後の拡張案: ひな型から材料取り込み、納期入力、CSV一括取り込み
 */
/** 概要と主要機能: 購買管理の目的と2タブ構成 */
const PURCHASE_OVERVIEW = {
  purpose: '材料・資材の発注を一元管理し、プロジェクト別の発注から発注確定（メール/電話/個別）までをサポートします。',
  tabs: [
    { id: 'new', label: '新規発注', description: '4ステップで発注を作成（プロジェクト選択 → 材料・仕入先 → 確認）' },
    { id: 'history', label: '発注履歴', description: '発注一覧と2段階ステータス（未発注／発注済み）・発注方法の管理' },
  ],
};

interface PurchaseProps {
  quoteProjects: Array<{ id: string; projectName: string; customerName: string; totalAmount: number; quoteItems?: Array<{ item: string; quantity: number; unit: string; unitPrice?: number }> }>;
  materials: Array<{ id: string; name: string; unit: string; category: string; standardPrice: number; code: string }>;
  purchaseOrders: PurchaseOrderRecord[];
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrderRecord[]>>;
  customers: any[];
  estimates: EstimateRecord[];
  orderTemplates: OrderTemplateRecord[];
  setOrderTemplates: React.Dispatch<React.SetStateAction<OrderTemplateRecord[]>>;
  onNavigateToQuote: () => void;
  selectedPurchaseOrderId?: string | null;
  setSelectedPurchaseOrderId?: React.Dispatch<React.SetStateAction<string | null>>;
}

function nextPONumber(orders: PurchaseOrderRecord[]): string {
  const yyyymm = new Date().toISOString().slice(0, 7).replace(/-/, '');
  const prefix = `PO-${yyyymm}-`;
  const sameMonth = orders.filter((o) => o.id.startsWith(prefix));
  const maxNum = sameMonth.reduce((max, o) => {
    const n = parseInt(o.id.slice(prefix.length), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
}

const STEPS = [
  { id: 1, title: 'プロジェクト選択', description: '発注対象の案件を複数選択' },
  { id: 2, title: '材料一覧・仕入先', description: '材料を登録し仕入先を選択' },
  { id: 3, title: '発注内容の確認', description: '内容を確認して保存' },
];

const UNIT_OPTIONS = ['個', '本', '枚', 'm', 'm²', 'm³', 'kg', 't', '式'];

const Purchase: React.FC<PurchaseProps> = ({
  quoteProjects,
  materials,
  purchaseOrders,
  setPurchaseOrders,
  customers,
  estimates,
  orderTemplates,
  setOrderTemplates,
  onNavigateToQuote,
  selectedPurchaseOrderId,
  setSelectedPurchaseOrderId,
}) => {
  const { log: auditLog } = useAudit();
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';

  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [step, setStep] = useState(1);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [orderMaterials, setOrderMaterials] = useState<PurchaseMaterialRow[]>([]);
  const [orderMemo, setOrderMemo] = useState('');

  /** 状態管理: 仕入先リストは useMemo で customers から導出 */
  const suppliers: Supplier[] = useMemo(
    () =>
      (customers || [])
        .filter((c: any) => c.type === 'supplier' && c.isActive !== false)
        .map((s: any) => ({
          id: s.id,
          name: s.companyName,
          phone: s.phone || '',
          email: s.email || '',
        })),
    [customers]
  );

  const selectedProjects = useMemo(
    () => quoteProjects.filter((p) => selectedProjectIds.includes(p.id)),
    [quoteProjects, selectedProjectIds]
  );

  const projectNamesLabel = useMemo(
    () => selectedProjects.map((p) => p.projectName).join('、') || '（未選択）',
    [selectedProjects]
  );

  /** ステップ1: プロジェクト選択（複数選択可） */
  const toggleProject = useCallback((id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const canGoStep2 = useMemo(() => selectedProjectIds.length > 0, [selectedProjectIds]);

  /** ステップ2へ: 選択案件の見積品目を材料に集約 */
  const goToStep2 = useCallback(() => {
    if (!canGoStep2) {
      toast.error('1件以上のプロジェクトを選択してください');
      return;
    }
    const aggregated: Record<string, { item: string; quantity: number; unit: string; unitPrice: number }> = {};
    selectedProjects.forEach((proj) => {
      (proj.quoteItems || []).forEach((i) => {
        const key = `${i.item}|${i.unit}`;
        if (!aggregated[key])
          aggregated[key] = {
            item: i.item,
            quantity: 0,
            unit: i.unit,
            unitPrice: i.unitPrice ?? 0,
          };
        aggregated[key].quantity += i.quantity;
      });
    });
    const rows: PurchaseMaterialRow[] = Object.values(aggregated).map((v, idx) => ({
      id: `row-${Date.now()}-${idx}`,
      materialName: v.item,
      quantity: v.quantity,
      unit: v.unit,
      unitPrice: v.unitPrice,
      totalPrice: v.quantity * v.unitPrice,
      isUnregistered: false,
      supplierId: '',
    }));
    setOrderMaterials(rows.length > 0 ? rows : [{ id: `row-${Date.now()}`, materialName: '', quantity: 0, unit: '個', unitPrice: 0, totalPrice: 0, isUnregistered: true, supplierId: '' }]);
    setStep(2);
  }, [canGoStep2, selectedProjects]);

  /** ステップ2&3: 材料一覧と仕入先選択 */
  const addMaterialRow = useCallback(() => {
    setOrderMaterials((prev) => [
      ...prev,
      { id: `row-${Date.now()}`, materialName: '', quantity: 0, unit: '個', unitPrice: 0, totalPrice: 0, isUnregistered: true, supplierId: '' },
    ]);
  }, []);

  const updateMaterialRow = useCallback((id: string, patch: Partial<PurchaseMaterialRow>) => {
    setOrderMaterials((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = { ...m, ...patch };
        if (typeof next.quantity === 'number' && typeof next.unitPrice === 'number')
          next.totalPrice = next.quantity * next.unitPrice;
        return next;
      })
    );
  }, []);

  const removeMaterialRow = useCallback((id: string) => {
    setOrderMaterials((prev) => (prev.length <= 1 ? prev : prev.filter((m) => m.id !== id)));
  }, []);

  const validMaterials = useMemo(
    () => orderMaterials.filter((m) => m.materialName.trim() && m.quantity > 0),
    [orderMaterials]
  );

  const canGoStep3 = useMemo(() => validMaterials.length > 0, [validMaterials.length]);

  /** ステップ4: 発注内容の確認 */
  const goToStep3 = useCallback(() => {
    if (!canGoStep3) {
      toast.error('品目と数量を1件以上入力してください');
      return;
    }
    setStep(3);
  }, [canGoStep3]);

  const backToStep = useCallback((s: number) => {
    setStep(s);
  }, []);

  const totalAmount = useMemo(() => {
    const hasUnreg = validMaterials.some((m) => m.isUnregistered);
    if (hasUnreg) return 0;
    return validMaterials.reduce((sum, m) => sum + (m.quantity * (m.unitPrice || 0)), 0);
  }, [validMaterials]);

  /** 発注を保存（未発注）→ 発注履歴タブへ。材料ごとの仕入先を保存 */
  const saveOrder = useCallback(() => {
    const orderDate = new Date().toISOString().split('T')[0];
    const poId = nextPONumber(purchaseOrders);
    const materialsWithTotal = validMaterials.map((m) => {
      const sup = m.supplierId ? suppliers.find((s) => s.id === m.supplierId) : undefined;
      return {
        ...m,
        totalPrice: m.quantity * (m.unitPrice || 0),
        supplierName: sup?.name,
      };
    });
    const newOrder: PurchaseOrderRecord = {
      id: poId,
      projectName: projectNamesLabel !== '（未選択）' ? projectNamesLabel : '（案件名未入力）',
      customerName: selectedProjects[0]?.customerName,
      projectId: selectedProjectIds[0],
      orderDate,
      status: 'not_ordered',
      totalAmount,
      materials: materialsWithTotal,
      memo: orderMemo,
      updateHistory: [{ at: new Date().toISOString(), userId, action: '発注作成' }],
    };
    setPurchaseOrders((prev) => [...prev, newOrder]);
    auditLog({ userId, action: '発注作成', targetId: poId, result: 'success' });
    toast.success('発注を作成しました。発注履歴で確認・発注確定ができます。');
    setTab('history');
    setStep(1);
    setSelectedProjectIds([]);
    setOrderMaterials([]);
    setOrderMemo('');
  }, [
    purchaseOrders,
    validMaterials,
    projectNamesLabel,
    selectedProjects,
    selectedProjectIds,
    suppliers,
    orderMemo,
    totalAmount,
    setPurchaseOrders,
    auditLog,
    userId,
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto space-y-6">
      {/* 概要と主要機能 */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#172b4d]">購買管理</h1>
        <p className="text-sm text-muted-foreground mt-1 text-[#5e6c84]">{PURCHASE_OVERVIEW.purpose}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'new' | 'history')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-11 bg-[#f4f5f7] border border-[#dfe1e6]">
          <TabsTrigger value="new" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-[#172b4d]">
            <ShoppingCart className="w-4 h-4 mr-2" />
            新規発注
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-[#172b4d]">
            <FileText className="w-4 h-4 mr-2" />
            発注履歴
          </TabsTrigger>
        </TabsList>

        {/* 新規発注フロー（4ステップ） */}
        <TabsContent value="new" className="space-y-6 mt-6">
          <Card className="border-[#dfe1e6] bg-white">
            <CardHeader>
              <CardTitle className="text-base text-[#172b4d]">新規発注</CardTitle>
              <p className="text-sm text-[#5e6c84]">
                ステップ1: プロジェクト選択 → ステップ2&3: 材料一覧・仕入先 → ステップ4: 発注内容の確認
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ステップインジケータ（Atlassian風） */}
              <div className="flex items-center gap-2 flex-wrap">
                {STEPS.map((s, i) => (
                  <React.Fragment key={s.id}>
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                        step === s.id ? 'bg-[#0052cc] text-white' : step > s.id ? 'bg-[#e3fcef] text-[#006644]' : 'bg-[#f4f5f7] text-[#5e6c84]'
                      }`}
                    >
                      <span>{s.id}</span>
                      <span>{s.title}</span>
                    </div>
                    {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-[#dfe1e6]" />}
                  </React.Fragment>
                ))}
              </div>

              {/* ステップ1: プロジェクト選択（複数選択可） */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-[#172b4d]">発注対象のプロジェクトを選択（複数可）</Label>
                    <p className="text-xs text-[#5e6c84] mt-1">見積・案件から選ぶと材料を自動で取り込めます</p>
                  </div>
                  <div className="border border-[#dfe1e6] rounded-lg divide-y divide-[#dfe1e6] max-h-64 overflow-y-auto">
                    {quoteProjects.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        案件がありません。見積画面で案件を登録してください。
                        <Button variant="link" className="ml-2 h-auto p-0" onClick={onNavigateToQuote}>見積へ</Button>
                      </div>
                    ) : (
                      quoteProjects.map((proj) => (
                        <label
                          key={proj.id}
                          className="flex items-center gap-3 p-3 hover:bg-[#f4f5f7] cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedProjectIds.includes(proj.id)}
                            onCheckedChange={() => toggleProject(proj.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#172b4d]">{proj.projectName}</p>
                            <p className="text-xs text-[#5e6c84]">{proj.customerName} · 品目数: {(proj.quoteItems || []).length}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={goToStep2} disabled={!canGoStep2} className="bg-[#0052cc] hover:bg-[#0747a6]">
                      次へ（材料・仕入先）
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ステップ2&3: 材料一覧と仕入先選択 */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => backToStep(1)}>
                      <ChevronLeft className="w-4 h-4 mr-1" />戻る
                    </Button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-[#172b4d]">材料一覧（各材料で仕入先を選択）</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addMaterialRow} className="border-[#dfe1e6]">
                        <Plus className="w-4 h-4 mr-1" />行追加
                      </Button>
                    </div>
                    <div className="border border-[#dfe1e6] rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[#f4f5f7] border-[#dfe1e6]">
                            <TableHead className="text-[#5e6c84]">品目・品番</TableHead>
                            <TableHead className="w-24 text-[#5e6c84]">数量</TableHead>
                            <TableHead className="w-28 text-[#5e6c84]">単位</TableHead>
                            <TableHead className="w-36 text-[#5e6c84]">仕入先</TableHead>
                            <TableHead className="w-28 text-[#5e6c84]">単価</TableHead>
                            <TableHead className="w-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderMaterials.map((m) => (
                            <TableRow key={m.id} className="border-[#dfe1e6]">
                              <TableCell>
                                <Input
                                  value={m.materialName}
                                  onChange={(e) => updateMaterialRow(m.id, { materialName: e.target.value })}
                                  placeholder="品目名"
                                  className="border-[#dfe1e6]"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  value={m.quantity || ''}
                                  onChange={(e) => updateMaterialRow(m.id, { quantity: parseInt(e.target.value, 10) || 0 })}
                                  className="border-[#dfe1e6]"
                                />
                              </TableCell>
                              <TableCell>
                                <Select value={m.unit} onValueChange={(v) => updateMaterialRow(m.id, { unit: v })}>
                                  <SelectTrigger className="w-28 border-[#dfe1e6]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {UNIT_OPTIONS.map((u) => (
                                      <SelectItem key={u} value={u}>{u}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={m.supplierId || '__none__'}
                                  onValueChange={(v) => updateMaterialRow(m.id, { supplierId: v === '__none__' ? '' : v })}
                                >
                                  <SelectTrigger className="w-36 border-[#dfe1e6]">
                                    <SelectValue placeholder="未定" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">仕入先未定</SelectItem>
                                    {suppliers.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  value={m.unitPrice || ''}
                                  onChange={(e) => updateMaterialRow(m.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                                  placeholder="参考"
                                  className="border-[#dfe1e6]"
                                />
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => removeMaterialRow(m.id)} disabled={orderMaterials.length <= 1}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[#5e6c84]">備考（任意）</Label>
                    <Input value={orderMemo} onChange={(e) => setOrderMemo(e.target.value)} placeholder="備考" className="mt-1 border-[#dfe1e6]" />
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => backToStep(1)} className="border-[#dfe1e6]">戻る</Button>
                    <Button onClick={goToStep3} disabled={!canGoStep3} className="bg-[#0052cc] hover:bg-[#0747a6]">
                      次へ（確認）
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ステップ4: 発注内容の確認 */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => backToStep(2)}>
                      <ChevronLeft className="w-4 h-4 mr-1" />戻る
                    </Button>
                  </div>
                  <Card className="bg-[#f4f5f7] border-[#dfe1e6]">
                    <CardHeader>
                      <CardTitle className="text-sm text-[#5e6c84]">発注内容の確認</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <span className="text-[#5e6c84]">案件: </span>
                        <span className="font-medium text-[#172b4d]">{projectNamesLabel}</span>
                      </div>
                      <div>
                        <span className="text-[#5e6c84]">仕入先: </span>
                        <span className="font-medium text-[#172b4d]">材料ごとに設定</span>
                      </div>
                      <div>
                        <span className="text-[#5e6c84]">品目数: </span>
                        <span className="font-medium text-[#172b4d]">{validMaterials.length}品目</span>
                      </div>
                      {orderMemo && (
                        <div>
                          <span className="text-[#5e6c84]">備考: </span>
                          <span className="text-[#172b4d]">{orderMemo}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-[#dfe1e6]">
                        <span className="text-[#5e6c84]">合計金額: </span>
                        <span className="font-semibold text-[#172b4d]">
                          {totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : '—（未登録材料あり）'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => backToStep(2)} className="border-[#dfe1e6]">戻る</Button>
                    <Button onClick={saveOrder} className="bg-[#006644] hover:bg-[#055a3a] text-white">
                      <Package className="w-4 h-4 mr-2" />
                      発注を保存（未発注）
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 発注履歴タブ（2段階ステータス・発注方法選択モーダルは PurchaseHistory 内） */}
        <TabsContent value="history" className="mt-6">
          <PurchaseHistory
            purchaseOrders={purchaseOrders}
            setPurchaseOrders={setPurchaseOrders}
            suppliers={suppliers}
            onNavigateToQuote={onNavigateToQuote}
            selectedPurchaseOrderId={selectedPurchaseOrderId}
            setSelectedPurchaseOrderId={setSelectedPurchaseOrderId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Purchase;
