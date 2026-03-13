import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import { Phone, Mail, Package, Building2, FileText, Search, Eye, X, Send, User, FileDown, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { useAudit } from '../contexts/AuditContext';
import { useAuth } from '../contexts/AuthContext';

/** 発注明細（未登録材料は isUnregistered=true, unitPrice は参考価格） */
export interface PurchaseOrderMaterial {
  id: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  isFromQuote?: boolean;
  /** 未登録材料（品番+数量のみ。単価は参考価格） */
  isUnregistered?: boolean;
  /** 材料ごとの仕入先（顧客・仕入先で登録した仕入先から選択） */
  supplierId?: string;
  supplierName?: string;
}

/** データ構造: 発注行（PurchaseMaterialRow = PurchaseOrderMaterial の別名） */
export type PurchaseMaterialRow = PurchaseOrderMaterial;

/** データ構造: 仕入先 */
export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
}

/** 発注更新履歴 */
export interface PurchaseOrderUpdateEntry {
  at: string;
  userId?: string;
  action: string;
}

export interface PurchaseOrderRecord {
  id: string;
  projectId?: string;
  projectName: string;
  customerName?: string;
  /** 仕入先は任意。未選択＝仕入先未定 */
  supplierId?: string;
  supplierName?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  status: 'not_ordered' | 'ordered';
  /** 未登録材料を含む場合は表示しない */
  totalAmount: number;
  materials: PurchaseOrderMaterial[];
  memo?: string;
  /** 発注方法・メール送付日時 */
  orderMethod?: 'email' | 'phone' | 'individual';
  emailSentAt?: string;
  /** 更新履歴 */
  updateHistory?: PurchaseOrderUpdateEntry[];
}

/** データ構造: 発注（PurchaseOrder = PurchaseOrderRecord の別名） */
export type PurchaseOrder = PurchaseOrderRecord;

const UNIT_OPTIONS = ['個', '本', '枚', 'm', 'm²', 'm³', 'kg', 't', '式'];

interface PurchaseHistoryProps {
  purchaseOrders: PurchaseOrderRecord[];
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrderRecord[]>>;
  suppliers: Supplier[];
  onNavigateToQuote?: () => void;
  selectedPurchaseOrderId?: string | null;
  setSelectedPurchaseOrderId?: React.Dispatch<React.SetStateAction<string | null>>;
}

