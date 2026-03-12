import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';
import {
  Phone,
  Mail,
  Package,
  Building2,
  Plus,
  FileText,
  Search,
  X,
  Send,
  User,
  CheckCircle,
  ClipboardList,
  ShoppingCart,
} from 'lucide-react';
import PurchaseHistory from './Purchase_history';
import type { PurchaseOrderRecord, PurchaseOrderMaterial } from './Purchase_history';
import type { EstimateRecord, OrderTemplateRecord, OrderTemplateItem } from '../App';
import { useAudit } from '../contexts/AuditContext';
import { useAuth } from '../contexts/AuthContext';

interface Material {
  id: string;
  name: string;
  unit: string;
  category: string;
  standardPrice: number;
  code: string;
  memo?: string;
  isActive?: boolean;
}

interface PurchaseProps {
  quoteProjects: Array<{ id: string; projectName: string; customerName: string; totalAmount: number }>;
  materials: Material[];
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

const Purchase: React.FC<PurchaseProps> = ({
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

  const [tab, setTab] = useState<'templates' | 'orders'>('templates');

  // ひな型
  const [templateListKeyword, setTemplateListKeyword] = useState('');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OrderTemplateRecord | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateItems, setTemplateItems] = useState<OrderTemplateItem[]>([]);
  const [fromEstimateModalOpen, setFromEstimateModalOpen] = useState(false);
  const [fromEstimateId, setFromEstimateId] = useState('');
  const [fromEstimateItems, setFromEstimateItems] = useState<OrderTemplateItem[]>([]);

  // 発注作成
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false);
  const [createFromTemplateId, setCreateFromTemplateId] = useState('');
  const [createProjectName, setCreateProjectName] = useState('');
  const [createSupplierId, setCreateSupplierId] = useState<string>('');
  const [createOrderMaterials, setCreateOrderMaterials] = useState<PurchaseOrderMaterial[]>([]);
  const [createOrderMemo, setCreateOrderMemo] = useState('');
  const [selectTemplateForOrderOpen, setSelectTemplateForOrderOpen] = useState(false);
  const [selectedTemplateIdForOrder, setSelectedTemplateIdForOrder] = useState('');

  const suppliers = useMemo(
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

  const filteredTemplates = useMemo(() => {
    if (!templateListKeyword.trim()) return orderTemplates;
    const k = templateListKeyword.toLowerCase();
    return orderTemplates.filter(
      (t) => t.name.toLowerCase().includes(k) || t.items.some((i) => i.item.toLowerCase().includes(k))
    );
  }, [orderTemplates, templateListKeyword]);

  const openNewTemplate = useCallback(() => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateItems([{ id: `i-${Date.now()}`, item: '', quantity: 0, unit: '個', memo: '' }]);
    setTemplateModalOpen(true);
  }, []);

  const openEditTemplate = useCallback((t: OrderTemplateRecord) => {
    setEditingTemplate(t);
    setTemplateName(t.name);
    setTemplateItems(t.items.map((i) => ({ ...i, id: i.id || `i-${Date.now()}-${Math.random().toString(36).slice(2)}` })));
    setTemplateModalOpen(true);
  }, []);

  const addTemplateRow = useCallback(() => {
    setTemplateItems((prev) => [...prev, { id: `i-${Date.now()}`, item: '', quantity: 0, unit: '個', memo: '' }]);
  }, []);

