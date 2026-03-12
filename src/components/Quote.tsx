import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Building, Plus, Search, FileText, Sparkles, Upload, Eye, Trash2, Archive, Play, ListChecks, Copy, Download, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import type { EstimateRecord, EstimateLineItem } from '../App';
import * as XLSX from 'xlsx';

const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_PDF_PAGES = 200;

export interface TakeoffJobRecord {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: 'running' | 'completed' | 'error';
  /** 失敗時のエラーコード（US-0505） */
  errorCode?: string;
  /** 失敗理由（ログ・ジョブ履歴から参照） */
  errorMessage?: string;
  error?: string; // 後方互換
}

/** 対象ページの指定方法: AI自動判定 or 手動指定（他業種用・図面以外のページ対策） */
export type PageSelectionMode = 'auto' | 'manual';

export interface DrawingRecord {
  id: string;
  name: string;
  registeredAt: string;
  registeredBy: string;
  status: '未処理' | '処理中' | '完了' | 'エラー';
  lastUpdated: string;
  fileSizeBytes?: number;
  pageCount?: number;
  /** 拾い対象とするページ番号（1始まり）。未指定時は全ページ対象の想定 */
  targetPages?: number[];
  /** 対象ページの指定方法。図面PDFに他業種用・図面以外のページがある場合の考慮 */
  pageSelectionMode?: PageSelectionMode;
  /** AI判定で提案されたページ（自動判定時や参考表示用） */
  aiSuggestedPages?: number[];
  archived?: boolean;
  takeoffJobHistory: TakeoffJobRecord[];
  /** 拾い結果（US-0502 構造化データ。完了時のみ） */
  takeoffResult?: TakeoffResult;
  /** 再実行回数（US-0508） */
  retryCount?: number;
  /** 処理中時のパイプライン進捗表示用（US-0502 超過時も進捗継続） */
  pipelineStep?: string;
}

/** 拾い結果の構造化データ（部屋/部材/数量/平米・算出根拠・警告） */
export interface TakeoffResultRoom {
  id: string;
  name: string;
  areaM2?: number;
}
export interface TakeoffResultItem {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  category?: string;
  areaM2?: number;
  /** 誤差チェック閾値超過時の警告（US-0504） */
  warning?: string;
  /** 算出根拠（歩掛ID・計算式）（US-0504） */
  calculationBasis?: { stepId: string; formula?: string };
}
export interface TakeoffResult {
  rooms: TakeoffResultRoom[];
  items: TakeoffResultItem[];
  completedAt: string;
}

/** LLM/誤差閾値など設定（US-0503/0504）。更新は監査ログ */
export interface TakeoffSettings {
  llmModel: string;
  llmPrompt: string;
  llmTemperature: number;
  errorThresholdPercent: number;
}

export interface ExtractedItem {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  category?: string;
}

