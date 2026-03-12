import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { ArrowLeft, Package, History, TrendingDown, X, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CustomerRecord } from './Customer';

interface Material {
  id: string;
  name: string;
  unit: string;
  category: string;
  standardPrice: number;
  code: string;
  memo?: string;
}

interface PurchaseOrder {
  id: string;
  projectId?: string;
  projectName: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  status: string;
  supplierId?: string;
  materials: Array<{ materialName: string; quantity: number; unit: string; unitPrice: number }>;
}

interface SupplierDetailProps {
  supplier: CustomerRecord;
  materials: Material[];
  purchaseOrders: PurchaseOrder[];
  setCustomers: React.Dispatch<React.SetStateAction<CustomerRecord[]>>;
  onBack: () => void;
  onOrderClick?: (orderId: string) => void;
}

const SupplierDetail: React.FC<SupplierDetailProps> = ({
  supplier,
  materials,
  purchaseOrders,
  setCustomers,
  onBack,
  onOrderClick,
}) => {
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [addMaterialOpen, setAddMaterialOpen] = useState(false);
  const [selectedMaterialIdToAdd, setSelectedMaterialIdToAdd] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ materialId: string; materialName: string } | null>(null);

  const supplierOrders = useMemo(() => {
    return purchaseOrders.filter((order) => order.supplierId === supplier.id);
  }, [supplier.id, purchaseOrders]);

  const addMaterialLink = () => {
    const mat = materials.find((m) => m.id === selectedMaterialIdToAdd);
    if (!mat || (supplier.supplierMaterials ?? []).some((sm) => sm.materialId === mat.id)) {
      toast.error('未選択または既に登録済みです');
      return;
    }
    const newLink = {
      materialId: mat.id,
      materialName: mat.name,
      unit: mat.unit,
      isPreferred: false,
    };
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === supplier.id
          ? { ...c, supplierMaterials: [...(c.supplierMaterials ?? []), newLink] }
          : c
      )
    );
    toast.success('材料を紐づけました');
    setAddMaterialOpen(false);
    setSelectedMaterialIdToAdd('');
  };

  const updatePreferred = (materialId: string, isPreferred: boolean) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === supplier.id
          ? {
              ...c,
              supplierMaterials: (c.supplierMaterials ?? []).map((sm) =>
                sm.materialId === materialId ? { ...sm, isPreferred } : sm
              ),
            }
          : c
      )
    );
    toast.success('優先仕入先フラグを更新しました');
  };

  const removeMaterialLink = (materialId: string, materialName: string) => {
    setDeleteConfirm({ materialId, materialName });
  };

  const doRemoveMaterialLink = () => {
    if (!deleteConfirm) return;
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === supplier.id
          ? { ...c, supplierMaterials: (c.supplierMaterials ?? []).filter((sm) => sm.materialId !== deleteConfirm.materialId) }
          : c
      )
    );
    toast.success('紐づけを削除しました');
    setDeleteConfirm(null);
  };

  const supplierMaterials = supplier.supplierMaterials ?? [];

  const materialPriceHistory = useMemo(() => {
    const historyList: Array<{
      materialName: string;
      orderDate: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      orderId: string;
      projectName: string;
    }> = [];

    supplierOrders.forEach(order => {
      order.materials.forEach(material => {
        historyList.push({
          materialName: material.materialName,
          orderDate: order.orderDate,
          quantity: material.quantity,
          unit: material.unit,
          unitPrice: material.unitPrice,
          orderId: order.id,
          projectName: order.projectName
        });
      });
    });

    let filtered = historyList;
    if (selectedMaterial !== 'all') {
      filtered = filtered.filter(item => item.materialName === selectedMaterial);
    }
    if (dateFrom) filtered = filtered.filter(item => item.orderDate >= dateFrom);
    if (dateTo) filtered = filtered.filter(item => item.orderDate <= dateTo);

    return filtered.sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  }, [supplierOrders, selectedMaterial, dateFrom, dateTo]);

  const materialNameList = useMemo(() => {
    const names = new Set<string>();
    supplierOrders.forEach(order => {
      order.materials.forEach(material => names.add(material.materialName));
    });
    return Array.from(names).sort();
  }, [supplierOrders]);

  const resetFilters = () => {
    setSelectedMaterial('all');
    setDateFrom('');
    setDateTo('');
  };

  const statusColors: Record<string, string> = {
    ordered: 'bg-blue-500 text-white',
    confirmed: 'bg-blue-500 text-white',
    shipping: 'bg-blue-500 text-white',
    delivered: 'bg-green-500 text-white',
    completed: 'bg-gray-500 text-white',
    cancelled: 'bg-red-500 text-white'
  };

  const statusLabels: Record<string, string> = {
    ordered: '発注済み',
    not_ordered: '未発注',
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={onBack} className="flex items-center space-x-2">
          <ArrowLeft className="w-4 h-4" />
          <span>仕入先一覧</span>
        </Button>
      </div>

      <h1>仕入先詳細</h1>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">仕入先名</Label>
                <div className="text-sm mt-1">{supplier.companyName}</div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">担当者名</Label>
                <div className="text-sm mt-1">{supplier.contactPerson || '-'}</div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">電話番号</Label>
                <div className="text-sm mt-1">{supplier.phone || '-'}</div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">メールアドレス</Label>
                <div className="text-sm mt-1">{supplier.email || '-'}</div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">備考</Label>
                <div className="text-sm mt-1">{supplier.memo || '-'}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b-2 border-border">
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">取扱材料（US-1004）</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAddMaterialOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />材料を追加
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            {supplierMaterials.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>品目名</TableHead>
                    <TableHead className="w-32">単位</TableHead>
                    <TableHead className="w-32">優先仕入先</TableHead>
                    <TableHead className="w-24">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierMaterials.map((material) => (
                    <TableRow key={material.materialId}>
                      <TableCell className="font-medium">{material.materialName}</TableCell>
                      <TableCell className="text-sm">{material.unit || '-'}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => updatePreferred(material.materialId, !material.isPreferred)}
                        >
                          {material.isPreferred ? <Badge className="bg-primary text-white">優先</Badge> : <Badge variant="outline">—</Badge>}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="編集（優先フラグ）" onClick={() => updatePreferred(material.materialId, !material.isPreferred)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" title="削除" onClick={() => removeMaterialLink(material.materialId, material.materialName)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto opacity-20 mb-2" />
                <p>登録された材料はありません。「材料を追加」から材料マスタで紐づけできます。</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={addMaterialOpen} onOpenChange={setAddMaterialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>材料を追加（US-0306）</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>材料マスタから品目を選択</Label>
            <Select value={selectedMaterialIdToAdd} onValueChange={setSelectedMaterialIdToAdd}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="選択..." />
              </SelectTrigger>
              <SelectContent>
                {materials
                  .filter((m) => !supplierMaterials.some((sm) => sm.materialId === m.id))
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}（{m.unit}）</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMaterialOpen(false)}>キャンセル</Button>
            <Button onClick={addMaterialLink}>紐づけ登録</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>紐づけを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>{deleteConfirm ? `「${deleteConfirm.materialName}」の紐づけを削除します。` : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={doRemoveMaterialLink} className="bg-destructive text-destructive-foreground">削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b-2 border-border">
          <History className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">発注履歴</h2>
        </div>
        <Card>
          <CardContent className="p-0">
            {supplierOrders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">発注番号</TableHead>
                    <TableHead>案件名</TableHead>
                    <TableHead className="w-40">発注日</TableHead>
                    <TableHead className="w-32">ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className={onOrderClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                      onClick={() => onOrderClick?.(order.id)}
                    >
                      <TableCell>
                        <span className="text-primary font-medium">{order.id}</span>
                      </TableCell>
                      <TableCell className="font-medium">{order.projectName}</TableCell>
                      <TableCell className="text-sm">{order.orderDate.replace(/-/g, '/')}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.status] || 'bg-muted'}>
                          {statusLabels[order.status] || order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mx-auto opacity-20 mb-2" />
                <p>発注履歴はありません</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b-2 border-border">
          <TrendingDown className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">材料別 価格・数量履歴</h2>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <Label className="text-sm mb-2">材料で絞り込む</Label>
                <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                  <SelectTrigger>
                    <SelectValue placeholder="すべての材料" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての材料</SelectItem>
                    {materialNameList.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-sm mb-2">期間で絞り込む（開始）</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="flex-1">
                <Label className="text-sm mb-2">期間で絞り込む（終了）</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <Button variant="ghost" onClick={resetFilters} className="flex items-center space-x-1">
                <X className="w-4 h-4" />
                <span>リセット</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {materialPriceHistory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>材料名</TableHead>
                    <TableHead className="w-40">発注日</TableHead>
                    <TableHead className="text-right w-32">数量</TableHead>
                    <TableHead className="text-right w-32">単価</TableHead>
                    <TableHead className="w-32">発注番号</TableHead>
                    <TableHead>案件名</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialPriceHistory.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.materialName}</TableCell>
                      <TableCell className="text-sm">{item.orderDate.replace(/-/g, '/')}</TableCell>
                      <TableCell className="text-right">{item.quantity.toLocaleString()} {item.unit}</TableCell>
                      <TableCell className="text-right">¥{item.unitPrice.toLocaleString()}</TableCell>
                      <TableCell><span className="text-primary font-medium">{item.orderId}</span></TableCell>
                      <TableCell className="text-sm">{item.projectName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingDown className="w-12 h-12 mx-auto opacity-20 mb-2" />
                <p>該当する履歴はありません</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SupplierDetail;
