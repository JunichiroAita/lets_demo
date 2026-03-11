import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
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
  ChevronRight,
  X,
  Briefcase,
  Send,
  User,
  CheckCircle,
} from 'lucide-react';
import PurchaseHistory from './Purchase_history';
import type { PurchaseOrderRecord } from './Purchase_history';

interface QuoteProject {
  id: string;
  customerName: string;
  projectName: string;
  status?: string;
  totalAmount: number;
  lastUpdated?: string;
  uploadedFiles?: any[];
  extractedItems?: any[];
  quoteItems: Array<{ id: number; item: string; quantity: number; unitPrice: number; amount: number; unit?: string }>;
}

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

interface PurchaseMaterialRow {
  id: string;
  projectId: string;
  projectName: string;
  materialName: string;
  materialCode?: string;
  quantity: number;
  unit: string;
  standardPrice?: number;
  selectedSupplierId?: string;
  supplierId?: string;
  supplierName?: string;
  unitPrice?: number;
  isFromQuote: boolean;
  quoteItemId?: number;
}

interface PurchaseProps {
  quoteProjects: QuoteProject[];
  materials: Material[];
  purchaseOrders: PurchaseOrderRecord[];
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrderRecord[]>>;
  customers: any[];
  onNavigateToQuote: () => void;
}

