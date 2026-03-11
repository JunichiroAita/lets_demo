import React, { useState, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Receipt, Download, Edit } from 'lucide-react';
import { toast } from 'sonner';
import type { InvoiceRecord } from '../App';

interface Customer {
  id: string;
  companyName: string;
  type: string;
  isActive?: boolean;
}

interface QuoteProject {
  id: string;
  customerName: string;
  projectName: string;
  totalAmount: number;
}

interface InvoiceProps {
  invoices: InvoiceRecord[];
  setInvoices: React.Dispatch<React.SetStateAction<InvoiceRecord[]>>;
  quoteProjects: QuoteProject[];
  customers: Customer[];
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500 text-white',
  issued: 'bg-green-500 text-white',
  cancelled: 'bg-red-500 text-white',
};
const statusLabels: Record<string, string> = {
  draft: '下書き',
  issued: '発行済',
  cancelled: '取消',
};

function nextInvoiceNumber(existing: InvoiceRecord[]): string {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `INV-${yyyymm}-`;
  const nums = existing
    .filter((inv) => inv.invoiceNumber.startsWith(prefix))
    .map((inv) => parseInt(inv.invoiceNumber.slice(prefix.length), 10) || 0);
  const next = (Math.max(0, ...nums) + 1).toString().padStart(4, '0');
  return `${prefix}${next}`;
}

const Invoice: React.FC<InvoiceProps> = ({ invoices, setInvoices, quoteProjects, customers }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerId: '',
    projectName: '',
    totalAmount: '',
    dueDate: '',
    status: 'draft' as InvoiceRecord['status'],
  });

  const customerOptions = useMemo(
    () => customers.filter((c) => c.type === 'customer' && c.isActive !== false),
    [customers]
  );

  const projectsForCustomer = useMemo(() => {
    if (!form.customerId) return [];
    const name = customers.find((c) => c.id === form.customerId)?.companyName ?? '';
    return quoteProjects.filter((p) => p.customerName === name);
  }, [form.customerId, customers, quoteProjects]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      customerId: customerOptions[0]?.id ?? '',
      projectName: '',
      totalAmount: '',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft',
    });
    setDialogOpen(true);
  };

  const openEdit = (inv: InvoiceRecord) => {
    const cust = customers.find((c) => c.companyName === inv.customerName);
    setEditingId(inv.id);
    setForm({
      customerId: cust?.id ?? '',
      projectName: inv.projectName,
      totalAmount: String(inv.totalAmount),
      dueDate: inv.dueDate ?? '',
      status: inv.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const customerName = customers.find((c) => c.id === form.customerId)?.companyName ?? form.customerId;
    if (!customerName) {
      toast.error('顧客を選択してください');
      return;
    }
    if (!form.projectName.trim()) {
      toast.error('案件名を入力してください');
      return;
    }
    const amount = Number(form.totalAmount) || 0;
    if (amount <= 0) {
      toast.error('合計金額を入力してください');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    if (editingId) {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === editingId
            ? {
                ...inv,
                customerName,
                projectName: form.projectName.trim(),
                totalAmount: amount,
                dueDate: form.dueDate || undefined,
                status: form.status,
                lastUpdated: today,
              }
            : inv
        )
      );
      toast.success('請求書を更新しました');
    } else {
      const id = 'inv' + (Math.max(0, ...invoices.map((i) => parseInt(i.id.replace(/\D/g, '') || '0', 10))) + 1);
      const invoiceNumber = nextInvoiceNumber(invoices);
      setInvoices((prev) => [
        ...prev,
        {
          id,
          invoiceNumber,
          customerName,
          projectName: form.projectName.trim(),
          status: form.status,
          totalAmount: amount,
          lastUpdated: today,
          dueDate: form.dueDate || undefined,
        },
      ]);
      toast.success('請求書を作成しました');
    }
    setDialogOpen(false);
  };

  const applyProject = (project: QuoteProject) => {
    setForm((f) => ({
      ...f,
      projectName: project.projectName,
      totalAmount: String(project.totalAmount),
    }));
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">請求書管理</h1>
          <p className="text-muted-foreground">請求書の作成・発行・管理</p>
        </div>
        <Button className="flex items-center space-x-2" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          <span>新規請求書作成</span>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>請求番号</TableHead>
                <TableHead>顧客名</TableHead>
                <TableHead>案件名</TableHead>
                <TableHead className="w-32">ステータス</TableHead>
                <TableHead className="text-right w-40">合計金額</TableHead>
                <TableHead className="w-28">支払期限</TableHead>
                <TableHead className="w-32">最終更新日</TableHead>
                <TableHead className="w-36 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    請求書がありません。「新規請求書作成」から追加してください。
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <span className="text-primary font-medium cursor-pointer hover:underline">{invoice.invoiceNumber}</span>
                    </TableCell>
                    <TableCell className="font-medium">{invoice.customerName}</TableCell>
                    <TableCell>{invoice.projectName}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[invoice.status]}>{statusLabels[invoice.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">¥{invoice.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{invoice.dueDate ?? '-'}</TableCell>
                    <TableCell className="text-sm">{invoice.lastUpdated}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="編集" onClick={() => openEdit(invoice)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="PDF出力" onClick={() => toast.success('PDFをダウンロードしました（デモ）')}>
                          <Download className="w-4 h-4" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? '請求書の編集' : '新規請求書作成'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>顧客 *</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm((f) => ({ ...f, customerId: v, projectName: '' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="顧客を選択" />
                </SelectTrigger>
                <SelectContent>
                  {customerOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {projectsForCustomer.length > 0 && (
              <div className="space-y-2">
                <Label>案件を選択（見積から流用）</Label>
                <Select
                  value=""
                  onValueChange={(projectId) => {
                    const p = quoteProjects.find((q) => q.id === projectId);
                    if (p) applyProject(p);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="案件を選ぶと案件名・金額を自動入力" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsForCustomer.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.projectName} — ¥{p.totalAmount.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>案件名 *</Label>
              <Input
                value={form.projectName}
                onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
                placeholder="内装工事（品川）"
              />
            </div>
            <div className="space-y-2">
              <Label>合計金額（円） *</Label>
              <Input
                type="number"
                min={1}
                value={form.totalAmount}
                onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
                placeholder="168850"
              />
            </div>
            <div className="space-y-2">
              <Label>支払期限</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>ステータス</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as InvoiceRecord['status'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{statusLabels.draft}</SelectItem>
                  <SelectItem value="issued">{statusLabels.issued}</SelectItem>
                  <SelectItem value="cancelled">{statusLabels.cancelled}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSubmit}>{editingId ? '更新' : '作成'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoice;