const PurchaseHistory: React.FC<PurchaseHistoryProps> = ({
  purchaseOrders,
  setPurchaseOrders,
  suppliers,
  onNavigateToQuote,
  selectedPurchaseOrderId,
  setSelectedPurchaseOrderId,
}) => {
  const { log: auditLog } = useAudit();
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';

  const [historySearchTerm, setHistorySearchTerm] = useState('');

  useEffect(() => {
    if (selectedPurchaseOrderId && purchaseOrders.length > 0) {
      const order = purchaseOrders.find((o) => o.id === selectedPurchaseOrderId);
      if (order) {
        setSelectedOrder(order);
        setShowOrderDetails(true);
      }
      setSelectedPurchaseOrderId?.(null);
    }
  }, [selectedPurchaseOrderId, purchaseOrders]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historySortBy, setHistorySortBy] = useState<string>('orderDate');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderRecord | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderRecord | null>(null);
  const [editMaterials, setEditMaterials] = useState<PurchaseOrderMaterial[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ordered': return 'default';
      case 'not_ordered': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusBadgeClassName = (status: string) => {
    switch (status) {
      case 'ordered': return 'bg-[var(--success)] text-white';
      case 'not_ordered': return 'bg-muted text-foreground';
      default: return '';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ordered': return '発注済み';
      case 'not_ordered': return '未発注';
      default: return status;
    }
  };

  const hasUnregistered = (order: PurchaseOrderRecord) =>
    order.materials.some((m) => m.isUnregistered);
  const showTotal = (order: PurchaseOrderRecord) => !hasUnregistered(order);

  const filteredAndSortedOrders = [...purchaseOrders]
    .filter((order) => {
      const search = historySearchTerm.toLowerCase();
      const matchesSearch =
        order.projectName.toLowerCase().includes(search) ||
        (order.customerName ?? '').toLowerCase().includes(search) ||
        (order.supplierName ?? '').toLowerCase().includes(search) ||
        order.id.toLowerCase().includes(search);
      const matchesStatus = historyStatusFilter === 'all' || order.status === historyStatusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (historySortBy) {
        case 'orderDate': return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
        case 'expectedDeliveryDate':
          return new Date(b.expectedDeliveryDate ?? 0).getTime() - new Date(a.expectedDeliveryDate ?? 0).getTime();
        case 'projectName': return a.projectName.localeCompare(b.projectName);
        case 'supplierName': return (a.supplierName ?? '').localeCompare(b.supplierName ?? '');
        default: return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
      }
    });

  /** 発注済みステータスにする（発注方法はなし。メール送付は行わない） */
  const confirmOrder = (order: PurchaseOrderRecord) => {
    const now = new Date().toISOString();
    setPurchaseOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status: 'ordered',
              updateHistory: [...(o.updateHistory ?? []), { at: now, userId, action: '発注確定' }],
            }
          : o
      )
    );
    auditLog({ userId, action: '発注確定', targetId: order.id, result: 'success' });
    toast.success('発注済みにしました');
    setSelectedOrder((prev) =>
      prev && prev.id === order.id
        ? { ...prev, status: 'ordered', updateHistory: [...(prev.updateHistory ?? []), { at: now, userId, action: '発注確定' }] }
        : prev
    );
  };

  const startEditOrder = (order: PurchaseOrderRecord) => {
    if (order.status !== 'not_ordered') return;
    setEditingOrder(order);
    setEditMaterials(order.materials.map((m) => ({ ...m })));
  };

  const saveEditOrder = () => {
    if (!editingOrder) return;
    const valid = editMaterials.filter((m) => m.materialName.trim() && m.quantity > 0);
    if (valid.length === 0) {
      toast.error('品目と数量を1件以上入力してください');
      return;
    }
    const hasUnreg = valid.some((m) => m.isUnregistered);
    const materialsWithTotal = valid.map((m) => {
      const sup = m.supplierId ? suppliers.find((s) => s.id === m.supplierId) : undefined;
      return {
        ...m,
        totalPrice: m.quantity * (m.unitPrice || 0),
        supplierName: sup?.name,
      };
    });
    const totalAmount = hasUnreg ? 0 : materialsWithTotal.reduce((s, m) => s + m.totalPrice, 0);
    const now = new Date().toISOString();
    setPurchaseOrders((prev) =>
      prev.map((o) =>
        o.id === editingOrder.id
          ? {
              ...o,
              materials: materialsWithTotal,
              totalAmount,
              updateHistory: [...(o.updateHistory ?? []), { at: now, userId, action: '明細編集' }],
            }
          : o
      )
    );
    toast.success('発注を更新しました');
    setEditingOrder(null);
    setEditMaterials([]);
    if (selectedOrder?.id === editingOrder.id) {
      setSelectedOrder((prev) =>
        prev ? { ...prev, materials: materialsWithTotal, totalAmount, updateHistory: [...(prev.updateHistory ?? []), { at: now, userId, action: '明細編集' }] } : null
      );
    }
  };

  const updateEditMaterial = (id: string, patch: Partial<PurchaseOrderMaterial>) => {
    setEditMaterials((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = { ...m, ...patch };
        next.totalPrice = (next.quantity ?? m.quantity) * (next.unitPrice ?? m.unitPrice);
        return next;
      })
    );
  };

  const exportCSV = (order: PurchaseOrderRecord) => {
    const rows = [
      ['発注番号', order.id],
      ['案件名', order.projectName],
      ['発注日', order.orderDate],
      ['仕入先', order.supplierName ?? '仕入先未定'],
      [],
      ['品目', '数量', '単位', '単価', '金額'],
      ...order.materials.map((m) => [m.materialName, m.quantity, m.unit, m.unitPrice, m.totalPrice]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `発注書_${order.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSVをダウンロードしました');
  };

  const printForPDF = (order: PurchaseOrderRecord) => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('ポップアップがブロックされています');
      return;
    }
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>発注書 ${order.id}</title>
      <style>
        body { font-family: sans-serif; padding: 24px; }
        table { border-collapse: collapse; width: 100%; margin-top: 16px; }
        th, td { border: 1px solid #333; padding: 8px; text-align: left; }
        th { background: #f0f0f0; }
        .header { margin-bottom: 16px; }
        .meta { font-size: 14px; color: #666; }
      </style></head><body>
      <div class="header">
        <h1>発注書</h1>
        <p class="meta">発注番号: ${order.id} &nbsp; 案件名: ${order.projectName} &nbsp; 発注日: ${order.orderDate}</p>
        <p class="meta">仕入先: ${order.supplierName ?? '仕入先未定'}</p>
      </div>
      <table>
        <thead><tr><th>品目</th><th>数量</th><th>単位</th><th>単価</th><th>金額</th></tr></thead>
        <tbody>
        ${order.materials.map((m) => `<tr><td>${m.materialName}</td><td>${m.quantity}</td><td>${m.unit}</td><td>${m.unitPrice}</td><td>${m.totalPrice}</td></tr>`).join('')}
        </tbody>
      </table>
      ${showTotal(order) ? `<p style="margin-top:16px; font-weight:bold;">合計金額: ¥${order.totalAmount.toLocaleString()}</p>` : '<p style="margin-top:16px; color:#666;">未登録材料を含むため合計金額は表示しません</p>'}
      ${order.memo ? `<p style="margin-top:16px;">備考: ${order.memo}</p>` : ''}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
    toast.success('印刷用画面を開きました。PDFで保存する場合は印刷ダイアログで「PDFに保存」を選択してください。');
  };

  return (
    <>
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-primary" />
              <span>発注一覧</span>
            </div>
            <Badge variant="outline" className="text-xs">{filteredAndSortedOrders.length}件</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="案件名・仕入先・発注IDで検索..."
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label>ステータス</Label>
              <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全て</SelectItem>
                  <SelectItem value="ordered">発注済み</SelectItem>
                  <SelectItem value="not_ordered">未発注</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>並び替え</Label>
              <Select value={historySortBy} onValueChange={setHistorySortBy}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="orderDate">発注日順</SelectItem>
                  <SelectItem value="expectedDeliveryDate">納期順</SelectItem>
                  <SelectItem value="projectName">案件名</SelectItem>
                  <SelectItem value="supplierName">仕入先</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredAndSortedOrders.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">発注がありません</h3>
                <p className="text-sm text-muted-foreground mb-4">「新規発注（ひな型から）」または「品番・数量で発注」で発注を作成し、ここで確認・発注確定できます</p>
                {onNavigateToQuote && (
                  <Button variant="outline" onClick={onNavigateToQuote}>見積画面へ</Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredAndSortedOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="cursor-pointer transition-all hover:shadow-md border-border hover:border-border"
                    onClick={() => { setSelectedOrder(order); setShowOrderDetails(true); }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-medium">{order.id}</h4>
                            <Badge variant={getStatusBadgeVariant(order.status)} className={`text-xs ${getStatusBadgeClassName(order.status)}`}>
                              {getStatusLabel(order.status)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">案件</p>
                              <p className="font-medium">{order.projectName}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">仕入先</p>
                              <p className="font-medium">{order.supplierName ?? '仕入先未定'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">発注日</p>
                              <p className="font-medium">{order.orderDate}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">品目数</p>
                              <p className="font-medium">{order.materials.length}品目</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Package className="w-3 h-3" />
                            <span>
                              {order.materials.slice(0, 2).map((m) => m.materialName).join(', ')}
                              {order.materials.length > 2 && ` 他${order.materials.length - 2}件`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {order.status === 'not_ordered' && (
                            <Button variant="outline" size="sm" onClick={() => confirmOrder(order)} className="text-xs">
                              <Send className="w-3 h-3 mr-1" />発注確定
                            </Button>
                          )}
                          {order.status === 'not_ordered' && (
                            <Button variant="outline" size="sm" onClick={() => startEditOrder(order)} className="text-xs">
                              編集
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => { setSelectedOrder(order); setShowOrderDetails(true); }} className="text-xs">
                            <Eye className="w-3 h-3 mr-1" />詳細
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 発注詳細 */}
      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span>発注詳細: {selectedOrder?.id}</span>
                <Badge variant={selectedOrder ? getStatusBadgeVariant(selectedOrder.status) : 'outline'} className={selectedOrder ? getStatusBadgeClassName(selectedOrder.status) : ''}>
                  {selectedOrder ? getStatusLabel(selectedOrder.status) : ''}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {selectedOrder && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => selectedOrder && exportCSV(selectedOrder)}>
                      <FileDown className="w-4 h-4 mr-1" />CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => selectedOrder && printForPDF(selectedOrder)}>
                      <FileDown className="w-4 h-4 mr-1" />PDF
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setShowOrderDetails(false)}><X className="w-4 h-4" /></Button>
              </div>
            </DialogTitle>
            <DialogDescription>発注の詳細です。発注済みの場合は明細は編集できません。</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6" ref={printRef}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-base">案件・発注情報</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div><Label className="text-sm text-muted-foreground">案件名</Label><p className="font-medium">{selectedOrder.projectName}</p></div>
                    <div><Label className="text-sm text-muted-foreground">発注日</Label><p className="font-medium">{selectedOrder.orderDate}</p></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">仕入先</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div><Label className="text-sm text-muted-foreground">仕入先名</Label><p className="font-medium">{selectedOrder.supplierName ?? '仕入先未定'}</p></div>
                    {selectedOrder.supplierPhone && <div><Label className="text-sm text-muted-foreground">電話</Label><p className="font-medium flex items-center gap-1"><Phone className="w-3 h-3" />{selectedOrder.supplierPhone}</p></div>}
                    {selectedOrder.supplierEmail && <div><Label className="text-sm text-muted-foreground">メール</Label><p className="font-medium flex items-center gap-1"><Mail className="w-3 h-3" />{selectedOrder.supplierEmail}</p></div>}
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>発注材料一覧</span>
                    <Badge variant="outline" className="text-xs">{selectedOrder.materials.length}品目</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedOrder.materials.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{m.materialName}</span>
                            {m.isUnregistered && <Badge variant="secondary" className="text-xs">未登録</Badge>}
                            {m.isFromQuote && <Badge variant="outline" className="text-xs">見積</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{m.quantity} {m.unit} × ¥{m.unitPrice.toLocaleString()}</p>
                          {(m.supplierName || m.supplierId) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              仕入先: {m.supplierName || suppliers.find((s) => s.id === m.supplierId)?.name || '—'}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">¥{m.totalPrice.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-4" />
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <h3 className="font-medium">発注合計金額</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedOrder.materials.length}品目
                        {hasUnregistered(selectedOrder) && '（未登録材料を含むため合計は表示しません）'}
                      </p>
                    </div>
                    {showTotal(selectedOrder) ? (
                      <p className="text-xl font-bold">¥{selectedOrder.totalAmount.toLocaleString()}</p>
                    ) : (
                      <p className="text-muted-foreground">—</p>
                    )}
                  </div>
                  {selectedOrder.memo && <p className="mt-3 text-sm text-muted-foreground">備考: {selectedOrder.memo}</p>}
                </CardContent>
              </Card>
              {selectedOrder.updateHistory && selectedOrder.updateHistory.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">更新履歴</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm">
                      {[...selectedOrder.updateHistory].reverse().map((entry, i) => (
                        <li key={i} className="text-muted-foreground">
                          {entry.at.slice(0, 19).replace('T', ' ')} — {entry.action}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 発注編集（未発注のみ） */}
      <Dialog open={!!editingOrder} onOpenChange={(open) => { if (!open) setEditingOrder(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg">発注を編集</DialogTitle>
            <DialogDescription>
              {editingOrder && (
                <span className="block mt-1">
                  発注番号: <strong>{editingOrder.id}</strong>
                  {editingOrder.projectName && ` · ${editingOrder.projectName}`}
                </span>
              )}
              未発注の発注のみ編集できます。品目・数量・単位・仕入先・参考価格を変更し、保存すると更新履歴に残ります。
            </DialogDescription>
          </DialogHeader>
          {editingOrder && (
            <div className="flex-1 overflow-auto space-y-4 py-4 pr-1">
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm font-medium text-muted-foreground">明細（品目と数量は必須。単価は参考価格）</Label>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMaterials((prev) => [...prev, { id: `em-${Date.now()}`, materialName: '', quantity: 0, unit: '個', unitPrice: 0, totalPrice: 0, supplierId: '' }])}
                  >
                    <Plus className="w-4 h-4 mr-1" />行追加
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMaterials((prev) => [...prev, { id: `em-${Date.now()}`, materialName: '', quantity: 0, unit: '個', unitPrice: 0, totalPrice: 0, isUnregistered: true, supplierId: '' }])}
                  >
                    <Plus className="w-4 h-4 mr-1" />未登録を追加
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[22%]">品目・品番</TableHead>
                      <TableHead className="w-20">数量</TableHead>
                      <TableHead className="w-24">単位</TableHead>
                      <TableHead className="w-[18%]">仕入先</TableHead>
                      <TableHead className="w-24">参考価格</TableHead>
                      <TableHead className="w-14" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editMaterials.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="align-middle">
                          <div className="flex items-center gap-2">
                            <Input
                              value={m.materialName}
                              onChange={(e) => updateEditMaterial(m.id, { materialName: e.target.value })}
                              className="h-9"
                              placeholder={m.isUnregistered ? '品番' : '品目名'}
                            />
                            {m.isUnregistered && (
                              <Badge variant="secondary" className="text-xs shrink-0">未登録</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <Input
                            type="number"
                            min={0}
                            value={m.quantity ?? ''}
                            onChange={(e) => updateEditMaterial(m.id, { quantity: parseInt(e.target.value, 10) || 0 })}
                            className="h-9 w-20"
                          />
                        </TableCell>
                        <TableCell className="align-middle">
                          <Select value={m.unit} onValueChange={(v) => updateEditMaterial(m.id, { unit: v })}>
                            <SelectTrigger className="h-9 w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UNIT_OPTIONS.map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="align-middle">
                          <Select
                            value={m.supplierId || '__none__'}
                            onValueChange={(v) => updateEditMaterial(m.id, { supplierId: v === '__none__' ? '' : v })}
                          >
                            <SelectTrigger className="h-9 min-w-[120px]">
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
                        <TableCell className="align-middle">
                          <Input
                            type="number"
                            min={0}
                            value={m.unitPrice ?? ''}
                            onChange={(e) => updateEditMaterial(m.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                            className="h-9 w-24"
                            placeholder="—"
                          />
                        </TableCell>
                        <TableCell className="align-middle">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            onClick={() => setEditMaterials((prev) => prev.filter((x) => x.id !== m.id))}
                            title="行を削除"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setEditingOrder(null)}>キャンセル</Button>
            <Button onClick={saveEditOrder}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PurchaseHistory;