const Purchase: React.FC<PurchaseProps> = ({
  quoteProjects,
  materials,
  purchaseOrders,
  setPurchaseOrders,
  customers,
  onNavigateToQuote,
}) => {
  const [activeStep, setActiveStep] = useState(1);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [materialRows, setMaterialRows] = useState<PurchaseMaterialRow[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterByProject, setFilterByProject] = useState<string>('all');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showOrderMethodModal, setShowOrderMethodModal] = useState(false);
  const [selectedOrderMethod, setSelectedOrderMethod] = useState<'email' | 'phone' | 'individual' | ''>('');
  const [showAddMaterialForm, setShowAddMaterialForm] = useState(false);
  const [newMaterialCode, setNewMaterialCode] = useState('');
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialQuantity, setNewMaterialQuantity] = useState('');
  const [newMaterialUnit, setNewMaterialUnit] = useState('個');
  const [newMaterialPrice, setNewMaterialPrice] = useState('');
  const [newMaterialProjectId, setNewMaterialProjectId] = useState('');
  const [tab, setTab] = useState('new-order');

  const suppliers = useMemo(
    () =>
      (customers || [])
        .filter((c: any) => c.type === 'supplier' && c.isActive !== false)
        .map((s: any) => ({
          id: s.id,
          name: s.companyName,
          phone: s.phone || '',
          email: s.email || '',
          rating: s.rating ?? 0,
          reliability: s.reliability ?? 0,
          leadTime: s.leadTime || '-',
        })),
    [customers]
  );

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  };

  const generateMaterialRows = () => {
    if (selectedProjectIds.length === 0) {
      toast.error('プロジェクトを選択してください');
      return;
    }
    const rows: PurchaseMaterialRow[] = [];
    selectedProjectIds.forEach((projectId) => {
      const project = quoteProjects.find((qp) => qp.id === projectId);
      if (!project) return;
      (project.quoteItems || []).forEach((item) => {
        rows.push({
          id: `${projectId}-${item.id}`,
          projectId,
          projectName: project.projectName,
          materialName: item.item,
          quantity: item.quantity,
          unit: item.unit || '個',
          standardPrice: item.unitPrice,
          isFromQuote: true,
          quoteItemId: item.id,
        });
      });
    });
    setMaterialRows(rows);
    setActiveStep(2);
    if (rows.length === 0) {
      toast.info('選択したプロジェクトに見積材料がありません。「材料を追加」で手動追加できます。');
    } else {
      toast.success(`${selectedProjectIds.length}件のプロジェクトから${rows.length}件の材料を読み込みました`);
    }
  };

  const selectSupplierForMaterial = (materialId: string, supplierId: string) => {
    if (supplierId === '__none__') {
      setMaterialRows((prev) =>
        prev.map((row) =>
          row.id === materialId
            ? {
                ...row,
                selectedSupplierId: undefined,
                supplierId: undefined,
                supplierName: undefined,
                unitPrice: undefined,
              }
            : row
        )
      );
      return;
    }
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) return;
    setMaterialRows((prev) =>
      prev.map((row) =>
        row.id === materialId
          ? {
              ...row,
              selectedSupplierId: supplierId,
              supplierId,
              supplierName: supplier.name,
              unitPrice: row.standardPrice,
            }
          : row
      )
    );
  };

  const updateMaterialQuantity = (materialId: string, quantity: number) => {
    setMaterialRows((prev) =>
      prev.map((row) => (row.id === materialId ? { ...row, quantity } : row))
    );
  };

  const updateMaterialPrice = (materialId: string, price: number | undefined) => {
    setMaterialRows((prev) =>
      prev.map((row) => (row.id === materialId ? { ...row, standardPrice: price } : row))
    );
  };

  const addManualMaterial = () => {
    if (!newMaterialCode.trim() || !newMaterialQuantity.trim() || !newMaterialProjectId) {
      toast.error('品番、数量、プロジェクトは必須です');
      return;
    }
    const project = quoteProjects.find((qp) => qp.id === newMaterialProjectId);
    if (!project) {
      toast.error('プロジェクトが見つかりません');
      return;
    }
    const newRow: PurchaseMaterialRow = {
      id: `manual-${Date.now()}`,
      projectId: newMaterialProjectId,
      projectName: project.projectName,
      materialName: newMaterialName || newMaterialCode,
      materialCode: newMaterialCode,
      quantity: parseInt(newMaterialQuantity, 10) || 0,
      unit: newMaterialUnit,
      standardPrice: newMaterialPrice ? parseFloat(newMaterialPrice) : undefined,
      isFromQuote: false,
    };
    setMaterialRows((prev) => [...prev, newRow]);
    toast.success('材料を追加しました');
    setNewMaterialCode('');
    setNewMaterialName('');
    setNewMaterialQuantity('');
    setNewMaterialUnit('個');
    setNewMaterialPrice('');
    setNewMaterialProjectId('');
    setShowAddMaterialForm(false);
  };

  const removeMaterial = (materialId: string) => {
    setMaterialRows((prev) => prev.filter((row) => row.id !== materialId));
    toast.success('材料を削除しました');
  };

  const filteredMaterialRows = useMemo(() => {
    return materialRows.filter((row) => {
      const matchesSearch =
        row.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProject = filterByProject === 'all' || row.projectId === filterByProject;
      return matchesSearch && matchesProject;
    });
  }, [materialRows, searchTerm, filterByProject]);

  const groupedBySupplier = useMemo(() => {
    const groups: Record<string, PurchaseMaterialRow[]> = {};
    materialRows.forEach((row) => {
      if (row.selectedSupplierId) {
        const key = row.selectedSupplierId;
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
      }
    });
    return groups;
  }, [materialRows]);

  const canProceedToStep2 = selectedProjectIds.length > 0;
  const canProceedToStep3 = materialRows.length > 0;
  const canProceedToStep4 = materialRows.length > 0;

  const confirmOrder = () => {
    if (!canProceedToStep4) {
      toast.error('材料を選択してください');
      return;
    }
    setSelectedOrderMethod('');
    setShowOrderMethodModal(true);
  };

  const executeOrder = () => {
    if (!selectedOrderMethod) {
      toast.error('発注方法を選択してください');
      return;
    }
    if (Object.keys(groupedBySupplier).length === 0) {
      toast.error('少なくとも1件の材料に仕入先を選択してください');
      return;
    }

    const newOrders: PurchaseOrderRecord[] = [];
    Object.entries(groupedBySupplier).forEach(([supplierId, mats]) => {
      const supplier = suppliers.find((s) => s.id === supplierId);
      if (!supplier) return;
      const projectNames = Array.from(new Set(mats.map((m) => m.projectName))).join(', ');
      const totalAmount = mats.reduce(
        (sum, m) => sum + m.quantity * (m.unitPrice ?? m.standardPrice ?? 0),
        0
      );
      const firstProj = quoteProjects.find((qp) => qp.id === mats[0].projectId);
      const order: PurchaseOrderRecord = {
        id: `PO-${Date.now()}-${supplierId}`,
        projectId: mats[0].projectId,
        projectName: projectNames,
        customerName: firstProj?.customerName ?? '',
        supplierId,
        supplierName: supplier.name,
        supplierPhone: supplier.phone,
        supplierEmail: supplier.email,
        orderDate,
        expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'ordered',
        totalAmount,
        materials: mats.map((m) => ({
          id: m.id,
          materialName: m.materialName,
          quantity: m.quantity,
          unit: m.unit,
          unitPrice: m.unitPrice ?? m.standardPrice ?? 0,
          totalPrice: m.quantity * (m.unitPrice ?? m.standardPrice ?? 0),
          isFromQuote: m.isFromQuote,
        })),
        memo: `${mats.length}種類の材料を発注`,
      };
      newOrders.push(order);
    });

    setPurchaseOrders((prev) => [...prev, ...newOrders]);

    if (selectedOrderMethod === 'email') {
      toast.success(`${newOrders.length}件の発注を作成し、メールで発注依頼を送信しました`);
    } else if (selectedOrderMethod === 'phone') {
      toast.success(`${newOrders.length}件の発注を作成しました。各仕入先へ電話で発注依頼をしてください`);
    } else {
      toast.success(`${newOrders.length}件の発注を作成しました。個別に発注処理を進めてください`);
    }

    setShowOrderMethodModal(false);
    setActiveStep(1);
    setSelectedProjectIds([]);
    setMaterialRows([]);
    setSearchTerm('');
    setFilterByProject('all');
  };

  const steps = [
    { num: 1, label: 'プロジェクト選択', icon: Briefcase },
    { num: 2, label: '材料一覧', icon: Package },
    { num: 3, label: '仕入先選択', icon: Building2 },
    { num: 4, label: '確認', icon: CheckCircle },
  ];

  const getStepStatus = (stepNum: number) => {
    if (stepNum < activeStep) return 'completed';
    if (stepNum === activeStep) return 'current';
    return 'upcoming';
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v)} className="w-full">
        <TabsList>
          <TabsTrigger value="new-order">
            <Plus className="w-4 h-4 mr-2" />
            新規発注
          </TabsTrigger>
          <TabsTrigger value="history">
            <FileText className="w-4 h-4 mr-2" />
            発注履歴
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new-order" className="space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">購買管理</h1>
              <p className="text-muted-foreground">案件ごとの材料発注</p>
            </div>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                  const status = getStepStatus(step.num);
                  const Icon = step.icon;
                  return (
                    <div key={step.num} className="flex items-center flex-1">
                      <div className="flex flex-col items-center space-y-2 flex-1">
                        <div
                          className={`
                          flex items-center justify-center w-12 h-12 rounded-full border-2 transition-colors
                          ${status === 'completed' ? 'bg-[var(--success)] border-[var(--success)]' : ''}
                          ${status === 'current' ? 'bg-primary border-primary' : ''}
                          ${status === 'upcoming' ? 'bg-muted border-border' : ''}
                        `}
                        >
                          {status === 'completed' ? (
                            <CheckCircle className="w-6 h-6 text-white" />
                          ) : (
                            <Icon
                              className={`w-6 h-6 ${status === 'current' ? 'text-white' : 'text-muted-foreground'}`}
                            />
                          )}
                        </div>
                        <p
                          className={`text-sm font-medium ${status === 'current' ? 'text-foreground' : 'text-muted-foreground'}`}
                        >
                          {step.label}
                        </p>
                      </div>
                      {index < steps.length - 1 && (
                        <div className="flex-1 h-0.5 mx-4 bg-border" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {activeStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>ステップ1: プロジェクト選択（複数選択可）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Briefcase className="w-4 h-4" />
                  <AlertDescription>
                    発注したい材料が含まれるプロジェクトを選択してください。複数のプロジェクトを同時に選択できます。
                  </AlertDescription>
                </Alert>

                {quoteProjects.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building2 className="w-12 h-12 mx-auto opacity-20 mb-2" />
                    <p>プロジェクトがありません</p>
                    <Button variant="link" onClick={onNavigateToQuote} className="mt-2">
                      見積画面で新規プロジェクトを作成
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {quoteProjects.map((project) => (
                      <Card
                        key={project.id}
                        className={`cursor-pointer transition-all ${
                          selectedProjectIds.includes(project.id)
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => toggleProjectSelection(project.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              checked={selectedProjectIds.includes(project.id)}
                              onCheckedChange={() => toggleProjectSelection(project.id)}
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{project.projectName}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {project.customerName} • {(project.quoteItems || []).length}種類の材料
                                  </p>
                                </div>
                                <Badge variant="outline">¥{project.totalAmount.toLocaleString()}</Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedProjectIds.length > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {selectedProjectIds.length}件のプロジェクトを選択中
                    </p>
                    <Button onClick={generateMaterialRows} disabled={!canProceedToStep2}>
                      材料一覧を表示
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(activeStep === 2 || activeStep === 3) && (
            <Card>
              <CardHeader>
                <CardTitle>ステップ2&3: 材料一覧と仕入先選択</CardTitle>
                <div className="flex items-center space-x-4 mt-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="材料名、プロジェクト名で検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterByProject} onValueChange={setFilterByProject}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="プロジェクトで絞り込み" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべてのプロジェクト</SelectItem>
                      {selectedProjectIds.map((projectId) => {
                        const project = quoteProjects.find((qp) => qp.id === projectId);
                        return (
                          <SelectItem key={projectId} value={projectId}>
                            {project?.projectName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddMaterialForm(!showAddMaterialForm)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    材料を追加
                  </Button>
                </div>

                {showAddMaterialForm && (
                  <Card className="mb-4 border-primary/20 bg-primary/5">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">材料を追加</h4>
                        <Button variant="ghost" size="sm" onClick={() => setShowAddMaterialForm(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="new-material-code">
                            品番 <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="new-material-code"
                            value={newMaterialCode}
                            onChange={(e) => setNewMaterialCode(e.target.value)}
                            placeholder="例: A-123"
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-material-name">材料名（任意）</Label>
                          <Input
                            id="new-material-name"
                            value={newMaterialName}
                            onChange={(e) => setNewMaterialName(e.target.value)}
                            placeholder="例: H鋼"
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-material-project">
                            プロジェクト <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={newMaterialProjectId || '__none__'}
                            onValueChange={(v) => setNewMaterialProjectId(v === '__none__' ? '' : v)}
                          >
                            <SelectTrigger id="new-material-project">
                              <SelectValue placeholder="選択..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">選択してください</SelectItem>
                              {selectedProjectIds.map((projectId) => {
                                const project = quoteProjects.find((qp) => qp.id === projectId);
                                return project ? (
                                  <SelectItem key={projectId} value={projectId}>
                                    {project.projectName}
                                  </SelectItem>
                                ) : null;
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <Label htmlFor="new-material-quantity">
                            数量 <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="new-material-quantity"
                            type="number"
                            value={newMaterialQuantity}
                            onChange={(e) => setNewMaterialQuantity(e.target.value)}
                            placeholder="数量"
                            min={1}
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-material-unit">単位</Label>
                          <Select value={newMaterialUnit} onValueChange={setNewMaterialUnit}>
                            <SelectTrigger id="new-material-unit">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="個">個</SelectItem>
                              <SelectItem value="本">本</SelectItem>
                              <SelectItem value="枚">枚</SelectItem>
                              <SelectItem value="m">m</SelectItem>
                              <SelectItem value="m²">m²</SelectItem>
                              <SelectItem value="m³">m³</SelectItem>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="t">t</SelectItem>
                              <SelectItem value="式">式</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="new-material-price">参考価格（任意）</Label>
                          <Input
                            id="new-material-price"
                            type="number"
                            value={newMaterialPrice}
                            onChange={(e) => setNewMaterialPrice(e.target.value)}
                            placeholder="価格"
                            min={0}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button onClick={addManualMaterial} className="w-full">
                            <Plus className="w-4 h-4 mr-2" />
                            追加
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-56">プロジェクト</TableHead>
                      <TableHead>材料名</TableHead>
                      <TableHead className="w-24">数量</TableHead>
                      <TableHead className="w-32">参考価格</TableHead>
                      <TableHead className="w-64">仕入先</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaterialRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          材料が見つかりません
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMaterialRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Briefcase className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{row.projectName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{row.materialName}</p>
                              {row.materialCode && (
                                <p className="text-xs text-muted-foreground">品番: {row.materialCode}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Input
                                type="number"
                                value={row.quantity}
                                onChange={(e) =>
                                  updateMaterialQuantity(row.id, parseInt(e.target.value, 10) || 0)
                                }
                                className="w-20"
                                min={0}
                              />
                              <span className="text-sm text-muted-foreground">{row.unit}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={row.standardPrice ?? ''}
                              onChange={(e) =>
                                updateMaterialPrice(
                                  row.id,
                                  e.target.value ? parseFloat(e.target.value) : undefined
                                )
                              }
                              className="w-28"
                              placeholder="未設定"
                              min={0}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={row.selectedSupplierId ?? '__none__'}
                              onValueChange={(value) => selectSupplierForMaterial(row.id, value)}
                            >
                              <SelectTrigger
                                className={row.selectedSupplierId ? '' : 'border-[var(--warning)]'}
                              >
                                <SelectValue placeholder="仕入先を選択..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">仕入先を選択...</SelectItem>
                                {suppliers.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    <div className="flex items-center justify-between w-full">
                                      <span>{s.name}</span>
                                      <span className="text-xs text-muted-foreground ml-4">
                                        信頼度{s.reliability}%
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeMaterial(row.id)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActiveStep(1);
                      setMaterialRows([]);
                    }}
                  >
                    戻る
                  </Button>
                  <div className="flex items-center space-x-4">
                    <p className="text-sm text-muted-foreground">
                      {materialRows.filter((r) => r.selectedSupplierId).length} / {materialRows.length}{' '}
                      材料に仕入先を選択済み
                    </p>
                    <Button onClick={() => setActiveStep(4)} disabled={!canProceedToStep3}>
                      確認画面へ
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>ステップ4: 発注内容の確認</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <CheckCircle className="w-4 h-4" />
                  <AlertDescription>
                    以下の内容で発注を確定します。仕入先ごとに発注書が作成されます。
                  </AlertDescription>
                </Alert>
                {materialRows.some((m) => !m.selectedSupplierId) && (
                  <Alert className="border-[var(--warning)] bg-[var(--warning)]/10">
                    <AlertDescription>
                      仕入先が未選択の材料は発注に含まれません。発注対象にする場合はステップ2に戻り、仕入先を選択してください。
                    </AlertDescription>
                  </Alert>
                )}
                {Object.keys(groupedBySupplier).length === 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      1件以上の材料に仕入先を選択してください。ステップ2に戻り、各材料に仕入先を選択してから確認画面へ進んでください。
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label>発注日</Label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-48"
                  />
                </div>

                <Separator />

                {Object.entries(groupedBySupplier).map(([supplierId, mats]) => {
                  const supplier = suppliers.find((s) => s.id === supplierId);
                  if (!supplier) return null;
                  const totalAmount = mats.reduce(
                    (sum, m) => sum + m.quantity * (m.unitPrice ?? m.standardPrice ?? 0),
                    0
                  );
                  return (
                    <Card key={supplierId}>
                      <CardHeader className="bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">{supplier.name}</CardTitle>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {supplier.phone}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {supplier.email}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">発注金額</p>
                            <p className="text-xl font-bold">¥{totalAmount.toLocaleString()}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>プロジェクト</TableHead>
                              <TableHead>材料名</TableHead>
                              <TableHead className="text-right">数量</TableHead>
                              <TableHead className="text-right">単価</TableHead>
                              <TableHead className="text-right">金額</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mats.map((material) => (
                              <TableRow key={material.id}>
                                <TableCell className="text-sm">
                                  <Badge variant="outline">{material.projectName}</Badge>
                                </TableCell>
                                <TableCell>{material.materialName}</TableCell>
                                <TableCell className="text-right">
                                  {material.quantity} {material.unit}
                                </TableCell>
                                <TableCell className="text-right">
                                  ¥{(material.unitPrice ?? material.standardPrice ?? 0).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  ¥{(
                                    material.quantity *
                                    (material.unitPrice ?? material.standardPrice ?? 0)
                                  ).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  );
                })}

                <Separator />

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">発注総額</p>
                    <p className="text-sm">
                      {Object.keys(groupedBySupplier).length}社 • {materialRows.length}種類の材料
                    </p>
                  </div>
                  <p className="text-2xl font-bold">
                    ¥
                    {materialRows
                      .reduce(
                        (sum, m) =>
                          sum + m.quantity * (m.unitPrice ?? m.standardPrice ?? 0),
                        0
                      )
                      .toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <Button variant="outline" onClick={() => setActiveStep(2)}>
                    戻る
                  </Button>
                  <Button
                    onClick={confirmOrder}
                    disabled={Object.keys(groupedBySupplier).length === 0}
                    className="bg-[var(--success)] hover:opacity-90 text-white disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    発注を確定
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <PurchaseHistory purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders} />
        </TabsContent>
      </Tabs>

      <Dialog open={showOrderMethodModal} onOpenChange={setShowOrderMethodModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>発注方法を選択してください</DialogTitle>
            <DialogDescription>
              仕入先への発注方法を選択してください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <button
              type="button"
              onClick={() => setSelectedOrderMethod('email')}
              className={`w-full p-4 rounded-md border-2 transition-all text-left ${
                selectedOrderMethod === 'email'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    selectedOrderMethod === 'email' ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <Mail
                    className={`w-5 h-5 ${selectedOrderMethod === 'email' ? 'text-white' : 'text-muted-foreground'}`}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium">メール</p>
                  <p className="text-sm text-muted-foreground">
                    各仕入先にメールで発注依頼を送信します
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedOrderMethod('phone')}
              className={`w-full p-4 rounded-md border-2 transition-all text-left ${
                selectedOrderMethod === 'phone'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    selectedOrderMethod === 'phone' ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <Phone
                    className={`w-5 h-5 ${selectedOrderMethod === 'phone' ? 'text-white' : 'text-muted-foreground'}`}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium">電話</p>
                  <p className="text-sm text-muted-foreground">
                    各仕入先に電話で発注依頼をします
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedOrderMethod('individual')}
              className={`w-full p-4 rounded-md border-2 transition-all text-left ${
                selectedOrderMethod === 'individual'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    selectedOrderMethod === 'individual' ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <User
                    className={`w-5 h-5 ${
                      selectedOrderMethod === 'individual' ? 'text-white' : 'text-muted-foreground'
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium">個別</p>
                  <p className="text-sm text-muted-foreground">
                    後で個別に発注処理を進めます
                  </p>
                </div>
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderMethodModal(false)}>
              キャンセル
            </Button>
            <Button
              onClick={executeOrder}
              disabled={!selectedOrderMethod}
              className="bg-[var(--success)] hover:opacity-90 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              発注を確定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Purchase;