  const updateTemplateItem = useCallback((id: string, patch: Partial<OrderTemplateItem>) => {
    setTemplateItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const removeTemplateRow = useCallback((id: string) => {
    setTemplateItems((prev) => (prev.length <= 1 ? prev : prev.filter((i) => i.id !== id)));
  }, []);

  const saveTemplate = useCallback(() => {
    const valid = templateItems.filter((i) => i.item.trim() && i.quantity > 0);
    if (valid.length === 0) {
      toast.error('品目と数量を1件以上入力してください');
      return;
    }
    const now = new Date().toISOString();
    if (editingTemplate) {
      setOrderTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id
            ? { ...t, name: templateName || t.name, items: valid, updatedAt: now }
            : t
        )
      );
      auditLog({ userId, action: 'ひな型更新', targetId: editingTemplate.id, result: 'success' });
      toast.success('ひな型を更新しました');
    } else {
      const newId = `tpl-${Date.now()}`;
      setOrderTemplates((prev) => [
        ...prev,
        { id: newId, name: templateName || `ひな型 ${now.slice(0, 10)}`, items: valid, createdAt: now, updatedAt: now },
      ]);
      auditLog({ userId, action: 'ひな型作成', targetId: newId, result: 'success' });
      toast.success('ひな型を作成しました');
    }
    setTemplateModalOpen(false);
  }, [editingTemplate, templateName, templateItems, setOrderTemplates, auditLog, userId]);

  const openFromEstimate = useCallback(() => {
    const confirmed = estimates.filter((e) => e.status === 'confirmed' && e.items.length > 0);
    if (confirmed.length === 0) {
      toast.error('確定済みの見積がありません');
      return;
    }
    setFromEstimateId(confirmed[0].id);
    const est = confirmed[0];
    const aggregated: Record<string, { item: string; quantity: number; unit: string; memo?: string }> = {};
    est.items.forEach((i) => {
      const key = `${i.item}|${i.unit}`;
      if (!aggregated[key]) aggregated[key] = { item: i.item, quantity: 0, unit: i.unit };
      aggregated[key].quantity += i.quantity;
    });
    setFromEstimateItems(
      Object.values(aggregated).map((v, idx) => ({
        id: `fe-${Date.now()}-${idx}`,
        item: v.item,
        quantity: v.quantity,
        unit: v.unit,
        memo: '',
      }))
    );
    setFromEstimateModalOpen(true);
  }, [estimates]);

  const changeFromEstimate = useCallback(
    (estimateId: string) => {
      setFromEstimateId(estimateId);
      const est = estimates.find((e) => e.id === estimateId);
      if (!est) return;
      const aggregated: Record<string, { item: string; quantity: number; unit: string }> = {};
      est.items.forEach((i) => {
        const key = `${i.item}|${i.unit}`;
        if (!aggregated[key]) aggregated[key] = { item: i.item, quantity: 0, unit: i.unit };
        aggregated[key].quantity += i.quantity;
      });
      setFromEstimateItems(
        Object.values(aggregated).map((v, idx) => ({
          id: `fe-${Date.now()}-${idx}`,
          item: v.item,
          quantity: v.quantity,
          unit: v.unit,
          memo: '',
        }))
      );
    },
    [estimates]
  );

