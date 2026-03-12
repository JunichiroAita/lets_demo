import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Plus, Search, Edit2, Archive, Eye, Building2, ArrowUpDown, ArrowUp, ArrowDown, FileText, Receipt, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useAudit } from '../contexts/AuditContext';
import { useAuth } from '../contexts/AuthContext';

export interface ProjectRecord {
  id: string;
  projectName: string;
  customerName: string;
  startDate: string;
  endDate: string;
  assignee: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'lost' | 'on-hold';
  memo?: string;
  createdAt: string;
  archived: boolean;
}

interface EstimateRecord {
  id: string;
  projectName: string;
  customerName: string;
  estimateNumber: string;
  status: string;
}

interface InvoiceRecord {
  id: string;
  projectName: string;
  customerName: string;
  invoiceNumber: string;
  status: string;
}

interface PurchaseOrderRecord {
  id: string;
  projectName: string;
  customerName?: string;
  status: string;
}

interface ProjectsProps {
  customers: { id: string; companyName: string; type?: string }[];
  setCustomers: React.Dispatch<React.SetStateAction<any[]>>;
  estimates?: EstimateRecord[];
  invoices?: InvoiceRecord[];
  purchaseOrders?: PurchaseOrderRecord[];
  onOpenEstimate?: (id: string) => void;
  onOpenInvoice?: (id: string) => void;
  onOpenPurchaseOrder?: (id: string) => void;
}

type SortKey = 'projectName' | 'customerName' | 'status' | 'startDate' | 'endDate' | 'assignee' | 'createdAt';
type SortDir = 'asc' | 'desc';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: '予定' },
  { value: 'in-progress', label: '進行中' },
  { value: 'completed', label: '完了' },
  { value: 'lost', label: '失注' },
  { value: 'on-hold', label: '保留' },
];

const DEFAULT_STATUS_FILTER = 'scheduled-or-in-progress';

