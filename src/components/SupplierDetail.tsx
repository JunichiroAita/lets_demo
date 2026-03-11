import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Package, History, TrendingDown, X } from 'lucide-react';


interface Material {
  id: string;
  name: string;
  unit: string;
  category: string;
  standardPrice: number;
  code: string;
  memo?: string;
}

interface Customer {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  memo?: string;
  createdAt: string;
  type: 'customer' | 'supplier';
  rating?: number;
  reliability?: number;
  leadTime?: string;
  supplierMaterials?: Array<{
    materialId: string;
    materialName: string;
    defaultUnitPrice?: number;
    unit?: string;
    isPreferred?: boolean;
    memo?: string;
  }>;
  isActive: boolean;
}

interface PurchaseOrder {
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
  status: 'ordered' | 'confirmed' | 'shipping' | 'delivered' | 'completed' | 'cancelled';
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

interface SupplierDetailProps {
  supplier: Customer;
  materials: Material[];
  purchaseOrders: PurchaseOrder[];
  onBack: () => void;
}

const SupplierDetail: React.FC<SupplierDetailProps> = ({
  supplier,
  materials,
  purchaseOrders,
  onBack
}) => {
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const supplierOrders = useMemo(() => {
    return purchaseOrders.filter(order => order.supplierId === supplier.id);
  }, [supplier, purchaseOrders]);

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
    ordered: '進行中',
    confirmed: '進行中',
    shipping: '進行中',
    delivered: '完了',
    completed: '完了',
    cancelled: '失注'
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
        <div className="flex items-center space-x-2 pb-2 border-b-2 border-border">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">取扱材料一覧</h2>
        </div>
        <Card>
          <CardContent className="p-0">
            {supplier.supplierMaterials && supplier.supplierMaterials.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>材料名</TableHead>
                    <TableHead className="w-32">単位</TableHead>
                    <TableHead className="w-32">優先仕入先</TableHead>
                    <TableHead>備考</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.supplierMaterials.map((material, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{material.materialName}</TableCell>
                      <TableCell className="text-sm">{material.unit || '-'}</TableCell>
                      <TableCell>
                        {material.isPreferred && (
                          <Badge className="bg-primary text-white">優先</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{material.memo || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto opacity-20 mb-2" />
                <p>登録された材料はありません</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                    <TableRow key={order.id}>
                      <TableCell>
                        <span className="text-primary font-medium">{order.id}</span>
                      </TableCell>
                      <TableCell className="font-medium">{order.projectName}</TableCell>
                      <TableCell className="text-sm">{order.orderDate.replace(/-/g, '/')}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.status] || 'bg-gray-500 text-white'}>
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
