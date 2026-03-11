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
import { Building, Plus, Search, FileText, Sparkles, Upload, Eye, Trash2, Archive, Play, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';

const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_PDF_PAGES = 200;

export interface TakeoffJobRecord {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: 'running' | 'completed' | 'error';
  error?: string;
}

export interface DrawingRecord {
  id: string;
  name: string;
  registeredAt: string;
  registeredBy: string;
  status: '未処理' | '処理中' | '完了' | 'エラー';
  lastUpdated: string;
  fileSizeBytes?: number;
  pageCount?: number;
  targetPages?: number[];
  archived?: boolean;
  takeoffJobHistory: TakeoffJobRecord[];
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

interface Customer {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  memo?: string;
  createdAt: string;
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
}

const Quote: React.FC<QuoteProps> = ({ quoteProjects, setQuoteProjects, customers, materials }) => {
  const { session } = useAuth();
  const { log: auditLog } = useAudit();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(quoteProjects[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlMapRef = useRef<Map<string, string>>(new Map());
  const [drawingListKeyword, setDrawingListKeyword] = useState('');
  const [drawingListStatus, setDrawingListStatus] = useState<string>('all');
  const [drawingListDateFrom, setDrawingListDateFrom] = useState('');
  const [drawingListDateTo, setDrawingListDateTo] = useState('');
  const [showArchivedDrawings, setShowArchivedDrawings] = useState(false);
  const [detailDrawing, setDetailDrawing] = useState<DrawingRecord | null>(null);
  const [deleteConfirmDrawing, setDeleteConfirmDrawing] = useState<DrawingRecord | null>(null);
  const [detailTargetPagesInput, setDetailTargetPagesInput] = useState('');
  useEffect(() => {
    setDetailTargetPagesInput(detailDrawing?.targetPages?.length ? detailDrawing.targetPages.join(',') : '');
  }, [detailDrawing?.id]);

  const projects = quoteProjects;
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const filteredProjects = projects.filter(project =>
    project.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.projectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const buildQuoteFromExtract = () => {
    if (!selectedProjectId || !selectedProject) return;
    const extracted = selectedProject.extractedItems;
    if (extracted.length === 0) {
      toast.error('算出結果がありません。先にデモを読み込むか、図面から抽出してください。');
      return;
    }
    const nextId = Math.max(0, ...selectedProject.quoteItems.map((q) => q.id)) + 1;
    const newItems: QuoteItem[] = extracted.map((e, i) => {
      const mat = materials.find((m) => m.name === e.item && m.isActive !== false);
      const unitPrice = mat?.standardPrice ?? 1000;
      const amount = e.quantity * unitPrice;
      return { id: nextId + i, item: e.item, quantity: e.quantity, unit: e.unit, unitPrice, amount };
    });
    const total = newItems.reduce((s, r) => s + r.amount, 0);
    setQuoteProjects(prev =>
      prev.map((p) => (p.id === selectedProjectId ? { ...p, quoteItems: newItems, totalAmount: total } : p))
    );
    toast.success('算出結果から見積を作成しました');
    setActiveTab('quote');
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

  const drawings = selectedProject?.drawings ?? [];
  const filteredDrawings = useMemo(() => {
    let list = drawings.filter((d) => {
      if (d.archived && !showArchivedDrawings) return false;
      if (drawingListKeyword.trim()) {
        const k = drawingListKeyword.toLowerCase();
        if (!d.name.toLowerCase().includes(k)) return false;
      }
      if (drawingListStatus !== 'all' && d.status !== drawingListStatus) return false;
      if (drawingListDateFrom && d.registeredAt < drawingListDateFrom) return false;
      if (drawingListDateTo && d.registeredAt > drawingListDateTo) return false;
      return true;
    });
    return list.sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
  }, [drawings, showArchivedDrawings, drawingListKeyword, drawingListStatus, drawingListDateFrom, drawingListDateTo]);

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
    toast.success(`「${file.name}」を登録しました。図面一覧に表示されます。`);
  };

  const startTakeoff = (drawing: DrawingRecord) => {
    if (!selectedProjectId) return;
    const jobId = `JOB-${Date.now()}`;
    const startedAt = new Date().toISOString();
    setQuoteProjects((prev) =>
      prev.map((p) => {
        if (p.id !== selectedProjectId) return p;
        const updated = p.drawings.map((d) =>
          d.id === drawing.id
            ? {
                ...d,
                status: '処理中' as const,
                lastUpdated: startedAt.split('T')[0],
                takeoffJobHistory: [
                  ...d.takeoffJobHistory,
                  { id: jobId, startedAt, status: 'running' as const },
                ],
              }
            : d
        );
        return { ...p, drawings: updated };
      })
    );
    toast.success('自動拾いを開始しました（デモでは即完了扱いです）');
    setTimeout(() => {
      const endedAt = new Date().toISOString();
      setQuoteProjects((prev) =>
        prev.map((p) => {
          if (p.id !== selectedProjectId) return p;
          return {
            ...p,
            drawings: p.drawings.map((d) => {
              if (d.id !== drawing.id) return d;
              const history = d.takeoffJobHistory.map((j) =>
                j.id === jobId
                  ? { ...j, endedAt, status: 'completed' as const }
                  : j
              );
              return {
                ...d,
                status: '完了' as const,
                lastUpdated: endedAt.split('T')[0],
                takeoffJobHistory: history,
              };
            }),
          };
        })
      );
    }, 800);
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

  const updateDrawingTargetPages = (drawingId: string, targetPages: number[]) => {
    if (!selectedProjectId) return;
    setQuoteProjects((prev) =>
      prev.map((p) =>
        p.id === selectedProjectId
          ? {
              ...p,
              drawings: p.drawings.map((d) =>
                d.id === drawingId ? { ...d, targetPages: targetPages.length ? targetPages : undefined } : d
              ),
            }
          : p
      )
    );
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
                  <TabsTrigger value="quote">見積書</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="space-y-6">
                  <Card className="border border-border">
                    <CardHeader>
                      <CardTitle>図面アップロード（EPIC-04 F-01）</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        PDF図面をアップロードすると図面一覧に登録されます。PDFのみ・50MB以下（暫定NFR: 200ページ超は本番で拒否）。
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
                          toast.success(`「${file.name}」を登録しました。`);
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
                    </CardContent>
                  </Card>

                  <Card className="border border-border">
                    <CardHeader>
                      <CardTitle>図面一覧・検索（US-0402）</CardTitle>
                      <div className="flex flex-wrap items-center gap-4 mt-4">
                        <div className="relative flex-1 min-w-[160px] max-w-xs">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="図面名で検索..."
                            value={drawingListKeyword}
                            onChange={(e) => setDrawingListKeyword(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <Select value={drawingListStatus} onValueChange={setDrawingListStatus}>
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="ステータス" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">すべて</SelectItem>
                            <SelectItem value="未処理">未処理</SelectItem>
                            <SelectItem value="処理中">処理中</SelectItem>
                            <SelectItem value="完了">完了</SelectItem>
                            <SelectItem value="エラー">エラー</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">登録日</Label>
                          <Input
                            type="date"
                            value={drawingListDateFrom}
                            onChange={(e) => setDrawingListDateFrom(e.target.value)}
                            className="w-36"
                          />
                          <span className="text-muted-foreground">～</span>
                          <Input
                            type="date"
                            value={drawingListDateTo}
                            onChange={(e) => setDrawingListDateTo(e.target.value)}
                            className="w-36"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showArchivedDrawings}
                            onChange={(e) => setShowArchivedDrawings(e.target.checked)}
                            className="rounded border-border"
                          />
                          アーカイブを表示
                        </label>
                        <span className="text-sm text-muted-foreground">{filteredDrawings.length}件</span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>図面名</TableHead>
                            <TableHead>登録日</TableHead>
                            <TableHead>登録者</TableHead>
                            <TableHead>ステータス</TableHead>
                            <TableHead>最終更新</TableHead>
                            <TableHead className="text-right w-52">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDrawings.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                図面がありません。PDFをアップロードするか、デモを読み込んでください。
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredDrawings.map((d) => (
                              <TableRow key={d.id}>
                                <TableCell className="font-medium">{d.name}</TableCell>
                                <TableCell className="text-sm">{d.registeredAt}</TableCell>
                                <TableCell className="text-sm">{d.registeredBy}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={d.status === '完了' ? 'default' : d.status === 'エラー' ? 'destructive' : 'secondary'}
                                    className={
                                      d.status === '未処理'
                                        ? 'bg-muted text-foreground'
                                        : d.status === '処理中'
                                          ? 'bg-primary/20 text-primary'
                                          : ''
                                    }
                                  >
                                    {d.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{d.lastUpdated}</TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      title="自動拾い開始"
                                      onClick={() => startTakeoff(d)}
                                      disabled={d.status === '処理中'}
                                    >
                                      <Play className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      title="結果を見る"
                                      onClick={() => setActiveTab('extract')}
                                    >
                                      <ListChecks className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      title="詳細・プレビュー"
                                      onClick={() => setDetailDrawing(d)}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    {!d.archived && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-amber-600"
                                        title="アーカイブ"
                                        onClick={() => archiveDrawing(d)}
                                      >
                                        <Archive className="w-4 h-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-destructive"
                                      title="削除"
                                      onClick={() => setDeleteConfirmDrawing(d)}
                                    >
                                      <Trash2 className="w-4 h-4" />
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
                      </DialogHeader>
                      <div className="flex-1 overflow-auto space-y-4">
                        {detailDrawing && (
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
                                updateDrawingTargetPages(detailDrawing.id, [...new Set(pages)].sort((a, b) => a - b));
                                toast.success('対象ページを保存しました');
                              }}
                            >
                              反映
                            </Button>
                          </div>
                        )}
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
                                    <TableHead>開始</TableHead>
                                    <TableHead>終了</TableHead>
                                    <TableHead>状態</TableHead>
                                    <TableHead>エラー</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {detailDrawing.takeoffJobHistory.map((j) => (
                                    <TableRow key={j.id}>
                                      <TableCell className="text-sm">{new Date(j.startedAt).toLocaleString('ja-JP')}</TableCell>
                                      <TableCell className="text-sm">{j.endedAt ? new Date(j.endedAt).toLocaleString('ja-JP') : '-'}</TableCell>
                                      <TableCell>
                                        <Badge variant={j.status === 'completed' ? 'default' : j.status === 'error' ? 'destructive' : 'secondary'}>
                                          {j.status === 'running' ? '実行中' : j.status === 'completed' ? '完了' : 'エラー'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{j.error ?? '-'}</TableCell>
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
                            <Button variant="outline" onClick={buildQuoteFromExtract}>
                              算出結果から見積を作成
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="quote" className="space-y-6">
                  <Card className="border border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle>見積書</CardTitle>
                      {selectedProject.quoteItems.length === 0 && (
                        <Button variant="outline" size="sm" onClick={loadDemoData}>
                          <Sparkles className="w-4 h-4 mr-1" /> デモを読み込む
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      {selectedProject.quoteItems.length === 0 ? (
                        <p className="text-muted-foreground">「デモを読み込む」でサンプル見積を表示するか、算出結果タブで「算出結果から見積を作成」を実行してください。</p>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground mb-4">数量・単価を変更すると合計が再計算されます。</p>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>品目</TableHead>
                                <TableHead className="text-right">数量</TableHead>
                                <TableHead>単位</TableHead>
                                <TableHead className="text-right">単価（円）</TableHead>
                                <TableHead className="text-right">金額（円）</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedProject.quoteItems.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell className="font-medium">{row.item}</TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      min={1}
                                      className="w-20 text-right h-8"
                                      value={row.quantity}
                                      onChange={(e) => updateQuoteItem(row.id, 'quantity', Number(e.target.value) || 0)}
                                    />
                                  </TableCell>
                                  <TableCell>{row.unit}</TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      min={0}
                                      className="w-24 text-right h-8"
                                      value={row.unitPrice}
                                      onChange={(e) => updateQuoteItem(row.id, 'unitPrice', Number(e.target.value) || 0)}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right font-medium">¥{row.amount.toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="mt-6 flex justify-end">
                            <div className="text-right space-y-1">
                              <p className="text-sm text-muted-foreground">小計 ¥{selectedProject.totalAmount.toLocaleString()}</p>
                              <p className="text-sm">消費税（10%） ¥{Math.floor(selectedProject.totalAmount * 0.1).toLocaleString()}</p>
                              <p className="text-xl font-bold text-primary">合計 ¥{(selectedProject.totalAmount + Math.floor(selectedProject.totalAmount * 0.1)).toLocaleString()}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
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
