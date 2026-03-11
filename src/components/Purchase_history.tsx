import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Phone, Mail, Package, Building2, FileText, Search, Eye, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

export interface PurchaseOrderRecord {
  id: string;
  projectId: string;
  projectName: string;
  customerName: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  supplierEmail: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: 'not_ordered' | 'ordered';
  totalAmount: number;
  materials: Array<{
    id: string;
    materialName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    isFromQuote: boolean;
  }>;
  memo?: string;
}

interface PurchaseHistoryProps {
  purchaseOrders: PurchaseOrderRecord[];
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrderRecord[]>>;
}

const PurchaseHistory: React.FC<PurchaseHistoryProps> = ({ purchaseOrders, setPurchaseOrders }) => {
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historySortBy, setHistorySortBy] = useState<string>('orderDate');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderRecord | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState<boolean>(false);

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

  const filteredAndSortedOrders = [...purchaseOrders]
    .filter(order => {
      const matchesSearch = order.projectName.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        order.supplierName.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(historySearchTerm.toLowerCase());
      const matchesStatus = historyStatusFilter === 'all' || order.status === historyStatusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (historySortBy) {
        case 'orderDate': return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
        case 'expectedDeliveryDate': return new Date(b.expectedDeliveryDate).getTime() - new Date(a.expectedDeliveryDate).getTime();
        case 'totalAmount': return b.totalAmount - a.totalAmount;
        case 'projectName': return a.projectName.localeCompare(b.projectName);
        case 'supplierName': return a.supplierName.localeCompare(b.supplierName);
        default: return 0;
      }
    });

  const updateOrderStatus = (orderId: string, newStatus: PurchaseOrderRecord['status']) => {
    setPurchaseOrders(prev => prev.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
    toast.success(`ステータスを「${getStatusLabel(newStatus)}」に更新しました`);
  };

  return (
    <>
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-primary" />
              <span>発注履歴</span>
            </div>
            <Badge variant="outline" className="text-xs">{filteredAndSortedOrders.length}件の発注</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input placeholder="プロジェクト名、顧客名、仕入先名、発注IDで検索..." value={historySearchTerm} onChange={(e) => setHistorySearchTerm(e.target.value)} className="flex-1" />
            </div>
            <div className="flex items-center space-x-2">
              <Label>ステータス:</Label>
              <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">全て</SelectItem><SelectItem value="ordered">発注済み</SelectItem><SelectItem value="not_ordered">未発注</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Label>並び替え:</Label>
              <Select value={historySortBy} onValueChange={setHistorySortBy}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="orderDate">発注日順</SelectItem><SelectItem value="expectedDeliveryDate">納期順</SelectItem><SelectItem value="totalAmount">金額順</SelectItem><SelectItem value="projectName">プロジェクト名</SelectItem><SelectItem value="supplierName">仕入先名</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredAndSortedOrders.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">発注履歴がありません</h3>
                <p className="text-sm text-muted-foreground mb-4">まだ発注が作成されていません</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredAndSortedOrders.map((order) => (
                  <Card key={order.id} className="cursor-pointer transition-all hover:shadow-md border-border hover:border-primary/50" onClick={() => { setSelectedOrder(order); setShowOrderDetails(true); }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-medium">{order.id}</h4>
                            <Badge variant={getStatusBadgeVariant(order.status)} className={`text-xs ${getStatusBadgeClassName(order.status)}`}>{getStatusLabel(order.status)}</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-3 text-sm">
                            <div><p className="text-muted-foreground">プロジェクト</p><p className="font-medium">{order.projectName}</p><p className="text-xs text-muted-foreground">{order.customerName}</p></div>
                            <div><p className="text-muted-foreground">仕入先</p><p className="font-medium">{order.supplierName}</p><p className="text-xs text-muted-foreground">{order.supplierPhone}</p></div>
                            <div><p className="text-muted-foreground">発注日</p><p className="font-medium">{order.orderDate}</p><p className="text-xs text-muted-foreground">納期予定: {order.expectedDeliveryDate}</p></div>
                            <div><p className="text-muted-foreground">金額</p><p className="font-medium text-primary">¥{order.totalAmount.toLocaleString()}</p><p className="text-xs text-muted-foreground">{order.materials.length}品目</p></div>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                            <Package className="w-3 h-3" />
                            <span>{order.materials.slice(0, 2).map(m => m.materialName).join(', ')}{order.materials.length > 2 && ` 他${order.materials.length - 2}件`}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                          {order.status === 'ordered' && <Button variant="outline" size="sm" onClick={() => updateOrderStatus(order.id, 'not_ordered')} className="text-xs">未発注にする</Button>}
                          {order.status === 'not_ordered' && <Button variant="outline" size="sm" onClick={() => updateOrderStatus(order.id, 'ordered')} className="text-xs">発注済みにする</Button>}
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => { setSelectedOrder(order); setShowOrderDetails(true); }}><Eye className="w-3 h-3 mr-1" />詳細</Button>
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

      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span>発注詳細: {selectedOrder?.id}</span>
                <Badge variant={selectedOrder ? getStatusBadgeVariant(selectedOrder.status) : 'outline'} className={`text-xs ${selectedOrder ? getStatusBadgeClassName(selectedOrder.status) : ''}`}>{selectedOrder ? getStatusLabel(selectedOrder.status) : ''}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowOrderDetails(false)}><X className="w-4 h-4" /></Button>
            </DialogTitle>
            <DialogDescription>発注の詳細情報を表示しています</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card><CardHeader><CardTitle className="text-base flex items-center"><Building2 className="w-4 h-4 mr-2" />プロジェクト情報</CardTitle></CardHeader><CardContent className="space-y-3"><div><Label className="text-sm text-muted-foreground">プロジェクト名</Label><p className="font-medium">{selectedOrder.projectName}</p></div><div><Label className="text-sm text-muted-foreground">顧客名</Label><p className="font-medium">{selectedOrder.customerName}</p></div><div className="grid grid-cols-2 gap-4"><div><Label className="text-sm text-muted-foreground">発注日</Label><p className="font-medium">{selectedOrder.orderDate}</p></div><div><Label className="text-sm text-muted-foreground">納期予定</Label><p className="font-medium">{selectedOrder.expectedDeliveryDate}</p></div></div></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base flex items-center"><Building2 className="w-4 h-4 mr-2" />仕入先情報</CardTitle></CardHeader><CardContent className="space-y-3"><div><Label className="text-sm text-muted-foreground">仕入先名</Label><p className="font-medium">{selectedOrder.supplierName}</p></div><div><Label className="text-sm text-muted-foreground">電話番号</Label><p className="font-medium flex items-center"><Phone className="w-3 h-3 mr-1" />{selectedOrder.supplierPhone}</p></div><div><Label className="text-sm text-muted-foreground">メールアドレス</Label><p className="font-medium flex items-center"><Mail className="w-3 h-3 mr-1" />{selectedOrder.supplierEmail}</p></div></CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle className="text-base flex items-center justify-between"><div className="flex items-center"><Package className="w-4 h-4 mr-2" />発注材料一覧</div><Badge variant="outline" className="text-xs">{selectedOrder.materials.length}品目</Badge></CardTitle></CardHeader><CardContent><div className="space-y-3">{selectedOrder.materials.map((material) => (<div key={material.id} className="flex items-center justify-between p-3 bg-muted rounded-lg"><div className="flex-1"><div className="flex items-center space-x-2"><span className="font-medium">{material.materialName}</span>{material.isFromQuote && <Badge variant="outline" className="text-xs bg-primary/10 text-primary">見積もり</Badge>}</div><p className="text-sm text-muted-foreground">{material.quantity} {material.unit} × ¥{material.unitPrice.toLocaleString()}</p></div><div className="text-right"><p className="font-medium">¥{material.totalPrice.toLocaleString()}</p></div></div>))}</div><Separator className="my-4" /><div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg"><div><h3 className="font-medium text-primary">発注合計金額</h3><p className="text-sm text-muted-foreground">{selectedOrder.materials.length}品目 (税別・配送料込み)</p></div><div className="text-right"><p className="text-2xl font-medium text-primary">¥{selectedOrder.totalAmount.toLocaleString()}</p></div></div></CardContent></Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PurchaseHistory;
