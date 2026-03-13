import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Plus, Receipt, Download, Edit, Search, FileSpreadsheet, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { InvoiceRecord, InvoiceLineItem } from '../App';
import type { EstimateRecord } from '../App';
import type { CustomerRecord } from './Customer';
import { useAudit } from '../contexts/AuditContext';
import { useAuth } from '../contexts/AuthContext';

function getBasicSettings(): { taxRate: number; taxRounding: 'half' | 'down' | 'up' } {
  try {
    const saved = localStorage.getItem('lets_basic_settings');
    if (saved) {
      const p = JSON.parse(saved);
      return { taxRate: Number(p.taxRate) || 10, taxRounding: p.taxRounding || 'half' };
    }
  } catch (_) {}
  return { taxRate: 10, taxRounding: 'half' as const };
}

function calcTaxAmount(subtotal: number, taxRate: number, rounding: 'half' | 'down' | 'up'): number {
  const raw = subtotal * (taxRate / 100);
  if (rounding === 'down') return Math.floor(raw);
  if (rounding === 'up') return Math.ceil(raw);
  return Math.round(raw);
}

function nextInvoiceNumber(existing: InvoiceRecord[]): string {
  const yyyymm = new Date().toISOString().slice(0, 7).replace(/-/, '');
  const prefix = `INV-${yyyymm}-`;
  const nums = existing
    .filter((inv) => inv.invoiceNumber.startsWith(prefix))
    .map((inv) => parseInt(inv.invoiceNumber.slice(prefix.length), 10) || 0);
  const next = (Math.max(0, ...nums) + 1).toString().padStart(4, '0');
  return `${prefix}${next}`;
}

interface QuoteProject {
  id: string;
  customerName: string;
  projectName: string;
  totalAmount: number;
  quoteItems?: Array<{ item: string; quantity: number; unit: string; unitPrice?: number; amount?: number }>;
  extractedItems?: Array<{ item: string; quantity: number; unit: string }>;
}

interface InvoiceProps {
  invoices: InvoiceRecord[];
  setInvoices: React.Dispatch<React.SetStateAction<InvoiceRecord[]>>;
  quoteProjects: QuoteProject[];
  customers: CustomerRecord[];
  estimates: EstimateRecord[];
  openInvoiceId?: string | null;
  setOpenInvoiceId?: React.Dispatch<React.SetStateAction<string | null>>;
}

const statusLabels: Record<string, string> = {
  draft: '下書き',
  issued: '保存済',
  cancelled: '取消',
};

