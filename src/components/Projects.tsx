import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Plus, Search, Edit2, Archive, Eye, Building2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAudit } from '../contexts/AuditContext';
import { useAuth } from '../contexts/AuthContext';

interface Project {
  id: string;
  projectName: string;
  customerName: string;
  location: string;
  assignee: string;
  startDate: string;
  endDate: string;
  status: string;
  memo?: string;
  createdAt: string;
  archived: boolean;
}

interface ProjectsProps {
  customers: { id: string; companyName: string }[];
  setCustomers: React.Dispatch<React.SetStateAction<any[]>>;
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

const Projects: React.FC<ProjectsProps> = ({ customers }) => {
  const { session } = useAuth();
  const { log: auditLog } = useAudit();
  const [projects, setProjects] = useState<Project[]>([
    { id: 'PRJ-001', projectName: 'A邸内装工事', customerName: 'A邸プロジェクト', location: '東京都品川区', assignee: '田中太郎', startDate: '2024-12-01', endDate: '2024-12-15', status: 'in-progress', createdAt: '2024-11-20', archived: false },
    { id: 'PRJ-002', projectName: 'Bビル改修工事', customerName: 'Bビル改修', location: '東京都新宿区', assignee: '佐藤花子', startDate: '2024-12-05', endDate: '2024-12-20', status: 'in-progress', createdAt: '2024-11-22', archived: false },
    { id: 'PRJ-003', projectName: 'C店舗改装', customerName: 'A邸プロジェクト', location: '東京都渋谷区', assignee: '山田次郎', startDate: '2025-01-10', endDate: '2025-01-25', status: 'scheduled', createdAt: '2024-12-01', archived: false },
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('startDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [form, setForm] = useState({ projectName: '', customerName: '', startDate: '', endDate: '', assignee: '', status: 'scheduled', memo: '' });

  const filteredProjects = useMemo(() => {
    let list = projects.filter((p) => {
      const matchArchived = !p.archived;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchSearch =
        !searchTerm ||
        p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.assignee || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchArchived && matchStatus && matchSearch;
    });
    list = [...list].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), 'ja');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [projects, searchTerm, statusFilter, sortKey, sortDir]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = { scheduled: 'bg-blue-500', 'in-progress': 'bg-primary', completed: 'bg-green-600', 'on-hold': 'bg-amber-500', lost: 'bg-red-600' };
    const label: Record<string, string> = { scheduled: '予定', 'in-progress': '進行中', completed: '完了', 'on-hold': '保留', lost: '失注' };
    return <Badge className={`${map[status] || 'bg-gray-500'} text-white`}>{label[status] || status}</Badge>;
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) =>
    sortKey === column ? sortDir === 'asc' ? <ArrowUp className="w-4 h-4 inline ml-1" /> : <ArrowDown className="w-4 h-4 inline ml-1" /> : <ArrowUpDown className="w-4 h-4 inline ml-1 opacity-50" />;

  const openCreate = () => {
    setEditingProject(null);
    setForm({
      projectName: '',
      customerName: (customers as { type?: string; companyName: string }[]).find((c) => c.type === 'customer')?.companyName ?? '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      assignee: '',
      status: 'scheduled',
      memo: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditingProject(p);
    setForm({
      projectName: p.projectName,
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
      auditLog({ userId: session?.user?.id ?? '', action: '案件編集', targetId: editingProject.id, result: 'success' });
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
          location: '',
          assignee: form.assignee.trim(),
          startDate: form.startDate,
          endDate: form.endDate || '',
          status: form.status,
          memo: form.memo || undefined,
          createdAt,
          archived: false,
        },
      ]);
      auditLog({ userId: session?.user?.id ?? '', action: '案件作成', targetId: id, result: 'success' });
      toast.success('案件を作成しました');
    }
    setDialogOpen(false);
  };

  const archiveProject = (p: Project) => {
    if (p.archived) return;
    setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, archived: true } : x)));
    auditLog({ userId: session?.user?.id ?? '', action: '案件アーカイブ', targetId: p.id, result: 'success' });
    toast.success('案件をアーカイブしました');
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">案件管理</h1>
          <p className="text-muted-foreground">案件の一覧・作成・編集（US-1021〜1025）</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4 mr-2" />
          新規案件
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="案件名・顧客・担当者で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="ステータスで絞り込み" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="scheduled">予定</SelectItem>
                <SelectItem value="in-progress">進行中</SelectItem>
                <SelectItem value="completed">完了</SelectItem>
                <SelectItem value="on-hold">保留</SelectItem>
                <SelectItem value="lost">失注</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{filteredProjects.length}件</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><button type="button" className="font-medium" onClick={() => toggleSort('projectName')}>案件名</button><SortIcon column="projectName" /></TableHead>
                <TableHead><button type="button" className="font-medium" onClick={() => toggleSort('customerName')}>顧客</button><SortIcon column="customerName" /></TableHead>
                <TableHead><button type="button" className="font-medium" onClick={() => toggleSort('status')}>ステータス</button><SortIcon column="status" /></TableHead>
                <TableHead><button type="button" className="font-medium" onClick={() => toggleSort('startDate')}>開始日</button><SortIcon column="startDate" /></TableHead>
                <TableHead><button type="button" className="font-medium" onClick={() => toggleSort('endDate')}>終了日</button><SortIcon column="endDate" /></TableHead>
                <TableHead><button type="button" className="font-medium" onClick={() => toggleSort('assignee')}>担当者</button><SortIcon column="assignee" /></TableHead>
                <TableHead><button type="button" className="font-medium" onClick={() => toggleSort('createdAt')}>作成日</button><SortIcon column="createdAt" /></TableHead>
                <TableHead className="w-40 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <Building2 className="w-12 h-12 mx-auto opacity-20 mb-2" />
                    <p>案件が見つかりません</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.projectName}</TableCell>
                    <TableCell>{project.customerName}</TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell className="text-sm">{project.startDate}</TableCell>
                    <TableCell className="text-sm">{project.endDate || '-'}</TableCell>
                    <TableCell className="text-sm">{project.assignee || '-'}</TableCell>
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
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-amber-600" title="アーカイブ" onClick={() => archiveProject(project)}>
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
            <DialogTitle>{editingProject ? '案件の編集' : '新規案件作成'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>案件名 *</Label>
              <Input value={form.projectName} onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))} placeholder="A邸内装工事" />
            </div>
            <div className="space-y-2">
              <Label>顧客 *</Label>
              <Select value={form.customerName || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, customerName: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="顧客を選択" /></SelectTrigger>
                <SelectContent>
                  {customers.filter((c: { type?: string }) => c.type === 'customer').map((c: { id: string; companyName: string }) => (
                    <SelectItem key={c.id} value={c.companyName}>{c.companyName}</SelectItem>
                  ))}
                  {customers.length === 0 && <SelectItem value="__none__">選択肢なし</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>開始日 *</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>終了日</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>担当者</Label>
              <Input value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))} placeholder="田中太郎" />
            </div>
            <div className="space-y-2">
              <Label>ステータス</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>備考</Label>
              <Input value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} placeholder="任意" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={saveProject}>{editingProject ? '更新' : '作成'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailProject} onOpenChange={() => setDetailProject(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>案件詳細</DialogTitle>
          </DialogHeader>
          {detailProject && (
            <div className="space-y-4">
              <p><span className="text-muted-foreground">案件名:</span> {detailProject.projectName}</p>
              <p><span className="text-muted-foreground">顧客:</span> {detailProject.customerName}</p>
              <p><span className="text-muted-foreground">ステータス:</span> {getStatusBadge(detailProject.status)}</p>
              <p><span className="text-muted-foreground">開始日 / 終了日:</span> {detailProject.startDate} ～ {detailProject.endDate || '-'}</p>
              <p><span className="text-muted-foreground">担当者:</span> {detailProject.assignee || '-'}</p>
              <p><span className="text-muted-foreground">作成日:</span> {detailProject.createdAt}</p>
              {detailProject.memo && <p><span className="text-muted-foreground">備考:</span> {detailProject.memo}</p>}
              <p className="text-sm text-muted-foreground">紐づく見積・発注・請求は今後の拡張で表示します。</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projects;
