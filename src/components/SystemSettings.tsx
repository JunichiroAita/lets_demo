import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Settings2, Package, TrendingUp, UserCheck, Plus, Edit, Search, History, ScrollText, Trash2, Layers, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import type { MaterialRecord } from '../App';
import type { PurchasePriceObjectRecord, PurchasePriceObjectEntry } from '../types/purchasePriceObject';
import { resolveMaterialPurchasePrice } from '../lib/resolveMaterialPurchasePrice';
import { getLoginHistory, useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';

interface SystemSettingsProps {
  materials?: MaterialRecord[];
  setMaterials?: React.Dispatch<React.SetStateAction<MaterialRecord[]>>;
  employees?: EmployeeRecord[];
  setEmployees?: React.Dispatch<React.SetStateAction<EmployeeRecord[]>>;
  purchasePriceObjects?: PurchasePriceObjectRecord[];
  setPurchasePriceObjects?: React.Dispatch<React.SetStateAction<PurchasePriceObjectRecord[]>>;
  activePurchasePriceObjectId?: string | null;
  setActivePurchasePriceObjectId?: React.Dispatch<React.SetStateAction<string | null>>;
}

// 基本設定（税率・税端数・休憩既定）
interface BasicSettings {
  companyName: string;
  postalCode: string;
  address: string;
  phone: string;
  taxRate: number;
  taxRounding: 'half' | 'down' | 'up';
  memo: string;
  break1Start: string;
  break1End: string;
  break2Start: string;
  break2End: string;
  break3Start: string;
  break3End: string;
  /** 会社全体の休日（YYYY-MM-DD）。勤怠の休み登録の参考・集計に利用できます。 */
  companyHolidays: string[];
}

// 標準歩掛（係数・有効フラグ）
interface StandardRate {
  id: string;
  name: string;
  unit: string;
  rate: number;
  coefficient?: number;
  category: string;
  isActive?: boolean;
}

// 従業員（ログイン可能。退職時は isActive=false でシステムログイン不可）
export interface EmployeeRecord {
  id: string;
  employeeNumber: number; // 1から順に自動採番（編集不可）
  name: string;
  loginId: string;
  /** パスワード（編集時は変更時のみ更新。未設定時はログイン不可の想定） */
  password?: string;
  role: string;
  position?: string;   // 役職（未入力可）
  hireDate: string;    // 入社日（必須）
  isActive: boolean;
}

const defaultBasic: BasicSettings = {
  companyName: '',
  postalCode: '',
  address: '',
  phone: '',
  taxRate: 10,
  taxRounding: 'half',
  memo: '',
  break1Start: '10:00',
  break1End: '10:30',
  break2Start: '12:00',
  break2End: '13:00',
  break3Start: '15:00',
  break3End: '15:30',
  companyHolidays: [],
};

const initialRates: StandardRate[] = [
  { id: 'R1', name: '下地処理', unit: 'm2', rate: 1200, coefficient: 1, category: '左官', isActive: true },
  { id: 'R2', name: '石膏ボード張り', unit: 'm2', rate: 1800, coefficient: 1, category: '内装', isActive: true },
];

const initialEmployees: EmployeeRecord[] = [
  { id: 'E1', employeeNumber: 1, name: '管理者', loginId: 'admin', role: 'owner', hireDate: '2020-04-01', isActive: true },
  { id: 'E2', employeeNumber: 2, name: '現場', loginId: 'field1', role: 'field', hireDate: '2021-06-15', isActive: true },
];

const SystemSettings: React.FC<SystemSettingsProps> = ({
  materials = [],
  setMaterials,
  employees: propEmployees,
  setEmployees: setPropEmployees,
  purchasePriceObjects = [],
  setPurchasePriceObjects = () => {},
  activePurchasePriceObjectId = null,
  setActivePurchasePriceObjectId = () => {},
}) => {
  const { getLogs: getAuditLogs, log: auditLog } = useAudit();
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';
  const [activeTab, setActiveTab] = useState<'basic' | 'materials' | 'rates' | 'employees' | 'login-history' | 'audit-log'>('basic');

  // 基本設定（localStorage に保存する想定）
  const [basicSettings, setBasicSettings] = useState<BasicSettings>(() => {
    try {
      const saved = localStorage.getItem('lets_basic_settings');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<BasicSettings>;
        return {
          ...defaultBasic,
          ...parsed,
          companyHolidays: Array.isArray(parsed.companyHolidays) ? [...parsed.companyHolidays] : [],
        };
      }
    } catch (_) {}
    return defaultBasic;
  });

  const [newCompanyHolidayDate, setNewCompanyHolidayDate] = useState('');

  const [rates, setRates] = useState<StandardRate[]>(initialRates);
  const employees = propEmployees ?? [];
  const setEmployees = setPropEmployees ?? (() => {});

  // 材料ダイアログ
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialRecord | null>(null);
  const [materialForm, setMaterialForm] = useState({ name: '', code: '', category: '建材', unit: '枚', standardPrice: 0, sellingPrice: 0, memo: '', isActive: true });
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialsSubTab, setMaterialsSubTab] = useState<'master' | 'ppo'>('master');
  const [ppoDialogOpen, setPpoDialogOpen] = useState(false);
  const [editingPpo, setEditingPpo] = useState<PurchasePriceObjectRecord | null>(null);
  const [ppoForm, setPpoForm] = useState<{ name: string; memo: string; entries: PurchasePriceObjectEntry[] }>({
    name: '',
    memo: '',
    entries: [],
  });

  // 歩掛ダイアログ
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<StandardRate | null>(null);
  const [rateForm, setRateForm] = useState({ name: '', unit: 'm2', rate: 0, coefficient: 1, category: 'その他', isActive: true });
  const [rateSearch, setRateSearch] = useState('');

  // 従業員ダイアログ
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);
  const [employeeForm, setEmployeeForm] = useState({ name: '', loginId: '', password: '', role: 'field', position: '', hireDate: '', isActive: true });
  const [employeeSearch, setEmployeeSearch] = useState('');

  const saveBasicSettings = () => {
    try {
      const sortedHolidays = [...new Set(basicSettings.companyHolidays.filter(Boolean))].sort();
      const payload = { ...basicSettings, companyHolidays: sortedHolidays };
      localStorage.setItem('lets_basic_settings', JSON.stringify(payload));
      setBasicSettings(payload);
      toast.success('基本設定を保存しました');
    } catch {
      toast.error('保存に失敗しました');
    }
  };

  const addCompanyHolidayRow = () => {
    const d = newCompanyHolidayDate.trim();
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      toast.error('日付を選択してください');
      return;
    }
    if (basicSettings.companyHolidays.includes(d)) {
      toast.error('すでに登録されています');
      return;
    }
    setBasicSettings((s) => ({
      ...s,
      companyHolidays: [...s.companyHolidays, d].sort(),
    }));
    setNewCompanyHolidayDate('');
  };

  const removeCompanyHolidayRow = (date: string) => {
    setBasicSettings((s) => ({
      ...s,
      companyHolidays: s.companyHolidays.filter((x) => x !== date),
    }));
  };

  const filteredMaterials = useMemo(() => {
    if (!materialSearch.trim()) return materials;
    const q = materialSearch.toLowerCase();
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.code || '').toLowerCase().includes(q) ||
        (m.category || '').toLowerCase().includes(q)
    );
  }, [materials, materialSearch]);

  const filteredRates = useMemo(() => {
    if (!rateSearch.trim()) return rates;
    const q = rateSearch.toLowerCase();
    return rates.filter((r) => r.name.toLowerCase().includes(q) || (r.category || '').toLowerCase().includes(q));
  }, [rates, rateSearch]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const q = employeeSearch.toLowerCase();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.loginId || '').toLowerCase().includes(q) ||
        (e.position || '').toLowerCase().includes(q)
    );
  }, [employees, employeeSearch]);

  const openMaterialDialog = (m?: MaterialRecord) => {
    if (m) {
      setEditingMaterial(m);
      setMaterialForm({
        name: m.name,
        code: m.code,
        category: m.category,
        unit: m.unit,
        standardPrice: m.standardPrice,
        sellingPrice: m.sellingPrice ?? 0,
        memo: m.memo || '',
        isActive: m.isActive !== false,
      });
    } else {
      setEditingMaterial(null);
      setMaterialForm({ name: '', code: '', category: '建材', unit: '枚', standardPrice: 0, sellingPrice: 0, memo: '', isActive: true });
    }
    setMaterialDialogOpen(true);
  };

  const saveMaterial = () => {
    if (!materialForm.name.trim()) {
      toast.error('材料名を入力してください');
      return;
    }
    if (materialForm.standardPrice === '' || materialForm.standardPrice === undefined || (typeof materialForm.standardPrice === 'string' && materialForm.standardPrice.trim() === '')) {
      toast.error('基準仕入単価を入力してください（0円は登録可、空欄は不可）');
      return;
    }
    const price = Number(materialForm.standardPrice);
    if (Number.isNaN(price) || price < 0) {
      toast.error('基準仕入単価は0以上の数値を入力してください');
      return;
    }
    const sell = Number(materialForm.sellingPrice);
    if (Number.isNaN(sell) || sell < 0) {
      toast.error('販売単価は0以上の数値を入力してください');
      return;
    }
    if (!setMaterials) return;
    if (editingMaterial) {
      setMaterials((prev) =>
        prev.map((x) =>
          x.id === editingMaterial.id
            ? {
                ...x,
                name: materialForm.name.trim(),
                code: materialForm.code,
                category: materialForm.category,
                unit: materialForm.unit,
                standardPrice: price,
                sellingPrice: sell,
                memo: materialForm.memo || undefined,
                isActive: materialForm.isActive,
              }
            : x
        )
      );
      toast.success('材料を更新しました');
    } else {
      const id = 'M' + (Math.max(0, ...materials.map((m) => parseInt(m.id.replace(/\D/g, '') || '0', 10))) + 1);
      setMaterials((prev) => [
        ...prev,
        {
          id,
          name: materialForm.name.trim(),
          code: materialForm.code,
          category: materialForm.category,
          unit: materialForm.unit,
          standardPrice: price,
          sellingPrice: sell,
          memo: materialForm.memo || undefined,
          isActive: materialForm.isActive !== false,
        },
      ]);
      toast.success('材料を追加しました');
    }
    setMaterialDialogOpen(false);
  };

  const openPpoDialog = (ppo?: PurchasePriceObjectRecord) => {
    if (ppo) {
      setEditingPpo(ppo);
      setPpoForm({ name: ppo.name, memo: ppo.memo ?? '', entries: ppo.entries.map((e) => ({ ...e })) });
    } else {
      setEditingPpo(null);
      setPpoForm({ name: '', memo: '', entries: [] });
    }
    setPpoDialogOpen(true);
  };

  const savePpo = () => {
    if (!ppoForm.name.trim()) {
      toast.error('仕入れ価格オブジェクト名を入力してください');
      return;
    }
    const validIds = new Set(materials.map((m) => m.id));
    const rawEntries = ppoForm.entries
      .filter((e) => validIds.has(e.materialId))
      .map((e) => ({ materialId: e.materialId, purchasePrice: Math.max(0, Number(e.purchasePrice) || 0) }));
    const byMat = new Map<string, PurchasePriceObjectEntry>();
    rawEntries.forEach((e) => byMat.set(e.materialId, e));
    const entries = Array.from(byMat.values());
    if (editingPpo) {
      setPurchasePriceObjects((prev) =>
        prev.map((o) => (o.id === editingPpo.id ? { ...o, name: ppoForm.name.trim(), memo: ppoForm.memo.trim() || undefined, entries } : o))
      );
      auditLog({ userId, action: '仕入れ価格オブジェクト更新', targetId: editingPpo.id, result: 'success' });
      toast.success('仕入れ価格オブジェクトを更新しました');
    } else {
      const id = `ppo-${Date.now()}`;
      setPurchasePriceObjects((prev) => [...prev, { id, name: ppoForm.name.trim(), memo: ppoForm.memo.trim() || undefined, entries }]);
      auditLog({ userId, action: '仕入れ価格オブジェクト追加', targetId: id, result: 'success' });
      toast.success('仕入れ価格オブジェクトを追加しました');
    }
    setPpoDialogOpen(false);
  };

  const deletePpo = (id: string) => {
    if (!confirm('この仕入れ価格オブジェクトを削除しますか？')) return;
    setPurchasePriceObjects((prev) => {
      const next = prev.filter((o) => o.id !== id);
      setActivePurchasePriceObjectId((cur) => (cur === id ? next[0]?.id ?? null : cur));
      return next;
    });
    auditLog({ userId, action: '仕入れ価格オブジェクト削除', targetId: id, result: 'success' });
    toast.success('削除しました');
  };

  const addPpoEntry = () => {
    const used = new Set(ppoForm.entries.map((e) => e.materialId));
    const next = materials.find((m) => !used.has(m.id) && m.isActive !== false);
    if (!next) {
      toast.error('追加できる材料がありません（すべて登録済み、または材料マスタが空です）');
      return;
    }
    setPpoForm((f) => ({
      ...f,
      entries: [...f.entries, { materialId: next.id, purchasePrice: next.standardPrice }],
    }));
  };

  const openRateDialog = (r?: StandardRate) => {
    if (r) {
      setEditingRate(r);
      setRateForm({ name: r.name, unit: r.unit, rate: r.rate, coefficient: r.coefficient ?? 1, category: r.category, isActive: r.isActive !== false });
    } else {
      setEditingRate(null);
      setRateForm({ name: '', unit: 'm2', rate: 0, coefficient: 1, category: 'その他', isActive: true });
    }
    setRateDialogOpen(true);
  };

  const saveRate = () => {
    if (!rateForm.name.trim()) {
      toast.error('歩掛名を入力してください');
      return;
    }
    if (!rateForm.unit.trim()) {
      toast.error('単位を入力してください');
      return;
    }
    const rateNum = Number(rateForm.rate);
    const coef = Number(rateForm.coefficient);
    if (Number.isNaN(rateNum) || rateNum < 0) {
      toast.error('単価は0以上の数値を入力してください');
      return;
    }
    if (Number.isNaN(coef) || coef <= 0) {
      toast.error('係数は正の数値を入力してください');
      return;
    }
    if (editingRate) {
      setRates((prev) =>
        prev.map((x) =>
          x.id === editingRate.id
            ? { ...x, name: rateForm.name.trim(), unit: rateForm.unit, rate: rateNum, coefficient: coef, category: rateForm.category, isActive: rateForm.isActive }
            : x
        )
      );
      auditLog({ userId, action: '標準歩掛更新', targetId: editingRate.id, result: 'success' });
      toast.success('標準歩掛を更新しました');
    } else {
      const id = 'R' + (Math.max(0, ...rates.map((r) => parseInt(r.id.replace(/\D/g, '') || '0', 10))) + 1);
      setRates((prev) => [...prev, { id, name: rateForm.name.trim(), unit: rateForm.unit, rate: rateNum, coefficient: coef, category: rateForm.category, isActive: rateForm.isActive !== false }]);
      auditLog({ userId, action: '標準歩掛追加', targetId: id, result: 'success' });
      toast.success('標準歩掛を追加しました');
    }
    setRateDialogOpen(false);
  };

  const openEmployeeDialog = (e?: EmployeeRecord) => {
    if (e) {
      setEditingEmployee(e);
      setEmployeeForm({
        name: e.name,
        loginId: e.loginId,
        password: '', // 編集時は変更時のみ入力（表示しない）
        role: e.role,
        position: e.position ?? '',
        hireDate: e.hireDate ?? '',
        isActive: e.isActive,
      });
    } else {
      setEditingEmployee(null);
      setEmployeeForm({ name: '', loginId: '', password: '', role: 'field', position: '', hireDate: '', isActive: true });
    }
    setEmployeeDialogOpen(true);
  };

  const saveEmployee = () => {
    if (!employeeForm.name.trim()) {
      toast.error('氏名を入力してください');
      return;
    }
    if (!employeeForm.loginId.trim()) {
      toast.error('ログインIDを入力してください');
      return;
    }
    if (!employeeForm.hireDate.trim()) {
      toast.error('入社日を入力してください');
      return;
    }
    if (editingEmployee) {
      setEmployees((prev) =>
        prev.map((x) =>
          x.id === editingEmployee.id
            ? {
                ...x,
                name: employeeForm.name.trim(),
                loginId: employeeForm.loginId.trim(),
                ...(employeeForm.password !== '' && { password: employeeForm.password }),
                role: employeeForm.role,
                position: employeeForm.position.trim() || undefined,
                hireDate: employeeForm.hireDate.trim(),
                isActive: employeeForm.isActive,
              }
            : x
        )
      );
      toast.success('従業員を更新しました');
    } else {
      const nextNum = employees.length === 0 ? 1 : Math.max(...employees.map((e) => e.employeeNumber), 0) + 1;
      const id = 'E' + (Math.max(0, ...employees.map((e) => parseInt(e.id.replace(/\D/g, '') || '0', 10))) + 1);
      setEmployees((prev) => [
        ...prev,
        {
          id,
          employeeNumber: nextNum,
          name: employeeForm.name.trim(),
          loginId: employeeForm.loginId.trim(),
          ...(employeeForm.password !== '' && { password: employeeForm.password }),
          role: employeeForm.role,
          position: employeeForm.position.trim() || undefined,
          hireDate: employeeForm.hireDate.trim(),
          isActive: employeeForm.isActive,
        },
      ]);
      toast.success('従業員を追加しました');
    }
    setEmployeeDialogOpen(false);
  };

  const renderBasicTab = () => (
    <div className="space-y-6">
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-base">会社情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>会社名</Label>
              <Input
                value={basicSettings.companyName}
                onChange={(e) => setBasicSettings((s) => ({ ...s, companyName: e.target.value }))}
                placeholder="株式会社サンプル"
              />
            </div>
            <div className="space-y-2">
              <Label>電話番号</Label>
              <Input
                value={basicSettings.phone}
                onChange={(e) => setBasicSettings((s) => ({ ...s, phone: e.target.value }))}
                placeholder="03-0000-0000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>郵便番号</Label>
            <Input
              value={basicSettings.postalCode}
              onChange={(e) => setBasicSettings((s) => ({ ...s, postalCode: e.target.value }))}
              placeholder="100-0001"
            />
          </div>
          <div className="space-y-2">
            <Label>住所</Label>
            <Input
              value={basicSettings.address}
              onChange={(e) => setBasicSettings((s) => ({ ...s, address: e.target.value }))}
              placeholder="東京都千代田区..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>消費税率（%）</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={basicSettings.taxRate}
                onChange={(e) => setBasicSettings((s) => ({ ...s, taxRate: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>税端数処理</Label>
              <Select value={basicSettings.taxRounding} onValueChange={(v: 'half' | 'down' | 'up') => setBasicSettings((s) => ({ ...s, taxRounding: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="half">四捨五入</SelectItem>
                  <SelectItem value="down">切り捨て</SelectItem>
                  <SelectItem value="up">切り上げ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-base">基本休憩時間（1日のデフォルト）</Label>
            <p className="text-sm text-muted-foreground">勤怠計算で使う休憩時間の既定値です。休憩1・2・3の「開始」と「終了」を設定してください。</p>
            <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-2 items-end">
                <span className="text-sm font-medium sm:pt-2">休憩1</span>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">開始</span>
                  <Input type="time" value={basicSettings.break1Start} onChange={(e) => setBasicSettings((s) => ({ ...s, break1Start: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">終了</span>
                  <Input type="time" value={basicSettings.break1End} onChange={(e) => setBasicSettings((s) => ({ ...s, break1End: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-2 items-end">
                <span className="text-sm font-medium sm:pt-2">休憩2</span>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">開始</span>
                  <Input type="time" value={basicSettings.break2Start} onChange={(e) => setBasicSettings((s) => ({ ...s, break2Start: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">終了</span>
                  <Input type="time" value={basicSettings.break2End} onChange={(e) => setBasicSettings((s) => ({ ...s, break2End: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-2 items-end">
                <span className="text-sm font-medium sm:pt-2">休憩3</span>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">開始</span>
                  <Input type="time" value={basicSettings.break3Start} onChange={(e) => setBasicSettings((s) => ({ ...s, break3Start: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">終了</span>
                  <Input type="time" value={basicSettings.break3End} onChange={(e) => setBasicSettings((s) => ({ ...s, break3End: e.target.value }))} />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">例: 10:00～10:30 / 12:00～13:00 / 15:00～15:30（合計2時間/日）</p>
          </div>
          <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <Label className="text-base">会社の休日</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              創立記念日や年末年始など、会社全体の休日を登録します。勤怠の「従業員別サマリー」から休みを登録する際の目安にもなります。
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">日付を追加</Label>
                <Input
                  type="date"
                  value={newCompanyHolidayDate}
                  onChange={(e) => setNewCompanyHolidayDate(e.target.value)}
                  className="w-44"
                />
              </div>
              <Button type="button" variant="secondary" onClick={addCompanyHolidayRow}>
                <Plus className="w-4 h-4 mr-1" />
                一覧に追加
              </Button>
            </div>
            {basicSettings.companyHolidays.length === 0 ? (
              <p className="text-sm text-muted-foreground">未登録です。日付を選んで「一覧に追加」してください。</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {basicSettings.companyHolidays.map((d) => (
                  <li
                    key={d}
                    className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-sm tabular-nums"
                  >
                    {d}
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                      onClick={() => removeCompanyHolidayRow(d)}
                      aria-label={`${d} を削除`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <Label>メモ</Label>
            <Textarea
              value={basicSettings.memo}
              onChange={(e) => setBasicSettings((s) => ({ ...s, memo: e.target.value }))}
              placeholder="設定に関するメモ"
              rows={3}
            />
          </div>
          <Button onClick={saveBasicSettings}>保存</Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderMaterialsTab = () => (
    <div className="space-y-4">
      <Tabs value={materialsSubTab} onValueChange={(v) => setMaterialsSubTab(v as 'master' | 'ppo')} className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-2 h-10">
          <TabsTrigger value="master" className="gap-2">
            <Package className="w-4 h-4" />
            材料マスタ
          </TabsTrigger>
          <TabsTrigger value="ppo" className="gap-2">
            <Layers className="w-4 h-4" />
            仕入れ価格オブジェクト
          </TabsTrigger>
        </TabsList>

        <TabsContent value="master" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            品目の基本情報と販売単価・基準仕入単価を登録します。実際の仕入単価は「仕入れ価格オブジェクト」で登録した単価が適用されます（未登録の材料は基準仕入単価にフォールバックします）。
          </p>
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="材料名・コード・カテゴリで検索"
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={() => openMaterialDialog()} disabled={!setMaterials}>
              <Plus className="w-4 h-4 mr-2" />
              新規追加
            </Button>
          </div>
          <Card className="border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>コード</TableHead>
                  <TableHead>材料名</TableHead>
                  <TableHead>カテゴリ</TableHead>
                  <TableHead>単位</TableHead>
                  <TableHead className="text-right">適用中の仕入単価</TableHead>
                  <TableHead className="text-right">基準仕入単価</TableHead>
                  <TableHead className="text-right">販売単価（円）</TableHead>
                  <TableHead className="w-20">有効</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      データがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaterials.map((m) => {
                    const effective = resolveMaterialPurchasePrice(
                      m.id,
                      m.standardPrice,
                      purchasePriceObjects,
                      activePurchasePriceObjectId
                    );
                    const fromObject =
                      activePurchasePriceObjectId &&
                      purchasePriceObjects
                        .find((o) => o.id === activePurchasePriceObjectId)
                        ?.entries.some((e) => e.materialId === m.id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-sm">{m.code}</TableCell>
                        <TableCell>{m.name}</TableCell>
                        <TableCell>{m.category}</TableCell>
                        <TableCell>{m.unit}</TableCell>
                        <TableCell className="text-right">
                          <span className="tabular-nums">¥{effective.toLocaleString()}</span>
                          {fromObject && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              オブジェクト
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          ¥{m.standardPrice.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">¥{(m.sellingPrice ?? 0).toLocaleString()}</TableCell>
                        <TableCell>{m.isActive !== false ? <Badge variant="outline">有効</Badge> : <Badge variant="secondary">無効</Badge>}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openMaterialDialog(m)} disabled={!setMaterials}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ppo" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            仕入れ価格オブジェクトに材料と仕入単価を登録し、一覧から適用するオブジェクトを選びます。適用中のオブジェクトに登録された材料は、その単価で見積などに反映されます（登録のない材料は材料マスタの基準仕入単価を使います）。
          </p>
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">適用中の仕入れ価格オブジェクト</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="text-muted-foreground">システム全体で参照する仕入単価セット</Label>
              <Select
                value={activePurchasePriceObjectId ?? '__none__'}
                onValueChange={(v) => setActivePurchasePriceObjectId(v === '__none__' ? null : v)}
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">なし（すべて基準仕入単価）</SelectItem>
                  {purchasePriceObjects.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}（{o.entries.length}件）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => openPpoDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              仕入れ価格オブジェクトを追加
            </Button>
          </div>

          <Card className="border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>オブジェクト名</TableHead>
                  <TableHead>登録材料数</TableHead>
                  <TableHead className="w-28">適用中</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchasePriceObjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      仕入れ価格オブジェクトがありません。追加してください。
                    </TableCell>
                  </TableRow>
                ) : (
                  purchasePriceObjects.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell>{o.entries.length}件</TableCell>
                      <TableCell>
                        {activePurchasePriceObjectId === o.id ? (
                          <Badge>適用中</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openPpoDialog(o)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deletePpo(o.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={ppoDialogOpen} onOpenChange={setPpoDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPpo ? '仕入れ価格オブジェクトの編集' : '仕入れ価格オブジェクトの追加'}</DialogTitle>
            <DialogDescription>
              材料マスタから品目を選び、このオブジェクトでの仕入単価を登録します。同じ材料を複数のオブジェクトで異なる単価にできます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>オブジェクト名 *</Label>
              <Input
                value={ppoForm.name}
                onChange={(e) => setPpoForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="例: 大口仕入価格"
              />
            </div>
            <div className="space-y-2">
              <Label>メモ</Label>
              <Input
                value={ppoForm.memo}
                onChange={(e) => setPpoForm((f) => ({ ...f, memo: e.target.value }))}
                placeholder="任意"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>登録材料と仕入単価</Label>
                <Button type="button" variant="outline" size="sm" onClick={addPpoEntry}>
                  <Plus className="w-4 h-4 mr-1" />
                  行を追加
                </Button>
              </div>
              {ppoForm.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">「行を追加」から材料を登録してください。</p>
              ) : (
                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>材料</TableHead>
                        <TableHead className="w-36">仕入単価（円）</TableHead>
                        <TableHead className="w-14" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ppoForm.entries.map((e, i) => (
                        <TableRow key={`${e.materialId}-${i}`}>
                          <TableCell>
                            <Select
                              value={e.materialId}
                              onValueChange={(vid) => {
                                const mat = materials.find((x) => x.id === vid);
                                setPpoForm((f) => {
                                  const next = [...f.entries];
                                  next[i] = { materialId: vid, purchasePrice: mat?.standardPrice ?? 0 };
                                  return { ...f, entries: next };
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {materials
                                  .filter((m) => m.isActive !== false)
                                  .map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                      {m.name}（{m.code}）
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={e.purchasePrice || ''}
                              onChange={(ev) => {
                                const v = Number(ev.target.value) || 0;
                                setPpoForm((f) => {
                                  const next = [...f.entries];
                                  next[i] = { ...next[i], purchasePrice: v };
                                  return { ...f, entries: next };
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setPpoForm((f) => ({ ...f, entries: f.entries.filter((_, j) => j !== i) }))
                              }
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPpoDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={savePpo}>{editingPpo ? '更新' : '追加'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMaterial ? '材料の編集' : '材料の追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>材料名 *</Label>
              <Input value={materialForm.name} onChange={(e) => setMaterialForm((f) => ({ ...f, name: e.target.value }))} placeholder="石膏ボード 12.5mm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>コード</Label>
                <Input value={materialForm.code} onChange={(e) => setMaterialForm((f) => ({ ...f, code: e.target.value }))} placeholder="GP-12.5" />
              </div>
              <div className="space-y-2">
                <Label>カテゴリ</Label>
                <Select value={materialForm.category} onValueChange={(v) => setMaterialForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['建材', '金物', '電気', '設備', 'その他'].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>単位</Label>
                <Select value={materialForm.unit} onValueChange={(v) => setMaterialForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['枚', 'm', 'm2', 'kg', '本', '式', '個'].map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>基準仕入単価（円）</Label>
                <Input
                  type="number"
                  min={0}
                  value={materialForm.standardPrice || ''}
                  onChange={(e) => setMaterialForm((f) => ({ ...f, standardPrice: Number(e.target.value) || 0 }))}
                />
                <p className="text-[11px] text-muted-foreground">仕入れ価格オブジェクトに未登録のときに使われます</p>
              </div>
              <div className="space-y-2">
                <Label>販売単価（円）</Label>
                <Input
                  type="number"
                  min={0}
                  value={materialForm.sellingPrice || ''}
                  onChange={(e) => setMaterialForm((f) => ({ ...f, sellingPrice: Number(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>メモ</Label>
              <Input value={materialForm.memo} onChange={(e) => setMaterialForm((f) => ({ ...f, memo: e.target.value }))} placeholder="任意" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mat-active"
                checked={materialForm.isActive !== false}
                onChange={(e) => setMaterialForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-border"
              />
              <Label htmlFor="mat-active">有効（無効の品目は見積で参照されません）</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={saveMaterial}>{editingMaterial ? '更新' : '追加'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderRatesTab = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">標準歩掛マスタ。品目/単位/係数/仕入単価/有効フラグ。単位未入力不可・係数は数値。有効な歩掛のみOCR算出に使用。変更は監査ログに残ります。</p>
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="歩掛名・カテゴリで検索" value={rateSearch} onChange={(e) => setRateSearch(e.target.value)} className="pl-8" />
        </div>
        <Button onClick={() => openRateDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          新規追加
        </Button>
      </div>
      <Card className="border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>品目（歩掛名）</TableHead>
              <TableHead>カテゴリ</TableHead>
              <TableHead>単位</TableHead>
              <TableHead className="text-right">係数</TableHead>
              <TableHead className="text-right">仕入単価（円）</TableHead>
              <TableHead className="w-20">有効</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRates.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.category}</TableCell>
                <TableCell>{r.unit}</TableCell>
                <TableCell className="text-right">{r.coefficient ?? 1}</TableCell>
                <TableCell className="text-right">¥{r.rate.toLocaleString()}</TableCell>
                <TableCell>{r.isActive !== false ? <Badge variant="outline">有効</Badge> : <Badge variant="secondary">無効</Badge>}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openRateDialog(r)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRate ? '標準歩掛の編集' : '標準歩掛の追加'}</DialogTitle>
            <p className="text-sm text-muted-foreground">単位は必須。係数は数値で入力。有効な歩掛のみOCR算出に使用されます。変更は監査ログに記録されます。</p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>品目（歩掛名） *</Label>
              <Input value={rateForm.name} onChange={(e) => setRateForm((f) => ({ ...f, name: e.target.value }))} placeholder="下地処理" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>カテゴリ</Label>
                <Select value={rateForm.category} onValueChange={(v) => setRateForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['左官', '内装', '電気', '設備', 'その他'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>単位 *</Label>
                <Select value={rateForm.unit} onValueChange={(v) => setRateForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['m2', 'm', '式', '枚', '箇所', '個'].map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>係数</Label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.1}
                  value={rateForm.coefficient ?? 1}
                  onChange={(e) => setRateForm((f) => ({ ...f, coefficient: Number(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>仕入単価（円）</Label>
                <Input
                  type="number"
                  min={0}
                  value={rateForm.rate || ''}
                  onChange={(e) => setRateForm((f) => ({ ...f, rate: Number(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rate-active"
                checked={rateForm.isActive !== false}
                onChange={(e) => setRateForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-border"
              />
              <Label htmlFor="rate-active">有効（有効な歩掛のみOCR算出に使用）</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateDialogOpen(false)}>キャンセル</Button>
            <Button onClick={saveRate}>{editingRate ? '更新' : '追加'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderEmployeesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="氏名・ログインID・役職で検索" value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} className="pl-8" />
        </div>
        <Button onClick={() => openEmployeeDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          新規追加
        </Button>
      </div>
      <Card className="border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>従業員番号</TableHead>
              <TableHead>氏名</TableHead>
              <TableHead>ログインID</TableHead>
              <TableHead>権限</TableHead>
              <TableHead>役職</TableHead>
              <TableHead>入社日</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono tabular-nums">{e.employeeNumber}</TableCell>
                <TableCell>{e.name}</TableCell>
                <TableCell className="font-mono">{e.loginId}</TableCell>
                <TableCell>
                  <Badge variant={e.role === 'owner' || e.role === 'admin' ? 'default' : 'secondary'}>
                    {e.role === 'owner' || e.role === 'admin' ? '管理者' : '現場'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{e.position || '-'}</TableCell>
                <TableCell>{e.hireDate || '-'}</TableCell>
                <TableCell>{e.isActive ? <Badge variant="outline">在籍</Badge> : <Badge variant="outline" className="text-muted-foreground">退職</Badge>}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openEmployeeDialog(e)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? '従業員の編集' : '従業員の追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingEmployee && (
              <div className="space-y-2">
                <Label>従業員番号</Label>
                <Input value={String(editingEmployee.employeeNumber)} readOnly disabled className="bg-muted font-mono tabular-nums" />
                <p className="text-xs text-muted-foreground">1から順に自動採番（編集不可）</p>
              </div>
            )}
            {!editingEmployee && (
              <p className="text-sm text-muted-foreground">従業員番号は登録時に1から順に自動採番されます。</p>
            )}
            <div className="space-y-2">
              <Label>氏名 *</Label>
              <Input value={employeeForm.name} onChange={(e) => setEmployeeForm((f) => ({ ...f, name: e.target.value }))} placeholder="山田太郎" />
            </div>
            <div className="space-y-2">
              <Label>ログインID *</Label>
              <Input value={employeeForm.loginId} onChange={(e) => setEmployeeForm((f) => ({ ...f, loginId: e.target.value }))} placeholder="user1" />
            </div>
            <div className="space-y-2">
              <Label>パスワード {editingEmployee ? '（変更時のみ入力）' : '（任意）'}</Label>
              <Input type="password" value={employeeForm.password} onChange={(e) => setEmployeeForm((f) => ({ ...f, password: e.target.value }))} placeholder={editingEmployee ? '変更する場合のみ入力' : '未入力時はログイン不可'} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label>権限</Label>
              <Select value={employeeForm.role} onValueChange={(v) => setEmployeeForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">管理者</SelectItem>
                  <SelectItem value="field">現場</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>役職（任意）</Label>
              <Input value={employeeForm.position} onChange={(e) => setEmployeeForm((f) => ({ ...f, position: e.target.value }))} placeholder="施工主任" />
            </div>
            <div className="space-y-2">
              <Label>入社日 *</Label>
              <Input type="date" value={employeeForm.hireDate} onChange={(e) => setEmployeeForm((f) => ({ ...f, hireDate: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="emp-active"
                checked={employeeForm.isActive}
                onChange={(e) => setEmployeeForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-border"
              />
              <Label htmlFor="emp-active">在籍（退職にするとシステムログインできなくなります）</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeeDialogOpen(false)}>キャンセル</Button>
            <Button onClick={saveEmployee}>{editingEmployee ? '更新' : '追加'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const loginHistory = getLoginHistory();
  const auditLogs = getAuditLogs();
  const renderLoginHistoryTab = () => (
    <Card className="border border-border">
      <CardHeader>
        <CardTitle className="text-base">ログイン履歴</CardTitle>
        <p className="text-sm text-muted-foreground">ログイン成功/失敗が記録されます（ユーザーID・日時・結果・端末情報）</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日時</TableHead>
              <TableHead>ログインID</TableHead>
              <TableHead>ユーザーID</TableHead>
              <TableHead>結果</TableHead>
              <TableHead>端末等</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loginHistory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">履歴がありません</TableCell>
              </TableRow>
            ) : (
              loginHistory.map((entry, i) => (
                <TableRow key={`${entry.at}-${i}`}>
                  <TableCell className="text-sm">{entry.at}</TableCell>
                  <TableCell>{entry.loginId}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.userId || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={entry.result === 'success' ? 'default' : 'destructive'}>{entry.result === 'success' ? '成功' : '失敗'}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{entry.ipOrDevice ?? '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const renderAuditLogTab = () => (
    <Card className="border border-border">
      <CardHeader>
        <CardTitle className="text-base">監査ログ</CardTitle>
        <p className="text-sm text-muted-foreground">重要操作の記録（日時・ユーザーID・操作種別・対象ID・結果）。1年保持。</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日時</TableHead>
              <TableHead>ユーザーID</TableHead>
              <TableHead>操作種別</TableHead>
              <TableHead>対象ID</TableHead>
              <TableHead>結果</TableHead>
              <TableHead>失敗理由</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">監査ログがありません</TableCell>
              </TableRow>
            ) : (
              [...auditLogs].reverse().map((entry, i) => (
                <TableRow key={`${entry.at}-${i}`}>
                  <TableCell className="text-sm">{entry.at}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.userId || '-'}</TableCell>
                  <TableCell>{entry.action}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.targetId ?? '-'}</TableCell>
                  <TableCell><Badge variant={entry.result === 'success' ? 'default' : 'destructive'}>{entry.result}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{entry.failureCode ?? '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex h-full bg-background">
      <div className="w-60 bg-surface border-r border-border flex flex-col">
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-medium">設定</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {(['basic', 'materials', 'rates', 'employees', 'login-history', 'audit-log'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center space-x-2 px-2 py-2 text-sm rounded-md transition-colors ${
                  activeTab === tab ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                {tab === 'basic' && <Settings2 className="w-4 h-4" />}
                {tab === 'materials' && <Package className="w-4 h-4" />}
                {tab === 'rates' && <TrendingUp className="w-4 h-4" />}
                {tab === 'employees' && <UserCheck className="w-4 h-4" />}
                {tab === 'login-history' && <History className="w-4 h-4" />}
                {tab === 'audit-log' && <ScrollText className="w-4 h-4" />}
                <span>
                  {tab === 'basic' && '基本設定'}
                  {tab === 'materials' && '材料価格マスタ'}
                  {tab === 'rates' && '標準歩掛マスタ'}
                  {tab === 'employees' && '従業員管理'}
                  {tab === 'login-history' && 'ログイン履歴'}
                  {tab === 'audit-log' && '監査ログ'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl">
          <div className="mb-6 pb-6 border-b border-border">
            <h1 className="text-2xl font-semibold">
              {activeTab === 'basic' && '基本設定'}
              {activeTab === 'materials' && '材料価格マスタ'}
              {activeTab === 'rates' && '標準歩掛マスタ'}
              {activeTab === 'employees' && '従業員管理'}
              {activeTab === 'login-history' && 'ログイン履歴'}
              {activeTab === 'audit-log' && '監査ログ'}
            </h1>
          </div>
          {activeTab === 'basic' && renderBasicTab()}
          {activeTab === 'materials' && renderMaterialsTab()}
          {activeTab === 'rates' && renderRatesTab()}
          {activeTab === 'employees' && renderEmployeesTab()}
          {activeTab === 'login-history' && renderLoginHistoryTab()}
          {activeTab === 'audit-log' && renderAuditLogTab()}
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