  const updateFromEstimateItem = useCallback((id: string, patch: Partial<OrderTemplateItem>) => {
    setFromEstimateItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const removeFromEstimateItem = useCallback((id: string) => {
    setFromEstimateItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const saveTemplateFromEstimate = useCallback(() => {
    const valid = fromEstimateItems.filter((i) => i.item.trim() && i.quantity > 0);
    if (valid.length === 0) {
      toast.error('品目と数量を1件以上入力してください');
      return;
    }
    const now = new Date().toISOString();
    const newId = `tpl-${Date.now()}`;
    const est = estimates.find((e) => e.id === fromEstimateId);
    setOrderTemplates((prev) => [
      ...prev,
      {
        id: newId,
        name: est ? `見積より: ${est.projectName}` : `ひな型 ${now.slice(0, 10)}`,
        items: valid,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    auditLog({ userId, action: '見積からひな型自動生成', targetId: newId, result: 'success' });
    toast.success('見積からひな型を生成しました');
    setFromEstimateModalOpen(false);
  }, [fromEstimateId, fromEstimateItems, estimates, setOrderTemplates, auditLog, userId]);

  const openCreateOrder = useCallback((templateId: string) => {
    const t = orderTemplates.find((x) => x.id === templateId);
    if (!t) return;
    setCreateFromTemplateId(templateId);
    setCreateProjectName('');
    setCreateSupplierId('');
    setCreateOrderMaterials(
      t.items.map((i, idx) => ({
        id: `m-${Date.now()}-${idx}`,
        materialName: i.item,
        quantity: i.quantity,
        unit: i.unit,
        unitPrice: 0,
        totalPrice: 0,
        isUnregistered: false,
      }))
    );
    setCreateOrderMemo('');
    setCreateOrderModalOpen(true);
  }, [orderTemplates]);

  const addUnregisteredMaterial = useCallback(() => {
    setCreateOrderMaterials((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        materialName: '',
        quantity: 0,
        unit: '個',
        unitPrice: 0,
        totalPrice: 0,
        isUnregistered: true,
      },
    ]);
  }, []);

  const updateCreateMaterial = useCallback((id: string, patch: Partial<PurchaseOrderMaterial>) => {
    setCreateOrderMaterials((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = { ...m, ...patch };
        if (typeof next.quantity === 'number' && typeof next.unitPrice === 'number')
          next.totalPrice = next.quantity * next.unitPrice;
        return next;
      })
    );
  }, []);

  const removeCreateMaterial = useCallback((id: string) => {
    setCreateOrderMaterials((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const saveNewOrder = useCallback(() => {
    const valid = createOrderMaterials.filter((m) => m.materialName.trim() && m.quantity > 0);
    if (valid.length === 0) {
      toast.error('品目と数量を1件以上入力してください');
      return;
    }
    const hasUnregistered = valid.some((m) => m.isUnregistered);
    const supplier = createSupplierId ? suppliers.find((s) => s.id === createSupplierId) : undefined;
    const orderDate = new Date().toISOString().split('T')[0];
    const poId = nextPONumber(purchaseOrders);
    const materialsWithTotal = valid.map((m) => ({
      ...m,
      totalPrice: m.quantity * (m.unitPrice || 0),
    }));
    const totalAmount = hasUnregistered ? 0 : materialsWithTotal.reduce((s, m) => s + m.totalPrice, 0);
    const newOrder: PurchaseOrderRecord = {
      id: poId,
      projectName: createProjectName || '（案件名未入力）',
      customerName: '',
      supplierId: supplier?.id,
      supplierName: supplier?.name,
      supplierPhone: supplier?.phone,
      supplierEmail: supplier?.email,
      orderDate,
      status: 'not_ordered',
      totalAmount,
      materials: materialsWithTotal,
      memo: createOrderMemo,
      updateHistory: [{ at: new Date().toISOString(), userId, action: '発注作成' }],
    };
    setPurchaseOrders((prev) => [...prev, newOrder]);
    auditLog({ userId, action: '発注作成', targetId: poId, result: 'success' });
    toast.success('発注を作成しました');
    setCreateOrderModalOpen(false);
    setTab('orders');
  }, [
    createOrderMaterials,
    createProjectName,
    createSupplierId,
    createOrderMemo,
    suppliers,
    purchaseOrders,
    setPurchaseOrders,
    auditLog,
    userId,
  ]);

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">購買管理</h1>
          <p className="text-muted-foreground">材料発注ひな型（F-06）・発注（F-11）</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'templates' | 'orders')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="templates">
            <ClipboardList className="w-4 h-4 mr-2" />
            ひな型（F-06）
          </TabsTrigger>
          <TabsTrigger value="orders">
            <ShoppingCart className="w-4 h-4 mr-2" />
            発注（F-11）
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>材料発注ひな型一覧</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={openFromEstimate} disabled={estimates.filter((e) => e.status === 'confirmed' && e.items.length > 0).length === 0}>
                  見積から自動生成
                </Button>
                <Button onClick={openNewTemplate}>
                  <Plus className="w-4 h-4 mr-2" />
                  新規ひな型
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative max-w-sm mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ひな型名・品目で検索..."
                  value={templateListKeyword}
                  onChange={(e) => setTemplateListKeyword(e.target.value)}
                  className="pl-10"
                />
              </div>
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto opacity-20 mb-2" />
                  <p>ひな型がありません</p>
                  <p className="text-sm mt-1">「新規ひな型」または「見積から自動生成」で作成できます</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTemplates.map((t) => (
                    <Card
                      key={t.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => openEditTemplate(t)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{t.name}</p>
                            <p className="text-sm text-muted-foreground">{t.items.length}品目 · 更新: {t.updatedAt.slice(0, 10)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditTemplate(t); }}>編集</Button>
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); openCreateOrder(t.id); setCreateOrderModalOpen(true); setTab('orders'); }}>発注に使う</Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <div className="flex items-center justify-between">
            <Alert className="flex-1">
              <Package className="w-4 h-4" />
              <AlertDescription>
                ひな型から発注を作成し、未発注のまま保存できます。仕入先は任意です。発注確定時に発注方法（メール/電話/個別）を選択します。
              </AlertDescription>
            </Alert>
            <Button onClick={() => { setSelectedTemplateIdForOrder(orderTemplates[0]?.id ?? ''); setSelectTemplateForOrderOpen(true); }} disabled={orderTemplates.length === 0}>
              <Plus className="w-4 h-4 mr-2" />
              新規発注
            </Button>
          </div>
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

      {/* ひな型 新規/編集 */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'ひな型を編集' : 'ひな型を作成（US-0901）'}</DialogTitle>
            <DialogDescription>品目・数量・単位・備考を登録し、保存後は一覧から再利用できます。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>ひな型名（任意）</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="例: 内装標準" className="mt-1" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>明細</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTemplateRow}>
                  <Plus className="w-4 h-4 mr-1" />行追加
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>品目</TableHead>
                    <TableHead className="w-24">数量</TableHead>
                    <TableHead className="w-28">単位</TableHead>
                    <TableHead>備考</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templateItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Input
                          value={row.item}
                          onChange={(e) => updateTemplateItem(row.id, { item: e.target.value })}
                          placeholder="品目名"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={row.quantity || ''}
                          onChange={(e) => updateTemplateItem(row.id, { quantity: parseInt(e.target.value, 10) || 0 })}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={row.unit} onValueChange={(v) => updateTemplateItem(row.id, { unit: v })}>
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {['個', '本', '枚', 'm', 'm²', 'm³', 'kg', 't', '式'].map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input value={row.memo || ''} onChange={(e) => updateTemplateItem(row.id, { memo: e.target.value })} placeholder="備考" />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeTemplateRow(row.id)} disabled={templateItems.length <= 1}>
                          <X className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateModalOpen(false)}>キャンセル</Button>
            <Button onClick={saveTemplate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 見積からひな型自動生成 */}
      <Dialog open={fromEstimateModalOpen} onOpenChange={setFromEstimateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>見積からひな型を自動生成（US-0902）</DialogTitle>
            <DialogDescription>見積明細から品目を取り込みます。同名品目は集約されます。追記・削除・数量変更後に保存できます。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>見積を選択</Label>
              <Select value={fromEstimateId} onValueChange={changeFromEstimate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {estimates
                    .filter((e) => e.status === 'confirmed' && e.items.length > 0)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.projectName}（{e.estimateNumber}）</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>品目</TableHead>
                  <TableHead className="w-24">数量</TableHead>
                  <TableHead className="w-28">単位</TableHead>
                  <TableHead>備考</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fromEstimateItems.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Input value={row.item} onChange={(e) => updateFromEstimateItem(row.id, { item: e.target.value })} placeholder="品目名" />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={row.quantity || ''}
                        onChange={(e) => updateFromEstimateItem(row.id, { quantity: parseInt(e.target.value, 10) || 0 })}
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={row.unit} onValueChange={(v) => updateFromEstimateItem(row.id, { unit: v })}>
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['個', '本', '枚', 'm', 'm²', 'm³', 'kg', 't', '式'].map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input value={row.memo || ''} onChange={(e) => updateFromEstimateItem(row.id, { memo: e.target.value })} placeholder="備考" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeFromEstimateItem(row.id)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFromEstimateModalOpen(false)}>キャンセル</Button>
            <Button onClick={saveTemplateFromEstimate}>ひな型として保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 発注作成（ひな型から） */}
      <Dialog open={createOrderModalOpen} onOpenChange={setCreateOrderModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>発注を作成（US-0911）</DialogTitle>
            <DialogDescription>発注番号は自動付番（PO-YYYYMM-####）です。仕入先は任意です。未登録の材料は品番＋数量のみで追加でき、単価は参考価格です。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>案件名（任意）</Label>
                <Input value={createProjectName} onChange={(e) => setCreateProjectName(e.target.value)} placeholder="案件名" className="mt-1" />
              </div>
              <div>
                <Label>仕入先（任意・未選択＝仕入先未定）</Label>
                <Select value={createSupplierId || '__none__'} onValueChange={(v) => setCreateSupplierId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">仕入先未定</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>明細（未登録材料は品番＋数量のみ。単価は参考価格）</Label>
                <Button type="button" variant="outline" size="sm" onClick={addUnregisteredMaterial}>
                  <Plus className="w-4 h-4 mr-1" />未登録材料を追加
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>品目・品番</TableHead>
                    <TableHead className="w-24">数量</TableHead>
                    <TableHead className="w-28">単位</TableHead>
                    <TableHead className="w-28">参考価格</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {createOrderMaterials.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Input
                          value={m.materialName}
                          onChange={(e) => updateCreateMaterial(m.id, { materialName: e.target.value })}
                          placeholder={m.isUnregistered ? '品番・品目' : '品目'}
                        />
                        {m.isUnregistered && <Badge variant="secondary" className="ml-2 text-xs">未登録</Badge>}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={m.quantity || ''}
                          onChange={(e) => updateCreateMaterial(m.id, { quantity: parseInt(e.target.value, 10) || 0 })}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={m.unit}
                          onValueChange={(v) => updateCreateMaterial(m.id, { unit: v })}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {['個', '本', '枚', 'm', 'm²', 'm³', 'kg', 't', '式'].map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={m.unitPrice || ''}
                          onChange={(e) => updateCreateMaterial(m.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                          placeholder="参考"
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeCreateMaterial(m.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {createOrderMaterials.some((m) => m.isUnregistered) && (
                <p className="text-sm text-muted-foreground mt-2">未登録材料を含むため、発注単位の合計金額は表示しません。</p>
              )}
            </div>
            <div>
              <Label>備考（任意）</Label>
              <Input value={createOrderMemo} onChange={(e) => setCreateOrderMemo(e.target.value)} placeholder="備考" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOrderModalOpen(false)}>キャンセル</Button>
            <Button onClick={saveNewOrder}>発注を保存（未発注）</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新規発注：ひな型選択 */}
      <Dialog open={selectTemplateForOrderOpen} onOpenChange={setSelectTemplateForOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ひな型を選択</DialogTitle>
            <DialogDescription>発注の元となるひな型を選んでください</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {orderTemplates.map((t) => (
              <Card
                key={t.id}
                className={`cursor-pointer transition-colors ${selectedTemplateIdForOrder === t.id ? 'border-primary bg-primary/5' : ''}`}
                onClick={() => setSelectedTemplateIdForOrder(t.id)}
              >
                <CardContent className="p-3">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.items.length}品目</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectTemplateForOrderOpen(false)}>キャンセル</Button>
            <Button
              disabled={!selectedTemplateIdForOrder}
              onClick={() => {
                if (selectedTemplateIdForOrder) {
                  openCreateOrder(selectedTemplateIdForOrder);
                  setCreateOrderModalOpen(true);
                  setSelectTemplateForOrderOpen(false);
                }
              }}
            >
              発注を作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Purchase;