const Invoice: React.FC<InvoiceProps> = ({ invoices, setInvoices, quoteProjects, customers, estimates, openInvoiceId, setOpenInvoiceId }) => {
  const { log: auditLog } = useAudit();
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';

  const [listKeyword, setListKeyword] = useState('');
  const [listStatus, setListStatus] = useState<string>('all');
  const [listDateFrom, setListDateFrom] = useState('');
  const [listDateTo, setListDateTo] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (openInvoiceId && invoices.some((i) => i.id === openInvoiceId)) {
      setDetailId(openInvoiceId);
      setOpenInvoiceId?.(null);
    }
  }, [openInvoiceId, invoices]);
  const [createSource, setCreateSource] = useState<'estimate' | 'project' | null>(null);
  const [createEstimateId, setCreateEstimateId] = useState('');
  const [createProjectId, setCreateProjectId] = useState('');

  const customerOptions = useMemo(
    () => customers.filter((c) => c.type === 'customer' && c.isActive !== false),
    [customers]
  );

  const assigneeOptions = useMemo(
    () => [...new Set(customerOptions.map((c) => c.contactPerson).filter(Boolean))] as string[],
    [customerOptions]
  );

  const filteredList = useMemo(() => {
    let list = invoices;
    if (listKeyword.trim()) {
      const k = listKeyword.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.customerName.toLowerCase().includes(k) ||
          inv.projectName.toLowerCase().includes(k) ||
          inv.invoiceNumber.toLowerCase().includes(k)
      );
    }
    if (listStatus !== 'all') list = list.filter((inv) => inv.status === listStatus);
    if (listDateFrom) list = list.filter((inv) => inv.lastUpdated >= listDateFrom);
    if (listDateTo) list = list.filter((inv) => inv.lastUpdated <= listDateTo);
    return list;
  }, [invoices, listKeyword, listStatus, listDateFrom, listDateTo]);

  const selectedInvoice = useMemo(() => invoices.find((i) => i.id === detailId) ?? null, [invoices, detailId]);

  const openCreateFromEstimate = () => {
    const confirmed = estimates.filter((e) => e.status === 'confirmed' && e.items.length > 0);
    if (confirmed.length === 0) {
      toast.error('確定済みの見積がありません');
      return;
    }
    setCreateSource('estimate');
    setCreateEstimateId(confirmed[0].id);
    setCreateProjectId('');
    setDetailId(null);
  };

  const openCreateFromProject = () => {
    if (quoteProjects.length === 0) {
      toast.error('案件がありません');
      return;
    }
    setCreateSource('project');
    setCreateProjectId(quoteProjects[0].id);
    setCreateEstimateId('');
    setDetailId(null);
  };

  const createInvoice = useCallback(() => {
    const { taxRate, taxRounding } = getBasicSettings();
    const now = new Date().toISOString().split('T')[0];
    const invNum = nextInvoiceNumber(invoices);
    const newId = `inv-${Date.now()}`;

    let customerId = '';
    let customerName = '';
    let projectName = '';
    let billingDayDisplay: number | undefined;
    let contactPerson = '';
    let items: InvoiceLineItem[] = [];
    let subtotal = 0;

    if (createSource === 'estimate' && createEstimateId) {
      const est = estimates.find((e) => e.id === createEstimateId);
      if (!est) return;
      customerId = est.customerId;
      customerName = est.customerName;
      projectName = est.projectName;
      const cust = customers.find((c) => c.id === est.customerId);
      billingDayDisplay = cust?.billingDay;
      contactPerson = cust?.contactPerson ?? (customerOptions[0]?.contactPerson ?? '');
      items = est.items.map((it, idx) => {
        const amt = it.quantity * it.unitPrice;
        subtotal += amt;
        return {
          id: `li-${idx}`,
          item: it.item,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          amount: amt,
        };
      });
    } else if (createSource === 'project' && createProjectId) {
      const proj = quoteProjects.find((p) => p.id === createProjectId);
      if (!proj) return;
      customerName = proj.customerName;
      projectName = proj.projectName;
      const cust = customers.find((c) => c.companyName === proj.customerName);
      customerId = cust?.id ?? '';
      billingDayDisplay = cust?.billingDay;
      contactPerson = cust?.contactPerson ?? (customerOptions[0]?.contactPerson ?? '');
      // 明細は見積書から自動：該当案件の確定済み見積があればその明細を使用
      const matchingEstimate = estimates.find(
        (e) => e.status === 'confirmed' && e.items.length > 0 && e.projectName === proj.projectName && e.customerName === proj.customerName
      );
      if (matchingEstimate) {
        items = matchingEstimate.items.map((it, idx) => {
          const amt = it.quantity * it.unitPrice;
          subtotal += amt;
          return {
            id: `li-${idx}`,
            item: it.item,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unitPrice,
            amount: amt,
          };
        });
      } else {
        const sourceItems = proj.quoteItems?.length ? proj.quoteItems : (proj.extractedItems ?? []).map((e) => ({ ...e, unitPrice: 0, amount: e.quantity * 0 }));
        sourceItems.forEach((it, idx) => {
          const amount = 'amount' in it && it.amount != null ? it.amount : it.quantity * ((it as any).unitPrice ?? 0);
          subtotal += amount;
          items.push({
            id: `li-${idx}`,
            item: it.item,
            quantity: it.quantity,
            unit: it.unit ?? '式',
            unitPrice: 'unitPrice' in it ? (it as any).unitPrice : 0,
            amount,
          });
        });
        if (items.length === 0 && proj.totalAmount > 0) {
          items = [{ id: 'li-0', item: '工事請負', quantity: 1, unit: '式', unitPrice: proj.totalAmount, amount: proj.totalAmount }];
          subtotal = proj.totalAmount;
        }
      }
    } else return;

    const taxAmount = calcTaxAmount(subtotal, taxRate, taxRounding);
    const totalAmount = subtotal + taxAmount;
    const newInv: InvoiceRecord = {
      id: newId,
      invoiceNumber: invNum,
      customerId,
      customerName,
      projectName,
      status: 'draft',
      billingDayDisplay,
      contactPerson,
      items,
      subtotal,
      taxAmount,
      totalAmount,
      lastUpdated: now,
      updateHistory: [{ at: new Date().toISOString(), action: '請求書作成' }],
    };
    setInvoices((prev) => [...prev, newInv]);
    auditLog({ userId, action: '請求書作成', targetId: newId, result: 'success' });
    toast.success('請求書を作成しました');
    setCreateSource(null);
    setDetailId(newId);
  }, [
    createSource,
    createEstimateId,
    createProjectId,
    estimates,
    quoteProjects,
    customers,
    customerOptions,
    invoices,
    setInvoices,
    auditLog,
    userId,
  ]);

  const updateInvoiceItem = useCallback(
    (invId: string, itemId: string, patch: Partial<InvoiceLineItem>) => {
      const { taxRate, taxRounding } = getBasicSettings();
      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== invId) return inv;
          const newItems = inv.items.map((it) => {
            if (it.id !== itemId) return it;
            const next = { ...it, ...patch };
            if (typeof next.quantity === 'number' && typeof next.unitPrice === 'number')
              next.amount = next.quantity * next.unitPrice;
            return next;
          });
          const subtotal = newItems.reduce((s, i) => s + i.amount, 0);
          const taxAmount = calcTaxAmount(subtotal, taxRate, taxRounding);
          const totalAmount = subtotal + taxAmount;
          const now = new Date().toISOString();
          return {
            ...inv,
            items: newItems,
            subtotal,
            taxAmount,
            totalAmount,
            lastUpdated: now.split('T')[0],
            updateHistory: [...(inv.updateHistory ?? []), { at: now, action: '明細編集' }],
          };
        })
      );
    },
    [setInvoices]
  );

  const addInvoiceRow = useCallback(
    (invId: string) => {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invId
            ? {
                ...inv,
                items: [
                  ...inv.items,
                  { id: `li-${Date.now()}`, item: '', quantity: 0, unit: '式', unitPrice: 0, amount: 0 },
                ],
              }
            : inv
        )
      );
    },
    [setInvoices]
  );

  const removeInvoiceRow = useCallback(
    (invId: string, itemId: string) => {
      const { taxRate, taxRounding } = getBasicSettings();
      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== invId) return inv;
          const newItems = inv.items.filter((i) => i.id !== itemId);
          const subtotal = newItems.reduce((s, i) => s + i.amount, 0);
          const taxAmount = calcTaxAmount(subtotal, taxRate, taxRounding);
          const now = new Date().toISOString();
          return {
            ...inv,
            items: newItems,
            subtotal,
            taxAmount,
            totalAmount: subtotal + taxAmount,
            lastUpdated: now.split('T')[0],
            updateHistory: [...(inv.updateHistory ?? []), { at: now, action: '明細編集' }],
          };
        })
      );
    },
    [setInvoices]
  );

  const saveInvoice = useCallback(
    (inv: InvoiceRecord) => {
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const next: InvoiceRecord = {
        ...inv,
        lastUpdated: today,
        status: inv.status === 'draft' ? 'issued' : inv.status,
        updateHistory: [...(inv.updateHistory ?? []), { at: now, action: '保存' }],
      };
      setInvoices((prev) => prev.map((i) => (i.id === inv.id ? next : i)));
      auditLog({ userId, action: '請求書保存', targetId: inv.id, result: 'success' });
      toast.success('請求書を保存しました');
    },
    [setInvoices, auditLog, userId]
  );

  const exportExcel = useCallback(
    (inv: InvoiceRecord) => {
      // 請求番号・電話番号・メールアドレスは印字しない
      const wsData: (string | number)[][] = [
        ['請求書'],
        ['顧客名', inv.customerName],
        ['案件名', inv.projectName],
        ['請求日', inv.billingDayDisplay != null ? (inv.billingDayDisplay === 99 ? '月末締め' : `${inv.billingDayDisplay}日締め`) : ''],
        inv.contactPerson ? ['担当者', inv.contactPerson] : [],
        [],
        ['品目', '数量', '単位', '単価', '金額'],
        ...inv.items.map((i) => [i.item, i.quantity, i.unit, i.unitPrice, i.amount]),
        [],
        ['小計', '', '', '', inv.subtotal],
        [`消費税（${getBasicSettings().taxRate}%）`, '', '', '', inv.taxAmount],
        ['合計', '', '', '', inv.totalAmount],
      ].filter((row) => row.length > 0) as (string | number)[][];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '請求書');
      XLSX.writeFile(wb, `請求書_${inv.customerName}_${inv.projectName || '請求'}.xlsx`);
      toast.success('Excelをダウンロードしました');
    },
    []
  );

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">請求</h1>
          <p className="text-muted-foreground">
            請求書の作成・保存・Excel出力。請求日は宛先（顧客）ごとに顧客管理で登録した締め日を初期表示（編集可・20日締め・月末締め等）。支払い期限は不要。請求番号・電話番号・メールアドレスは印字しません。担当者は選択または自由入力。保存後もいつでも修正してExcelダウンロードできます。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openCreateFromEstimate}>
            <Plus className="w-4 h-4 mr-2" />
            見積から作成
          </Button>
          <Button onClick={openCreateFromProject}>
            <Plus className="w-4 h-4 mr-2" />
            案件から作成
          </Button>
        </div>
      </div>

      {/* 作成元選択 */}
      <Dialog open={createSource !== null} onOpenChange={(o) => !o && setCreateSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>請求書を作成</DialogTitle>
            <DialogDescription>
              見積（確定）または案件から請求を作成します。明細は見積書から自動で取り込みます（案件から作成の場合は、該当する確定済み見積があればその明細を使用）。請求日は顧客管理の締め日を初期表示（編集可）。担当者は選択または自由入力。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {createSource === 'estimate' && (
              <>
                <Label>見積を選択</Label>
                <Select value={createEstimateId} onValueChange={setCreateEstimateId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {estimates
                      .filter((e) => e.status === 'confirmed' && e.items.length > 0)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.projectName}（{e.estimateNumber}）
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </>
            )}
            {createSource === 'project' && (
              <>
                <Label>案件を選択</Label>
                <Select value={createProjectId} onValueChange={setCreateProjectId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {quoteProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.projectName} — {p.customerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSource(null)}>キャンセル</Button>
            <Button onClick={createInvoice}>請求書を作成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>請求一覧</span>
            <Badge variant="outline">{filteredList.length}件</Badge>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="キーワード（請求番号・顧客・案件）" value={listKeyword} onChange={(e) => setListKeyword(e.target.value)} className="pl-10" />
            </div>
            <Select value={listStatus} onValueChange={setListStatus}>
              <SelectTrigger className="w-32"><SelectValue placeholder="状態" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="draft">下書き</SelectItem>
                <SelectItem value="issued">保存済</SelectItem>
                <SelectItem value="cancelled">取消</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" placeholder="更新日から" value={listDateFrom} onChange={(e) => setListDateFrom(e.target.value)} className="w-40" />
            <Input type="date" placeholder="更新日まで" value={listDateTo} onChange={(e) => setListDateTo(e.target.value)} className="w-40" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>請求番号</TableHead>
                <TableHead>顧客</TableHead>
                <TableHead className="w-28">状態</TableHead>
                <TableHead className="text-right w-36">金額</TableHead>
                <TableHead className="w-32">更新日</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    条件に一致する請求がありません
                  </TableCell>
                </TableRow>
              ) : (
                filteredList.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.customerName}</TableCell>
                    <TableCell><Badge variant={inv.status === 'issued' ? 'default' : 'secondary'}>{statusLabels[inv.status]}</Badge></TableCell>
                    <TableCell className="text-right">¥{inv.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{inv.lastUpdated}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setDetailId(inv.id)}><Edit className="w-4 h-4 mr-1" />開く</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 請求詳細・編集 */}
      <Dialog open={!!selectedInvoice} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>請求書 {selectedInvoice?.invoiceNumber}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => selectedInvoice && exportExcel(selectedInvoice)}>
                  <FileSpreadsheet className="w-4 h-4 mr-1" />Excel出力
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDetailId(null)}><X className="w-4 h-4" /></Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              明細・請求日・担当者はいつでも編集可能。保存で更新履歴が残ります。Excelダウンロード時は請求番号・電話番号・メールアドレスは印字しません。いつでも修正して再ダウンロードできます。
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>顧客名</Label>
                  <p className="font-medium">{selectedInvoice.customerName}</p>
                </div>
                <div>
                  <Label>案件名</Label>
                  <p className="font-medium">{selectedInvoice.projectName}</p>
                </div>
                <div>
                  <Label>請求日（顧客管理の締め日を初期表示・編集可）</Label>
                  <Select
                    value={selectedInvoice.billingDayDisplay != null ? String(selectedInvoice.billingDayDisplay) : 'none'}
                    onValueChange={(v) => {
                      const val = v === 'none' ? undefined : v === '99' ? 99 : parseInt(v, 10);
                      setInvoices((prev) =>
                        prev.map((i) => (i.id === selectedInvoice.id ? { ...i, billingDayDisplay: val } : i))
                      );
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="1">1日締め</SelectItem>
                      <SelectItem value="5">5日締め</SelectItem>
                      <SelectItem value="10">10日締め</SelectItem>
                      <SelectItem value="15">15日締め</SelectItem>
                      <SelectItem value="20">20日締め</SelectItem>
                      <SelectItem value="25">25日締め</SelectItem>
                      <SelectItem value="28">28日締め</SelectItem>
                      <SelectItem value="99">月末締め</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>担当者（選択または自由入力）</Label>
                  <div className="flex gap-2">
                    {assigneeOptions.length > 0 ? (
                      <Select
                        value={selectedInvoice.contactPerson && assigneeOptions.includes(selectedInvoice.contactPerson) ? selectedInvoice.contactPerson : '__free__'}
                        onValueChange={(v) =>
                          setInvoices((prev) =>
                            prev.map((i) =>
                              i.id === selectedInvoice.id ? { ...i, contactPerson: v === '__free__' ? (i.contactPerson ?? '') : v } : i
                            )
                          )
                        }
                      >
                        <SelectTrigger className="w-40 shrink-0"><SelectValue placeholder="選択" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__free__">自由入力</SelectItem>
                          {assigneeOptions.map((name) => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    <Input
                      className="flex-1 min-w-0"
                      value={selectedInvoice.contactPerson ?? ''}
                      onChange={(e) =>
                        setInvoices((prev) => prev.map((i) => (i.id === selectedInvoice.id ? { ...i, contactPerson: e.target.value } : i)))
                      }
                      placeholder="担当者名（自由入力）"
                    />
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>明細（編集可・合計再計算）</Label>
                  <Button variant="outline" size="sm" onClick={() => addInvoiceRow(selectedInvoice.id)}><Plus className="w-4 h-4 mr-1" />行追加</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>品目</TableHead>
                      <TableHead className="w-24">数量</TableHead>
                      <TableHead className="w-24">単位</TableHead>
                      <TableHead className="w-28">単価</TableHead>
                      <TableHead className="w-28">金額</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>
                          <Input
                            value={it.item}
                            onChange={(e) => updateInvoiceItem(selectedInvoice.id, it.id, { item: e.target.value })}
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={it.quantity}
                            onChange={(e) => updateInvoiceItem(selectedInvoice.id, it.id, { quantity: Number(e.target.value) || 0 })}
                            className="h-9 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={it.unit}
                            onChange={(e) => updateInvoiceItem(selectedInvoice.id, it.id, { unit: e.target.value })}
                            className="h-9 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={it.unitPrice}
                            onChange={(e) => updateInvoiceItem(selectedInvoice.id, it.id, { unitPrice: Number(e.target.value) || 0 })}
                            className="h-9 w-24"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{it.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeInvoiceRow(selectedInvoice.id, it.id)}><X className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-4 text-sm">
                <span>小計: ¥{selectedInvoice.subtotal.toLocaleString()}</span>
                <span>消費税: ¥{selectedInvoice.taxAmount.toLocaleString()}</span>
                <span className="font-bold">合計: ¥{selectedInvoice.totalAmount.toLocaleString()}</span>
              </div>
              {selectedInvoice.updateHistory && selectedInvoice.updateHistory.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  更新履歴: {selectedInvoice.updateHistory.slice(-3).map((e) => e.action).join(' → ')}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailId(null)}>閉じる</Button>
                <Button onClick={() => saveInvoice(selectedInvoice)}>保存</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoice;
