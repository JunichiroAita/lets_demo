import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Plus, Edit, Search, Users, Truck, Filter, Archive, ArchiveRestore, Eye } from 'lucide-react';
import { toast } from 'sonner';
import SupplierDetail from './SupplierDetail';

export interface CustomerRecord {
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
  supplierMaterials?: Array<{ materialId: string; materialName: string; defaultUnitPrice?: number; unit?: string; isPreferred?: boolean; memo?: string }>;
  isActive: boolean;
}

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
  projectId: string;
  projectName: string;
  customerName: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  supplierEmail: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: string;
  totalAmount: number;
  materials: Array<{ id: string; materialName: string; quantity: number; unit: string; unitPrice: number; totalPrice: number; isFromQuote: boolean }>;
  memo?: string;
}

interface CustomerProps {
  customers: CustomerRecord[];
  setCustomers: React.Dispatch<React.SetStateAction<CustomerRecord[]>>;
  materials: Material[];
  purchaseOrders: PurchaseOrder[];
}

type CustomerSortKey = 'createdAt' | 'companyName' | 'contactPerson';
type CustomerSortDir = 'asc' | 'desc';

const Customer: React.FC<CustomerProps> = ({ customers, setCustomers, materials, purchaseOrders }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'supplier'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortKey, setSortKey] = useState<CustomerSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<CustomerSortDir>('desc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<CustomerRecord | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    memo: '',
    type: 'customer' as 'customer' | 'supplier',
    rating: 0,
    reliability: 0,
    leadTime: '',
    supplierMaterials: [] as CustomerRecord['supplierMaterials']
  });

  const filteredAndSortedCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = customers.filter(customer => {
      const matchesType = typeFilter === 'all' || customer.type === typeFilter;
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && customer.isActive) ||
        (statusFilter === 'inactive' && !customer.isActive);
      const matchesSearch = !term ||
        customer.companyName.toLowerCase().includes(term) ||
        (customer.contactPerson?.toLowerCase() || '').includes(term) ||
        (customer.email?.toLowerCase() || '').includes(term) ||
        (customer.phone?.toLowerCase() || '').includes(term) ||
        (customer.address?.toLowerCase() || '').includes(term) ||
        (customer.memo?.toLowerCase() || '').includes(term);
      return matchesType && matchesStatus && matchesSearch;
    });
    list = [...list].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (sortKey === 'createdAt') {
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const cmp = String(aVal).localeCompare(String(bVal), 'ja');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [customers, typeFilter, statusFilter, searchTerm, sortKey, sortDir]);

  const openCreateDialog = () => {
    setEditingCustomer(null);
    setFormData({
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      memo: '',
      type: 'customer',
      rating: 0,
      reliability: 0,
      leadTime: '',
      supplierMaterials: []
    });
    setIsModalOpen(true);
  };

  const openEditDialog = (customer: CustomerRecord) => {
    setEditingCustomer(customer);
    setFormData({
      companyName: customer.companyName,
      contactPerson: customer.contactPerson || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      memo: customer.memo || '',
      type: customer.type,
      rating: customer.rating || 0,
      reliability: customer.reliability || 0,
      leadTime: customer.leadTime || '',
      supplierMaterials: customer.supplierMaterials || []
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.companyName.trim()) {
      toast.error('名称は必須項目です');
      return;
    }

    if (editingCustomer) {
      setCustomers(prev => prev.map(c =>
        c.id === editingCustomer.id
          ? {
              ...editingCustomer,
              ...formData,
              companyName: formData.companyName,
              contactPerson: formData.contactPerson || '',
              email: formData.email || '',
              phone: formData.phone || '',
              address: formData.address,
              memo: formData.memo,
              type: formData.type,
              rating: formData.type === 'supplier' ? formData.rating : undefined,
              reliability: formData.type === 'supplier' ? formData.reliability : undefined,
              leadTime: formData.type === 'supplier' ? formData.leadTime : undefined,
              supplierMaterials: formData.type === 'supplier' ? formData.supplierMaterials : undefined
            }
          : c
      ));
      toast.success(`${formData.type === 'customer' ? '顧客' : '仕入先'}を更新しました`);
    } else {
      const newId = `${formData.type === 'customer' ? 'CUST' : 'SUPP'}-${String(customers.filter(c => c.type === formData.type).length + 1).padStart(3, '0')}`;
      const newCustomer: CustomerRecord = {
        id: newId,
        companyName: formData.companyName,
        contactPerson: formData.contactPerson || '',
        email: formData.email || '',
        phone: formData.phone || '',
        address: formData.address,
        memo: formData.memo,
        type: formData.type,
        rating: formData.type === 'supplier' ? formData.rating : undefined,
        reliability: formData.type === 'supplier' ? formData.reliability : undefined,
        leadTime: formData.type === 'supplier' ? formData.leadTime : undefined,
        supplierMaterials: formData.type === 'supplier' ? formData.supplierMaterials : undefined,
        createdAt: new Date().toISOString().split('T')[0],
        isActive: true
      };
      setCustomers(prev => [...prev, newCustomer]);
      toast.success(`${formData.type === 'customer' ? '顧客' : '仕入先'}を追加しました`);
    }
    setIsModalOpen(false);
  };

  const sortValue = `${sortKey}-${sortDir}`;
  const setSort = (value: string) => {
    const [k, d] = value.split('-') as [CustomerSortKey, CustomerSortDir];
    if (k && d) {
      setSortKey(k);
      setSortDir(d);
    }
  };

  const toggleActive = (customer: CustomerRecord) => {
    const newActiveState = !customer.isActive;
    const actionText = newActiveState ? '有効化' : '無効化';
    if (confirm(`「${customer.companyName}」を${actionText}してもよろしいですか？`)) {
      setCustomers(prev => prev.map(c =>
        c.id === customer.id ? { ...c, isActive: newActiveState } : c
      ));
      toast.success(`${customer.type === 'customer' ? '顧客' : '仕入先'}を${actionText}しました`);
    }
  };

  return (
    <>
      {viewMode === 'list' ? (
        <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1>顧客・仕入先管理</h1>
              <p className="text-muted-foreground">顧客と仕入先の情報を一元管理</p>
            </div>
          </div>

          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="名称・担当者・メール・電話・住所・メモで検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={openCreateDialog} className="bg-primary hover:bg-primary-hover">
                    <Plus className="w-4 h-4 mr-2" />
                    新規登録
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">種別:</Label>
                    <Select value={typeFilter} onValueChange={(v: string) => setTypeFilter(v as 'all' | 'customer' | 'supplier')}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="種別" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて</SelectItem>
                        <SelectItem value="customer">顧客</SelectItem>
                        <SelectItem value="supplier">仕入先</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">状態:</Label>
                    <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v as 'all' | 'active' | 'inactive')}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="状態" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて</SelectItem>
                        <SelectItem value="active">有効</SelectItem>
                        <SelectItem value="inactive">無効</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">並び替え:</Label>
                    <Select value={sortValue} onValueChange={setSort}>
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="並び替え" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="createdAt-desc">作成日が新しい順</SelectItem>
                        <SelectItem value="createdAt-asc">作成日が古い順</SelectItem>
                        <SelectItem value="companyName-asc">名称（あいうえお順）</SelectItem>
                        <SelectItem value="companyName-desc">名称（逆順）</SelectItem>
                        <SelectItem value="contactPerson-asc">担当者名順</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm text-muted-foreground ml-auto">
                    {filteredAndSortedCustomers.length}件 / 全{customers.length}件
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">ID</TableHead>
                    <TableHead className="w-24">種別</TableHead>
                    <TableHead className="w-24">状態</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>担当者</TableHead>
                    <TableHead>メール</TableHead>
                    <TableHead>電話番号</TableHead>
                    <TableHead className="w-32">登録日</TableHead>
                    <TableHead className="text-center w-40">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12">
                        <Users className="w-12 h-12 mx-auto opacity-20 mb-2 text-muted-foreground" />
                        <p className="text-muted-foreground">条件に一致するデータが見つかりません</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedCustomers.map((customer) => (
                      <TableRow key={customer.id} className={!customer.isActive ? 'opacity-50' : ''}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{customer.id}</TableCell>
                        <TableCell>
                          <Badge variant={customer.type === 'customer' ? 'default' : 'outline'}>
                            {customer.type === 'customer' ? <><Users className="w-3 h-3 mr-1" />顧客</> : <><Truck className="w-3 h-3 mr-1" />仕入先</>}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={customer.isActive ? 'outline' : 'secondary'} className={customer.isActive ? 'border-green-600 text-green-600' : ''}>
                            {customer.isActive ? '有効' : '無効'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{customer.companyName}</TableCell>
                        <TableCell className="text-sm">{customer.contactPerson || '-'}</TableCell>
                        <TableCell className="text-sm">{customer.email || '-'}</TableCell>
                        <TableCell className="text-sm">{customer.phone || '-'}</TableCell>
                        <TableCell className="text-sm">{customer.createdAt}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center space-x-2">
                            {customer.type === 'supplier' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSelectedSupplier(customer); setViewMode('detail'); }}
                                className="h-8 w-8 p-0"
                                title="詳細"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(customer)} className="h-8 w-8 p-0" title="編集">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActive(customer)}
                              className={`h-8 w-8 p-0 ${customer.isActive ? 'text-amber-600 hover:bg-amber-500/10' : 'text-green-600 hover:bg-green-500/10'}`}
                              title={customer.isActive ? '無効化' : '有効化'}
                            >
                              {customer.isActive ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingCustomer ? `${formData.type === 'customer' ? '顧客' : '仕入先'}を編集` : '新規登録'}</DialogTitle>
                <DialogDescription>必須項目（*）を入力してください</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="type">種別 *</Label>
                    <Select value={formData.type} onValueChange={(v: string) => setFormData({ ...formData, type: v as 'customer' | 'supplier' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer"><div className="flex items-center space-x-2"><Users className="w-4 h-4" /><span>顧客</span></div></SelectItem>
                        <SelectItem value="supplier"><div className="flex items-center space-x-2"><Truck className="w-4 h-4" /><span>仕入先</span></div></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="companyName">名称 *</Label>
                    <Input id="companyName" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} placeholder="例：株式会社〇〇" />
                  </div>
                  <div>
                    <Label htmlFor="contactPerson">担当者</Label>
                    <Input id="contactPerson" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} placeholder="例：山田太郎" />
                  </div>
                  <div>
                    <Label htmlFor="phone">電話番号</Label>
                    <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="例：03-1234-5678" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="email">メールアドレス</Label>
                    <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="例：example@company.com" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="address">住所</Label>
                    <Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="例：東京都〇〇区△△1-2-3" />
                  </div>
                  {formData.type === 'supplier' && (
                    <>
                      <div>
                        <Label htmlFor="leadTime">リードタイム</Label>
                        <Input id="leadTime" value={formData.leadTime} onChange={(e) => setFormData({ ...formData, leadTime: e.target.value })} placeholder="例：3営業日" />
                      </div>
                      <div>
                        <Label htmlFor="rating">評価（1-5）</Label>
                        <Input id="rating" type="number" min="0" max="5" step="0.1" value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="reliability">信頼度（%）</Label>
                        <Input id="reliability" type="number" min="0" max="100" value={formData.reliability} onChange={(e) => setFormData({ ...formData, reliability: parseInt(e.target.value) || 0 })} />
                      </div>
                    </>
                  )}
                  <div className="col-span-2">
                    <Label htmlFor="memo">メモ</Label>
                    <Textarea id="memo" value={formData.memo} onChange={(e) => setFormData({ ...formData, memo: e.target.value })} placeholder="特記事項など" rows={3} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>キャンセル</Button>
                <Button onClick={handleSave} className="bg-primary hover:bg-primary-hover">{editingCustomer ? '更新' : '作成'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        selectedSupplier && (
          <SupplierDetail
            supplier={selectedSupplier}
            materials={materials}
            purchaseOrders={purchaseOrders}
            onBack={() => setViewMode('list')}
          />
        )
      )}
    </>
  );
};

export default Customer;