const Projects: React.FC<ProjectsProps> = ({
  customers,
  estimates = [],
  invoices = [],
  purchaseOrders = [],
  onOpenEstimate,
  onOpenInvoice,
  onOpenPurchaseOrder,
}) => {
  const { session } = useAuth();
  const { log: auditLog } = useAudit();
  const userId = session?.user?.id ?? '';

  const [projects, setProjects] = useState<ProjectRecord[]>([
    { id: 'PRJ-001', projectName: 'A邸内装工事', customerName: 'A邸プロジェクト', startDate: '2024-12-01', endDate: '2024-12-15', assignee: '田中太郎', status: 'in-progress', createdAt: '2024-11-20', archived: false },
    { id: 'PRJ-002', projectName: 'Bビル改修工事', customerName: 'Bビル改修', startDate: '2024-12-05', endDate: '2024-12-20', assignee: '佐藤花子', status: 'in-progress', createdAt: '2024-11-22', archived: false },
    { id: 'PRJ-003', projectName: 'C店舗改装', customerName: 'A邸プロジェクト', startDate: '2025-01-10', endDate: '2025-01-25', assignee: '山田次郎', status: 'scheduled', createdAt: '2024-12-01', archived: false },
  ]);

  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(DEFAULT_STATUS_FILTER);
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('startDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [detailProject, setDetailProject] = useState<ProjectRecord | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ProjectRecord | null>(null);
  const [archiveReason, setArchiveReason] = useState<string | null>(null);

  const [form, setForm] = useState({
    projectName: '',
    customerId: '',
    customerName: '',
    startDate: '',
    endDate: '',
    assignee: '',
    status: 'scheduled' as ProjectRecord['status'],
    memo: '',
  });

  const customerOptions = useMemo(
    () => customers.filter((c: { type?: string }) => c.type === 'customer'),
    [customers]
  );

  const linkedCount = useCallback(
    (project: ProjectRecord) => {
      const est = (estimates ?? []).filter((e) => e.customerName === project.customerName && e.projectName === project.projectName);
      const inv = (invoices ?? []).filter((i) => i.customerName === project.customerName && i.projectName === project.projectName);
      const po = (purchaseOrders ?? []).filter((o) => (o.customerName ?? '') === project.customerName && o.projectName === project.projectName);
      return { estimates: est, invoices: inv, purchaseOrders: po };
    },
    [estimates, invoices, purchaseOrders]
  );

  const filteredProjects = useMemo(() => {
    let list = projects.filter((p) => {
      if (p.archived) {
        if (!showArchived) return false;
        // アーカイブ表示時はアーカイブのものを表示（顧客・期間・キーワードは適用）
      } else {
        if (statusFilter === DEFAULT_STATUS_FILTER && !['scheduled', 'in-progress'].includes(p.status)) return false;
        if (statusFilter !== 'all' && statusFilter !== DEFAULT_STATUS_FILTER && p.status !== statusFilter) return false;
      }
      if (customerFilter !== 'all' && p.customerName !== customerFilter) return false;
      if (dateFrom && p.startDate < dateFrom) return false;
      if (dateTo && (p.endDate || '') > dateTo) return false;
      const k = keyword.trim().toLowerCase();
      if (k && !p.projectName.toLowerCase().includes(k) && !p.customerName.toLowerCase().includes(k) && !(p.assignee || '').toLowerCase().includes(k)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), 'ja');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [projects, keyword, statusFilter, customerFilter, dateFrom, dateTo, showArchived, sortKey, sortDir]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = { scheduled: 'bg-blue-500', 'in-progress': 'bg-primary', completed: 'bg-green-600', 'on-hold': 'bg-amber-500', lost: 'bg-red-600' };
    const label: Record<string, string> = { scheduled: '予定', 'in-progress': '進行中', completed: '完了', 'on-hold': '保留', lost: '失注' };
    return <Badge className={`${map[status] || 'bg-muted'} text-white`}>{label[status] || status}</Badge>;
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) =>
    sortKey === column ? (sortDir === 'asc' ? <ArrowUp className="w-4 h-4 inline ml-1" /> : <ArrowDown className="w-4 h-4 inline ml-1" />) : <ArrowUpDown className="w-4 h-4 inline ml-1 opacity-50" />;

  const openCreate = () => {
    setEditingProject(null);
    const firstCustomer = customerOptions[0];
    setForm({
      projectName: '',
      customerId: firstCustomer?.id ?? '',
      customerName: firstCustomer?.companyName ?? '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      assignee: '',
      status: 'scheduled',
      memo: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (p: ProjectRecord) => {
    setEditingProject(p);
    const cust = customerOptions.find((c: { companyName: string }) => c.companyName === p.customerName);
    setForm({
      projectName: p.projectName,
      customerId: cust?.id ?? '',
      customerName: p.customerName,
      startDate: p.startDate,
      endDate: p.endDate || '',
      assignee: p.assignee || '',
      status: p.status,
      memo: p.memo || '',
    });
    setDialogOpen(true);
  };

  const saveProject = () => {
    if (!form.projectName.trim()) {
      toast.error('案件名を入力してください');
      return;
    }
    if (!form.customerName.trim()) {
      toast.error('顧客を選択してください');
      return;
    }
    if (!form.startDate) {
      toast.error('開始日を入力してください');
      return;
    }
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      toast.error('終了日は開始日以降にしてください');
      return;
    }
    if (editingProject) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProject.id
            ? {
                ...p,
                projectName: form.projectName.trim(),
                customerName: form.customerName.trim(),
                startDate: form.startDate,
                endDate: form.endDate || '',
                assignee: form.assignee.trim(),
                status: form.status,
                memo: form.memo || undefined,
              }
            : p
        )
      );
      auditLog({ userId, action: '案件編集', targetId: editingProject.id, result: 'success' });
      toast.success('案件を更新しました');
    } else {
      const id = 'PRJ-' + String(Math.max(0, ...projects.map((p) => parseInt(p.id.replace(/\D/g, '') || '0', 10)) + 1)).padStart(3, '0');
      const createdAt = new Date().toISOString().split('T')[0];
      setProjects((prev) => [
        ...prev,
        {
          id,
          projectName: form.projectName.trim(),
          customerName: form.customerName.trim(),
          startDate: form.startDate,
          endDate: form.endDate || '',
          assignee: form.assignee.trim(),
          status: form.status,
          memo: form.memo || undefined,
          createdAt,
          archived: false,
        },
      ]);
      auditLog({ userId, action: '案件作成', targetId: id, result: 'success' });
      toast.success('案件を作成しました');
    }
    setDialogOpen(false);
  };

  const requestArchive = (p: ProjectRecord) => {
    const links = linkedCount(p);
    const hasLinks = links.estimates.length > 0 || links.invoices.length > 0 || links.purchaseOrders.length > 0;
    setArchiveTarget(p);
    setArchiveReason(hasLinks ? 'linked' : null);
  };

  const doArchive = () => {
    if (!archiveTarget) return;
    setProjects((prev) => prev.map((x) => (x.id === archiveTarget.id ? { ...x, archived: true } : x)));
    auditLog({ userId, action: '案件アーカイブ', targetId: archiveTarget.id, result: 'success' });
    toast.success('案件をアーカイブしました');
    setArchiveTarget(null);
    setArchiveReason(null);
    setDetailProject((prev) => (prev?.id === archiveTarget.id ? null : prev));
  };

  const linkedForDetail = detailProject ? linkedCount(detailProject) : { estimates: [] as EstimateRecord[], invoices: [] as InvoiceRecord[], purchaseOrders: [] as PurchaseOrderRecord[] };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">案件管理（F-24）</h1>
          <p className="text-muted-foreground">案件の一覧・作成・編集・アーカイブ。紐づく見積・発注・請求へ遷移できます。</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          新規案件
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="案件名・顧客・担当者で検索..." value={keyword} onChange={(e) => setKeyword(e.target.value)} className="pl-10" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">ステータス</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_STATUS_FILTER}>予定・進行中（既定）</SelectItem>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="scheduled">予定</SelectItem>
                  <SelectItem value="in-progress">進行中</SelectItem>
                  <SelectItem value="completed">完了</SelectItem>
                  <SelectItem value="on-hold">保留</SelectItem>
                  <SelectItem value="lost">失注</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">顧客</Label>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="顧客" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  {[...new Set(projects.map((p) => p.customerName))].map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">期間</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" placeholder="開始日から" />
              <span className="text-muted-foreground">～</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" placeholder="終了日まで" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded border-border" />
              アーカイブを表示
            </label>
            <span className="text-sm text-muted-foreground ml-auto">{filteredProjects.length}件</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><button type="button" className="font-medium hover:underline" onClick={() => toggleSort('projectName')}>案件名</button><SortIcon column="projectName" /></TableHead>
                <TableHead><button type="button" className="font-medium hover:underline" onClick={() => toggleSort('customerName')}>顧客</button><SortIcon column="customerName" /></TableHead>
                <TableHead><button type="button" className="font-medium hover:underline" onClick={() => toggleSort('status')}>ステータス</button><SortIcon column="status" /></TableHead>
                <TableHead><button type="button" className="font-medium hover:underline" onClick={() => toggleSort('startDate')}>開始日</button><SortIcon column="startDate" /></TableHead>
                <TableHead><button type="button" className="font-medium hover:underline" onClick={() => toggleSort('endDate')}>終了日</button><SortIcon column="endDate" /></TableHead>
                <TableHead><button type="button" className="font-medium hover:underline" onClick={() => toggleSort('assignee')}>担当者</button><SortIcon column="assignee" /></TableHead>
                <TableHead><button type="button" className="font-medium hover:underline" onClick={() => toggleSort('createdAt')}>作成日</button><SortIcon column="createdAt" /></TableHead>
                <TableHead className="w-40 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Building2 className="w-12 h-12 mx-auto opacity-20 mb-2" />
                    <p>条件に一致する案件がありません</p>
                    <p className="text-sm mt-1">フィルタを変えるか、アーカイブを表示にしてください。</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProjects.map((project) => (
                  <TableRow key={project.id} className={project.archived ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{project.projectName}</TableCell>
                    <TableCell>{project.customerName}</TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell className="text-sm">{project.startDate}</TableCell>
                    <TableCell className="text-sm">{project.endDate || '—'}</TableCell>
                    <TableCell className="text-sm">{project.assignee || '—'}</TableCell>
                    <TableCell className="text-sm">{project.createdAt}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="詳細" onClick={() => setDetailProject(project)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="編集" onClick={() => openEdit(project)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {!project.archived && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-amber-600" title="アーカイブ" onClick={() => requestArchive(project)}>
                            <Archive className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProject ? '案件の編集（US-1023）' : '新規案件作成（US-1022）'}</DialogTitle>
            <DialogDescription>必須：案件名・顧客・開始日。編集時も必須項目を満たしてください。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>案件名 *</Label>
              <Input value={form.projectName} onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))} placeholder="A邸内装工事" className="mt-1" />
            </div>
            <div>
              <Label>顧客 *</Label>
              <Select
                value={form.customerId || '__none__'}
                onValueChange={(v) => {
                  if (v === '__none__') return;
                  const c = customerOptions.find((x: { id: string }) => x.id === v) as { id: string; companyName: string } | undefined;
                  setForm((f) => ({ ...f, customerId: v, customerName: c?.companyName ?? '' }));
                }}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="顧客を選択" /></SelectTrigger>
                <SelectContent>
                  {customerOptions.map((c: { id: string; companyName: string }) => (
                    <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                  ))}
                  {customerOptions.length === 0 && <SelectItem value="__none__">顧客がありません</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>開始日 *</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>終了日</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>担当者</Label>
              <Input value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))} placeholder="田中太郎" className="mt-1" />
            </div>
            <div>
              <Label>ステータス</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ProjectRecord['status'] }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>備考</Label>
              <Input value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} placeholder="任意" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={saveProject}>{editingProject ? '更新' : '作成'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailProject} onOpenChange={() => setDetailProject(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>案件詳細（US-1025）</DialogTitle>
            <DialogDescription>基本情報と紐づく見積・発注・請求。各「開く」で該当画面へ遷移します。</DialogDescription>
          </DialogHeader>
          {detailProject && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground">案件名</Label><p className="font-medium">{detailProject.projectName}</p></div>
                <div><Label className="text-muted-foreground">顧客</Label><p className="font-medium">{detailProject.customerName}</p></div>
                <div><Label className="text-muted-foreground">ステータス</Label><p>{getStatusBadge(detailProject.status)}</p></div>
                <div><Label className="text-muted-foreground">開始日 / 終了日</Label><p className="font-medium">{detailProject.startDate} ～ {detailProject.endDate || '—'}</p></div>
                <div><Label className="text-muted-foreground">担当者</Label><p className="font-medium">{detailProject.assignee || '—'}</p></div>
                <div><Label className="text-muted-foreground">作成日</Label><p className="font-medium">{detailProject.createdAt}</p></div>
                {detailProject.memo && <div className="col-span-2"><Label className="text-muted-foreground">備考</Label><p className="text-sm">{detailProject.memo}</p></div>}
              </div>

              <div>
                <h4 className="font-medium flex items-center gap-2 mb-2"><FileText className="w-4 h-4" />紐づく見積</h4>
                {linkedForDetail.estimates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">なし</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>見積番号</TableHead><TableHead>状態</TableHead><TableHead className="w-20"></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {linkedForDetail.estimates.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.estimateNumber}</TableCell>
                          <TableCell><Badge variant="outline">{e.status === 'confirmed' ? '確定' : e.status}</Badge></TableCell>
                          <TableCell>
                            {onOpenEstimate && <Button variant="ghost" size="sm" onClick={() => { onOpenEstimate(e.id); setDetailProject(null); }}>開く</Button>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <div>
                <h4 className="font-medium flex items-center gap-2 mb-2"><Package className="w-4 h-4" />紐づく発注</h4>
                {linkedForDetail.purchaseOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">なし</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>発注番号</TableHead><TableHead>状態</TableHead><TableHead className="w-20"></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {linkedForDetail.purchaseOrders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{o.id}</TableCell>
                          <TableCell><Badge variant="outline">{o.status === 'ordered' ? '発注済み' : '未発注'}</Badge></TableCell>
                          <TableCell>
                            {onOpenPurchaseOrder && <Button variant="ghost" size="sm" onClick={() => { onOpenPurchaseOrder(o.id); setDetailProject(null); }}>開く</Button>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <div>
                <h4 className="font-medium flex items-center gap-2 mb-2"><Receipt className="w-4 h-4" />紐づく請求</h4>
                {linkedForDetail.invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">なし</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>請求番号</TableHead><TableHead>状態</TableHead><TableHead className="w-20"></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {linkedForDetail.invoices.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium">{i.invoiceNumber}</TableCell>
                          <TableCell><Badge variant="outline">{i.status}</Badge></TableCell>
                          <TableCell>
                            {onOpenInvoice && <Button variant="ghost" size="sm" onClick={() => { onOpenInvoice(i.id); setDetailProject(null); }}>開く</Button>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{archiveReason === 'linked' ? '削除できません（US-1024）' : 'アーカイブしますか？'}</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveReason === 'linked'
                ? 'この案件には見積・請求・発注が紐づいているため削除できません。一覧の既定表示から除外するにはアーカイブをご利用ください。'
                : 'アーカイブすると一覧の既定表示から除外されます。フィルタで「アーカイブを表示」すると再度表示できます。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setArchiveTarget(null); setArchiveReason(null); }}>{archiveReason === 'linked' ? '閉じる' : 'キャンセル'}</AlertDialogCancel>
            <AlertDialogAction onClick={doArchive}>アーカイブする</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Projects;