export interface QuoteItem {
  id: number;
  item: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

interface QuoteProject {
  id: string;
  customerName: string;
  projectName: string;
  status: string;
  totalAmount: number;
  lastUpdated: string;
  uploadedFiles: { name?: string }[];
  drawings: DrawingRecord[];
  extractedItems: ExtractedItem[];
  quoteItems: QuoteItem[];
}

// デモ用サンプル（「デモを読み込む」で使用）
const DEMO_EXTRACTED: ExtractedItem[] = [
  { id: 'e1', item: '石膏ボード 12.5mm', quantity: 50, unit: '枚', category: '建材' },
  { id: 'e2', item: 'LGS @455', quantity: 30, unit: 'm', category: '建材' },
  { id: 'e3', item: '下地処理', quantity: 25, unit: 'm2', category: '左官' },
  { id: 'e4', item: '石膏ボード張り', quantity: 25, unit: 'm2', category: '内装' },
];
const DEMO_QUOTE_ITEMS: QuoteItem[] = [
  { id: 1, item: '石膏ボード 12.5mm', quantity: 50, unit: '枚', unitPrice: 850, amount: 42500 },
  { id: 2, item: 'LGS @455', quantity: 30, unit: 'm', unitPrice: 1200, amount: 36000 },
  { id: 3, item: '下地処理', quantity: 25, unit: 'm2', unitPrice: 1200, amount: 30000 },
  { id: 4, item: '石膏ボード張り', quantity: 25, unit: 'm2', unitPrice: 1800, amount: 45000 },
];
const DEMO_TOTAL = DEMO_QUOTE_ITEMS.reduce((s, r) => s + r.amount, 0);

const DEFAULT_TAKEOFF_SETTINGS: TakeoffSettings = {
  llmModel: 'gpt-4o',
  llmPrompt: '図面から部材・数量を抽出し構造化してください。',
  llmTemperature: 0.2,
  errorThresholdPercent: 5,
};

/** デモ用：拾い結果サンプル（パイプライン完了時） */
function buildMockTakeoffResult(): TakeoffResult {
  return {
    rooms: [
      { id: 'r1', name: '居室', areaM2: 25 },
      { id: 'r2', name: '廊下', areaM2: 8 },
    ],
    items: [
      { id: 'i1', item: '石膏ボード 12.5mm', quantity: 50, unit: '枚', category: '建材', areaM2: 25, calculationBasis: { stepId: 'STEP-001', formula: '面積/0.9' } },
      { id: 'i2', item: 'LGS @455', quantity: 30, unit: 'm', category: '建材', calculationBasis: { stepId: 'STEP-002' } },
      { id: 'i3', item: '下地処理', quantity: 25, unit: 'm2', category: '左官', areaM2: 25 },
      { id: 'i4', item: '石膏ボード張り', quantity: 25, unit: 'm2', category: '内装', areaM2: 25, warning: '歩掛との誤差が閾値超過（6%）' },
    ],
    completedAt: new Date().toISOString(),
  };
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
  type?: 'customer' | 'supplier';
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

interface QuoteProps {
  quoteProjects: QuoteProject[];
  setQuoteProjects: React.Dispatch<React.SetStateAction<QuoteProject[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  materials: Material[];
  estimates: EstimateRecord[];
  setEstimates: React.Dispatch<React.SetStateAction<EstimateRecord[]>>;
  openEstimateId?: string | null;
  setOpenEstimateId?: React.Dispatch<React.SetStateAction<string | null>>;
}

/** システム設定の税率・端数（US-0601） */
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

/** 見積番号付番（US-0604: 暫定 EST-YYYYMM-####） */
function nextEstimateNumber(estimates: EstimateRecord[]): string {
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
  const sameMonth = estimates.filter((e) => e.estimateNumber.startsWith(`EST-${yyyymm}`));
  const n = (sameMonth.length + 1).toString().padStart(4, '0');
  return `EST-${yyyymm}-${n}`;
}

const Quote: React.FC<QuoteProps> = ({ quoteProjects, setQuoteProjects, customers, materials, estimates, setEstimates, openEstimateId, setOpenEstimateId }) => {
  const { session } = useAuth();
  const { log: auditLog } = useAudit();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(quoteProjects[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlMapRef = useRef<Map<string, string>>(new Map());
  const [detailDrawing, setDetailDrawing] = useState<DrawingRecord | null>(null);
  const [deleteConfirmDrawing, setDeleteConfirmDrawing] = useState<DrawingRecord | null>(null);
  const [resultDrawing, setResultDrawing] = useState<DrawingRecord | null>(null);
  const [detailTargetPagesInput, setDetailTargetPagesInput] = useState('');
  const [aiDetectingDrawingId, setAiDetectingDrawingId] = useState<string | null>(null);
  const [takeoffSettings, setTakeoffSettings] = useState<TakeoffSettings>(DEFAULT_TAKEOFF_SETTINGS);
  const [editingTakeoffItems, setEditingTakeoffItems] = useState<TakeoffResultItem[]>([]);
  const [showTakeoffSettings, setShowTakeoffSettings] = useState(false);
  /** アップロード直後の「どの図面をAIに読み取らせるか」選択用 */
  const [selectPagesDrawing, setSelectPagesDrawing] = useState<DrawingRecord | null>(null);
  const [selectPagesManualInput, setSelectPagesManualInput] = useState('');
  /** 見積一覧 / 詳細（F-03） */
  const [estimateView, setEstimateView] = useState<'projects' | 'list' | 'detail'>('projects');
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [estimateToCancel, setEstimateToCancel] = useState<EstimateRecord | null>(null);
  const [estimateListStatus, setEstimateListStatus] = useState<string>('all');
  const [estimateListDateFrom, setEstimateListDateFrom] = useState('');
  const [estimateListDateTo, setEstimateListDateTo] = useState('');
  const [estimateListKeyword, setEstimateListKeyword] = useState('');
  useEffect(() => {
    setDetailTargetPagesInput(detailDrawing?.targetPages?.length ? detailDrawing.targetPages.join(',') : '');
  }, [detailDrawing?.id]);

  useEffect(() => {
    if (openEstimateId && estimates.some((e) => e.id === openEstimateId)) {
      setSelectedEstimateId(openEstimateId);
      setEstimateView('detail');
      setActiveTab('estimates');
      setOpenEstimateId?.(null);
    }
  }, [openEstimateId, estimates]);

  useEffect(() => {
    if (resultDrawing?.takeoffResult?.items) {
      setEditingTakeoffItems([...resultDrawing.takeoffResult.items]);
    } else {
      setEditingTakeoffItems([]);
    }
  }, [resultDrawing?.id, resultDrawing?.takeoffResult]);

  const projects = quoteProjects;
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const filteredProjects = projects.filter(project =>

    project.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.projectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /** 対象ページ選択ダイアログでAI判定結果を入力欄に反映 */
  useEffect(() => {
    if (!selectPagesDrawing || !selectedProject) return;
    const cur = selectedProject.drawings.find((d) => d.id === selectPagesDrawing.id);
    if (cur?.targetPages?.length) setSelectPagesManualInput(cur.targetPages.join(','));
  }, [selectPagesDrawing?.id, selectedProject?.drawings]);

  const loadDemoData = () => {
    if (!selectedProjectId) return;
    setQuoteProjects(prev =>
      prev.map(p =>
        p.id === selectedProjectId
          ? {
              ...p,
              extractedItems: [...DEMO_EXTRACTED],
              quoteItems: DEMO_QUOTE_ITEMS.map((q) => ({ ...q })),
              totalAmount: DEMO_TOTAL,
              uploadedFiles: p.uploadedFiles.length ? p.uploadedFiles : [{ name: '図面.pdf' }],
            }
          : p
      )
    );
    toast.success('デモデータを読み込みました。「算出結果」「見積書」タブで確認できます。');
    setActiveTab('extract');
  };

  /** US-0601: 拾い結果から見積（下書き）生成。マスタ単価 or AI算出単価・税率はシステム設定 */
  const createEstimateFromExtract = () => {
    if (!selectedProject || !selectedProjectId) return;
    const extracted = selectedProject.extractedItems;
    if (extracted.length === 0) {
      toast.error('算出結果がありません。先にデモを読み込むか、図面から抽出してください。');
      return;
    }
    const cust = customers.find((c) => c.companyName === selectedProject.customerName) ?? customers[0];
    const { taxRate, taxRounding } = getBasicSettings();
    const items: EstimateLineItem[] = extracted.map((e, i) => {
      const mat = materials.find((m) => m.name === e.item && (m as { isActive?: boolean }).isActive !== false);
      const fromMaster = !!mat;
      const unitPrice = mat?.standardPrice ?? Math.round(800 + Math.random() * 400);
      const amount = e.quantity * unitPrice;
      return {
        id: `li-${Date.now()}-${i}`,
        item: e.item,
        quantity: e.quantity,
        unit: e.unit,
        unitPrice,
        amount,
        unitPriceSource: fromMaster ? 'master' : 'ai',
      };
    });
    const subtotal = items.reduce((s, r) => s + r.amount, 0);
    const taxAmount = calcTaxAmount(subtotal, taxRate, taxRounding);
    const total = subtotal + taxAmount;
    const now = new Date().toISOString().split('T')[0];
    const est: EstimateRecord = {
      id: `EST-ID-${Date.now()}`,
      estimateNumber: '',
      customerId: cust?.id ?? '',
      customerName: cust?.companyName ?? selectedProject.customerName,
      projectName: selectedProject.projectName,
      status: 'draft',
      items,
      subtotal,
      taxAmount,
      total,
      createdAt: now,
      updatedAt: now,
    };
    setEstimates((prev) => [...prev, est]);
    setSelectedEstimateId(est.id);
    setEstimateView('detail');
    toast.success('見積（下書き）を作成しました。顧客・案件を確認し、確定してください。');
  };

  const selectedEstimate = useMemo(() => estimates.find((e) => e.id === selectedEstimateId) ?? null, [estimates, selectedEstimateId]);
  const filteredEstimates = useMemo(() => {
    let list = estimates.filter((e) => {
      if (estimateListStatus !== 'all' && e.status !== estimateListStatus) return false;
      if (estimateListDateFrom && e.updatedAt < estimateListDateFrom) return false;
      if (estimateListDateTo && e.updatedAt > estimateListDateTo) return false;
      if (estimateListKeyword.trim()) {
        const k = estimateListKeyword.toLowerCase();
        if (!(e.estimateNumber || '').toLowerCase().includes(k) && !e.customerName.toLowerCase().includes(k) && !e.projectName.toLowerCase().includes(k)) return false;
      }
      return true;
    });
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [estimates, estimateListStatus, estimateListDateFrom, estimateListDateTo, estimateListKeyword]);

  const recalcEstimate = (items: EstimateLineItem[], taxRate: number, taxRounding: 'half' | 'down' | 'up') => {
    const subtotal = items.reduce((s, r) => s + r.amount, 0);
    const taxAmount = calcTaxAmount(subtotal, taxRate, taxRounding);
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  const updateEstimateItem = (estId: string, lineId: string, field: 'quantity' | 'unitPrice', value: number) => {
    setEstimates((prev) =>
      prev.map((e) => {
        if (e.id !== estId || e.status !== 'draft') return e;
        const items = e.items.map((li) => {
          if (li.id !== lineId) return li;
          if (field === 'quantity') {
            const amount = value * li.unitPrice;
            return { ...li, quantity: value, amount };
          }
          const amount = li.quantity * value;
          return { ...li, unitPrice: value, amount };
        });
        const { subtotal, taxAmount, total } = recalcEstimate(items, getBasicSettings().taxRate, getBasicSettings().taxRounding);
        return { ...e, items, subtotal, taxAmount, total, updatedAt: new Date().toISOString().split('T')[0] };
      })
    );
  };

  const addEstimateRow = (estId: string) => {
    setEstimates((prev) =>
      prev.map((e) => {
        if (e.id !== estId || e.status !== 'draft') return e;
        const newItem: EstimateLineItem = {
          id: `li-${Date.now()}`,
          item: '',
          quantity: 1,
          unit: '式',
          unitPrice: 0,
          amount: 0,
          unitPriceSource: 'master',
        };
        const items = [...e.items, newItem];
        const { subtotal, taxAmount, total } = recalcEstimate(items, getBasicSettings().taxRate, getBasicSettings().taxRounding);
        return { ...e, items, subtotal, taxAmount, total, updatedAt: new Date().toISOString().split('T')[0] };
      })
    );
  };

  const removeEstimateRow = (estId: string, lineId: string) => {
    setEstimates((prev) =>
      prev.map((e) => {
        if (e.id !== estId || e.status !== 'draft') return e;
        const items = e.items.filter((li) => li.id !== lineId);
        const { subtotal, taxAmount, total } = recalcEstimate(items, getBasicSettings().taxRate, getBasicSettings().taxRounding);
        return { ...e, items, subtotal, taxAmount, total, updatedAt: new Date().toISOString().split('T')[0] };
      })
    );
  };

  const updateEstimateHeader = (estId: string, field: 'customerId' | 'customerName' | 'projectName', value: string) => {
    setEstimates((prev) =>
      prev.map((e) => {
        if (e.id !== estId) return e;
        if (field === 'customerId') {
          const cust = customers.find((c) => c.id === value);
          return { ...e, customerId: value, customerName: cust?.companyName ?? e.customerName, updatedAt: new Date().toISOString().split('T')[0] };
        }
        if (field === 'customerName') return { ...e, customerName: value, updatedAt: new Date().toISOString().split('T')[0] };
        return { ...e, projectName: value, updatedAt: new Date().toISOString().split('T')[0] };
      })
    );
  };

  const updateEstimateLineItem = (estId: string, lineId: string, field: 'item' | 'quantity' | 'unit' | 'unitPrice', value: string | number) => {
    setEstimates((prev) =>
      prev.map((e) => {
        if (e.id !== estId || e.status !== 'draft') return e;
        const items = e.items.map((li) => {
          if (li.id !== lineId) return li;
          if (field === 'item') return { ...li, item: String(value) };
          if (field === 'unit') return { ...li, unit: String(value) };
          if (field === 'quantity') {
            const q = Number(value);
            const amount = Math.round((isNaN(q) ? 0 : q) * li.unitPrice);
            return { ...li, quantity: isNaN(q) ? 0 : q, amount };
          }
          const p = Number(value);
          const amount = Math.round(li.quantity * (isNaN(p) ? 0 : p));
          return { ...li, unitPrice: isNaN(p) ? 0 : p, amount };
        });
        const { subtotal, taxAmount, total } = recalcEstimate(items, getBasicSettings().taxRate, getBasicSettings().taxRounding);
        return { ...e, items, subtotal, taxAmount, total, updatedAt: new Date().toISOString().split('T')[0] };
      })
    );
  };

  /** US-0602: 保存時バリデーション（不正値は保存不可） */
  const validateEstimate = (e: EstimateRecord): string | null => {
    if (!e.customerId?.trim()) return '顧客を選択してください。';
    if (!e.projectName?.trim()) return '案件名を入力してください。';
    for (const li of e.items) {
      if (li.quantity <= 0 || !Number.isFinite(li.quantity)) return `品目「${li.item || '(未入力)'}」の数量が不正です。`;
      if (li.unitPrice < 0 || !Number.isFinite(li.unitPrice)) return `品目「${li.item}」の単価が不正です。`;
    }
    return null;
  };

  const saveEstimate = (est: EstimateRecord) => {
    const err = validateEstimate(est);
    if (err) {
      toast.error(err);
      return;
    }
    auditLog({ userId: session?.user?.id ?? '', action: '見積編集', targetId: est.id, result: 'success' });
    toast.success('見積を保存しました。');
  };

  /** US-0604: 確定（見積番号付番・監査必須） */
  const confirmEstimate = (est: EstimateRecord) => {
    const err = validateEstimate(est);
    if (err) {
      toast.error(`必須項目未入力のため確定できません。${err}`);
      return;
    }
    const num = nextEstimateNumber(estimates);
    setEstimates((prev) =>
      prev.map((e) => (e.id === est.id ? { ...e, status: 'confirmed' as const, estimateNumber: num, updatedAt: new Date().toISOString().split('T')[0] } : e))
    );
    auditLog({ userId: session?.user?.id ?? '', action: '見積確定', targetId: est.id, result: 'success' });
    toast.success(`見積を確定しました。見積番号: ${num}`);
  };

  /** US-0606: 取消（理由・監査） */
  const doCancelEstimate = (est: EstimateRecord, reason: string) => {
    setEstimates((prev) =>
      prev.map((e) => (e.id === est.id ? { ...e, status: 'cancelled' as const, cancelReason: reason.trim() || undefined, updatedAt: new Date().toISOString().split('T')[0] } : e))
    );
    setCancelDialogOpen(false);
    setEstimateToCancel(null);
    setCancelReason('');
    auditLog({ userId: session?.user?.id ?? '', action: '見積取消', targetId: est.id, result: 'success' });
    toast.success('見積を取消しました。');
  };

  /** US-0605: 複製（改版元ID保持） */
  const duplicateEstimate = (est: EstimateRecord) => {
    const now = new Date().toISOString().split('T')[0];
    const copy: EstimateRecord = {
      ...est,
      id: `EST-ID-${Date.now()}`,
      estimateNumber: '',
      status: 'draft',
      sourceEstimateId: est.id,
      createdAt: now,
      updatedAt: now,
      items: est.items.map((li) => ({ ...li, id: `li-${Date.now()}-${li.id}` })),
    };
    setEstimates((prev) => [...prev, copy]);
    setSelectedEstimateId(copy.id);
    toast.success('見積を複製しました（改版元を参照）。');
  };

  /** US-0607: Excel出力（監査） */
  const exportEstimateExcel = (est: EstimateRecord) => {
    const { taxRate } = getBasicSettings();
    const rows = [
      ['見積書'],
      ['見積番号', est.estimateNumber || '(下書き)'],
      ['顧客', est.customerName],
      ['案件名', est.projectName],
      [''],
      ['品目', '数量', '単位', '単価', '金額'],
      ...est.items.map((li) => [li.item, li.quantity, li.unit, li.unitPrice, li.amount]),
      [''],
      ['小計', '', '', '', est.subtotal],
      [`消費税（${taxRate}%）`, '', '', '', est.taxAmount],
      ['合計', '', '', '', est.total],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '見積');
    XLSX.writeFile(wb, `見積_${est.estimateNumber || est.id}.xlsx`);
    auditLog({ userId: session?.user?.id ?? '', action: '見積Excel出力', targetId: est.id, result: 'success' });
    toast.success('Excelをダウンロードしました。');
  };

  const updateQuoteItem = (quoteItemId: number, field: 'quantity' | 'unitPrice', value: number) => {
    if (!selectedProjectId) return;
    setQuoteProjects((prev) =>
      prev.map((p) => {
        if (p.id !== selectedProjectId) return p;
        const items = p.quoteItems.map((q) => {
          if (q.id !== quoteItemId) return q;
          if (field === 'quantity') {
            const amount = value * q.unitPrice;
            return { ...q, quantity: value, amount };
          }
          const amount = q.quantity * value;
          return { ...q, unitPrice: value, amount };
        });
        const totalAmount = items.reduce((s, r) => s + r.amount, 0);
        return { ...p, quoteItems: items, totalAmount };
      })
    );
  };

  const handleStartNewProject = () => {
    const newProject: QuoteProject = {
      id: Math.random().toString(36).substr(2, 9),
      customerName: `新規顧客${Math.floor(Math.random() * 1000) + 1}`,
      projectName: `内装工事（東京）`,
      status: 'draft',
      totalAmount: 0,
      lastUpdated: new Date().toISOString().split('T')[0],
      uploadedFiles: [],
      drawings: [],
      extractedItems: [],
      quoteItems: [],
    };
    setQuoteProjects([newProject, ...projects]);
    setSelectedProjectId(newProject.id);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedProjectId) return;
    if (file.type !== 'application/pdf') {
      toast.error('PDF以外のファイルは受付できません。PDFをアップロードしてください。');
      return;
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      toast.error(`50MBを超えるファイルは受付できません。現在: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      return;
    }
    if (file.name.toLowerCase().includes('over200') || file.name.toLowerCase().includes('200page')) {
      toast.error('200ページを超えるPDFは受付できません。');
      return;
    }
    const now = new Date().toISOString().split('T')[0];
    const drawingId = `DWG-${Date.now()}`;
    const registeredBy = session?.user?.displayName ?? 'オーナー';
    const url = URL.createObjectURL(file);
    previewUrlMapRef.current.set(drawingId, url);
    const newDrawing: DrawingRecord = {
      id: drawingId,
      name: file.name,
      registeredAt: now,
      registeredBy,
      status: '未処理',
      lastUpdated: now,
      fileSizeBytes: file.size,
      pageCount: undefined,
      takeoffJobHistory: [],
      archived: false,
    };
    setQuoteProjects((prev) =>
      prev.map((p) =>
        p.id === selectedProjectId
          ? { ...p, drawings: [...(p.drawings ?? []), newDrawing], lastUpdated: now }
          : p
      )
    );
    auditLog({
      userId: session?.user?.id ?? '',
      action: '図面アップロード',
      targetId: drawingId,
      result: 'success',
    });
    setSelectPagesDrawing(newDrawing);
    setSelectPagesManualInput('');
    toast.success(`「${file.name}」を登録しました。どの図面をAIに読み取らせるか選択してください。`);
  };

  /** US-0501: 自動拾い開始。未処理 or エラー時のみジョブ作成。処理中は二重起動しない。 */
  const startTakeoff = (drawing: DrawingRecord) => {
    if (!selectedProjectId) return;
    if (drawing.status === '処理中') {
      toast.info('処理中のため二重起動できません。「処理中」のまま進捗を確認してください。');
      return;
    }
    const jobId = `JOB-${Date.now()}`;
    const startedAt = new Date().toISOString();
    const isRetry = drawing.status === 'エラー';
    setQuoteProjects((prev) =>
      prev.map((p) => {
        if (p.id !== selectedProjectId) return p;
        return {
          ...p,
          drawings: p.drawings.map((d) =>
            d.id === drawing.id
              ? {
                  ...d,
                  status: '処理中' as const,
                  lastUpdated: startedAt.split('T')[0],
                  pipelineStep: '前処理中',
                  takeoffJobHistory: [
                    ...d.takeoffJobHistory,
                    { id: jobId, startedAt, status: 'running' as const },
                  ],
                  ...(isRetry && { retryCount: (d.retryCount ?? 0) + 1 }),
                }
              : d
          ),
        };
      })
    );
    auditLog({
      userId: session?.user?.id ?? '',
      action: '自動拾い開始',
      targetId: jobId,
      result: 'success',
    });
    toast.success(isRetry ? '再実行を開始しました。' : '自動拾いを開始しました。');
    runTakeoffPipeline(drawing.id, jobId);
  };

  /** US-0502–0505: OCRパイプライン（前処理→OCR→構造化）。完了/失敗でジョブ更新。進捗表示継続。 */
  const runTakeoffPipeline = (drawingId: string, jobId: string) => {
    const steps = ['前処理中', 'OCR実行中', '構造化データ変換中', 'レイアウト解析・LLM連携中', '数量・平米算出・誤差チェック中'];
    const failCodes = ['OCR_FAILED', 'LAYOUT_PARSE_ERROR', 'CALC_ERROR'] as const;
    let stepIndex = 0;
    const tick = () => {
      setQuoteProjects((prev) =>
        prev.map((p) => {
          if (p.id !== selectedProjectId) return p;
          const d = p.drawings.find((x) => x.id === drawingId);
          if (!d || d.status !== '処理中') return p;
          return {
            ...p,
            drawings: p.drawings.map((dd) =>
              dd.id === drawingId ? { ...dd, pipelineStep: steps[stepIndex] } : dd
            ),
          };
        })
      );
      stepIndex++;
      if (stepIndex < steps.length) {
        setTimeout(tick, 600);
      } else {
        finishPipeline(drawingId, jobId);
      }
    };
    setTimeout(tick, 400);
  };

  const finishPipeline = (drawingId: string, jobId: string) => {
    const endedAt = new Date().toISOString();
    const shouldFail = Math.random() < 0.2;
    const errorCode = shouldFail ? 'OCR_FAILED' : undefined;
    const errorMessage = shouldFail ? 'PDFのテキスト抽出に失敗しました。スキャン品質を確認してください。' : undefined;
    const mockResult = shouldFail ? null : buildMockTakeoffResult();
    setQuoteProjects((prev) =>
      prev.map((p) => {
        if (p.id !== selectedProjectId) return p;
        const updatedDrawings = p.drawings.map((d) => {
          if (d.id !== drawingId) return d;
          const history = d.takeoffJobHistory.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  endedAt,
                  status: (shouldFail ? 'error' : 'completed') as 'running' | 'completed' | 'error',
                  ...(errorCode && { errorCode, errorMessage }),
                }
              : j
          );
          return {
            ...d,
            status: (shouldFail ? 'エラー' : '完了') as '未処理' | '処理中' | '完了' | 'エラー',
            lastUpdated: endedAt.split('T')[0],
            pipelineStep: undefined,
            takeoffJobHistory: history,
            ...(mockResult && { takeoffResult: mockResult }),
          };
        });
        return {
          ...p,
          drawings: updatedDrawings,
          ...(mockResult && {
            extractedItems: mockResult.items.map((it, i) => ({
              id: `e-${drawingId}-${i}`,
              item: it.item,
              quantity: it.quantity,
              unit: it.unit,
              category: it.category,
            })),
          }),
        };
      })
    );
    if (shouldFail) {
      auditLog({
        userId: session?.user?.id ?? '',
        action: '自動拾いジョブ完了',
        targetId: jobId,
        result: 'failure',
        failureCode: errorCode,
      });
    }
  };

  const archiveDrawing = (drawing: DrawingRecord) => {
    if (!selectedProjectId) return;
    setQuoteProjects((prev) =>
      prev.map((p) =>
        p.id === selectedProjectId
          ? {
              ...p,
              drawings: p.drawings.map((d) =>
                d.id === drawing.id ? { ...d, archived: true } : d
              ),
            }
          : p
      )
    );
    auditLog({
      userId: session?.user?.id ?? '',
      action: '図面アーカイブ',
      targetId: drawing.id,
      result: 'success',
    });
    toast.success('図面をアーカイブしました');
  };

  const updateDrawingTargetPages = (drawingId: string, targetPages: number[], mode?: PageSelectionMode) => {
    if (!selectedProjectId) return;
    setQuoteProjects((prev) =>
      prev.map((p) =>
        p.id === selectedProjectId
          ? {
              ...p,
              drawings: p.drawings.map((d) =>
                d.id === drawingId
                  ? {
                      ...d,
                      targetPages: targetPages.length ? targetPages : undefined,
                      ...(mode !== undefined && { pageSelectionMode: mode }),
                    }
                  : d
              ),
            }
          : p
      )
    );
  };

  /** AIで図面ページを自動判定（デモ: モックで対象ページを提案） */
  const runAIPageDetection = (drawing: DrawingRecord) => {
    if (!selectedProjectId) return;
    setAiDetectingDrawingId(drawing.id);
    const maxPage = drawing.pageCount ?? 20;
    const suggested = Array.from({ length: Math.min(5, Math.max(1, Math.floor(maxPage / 3))) }, (_, i) => 2 + i * 3).filter((p) => p <= maxPage);
    if (suggested.length === 0) suggested.push(1);
    setTimeout(() => {
      setQuoteProjects((prev) =>
        prev.map((p) =>
          p.id === selectedProjectId
            ? {
                ...p,
                drawings: p.drawings.map((d) =>
                  d.id === drawing.id
                    ? {
                        ...d,
                        aiSuggestedPages: suggested,
                        targetPages: suggested,
                        pageSelectionMode: 'auto' as const,
                      }
                    : d
                ),
              }
            : p
        )
      );
      setDetailTargetPagesInput(suggested.join(','));
      setAiDetectingDrawingId(null);
      toast.success(`AIが図面ページを判定しました（対象: ${suggested.join(', ')}ページ）。必要に応じて手動で修正できます。`);
    }, 1200);
  };

  const deleteDrawing = (drawing: DrawingRecord) => {
    if (!selectedProjectId) return;
    const url = previewUrlMapRef.current.get(drawing.id);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlMapRef.current.delete(drawing.id);
    }
    setQuoteProjects((prev) =>
      prev.map((p) =>
        p.id === selectedProjectId
          ? { ...p, drawings: p.drawings.filter((d) => d.id !== drawing.id) }
          : p
      )
    );
    auditLog({
      userId: session?.user?.id ?? '',
      action: '図面削除',
      targetId: drawing.id,
      result: 'success',
    });
    setDeleteConfirmDrawing(null);
    toast.success('図面を削除しました');
  };

  const getProjectStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-600 text-white">完了</Badge>;
      case 'in_progress': return <Badge className="bg-primary text-white">進行中</Badge>;
      case 'sent': return <Badge className="bg-blue-500 text-white">送付済</Badge>;
      case 'draft': return <Badge variant="outline">下書き</Badge>;
      default: return <Badge variant="outline">不明</Badge>;
    }
  };

  return (
    <div className="h-full flex">
      <div className="w-80 bg-surface border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium">見積プロジェクト</h2>
            <Button size="sm" onClick={handleStartNewProject} className="bg-primary hover:bg-primary-hover">
              <Plus className="w-4 h-4 mr-1" />新規
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="プロジェクトを検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className={`p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${selectedProjectId === project.id ? 'bg-muted/70 border-r-2 border-r-primary' : ''}`}
              onClick={() => setSelectedProjectId(project.id)}
            >
              <div className="space-y-2">
                <h3 className="font-medium truncate">{project.customerName}</h3>
                <p className="text-sm text-muted-foreground truncate">{project.projectName}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{project.lastUpdated}</span>
                  {getProjectStatusBadge(project.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">¥{project.totalAmount.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">{(project.drawings ?? []).length}図面</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {selectedProject ? (
          <>
            <div className="p-6 border-b border-border bg-surface">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="flex items-center space-x-2"><Building className="w-5 h-5" /><span>{selectedProject.customerName}</span></h1>
                  <p className="text-muted-foreground">{selectedProject.projectName}</p>
                </div>
                <div className="flex items-center space-x-4">
                  {getProjectStatusBadge(selectedProject.status)}
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">合計金額</p>
                    <p className="text-xl font-bold text-primary">¥{selectedProject.totalAmount.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="upload">図面アップロード</TabsTrigger>
                  <TabsTrigger value="extract">算出結果</TabsTrigger>
                  <TabsTrigger value="estimates">見積一覧（F-03）</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="space-y-6">
                  <Card className="border border-border">
                    <CardHeader>
                      <CardTitle>図面アップロード（EPIC-04 F-01）</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        <strong>1.</strong> PDFをアップロード → <strong>2.</strong> どの図面をAIに読み取らせるか対象ページを選択 → <strong>3.</strong> 「選択を確定してAI解析を開始」でAI解析を実行します。
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        PDFのみ・50MB以下（200ページ超は本番で拒否）。図面PDFには他業種用・図面以外のページが含まれる場合があるため、対象ページの選択が必須です。
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <div
                        className="border-2 border-dashed border-border rounded-md p-8 text-center hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary'); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-primary');
                          const file = e.dataTransfer.files?.[0];
                          if (!file) return;
                          if (file.type !== 'application/pdf') {
                            toast.error('PDF以外のファイルは受付できません。PDFをアップロードしてください。');
                            return;
                          }
                          if (file.size > MAX_PDF_SIZE_BYTES) {
                            toast.error(`50MBを超えるファイルは受付できません。現在: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
                            return;
                          }
                          if (file.name.toLowerCase().includes('over200') || file.name.toLowerCase().includes('200page')) {
                            toast.error('200ページを超えるPDFは受付できません。');
                            return;
                          }
                          const now = new Date().toISOString().split('T')[0];
                          const drawingId = `DWG-${Date.now()}`;
                          const registeredBy = session?.user?.displayName ?? 'オーナー';
                          const url = URL.createObjectURL(file);
                          previewUrlMapRef.current.set(drawingId, url);
                          const newDrawing: DrawingRecord = {
                            id: drawingId,
                            name: file.name,
                            registeredAt: now,
                            registeredBy,
                            status: '未処理',
                            lastUpdated: now,
                            fileSizeBytes: file.size,
                            takeoffJobHistory: [],
                            archived: false,
                          };
                          setQuoteProjects((prev) =>
                            prev.map((p) =>
                              p.id === selectedProjectId!
                                ? { ...p, drawings: [...(p.drawings ?? []), newDrawing], lastUpdated: now }
                                : p
                            )
                          );
                          auditLog({ userId: session?.user?.id ?? '', action: '図面アップロード', targetId: drawingId, result: 'success' });
                          setSelectPagesDrawing(newDrawing);
                          setSelectPagesManualInput('');
                          toast.success(`「${file.name}」を登録しました。どの図面をAIに読み取らせるか選択してください。`);
                        }}
                      >
                        <Upload className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-medium mb-2">PDFをドラッグ&ドロップ / クリックして選択</p>
                        <p className="text-sm text-muted-foreground">PDFのみ・50MB以下（200ページ超は本番で受付拒否）</p>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <Button variant="outline" onClick={loadDemoData} className="shrink-0">
                          <Sparkles className="w-4 h-4 mr-2" />
                          デモを読み込む
                        </Button>
                        <span className="text-sm text-muted-foreground">サンプルの算出結果・見積を即表示</span>
                      </div>
                      {/* US-0503: LLM/誤差閾値設定（更新は監査ログ） */}
                      <div className="border-t border-border pt-4 mt-4">
                        <Button variant="ghost" size="sm" onClick={() => setShowTakeoffSettings((v) => !v)}>
                          {showTakeoffSettings ? '拾い・LLM設定を閉じる' : '拾い・LLM設定（US-0503）'}
                        </Button>
                        {showTakeoffSettings && (
                          <div className="grid gap-2 mt-2 text-sm">
                            <div className="flex gap-2 items-center">
                              <Label className="w-24">モデル</Label>
                              <Input
                                value={takeoffSettings.llmModel}
                                onChange={(e) => setTakeoffSettings((s) => ({ ...s, llmModel: e.target.value }))}
                                className="h-8"
                              />
                            </div>
                            <div className="flex gap-2 items-center">
                              <Label className="w-24">温度</Label>
                              <Input
                                type="number"
                                step={0.1}
                                min={0}
                                max={2}
                                value={takeoffSettings.llmTemperature}
                                onChange={(e) => setTakeoffSettings((s) => ({ ...s, llmTemperature: Number(e.target.value) || 0 }))}
                                className="h-8 w-20"
                              />
                            </div>
                            <div className="flex gap-2 items-center">
                              <Label className="w-24">誤差閾値%</Label>
                              <Input
                                type="number"
                                value={takeoffSettings.errorThresholdPercent}
                                onChange={(e) => setTakeoffSettings((s) => ({ ...s, errorThresholdPercent: Number(e.target.value) || 0 }))}
                                className="h-8 w-20"
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                auditLog({ userId: session?.user?.id ?? '', action: '拾い設定更新', targetId: 'takeoff-settings', result: 'success' });
                                toast.success('設定を保存しました。変更は監査ログに記録されています。');
                              }}
                            >
                              設定を保存（監査ログに記録）
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* アップロード後: どの図面をAIに読み取らせるか選択 */}
                  <Dialog open={!!selectPagesDrawing} onOpenChange={(open) => { if (!open) { setSelectPagesDrawing(null); setSelectPagesManualInput(''); } }}>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>対象ページの選択</DialogTitle>
                        <DialogDescription>
                          {selectPagesDrawing?.name} のうち、<strong>どの図面（ページ）をAIに読み取らせますか？</strong> 対象を選択してからAI解析を実行できます。
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        {selectPagesDrawing && (() => {
                          const current = selectedProject?.drawings.find((d) => d.id === selectPagesDrawing.id) ?? selectPagesDrawing;
                          return (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={!!aiDetectingDrawingId}
                                  onClick={() => runAIPageDetection(current)}
                                >
                                  {aiDetectingDrawingId === current.id ? '判定中...' : <><Sparkles className="w-4 h-4 mr-1" />AIで対象ページを判定</>}
                                </Button>
                                {current.targetPages?.length ? (
                                  <span className="text-sm text-muted-foreground">対象: {current.targetPages.join(', ')} ページ</span>
                                ) : null}
                              </div>
                              <div>
                                <Label className="text-sm">手動で指定（例: 1,3,5-7）</Label>
                                <Input
                                  placeholder="例: 1,3,5-7"
                                  className="mt-1"
                                  value={selectPagesManualInput}
                                  onChange={(e) => setSelectPagesManualInput(e.target.value)}
                                />
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setSelectPagesDrawing(null); setSelectPagesManualInput(''); }}>
                          あとで選択する
                        </Button>
                        <Button
                          onClick={() => {
                            if (!selectPagesDrawing) return;
                            const current = selectedProject?.drawings.find((d) => d.id === selectPagesDrawing.id) ?? selectPagesDrawing;
                            const parsed = (() => {
                              const parts = selectPagesManualInput.trim().split(/[,\s]+/).filter(Boolean);
                              const pages: number[] = [];
                              for (const p of parts) {
                                if (p.includes('-')) {
                                  const [a, b] = p.split('-').map(Number);
                                  if (!isNaN(a) && !isNaN(b)) for (let i = a; i <= b; i++) pages.push(i);
                                } else {
                                  const n = parseInt(p, 10);
                                  if (!isNaN(n)) pages.push(n);
                                }
                              }
                              return [...new Set(pages)].sort((a, b) => a - b);
                            })();
                            const pagesToUse = parsed.length > 0 ? parsed : (current.targetPages ?? []);
                            if (!pagesToUse.length) {
                              toast.error('対象ページを指定するか、「AIで対象ページを判定」を実行してください。');
                              return;
                            }
                            updateDrawingTargetPages(selectPagesDrawing.id, pagesToUse, current.pageSelectionMode ?? 'manual');
                            setSelectPagesDrawing(null);
                            setSelectPagesManualInput('');
                            setResultDrawing(selectPagesDrawing);
                            setEditingTakeoffItems([]);
                            toast.success(`対象ページを選択しました。AI解析を開始します。`);
                            setTimeout(() => startTakeoff(selectPagesDrawing), 0);
                          }}
                        >
                          選択を確定してAI解析を開始
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={!!detailDrawing}
                    onOpenChange={(open) => {
                      if (!open) {
                        setDetailDrawing(null);
                        setDetailTargetPagesInput('');
                      }
                    }}
                  >
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                      <DialogHeader>
                        <DialogTitle>図面詳細・プレビュー（US-0403）</DialogTitle>
                        <DialogDescription>
                          {detailDrawing?.name} — 登録日: {detailDrawing?.registeredAt} / 登録者: {detailDrawing?.registeredBy}
                        </DialogDescription>
                        <p className="text-sm text-muted-foreground rounded-md bg-muted/50 p-3">
                          図面PDFには他業種用や図面以外のページが含まれる場合があります。<strong>AIで自動判定</strong>するか、<strong>対象ページを手動指定</strong>して拾い対象を限定してください。
                        </p>
                      </DialogHeader>
                      <div className="flex-1 overflow-auto space-y-4">
                        {detailDrawing && (() => {
                          const currentDrawing = selectedProject?.drawings.find((d) => d.id === detailDrawing.id) ?? detailDrawing;
                          return (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={!!aiDetectingDrawingId}
                                onClick={() => runAIPageDetection(detailDrawing)}
                              >
                                {aiDetectingDrawingId === detailDrawing.id ? (
                                  <>判定中...</>
                                ) : (
                                  <><Sparkles className="w-4 h-4 mr-1" />AIで対象ページを判定</>
                                )}
                              </Button>
                              {currentDrawing.pageSelectionMode && (
                                <Badge variant="outline" className="text-xs">
                                  {currentDrawing.pageSelectionMode === 'auto' ? 'AI判定済み' : '手動指定'}
                                </Badge>
                              )}
                              {currentDrawing.targetPages?.length ? (
                                <span className="text-xs text-muted-foreground">
                                  対象: {currentDrawing.targetPages.join(', ')} ページ
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-end gap-2">
                              <div className="flex-1">
                                <Label className="text-sm font-medium">対象ページを手動指定（US-0401）</Label>
                                <Input
                                  placeholder="例: 1,3,5-7（カンマ・ハイフン区切り）"
                                  value={detailTargetPagesInput}
                                  onChange={(e) => setDetailTargetPagesInput(e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const parts = detailTargetPagesInput.trim().split(/[,\s]+/).filter(Boolean);
                                  const pages: number[] = [];
                                  for (const p of parts) {
                                    if (p.includes('-')) {
                                      const [a, b] = p.split('-').map(Number);
                                      if (!isNaN(a) && !isNaN(b)) for (let i = a; i <= b; i++) pages.push(i);
                                    } else {
                                      const n = parseInt(p, 10);
                                      if (!isNaN(n)) pages.push(n);
                                    }
                                  }
                                  updateDrawingTargetPages(detailDrawing.id, [...new Set(pages)].sort((a, b) => a - b), 'manual');
                                  toast.success('対象ページを保存しました');
                                }}
                              >
                                反映
                              </Button>
                            </div>
                          </div>
                          );
                        })()}
                        <div>
                          <Label className="text-sm font-medium">PDFプレビュー</Label>
                          <div className="border border-border rounded-md bg-muted/30 mt-1 min-h-[200px] flex items-center justify-center">
                            {detailDrawing && previewUrlMapRef.current.get(detailDrawing.id) ? (
                              <iframe
                                title={detailDrawing.name}
                                src={previewUrlMapRef.current.get(detailDrawing.id)!}
                                className="w-full h-[400px] rounded-md"
                              />
                            ) : (
                              <p className="text-muted-foreground py-8">プレビューは同じセッションでアップロードした図面のみ表示されます。</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">自動拾いジョブ履歴</Label>
                          <div className="mt-1 border border-border rounded-md overflow-hidden">
                            {detailDrawing?.takeoffJobHistory.length ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>ジョブID</TableHead>
                                    <TableHead>開始</TableHead>
                                    <TableHead>終了</TableHead>
                                    <TableHead>状態</TableHead>
                                    <TableHead>エラーコード</TableHead>
                                    <TableHead>理由</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {detailDrawing.takeoffJobHistory.map((j) => (
                                    <TableRow key={j.id}>
                                      <TableCell className="text-xs font-mono">{j.id}</TableCell>
                                      <TableCell className="text-sm">{new Date(j.startedAt).toLocaleString('ja-JP')}</TableCell>
                                      <TableCell className="text-sm">{j.endedAt ? new Date(j.endedAt).toLocaleString('ja-JP') : '-'}</TableCell>
                                      <TableCell>
                                        <Badge variant={j.status === 'completed' ? 'default' : j.status === 'error' ? 'destructive' : 'secondary'}>
                                          {j.status === 'running' ? '実行中' : j.status === 'completed' ? '完了' : '失敗'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-sm">{j.errorCode ?? j.error ?? '-'}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={j.errorMessage ?? j.error}>{j.errorMessage ?? j.error ?? '-'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <p className="text-muted-foreground p-4 text-sm">ジョブ履歴はまだありません。「自動拾い開始」で実行できます。</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailDrawing(null)}>閉じる</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* US-0506: 拾い結果表示（処理中=進捗 / 完了=結果 / 失敗=エラー+再実行） */}
                  <Dialog
                    open={!!resultDrawing}
                    onOpenChange={(open) => {
                      if (!open) {
                        setResultDrawing(null);
                        setEditingTakeoffItems([]);
                      }
                    }}
                  >
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                      <DialogHeader>
                        <DialogTitle>拾い結果（US-0506 / F-02）</DialogTitle>
                        <DialogDescription>
                          {resultDrawing?.name}
                          {(() => {
                            const current = selectedProject?.drawings.find((d) => d.id === resultDrawing?.id);
                            return current ? ` — ステータス: ${current.status}` : '';
                          })()}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex-1 overflow-auto space-y-4">
                        {resultDrawing && (() => {
                          const current = selectedProject?.drawings.find((d) => d.id === resultDrawing.id) ?? resultDrawing;
                          if (current.status === '処理中') {
                            return (
                              <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
                                <p className="font-medium text-primary">処理中です</p>
                                <p className="text-sm text-muted-foreground mt-2">{current.pipelineStep ?? '前処理→OCR→構造化データ変換を実行しています。'}</p>
                                <p className="text-xs text-muted-foreground mt-2">（US-0502: 進捗表示は継続します）</p>
                              </div>
                            );
                          }
                          if (current.status === 'エラー') {
                            const lastJob = current.takeoffJobHistory.filter((j) => j.status === 'error').pop() ?? current.takeoffJobHistory[current.takeoffJobHistory.length - 1];
                            return (
                              <div className="space-y-4">
                                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                                  <p className="font-medium text-destructive">ジョブが失敗しました</p>
                                  <p className="text-sm mt-1">エラーコード: {lastJob?.errorCode ?? 'UNKNOWN'}</p>
                                  <p className="text-sm text-muted-foreground">{lastJob?.errorMessage ?? lastJob?.error ?? '原因の詳細はジョブ履歴を参照してください。'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button onClick={() => startTakeoff(current)}>再実行（US-0508）</Button>
                                  <span className="text-xs text-muted-foreground">再実行回数: {current.retryCount ?? 0}</span>
                                </div>
                              </div>
                            );
                          }
                          if (current.status === '完了' && current.takeoffResult) {
                            const items = editingTakeoffItems.length ? editingTakeoffItems : current.takeoffResult.items;
                            const isOwner = session?.user?.role === 'owner';
                            return (
                              <div className="space-y-4">
                                <div>
                                  <Label className="text-sm font-medium">部屋・面積</Label>
                                  <Table className="mt-1">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>部屋</TableHead>
                                        <TableHead className="text-right">面積（m²）</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {current.takeoffResult.rooms.map((r) => (
                                        <TableRow key={r.id}>
                                          <TableCell>{r.name}</TableCell>
                                          <TableCell className="text-right">{r.areaM2 ?? '-'}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium">部材・数量・平米（US-0507: 編集可能）</Label>
                                  <Table className="mt-1">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>品目</TableHead>
                                        <TableHead className="text-right">数量</TableHead>
                                        <TableHead>単位</TableHead>
                                        <TableHead>カテゴリ</TableHead>
                                        <TableHead>平米</TableHead>
                                        <TableHead>算出根拠</TableHead>
                                        <TableHead>警告</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {items.map((row, idx) => (
                                        <TableRow key={row.id}>
                                          <TableCell>
                                            {isOwner ? (
                                              <Input
                                                value={row.item}
                                                onChange={(e) => {
                                                  const next = [...(editingTakeoffItems.length ? editingTakeoffItems : current.takeoffResult!.items)];
                                                  next[idx] = { ...next[idx], item: e.target.value };
                                                  setEditingTakeoffItems(next);
                                                }}
                                                className="h-8 text-sm"
                                              />
                                            ) : (
                                              row.item
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {isOwner ? (
                                              <Input
                                                type="number"
                                                className="w-20 h-8 text-right"
                                                value={row.quantity}
                                                onChange={(e) => {
                                                  const next = [...(editingTakeoffItems.length ? editingTakeoffItems : current.takeoffResult!.items)];
                                                  next[idx] = { ...next[idx], quantity: Number(e.target.value) || 0 };
                                                  setEditingTakeoffItems(next);
                                                }}
                                              />
                                            ) : (
                                              row.quantity
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {isOwner ? (
                                              <Input
                                                value={row.unit}
                                                onChange={(e) => {
                                                  const next = [...(editingTakeoffItems.length ? editingTakeoffItems : current.takeoffResult!.items)];
                                                  next[idx] = { ...next[idx], unit: e.target.value };
                                                  setEditingTakeoffItems(next);
                                                }}
                                                className="w-16 h-8 text-sm"
                                              />
                                            ) : (
                                              row.unit
                                            )}
                                          </TableCell>
                                          <TableCell className="text-muted-foreground text-sm">{row.category ?? '-'}</TableCell>
                                          <TableCell className="text-sm">{row.areaM2 ?? '-'}</TableCell>
                                          <TableCell className="text-xs text-muted-foreground">{row.calculationBasis?.stepId ?? '-'}</TableCell>
                                          <TableCell className="text-xs text-amber-600">{row.warning ?? '-'}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                                {isOwner && (
                                  <Button
                                    onClick={() => {
                                      if (!selectedProjectId || !current.takeoffResult) return;
                                      const nextItems = editingTakeoffItems.length ? editingTakeoffItems : current.takeoffResult.items;
                                      setQuoteProjects((prev) =>
                                        prev.map((p) =>
                                          p.id !== selectedProjectId
                                            ? p
                                            : {
                                                ...p,
                                                drawings: p.drawings.map((dd) =>
                                                  dd.id === current.id
                                                    ? { ...dd, takeoffResult: { ...dd.takeoffResult!, items: nextItems, rooms: dd.takeoffResult!.rooms, completedAt: dd.takeoffResult!.completedAt } }
                                                    : dd
                                                ),
                                              }
                                        )
                                      );
                                      auditLog({
                                        userId: session?.user?.id ?? '',
                                        action: '拾い結果編集',
                                        targetId: current.id,
                                        result: 'success',
                                      });
                                      setEditingTakeoffItems([]);
                                      toast.success('保存しました。編集履歴は監査ログに記録されています。');
                                    }}
                                  >
                                    保存（永続化・監査ログ）
                                  </Button>
                                )}
                                {!isOwner && (
                                  <p className="text-sm text-muted-foreground">権限のない操作（現場）のため編集・保存は実行できません。</p>
                                )}
                              </div>
                            );
                          }
                          return <p className="text-muted-foreground">拾い結果はまだありません。</p>;
                        })()}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setResultDrawing(null); setEditingTakeoffItems([]); }}>閉じる</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog open={!!deleteConfirmDrawing} onOpenChange={(open) => !open && setDeleteConfirmDrawing(null)}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>図面を削除しますか？</AlertDialogTitle>
                        <AlertDialogDescription>
                          {deleteConfirmDrawing?.name} を削除すると復元できません。よろしいですか？（US-0404）
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteConfirmDrawing(null)}>キャンセル</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteConfirmDrawing && deleteDrawing(deleteConfirmDrawing)}
                        >
                          削除する
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TabsContent>
                <TabsContent value="extract" className="space-y-6">
                  <Card className="border border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle>AI算出結果</CardTitle>
                      {selectedProject.extractedItems.length === 0 && (
                        <Button variant="outline" size="sm" onClick={loadDemoData}>
                          <Sparkles className="w-4 h-4 mr-1" /> デモを読み込む
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      {selectedProject.extractedItems.length === 0 ? (
                        <p className="text-muted-foreground">図面をアップロードしてAI解析を実行するか、「デモを読み込む」でサンプルを表示してください。</p>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground mb-4">図面から抽出した材料・工種と数量です。見積書タブで単価を付けて見積を作成できます。</p>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>品目</TableHead>
                                <TableHead>数量</TableHead>
                                <TableHead>単位</TableHead>
                                <TableHead>カテゴリ</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedProject.extractedItems.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell className="font-medium">{row.item}</TableCell>
                                  <TableCell>{row.quantity.toLocaleString()}</TableCell>
                                  <TableCell>{row.unit}</TableCell>
                                  <TableCell className="text-muted-foreground">{row.category ?? '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="mt-4">
                            <Button variant="outline" onClick={() => { createEstimateFromExtract(); setActiveTab('estimates'); }}>
                              拾い結果から見積を作成（US-0601）
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="estimates" className="space-y-6">
                  {selectedEstimateId && selectedEstimate ? (
                    <Card className="border border-border">
                      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                        <CardTitle>見積詳細（US-0602 / US-0603）</CardTitle>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedEstimateId(null); }}>一覧へ</Button>
                          {selectedEstimate.status === 'draft' && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => saveEstimate(selectedEstimate)}>保存</Button>
                              <Button size="sm" onClick={() => confirmEstimate(selectedEstimate)}><CheckCircle className="w-4 h-4 mr-1" />確定</Button>
                              <Button variant="outline" size="sm" onClick={() => { setEstimateToCancel(selectedEstimate); setCancelDialogOpen(true); }}><XCircle className="w-4 h-4 mr-1" />取消</Button>
                            </>
                          )}
                          {(selectedEstimate.status === 'confirmed' || selectedEstimate.status === 'cancelled') && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => duplicateEstimate(selectedEstimate)}><Copy className="w-4 h-4 mr-1" />複製</Button>
                              <Button variant="outline" size="sm" onClick={() => exportEstimateExcel(selectedEstimate)}><Download className="w-4 h-4 mr-1" />Excel出力</Button>
                            </>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <Label>顧客（US-0603）</Label>
                            <Select
                              value={selectedEstimate.customerId}
                              onValueChange={(v) => updateEstimateHeader(selectedEstimate.id, 'customerId', v)}
                              disabled={selectedEstimate.status !== 'draft'}
                            >
                              <SelectTrigger><SelectValue placeholder="顧客を選択" /></SelectTrigger>
                              <SelectContent>
                                {customers.filter((c) => c.type !== 'supplier').map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>案件名・工事名</Label>
                            <Input
                              value={selectedEstimate.projectName}
                              onChange={(e) => updateEstimateHeader(selectedEstimate.id, 'projectName', e.target.value)}
                              disabled={selectedEstimate.status !== 'draft'}
                              placeholder="案件名を入力"
                            />
                          </div>
                        </div>
                        {selectedEstimate.estimateNumber && <p className="text-sm text-muted-foreground">見積番号: {selectedEstimate.estimateNumber}</p>}
                        {selectedEstimate.status !== 'draft' && <Badge variant={selectedEstimate.status === 'confirmed' ? 'default' : 'destructive'}>{selectedEstimate.status === 'confirmed' ? '確定' : '取消'}</Badge>}
                        <div>
                          <Label>明細（品目/数量/単位/単価/金額）</Label>
                          <Table className="mt-1">
                            <TableHeader>
                              <TableRow>
                                <TableHead>品目</TableHead>
                                <TableHead className="text-right w-24">数量</TableHead>
                                <TableHead className="w-20">単位</TableHead>
                                <TableHead className="text-right w-28">単価</TableHead>
                                <TableHead className="text-right w-28">金額</TableHead>
                                <TableHead className="w-20">単価元</TableHead>
                                {selectedEstimate.status === 'draft' && <TableHead className="w-12" />}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedEstimate.items.map((li) => (
                                <TableRow key={li.id}>
                                  <TableCell>
                                    <Input
                                      value={li.item}
                                      onChange={(e) => updateEstimateLineItem(selectedEstimate.id, li.id, 'item', e.target.value)}
                                      disabled={selectedEstimate.status !== 'draft'}
                                      className="h-8"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      min={0}
                                      className="h-8 w-24 text-right"
                                      value={li.quantity}
                                      onChange={(e) => updateEstimateLineItem(selectedEstimate.id, li.id, 'quantity', e.target.value)}
                                      disabled={selectedEstimate.status !== 'draft'}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={li.unit}
                                      onChange={(e) => updateEstimateLineItem(selectedEstimate.id, li.id, 'unit', e.target.value)}
                                      disabled={selectedEstimate.status !== 'draft'}
                                      className="h-8 w-20"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      min={0}
                                      className="h-8 w-28 text-right"
                                      value={li.unitPrice}
                                      onChange={(e) => updateEstimateLineItem(selectedEstimate.id, li.id, 'unitPrice', e.target.value)}
                                      disabled={selectedEstimate.status !== 'draft'}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right font-medium">¥{li.amount.toLocaleString()}</TableCell>
                                  <TableCell>{li.unitPriceSource === 'ai' ? <Badge variant="secondary">AI算出</Badge> : <span className="text-muted-foreground text-xs">マスタ</span>}</TableCell>
                                  {selectedEstimate.status === 'draft' && (
                                    <TableCell>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeEstimateRow(selectedEstimate.id, li.id)}><Trash2 className="w-4 h-4" /></Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {selectedEstimate.status === 'draft' && (
                            <Button variant="outline" size="sm" className="mt-2" onClick={() => addEstimateRow(selectedEstimate.id)}><Plus className="w-4 h-4 mr-1" />行追加</Button>
                          )}
                        </div>
                        <div className="flex justify-end border-t pt-4">
                          <div className="text-right space-y-1">
                            <p className="text-sm text-muted-foreground">小計 ¥{selectedEstimate.subtotal.toLocaleString()}</p>
                            <p className="text-sm">消費税（{getBasicSettings().taxRate}%） ¥{selectedEstimate.taxAmount.toLocaleString()}</p>
                            <p className="text-xl font-bold text-primary">合計 ¥{selectedEstimate.total.toLocaleString()}</p>
                          </div>
                        </div>
                        {selectedEstimate.status === 'cancelled' && selectedEstimate.cancelReason && (
                          <p className="text-sm text-muted-foreground">取消理由: {selectedEstimate.cancelReason}</p>
                        )}
                        {selectedEstimate.sourceEstimateId && <p className="text-xs text-muted-foreground">改版元: {selectedEstimate.sourceEstimateId}</p>}
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <Card className="border border-border">
                        <CardHeader>
                          <CardTitle>見積一覧・検索（US-0608）</CardTitle>
                          <div className="flex flex-wrap items-center gap-4 mt-4">
                            <div className="relative flex-1 min-w-[140px] max-w-xs">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input placeholder="キーワード（見積番号・顧客・案件）" value={estimateListKeyword} onChange={(e) => setEstimateListKeyword(e.target.value)} className="pl-10" />
                            </div>
                            <Select value={estimateListStatus} onValueChange={setEstimateListStatus}>
                              <SelectTrigger className="w-32"><SelectValue placeholder="状態" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">すべて</SelectItem>
                                <SelectItem value="draft">下書き</SelectItem>
                                <SelectItem value="confirmed">確定</SelectItem>
                                <SelectItem value="cancelled">取消</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm text-muted-foreground whitespace-nowrap">更新日</Label>
                              <Input type="date" value={estimateListDateFrom} onChange={(e) => setEstimateListDateFrom(e.target.value)} className="w-36" />
                              <span className="text-muted-foreground">～</span>
                              <Input type="date" value={estimateListDateTo} onChange={(e) => setEstimateListDateTo(e.target.value)} className="w-36" />
                            </div>
                            <span className="text-sm text-muted-foreground">{filteredEstimates.length}件</span>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>見積番号</TableHead>
                                <TableHead>顧客</TableHead>
                                <TableHead>案件</TableHead>
                                <TableHead>状態</TableHead>
                                <TableHead className="text-right">金額</TableHead>
                                <TableHead>更新日</TableHead>
                                <TableHead className="w-20" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredEstimates.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">見積がありません。算出結果タブで「拾い結果から見積を作成」を実行してください。</TableCell>
                                </TableRow>
                              ) : (
                                filteredEstimates.map((e) => (
                                  <TableRow key={e.id}>
                                    <TableCell className="font-mono text-sm">{e.estimateNumber || '(下書き)'}</TableCell>
                                    <TableCell>{e.customerName}</TableCell>
                                    <TableCell>{e.projectName}</TableCell>
                                    <TableCell>
                                      <Badge variant={e.status === 'confirmed' ? 'default' : e.status === 'cancelled' ? 'destructive' : 'secondary'}>{e.status === 'draft' ? '下書き' : e.status === 'confirmed' ? '確定' : '取消'}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">¥{e.total.toLocaleString()}</TableCell>
                                    <TableCell className="text-sm">{e.updatedAt}</TableCell>
                                    <TableCell>
                                      <Button variant="ghost" size="sm" onClick={() => setSelectedEstimateId(e.id)}>開く</Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </>
                  )}
                  <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>見積を取消しますか？</AlertDialogTitle>
                        <AlertDialogDescription>取消理由を入力してください（暫定: 必須推奨）。</AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-2">
                        <Label>取消理由</Label>
                        <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="理由を入力" className="mt-1" />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => { setCancelDialogOpen(false); setEstimateToCancel(null); setCancelReason(''); }}>キャンセル</AlertDialogCancel>
                        <AlertDialogAction onClick={() => estimateToCancel && doCancelEstimate(estimateToCancel, cancelReason)} disabled={!cancelReason.trim()}>取消する</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
              <h3 className="font-medium">プロジェクトを選択してください</h3>
              <p className="text-sm text-muted-foreground">左側のリストからプロジェクトを選択するか、新規プロジェクトを作成してください</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Quote;
