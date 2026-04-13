import React, { useState, useMemo, useEffect } from 'react';
import {
  Home,
  Briefcase,
  FileText,
  Calendar,
  ShoppingCart,
  Receipt,
  Users,
  User,
  Settings,
  Search,
  LogOut,
  GraduationCap,
  Bell,
} from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { Input } from './components/ui/input';
import { Avatar, AvatarFallback } from './components/ui/avatar';
import { Button } from './components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';
import Dashboard from './components/Dashboard';
import Quote from './components/Quote';
import Process from './components/Process';
import Purchase from './components/Purchase';
import Invoice from './components/Invoice';
import Customer from './components/Customer';
import type { CustomerRecord } from './components/Customer';
import Attendance from './components/Attendance';
import TrainingVideos from './components/TrainingVideos';
import SystemSettings from './components/SystemSettings';
import type { EmployeeRecord } from './components/SystemSettings';
import Projects from './components/Projects';
import Login from './components/Login';
import Forbidden403 from './components/Forbidden403';
import type { PurchaseOrderRecord } from './components/Purchase_history';
import { useAuth } from './contexts/AuthContext';
import type { PurchasePriceObjectRecord } from './types/purchasePriceObject';
import { resolveMaterialPurchasePrice } from './lib/resolveMaterialPurchasePrice';

type Page =
  | 'dashboard'
  | 'quote'
  | 'process'
  | 'purchase'
  | 'invoice'
  | 'customer'
  | 'attendance'
  | 'training-videos'
  | 'system-settings'
  | 'projects';

/** Web ヘッダーに表示する通知（モバイルアプリからの有給申請など） */
export type LeaveWebNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  leaveRequestId: string;
};

const WEB_NOTIFICATIONS_KEY = 'lets_web_notifications';

const navigationItems = [
  { id: 'dashboard', label: 'ダッシュボード', icon: Home },
  { id: 'projects', label: '案件', icon: Briefcase },
  { id: 'quote', label: '見積', icon: FileText },
  { id: 'process', label: '工程', icon: Calendar },
  { id: 'purchase', label: '購買', icon: ShoppingCart },
  { id: 'invoice', label: '請求', icon: Receipt },
  { id: 'customer', label: '顧客', icon: Users },
  { id: 'attendance', label: '勤怠', icon: User },
  { id: 'training-videos', label: '教育動画', icon: GraduationCap },
  { id: 'system-settings', label: '設定', icon: Settings },
];

// 見積デモ用サンプル（算出結果・見積明細）
const demoExtractedItems = [
  { id: 'e1', item: '石膏ボード 12.5mm', quantity: 50, unit: '枚', category: '建材' },
  { id: 'e2', item: 'LGS @455', quantity: 30, unit: 'm', category: '建材' },
  { id: 'e3', item: '下地処理', quantity: 25, unit: 'm2', category: '左官' },
  { id: 'e4', item: '石膏ボード張り', quantity: 25, unit: 'm2', category: '内装' },
];
const demoQuoteItems = [
  { id: 1, item: '石膏ボード 12.5mm', quantity: 50, unit: '枚', unitPrice: 850, amount: 42500 },
  { id: 2, item: 'LGS @455', quantity: 30, unit: 'm', unitPrice: 1200, amount: 36000 },
  { id: 3, item: '下地処理', quantity: 25, unit: 'm2', unitPrice: 1200, amount: 30000 },
  { id: 4, item: '石膏ボード張り', quantity: 25, unit: 'm2', unitPrice: 1800, amount: 45000 },
];
const demoTotal = demoQuoteItems.reduce((sum, r) => sum + r.amount, 0);

const initialQuoteProjects = [
  { id: '1', customerName: 'A邸プロジェクト', projectName: '内装工事（品川）', status: 'in_progress', totalAmount: demoTotal, lastUpdated: '2024-01-15', uploadedFiles: [{ name: '図面.pdf' }], drawings: [], extractedItems: demoExtractedItems, quoteItems: demoQuoteItems },
  { id: '2', customerName: 'Bビル改修', projectName: 'オフィス改装工事（新宿）', status: 'completed', totalAmount: 850000, lastUpdated: '2024-01-14', uploadedFiles: [], drawings: [], extractedItems: [], quoteItems: [] },
];

const initialCustomers: CustomerRecord[] = [
  { id: 'CUST-001', companyName: 'A邸プロジェクト', contactPerson: '担当者A', email: 'a@example.com', phone: '03-0000-0001', createdAt: '2024-01-01', type: 'customer', isActive: true, billingDay: 20 },
  { id: 'SUPP-001', companyName: '建材商会', contactPerson: '担当者B', email: 'b@example.com', phone: '03-0000-0002', createdAt: '2024-01-01', type: 'supplier', isActive: true },
  { id: 'SUPP-002', companyName: '東都建材', contactPerson: '担当者C', email: 'c@example.com', phone: '03-0000-0003', createdAt: '2024-01-01', type: 'supplier', isActive: true },
];

const initialPurchaseOrders: PurchaseOrderRecord[] = [
  {
    id: 'PO-202401-0001',
    projectId: '1',
    projectName: '内装工事（品川）',
    customerName: 'A邸プロジェクト',
    supplierId: 'SUPP-001',
    supplierName: '建材商会',
    supplierPhone: '03-0000-0002',
    supplierEmail: 'b@example.com',
    orderDate: '2024-01-10',
    expectedDeliveryDate: '2024-01-17',
    status: 'ordered',
    totalAmount: 153500,
    orderMethod: 'email',
    emailSentAt: '2024-01-10T10:00:00Z',
    materials: [
      { id: '1-1', materialName: '石膏ボード 12.5mm', quantity: 50, unit: '枚', unitPrice: 850, totalPrice: 42500, isFromQuote: true },
      { id: '1-2', materialName: 'LGS @455', quantity: 30, unit: 'm', unitPrice: 1200, totalPrice: 36000, isFromQuote: true },
    ],
    memo: '2種類の材料を発注',
  },
  {
    id: 'PO-202401-0003',
    projectId: '2',
    projectName: 'オフィス改装工事（新宿）',
    customerName: 'Bビル改修',
    orderDate: '2024-01-15',
    expectedDeliveryDate: '2024-01-22',
    status: 'not_ordered',
    totalAmount: 0,
    materials: [
      { id: '2-1', materialName: 'システム天井', quantity: 80, unit: 'm2', unitPrice: 2500, totalPrice: 200000, isFromQuote: false },
      { id: '2-2', materialName: 'カーペット', quantity: 120, unit: 'm2', unitPrice: 1000, totalPrice: 120000, isFromQuote: false },
    ],
    memo: '未発注・仕入先未定',
  },
];

export type MaterialRecord = {
  id: string;
  name: string;
  unit: string;
  category: string;
  /** 仕入単価（円） */
  standardPrice: number;
  /** 販売単価（円） */
  sellingPrice?: number;
  code: string;
  memo?: string;
  isActive?: boolean;
};

/** 見積明細（単価元でマスタ/AIを区別） */
export type EstimateLineItem = {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  unitPriceSource: 'master' | 'ai';
};

/** 見積（下書き/確定/取消・見積番号・顧客・案件・改版元） */
export type EstimateRecord = {
  id: string;
  estimateNumber: string;
  customerId: string;
  customerName: string;
  projectName: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  items: EstimateLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  sourceEstimateId?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
};

/** 材料発注ひな型 1行（品目/数量/単位/備考） */
export type OrderTemplateItem = {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  memo?: string;
};

/** 材料発注ひな型 */
export type OrderTemplateRecord = {
  id: string;
  name: string;
  items: OrderTemplateItem[];
  createdAt: string;
  updatedAt: string;
};

const initialMaterials: MaterialRecord[] = [
  { id: 'M1', name: '石膏ボード 12.5mm', unit: '枚', category: '建材', standardPrice: 850, sellingPrice: 1100, code: 'GP-12.5', isActive: true },
  { id: 'M2', name: 'LGS @455', unit: 'm', category: '建材', standardPrice: 1200, sellingPrice: 1550, code: 'LGS-455', isActive: true },
];

const PURCHASE_PRICE_OBJECTS_KEY = 'lets_purchase_price_objects';
const ACTIVE_PURCHASE_PRICE_OBJECT_ID_KEY = 'lets_active_purchase_price_object_id';

const initialPurchasePriceObjects: PurchasePriceObjectRecord[] = [
  {
    id: 'ppo-default',
    name: '標準仕入価格',
    memo: '既定の仕入単価セット。材料マスタの基準仕入と同じ値から開始できます。',
    entries: [
      { materialId: 'M1', purchasePrice: 850 },
      { materialId: 'M2', purchasePrice: 1200 },
    ],
  },
  {
    id: 'ppo-volume',
    name: '大口仕入価格',
    memo: 'ボリュームディスカウント想定（例: 石膏ボードのみ差し替え）',
    entries: [{ materialId: 'M1', purchasePrice: 780 }],
  },
];

/** 請求明細行 */
export type InvoiceLineItem = {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
};

/** 請求：請求番号は内部管理用・支払い期限は設けない */
export type InvoiceRecord = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  projectName: string;
  status: 'draft' | 'issued' | 'cancelled';
  /** 請求日（顧客の請求日を初期値。例: 20日締め→20、月末→99） */
  billingDayDisplay?: number;
  /** 担当者（自由入力） */
  contactPerson?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  lastUpdated: string;
  updateHistory?: Array<{ at: string; action: string }>;
};

const initialInvoices: InvoiceRecord[] = [
  { id: 'inv1', invoiceNumber: 'INV-202603-0001', customerId: 'CUST-001', customerName: 'A邸プロジェクト', projectName: '内装工事（品川）', status: 'issued', billingDayDisplay: 20, items: [{ id: '1', item: '工事請負', quantity: 1, unit: '式', unitPrice: 153500, amount: 153500 }], subtotal: 153500, taxAmount: 15350, totalAmount: 168850, lastUpdated: '2026-03-01' },
  { id: 'inv2', invoiceNumber: 'INV-202603-0002', customerId: '', customerName: 'Bビル改修', projectName: 'オフィス改装工事（新宿）', status: 'issued', items: [{ id: '1', item: '工事請負', quantity: 1, unit: '式', unitPrice: 850000, amount: 850000 }], subtotal: 850000, taxAmount: 85000, totalAmount: 935000, lastUpdated: '2026-03-05' },
  { id: 'inv3', invoiceNumber: 'INV-202603-0003', customerId: 'CUST-001', customerName: 'A邸プロジェクト', projectName: '追加工事（品川）', status: 'draft', items: [{ id: '1', item: '追加工事', quantity: 1, unit: '式', unitPrice: 50000, amount: 50000 }], subtotal: 50000, taxAmount: 5000, totalAmount: 55000, lastUpdated: '2026-03-10' },
];

// 請求「見積から作成」デモ用：確定済み見積
const demoEstimateItems: EstimateLineItem[] = [
  { id: 'est-li-1', item: '石膏ボード 12.5mm', quantity: 50, unit: '枚', unitPrice: 850, amount: 42500, unitPriceSource: 'master' },
  { id: 'est-li-2', item: 'LGS @455', quantity: 30, unit: 'm', unitPrice: 1200, amount: 36000, unitPriceSource: 'master' },
  { id: 'est-li-3', item: '下地処理', quantity: 25, unit: 'm2', unitPrice: 1200, amount: 30000, unitPriceSource: 'master' },
  { id: 'est-li-4', item: '石膏ボード張り', quantity: 25, unit: 'm2', unitPrice: 1800, amount: 45000, unitPriceSource: 'master' },
];
const demoEstimateSubtotal = demoEstimateItems.reduce((s, i) => s + i.amount, 0);
const demoEstimateTax = Math.round(demoEstimateSubtotal * 0.1);
const initialEstimates: EstimateRecord[] = [
  {
    id: 'est-demo-1',
    estimateNumber: 'EST-202601-0001',
    customerId: 'CUST-001',
    customerName: 'A邸プロジェクト',
    projectName: '内装工事（品川）',
    status: 'confirmed',
    items: demoEstimateItems,
    subtotal: demoEstimateSubtotal,
    taxAmount: demoEstimateTax,
    total: demoEstimateSubtotal + demoEstimateTax,
    createdAt: '2026-01-10',
    updatedAt: '2026-01-15',
  },
  {
    id: 'est-demo-2',
    estimateNumber: 'EST-202601-0002',
    customerId: '',
    customerName: 'Bビル改修',
    projectName: 'オフィス改装工事（新宿）',
    status: 'confirmed',
    items: [
      { id: 'est-li-5', item: 'システム天井', quantity: 80, unit: 'm2', unitPrice: 2500, amount: 200000, unitPriceSource: 'master' },
      { id: 'est-li-6', item: 'カーペット', quantity: 120, unit: 'm2', unitPrice: 1000, amount: 120000, unitPriceSource: 'master' },
    ],
    subtotal: 320000,
    taxAmount: 32000,
    total: 352000,
    createdAt: '2026-01-12',
    updatedAt: '2026-01-14',
  },
];
// 購買ひな型デモ用
const initialOrderTemplates: OrderTemplateRecord[] = [
  {
    id: 'tpl-1',
    name: '内装工事用（石膏ボード・LGS）',
    items: [
      { id: 'tpl1-1', item: '石膏ボード 12.5mm', quantity: 50, unit: '枚', memo: '天井・壁下地' },
      { id: 'tpl1-2', item: 'LGS @455', quantity: 30, unit: 'm', memo: '軽量鉄骨' },
      { id: 'tpl1-3', item: '下地処理', quantity: 25, unit: 'm2' },
      { id: 'tpl1-4', item: '石膏ボード張り', quantity: 25, unit: 'm2' },
    ],
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05',
  },
  {
    id: 'tpl-2',
    name: 'オフィス改装用',
    items: [
      { id: 'tpl2-1', item: 'システム天井', quantity: 80, unit: 'm2' },
      { id: 'tpl2-2', item: 'カーペット', quantity: 120, unit: 'm2' },
    ],
    createdAt: '2026-01-08',
    updatedAt: '2026-01-08',
  },
];

const EMPLOYEES_STORAGE_KEY = 'lets_employees';

const initialEmployees: EmployeeRecord[] = [
  { id: 'E1', employeeNumber: 1, name: '管理者', loginId: 'admin', role: 'owner', hireDate: '2020-04-01', isActive: true },
  { id: 'E2', employeeNumber: 2, name: '現場', loginId: 'field1', role: 'field', hireDate: '2021-06-15', isActive: true },
];

function normalizeEmployeesFromStorage(raw: unknown): EmployeeRecord[] {
  if (!Array.isArray(raw)) return initialEmployees;
  return raw.map((e: EmployeeRecord) => ({
    ...e,
    hireDate: e.hireDate ?? '',
  }));
}

export default function App() {
  const { session, logout, isField } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [quoteProjects, setQuoteProjects] = useState(initialQuoteProjects);
  const [customers, setCustomers] = useState<CustomerRecord[]>(initialCustomers);
  const [materials, setMaterials] = useState<MaterialRecord[]>(initialMaterials);

  const [purchasePriceObjects, setPurchasePriceObjects] = useState<PurchasePriceObjectRecord[]>(() => {
    try {
      const s = localStorage.getItem(PURCHASE_PRICE_OBJECTS_KEY);
      if (s) return JSON.parse(s);
    } catch (_) {}
    return initialPurchasePriceObjects;
  });

  const [activePurchasePriceObjectId, setActivePurchasePriceObjectId] = useState<string | null>(() => {
    try {
      const s = localStorage.getItem(ACTIVE_PURCHASE_PRICE_OBJECT_ID_KEY);
      if (s === '') return null;
      if (s) return s;
    } catch (_) {}
    return 'ppo-default';
  });

  useEffect(() => {
    try {
      localStorage.setItem(PURCHASE_PRICE_OBJECTS_KEY, JSON.stringify(purchasePriceObjects));
    } catch (_) {}
  }, [purchasePriceObjects]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_PURCHASE_PRICE_OBJECT_ID_KEY, activePurchasePriceObjectId ?? '');
    } catch (_) {}
  }, [activePurchasePriceObjectId]);

  useEffect(() => {
    if (
      activePurchasePriceObjectId != null &&
      !purchasePriceObjects.some((o) => o.id === activePurchasePriceObjectId)
    ) {
      setActivePurchasePriceObjectId(purchasePriceObjects[0]?.id ?? null);
    }
  }, [purchasePriceObjects, activePurchasePriceObjectId]);

  const getMaterialPurchasePrice = React.useCallback(
    (m: MaterialRecord) =>
      resolveMaterialPurchasePrice(m.id, m.standardPrice, purchasePriceObjects, activePurchasePriceObjectId),
    [purchasePriceObjects, activePurchasePriceObjectId]
  );
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(initialInvoices);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>(initialPurchaseOrders);
  const [estimates, setEstimates] = useState<EstimateRecord[]>(initialEstimates);
  const [orderTemplates, setOrderTemplates] = useState<OrderTemplateRecord[]>(initialOrderTemplates);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string | null>(null);
  const [openEstimateId, setOpenEstimateId] = useState<string | null>(null);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>(() => {
    try {
      const s = localStorage.getItem(EMPLOYEES_STORAGE_KEY);
      if (s) return normalizeEmployeesFromStorage(JSON.parse(s));
    } catch (_) {}
    return initialEmployees;
  });

  const [webNotifications, setWebNotifications] = useState<LeaveWebNotification[]>(() => {
    try {
      const s = localStorage.getItem(WEB_NOTIFICATIONS_KEY);
      if (s) return JSON.parse(s);
    } catch (_) {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(WEB_NOTIFICATIONS_KEY, JSON.stringify(webNotifications));
    } catch (_) {}
  }, [webNotifications]);

  const pushLeaveRequestWebNotification = React.useCallback(
    (info: { leaveRequestId: string; employeeName: string; periodLabel: string }) => {
      const id = `wn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setWebNotifications((prev) => [
        {
          id,
          title: '有給申請（モバイルアプリ）',
          body: `${info.employeeName} より申請がありました（${info.periodLabel}）。勤怠の「有給申請管理」で確認できます。`,
          createdAt: new Date().toISOString(),
          read: false,
          leaveRequestId: info.leaveRequestId,
        },
        ...prev,
      ]);
    },
    []
  );

  const unreadWebNotificationCount = useMemo(
    () => webNotifications.filter((n) => !n.read).length,
    [webNotifications]
  );

  const markAllWebNotificationsRead = React.useCallback(() => {
    setWebNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(employees));
    } catch (_) {}
  }, [employees]);

  const loginUsers = useMemo(
    () =>
      employees
        .filter((e) => e.isActive)
        .map((e) => ({
          id: e.id,
          loginId: e.loginId,
          displayName: e.name,
          role: e.role === 'owner' || e.role === 'admin' ? 'owner' : 'field',
          isActive: true,
          // 従業員にパスワードが未設定の場合はデモ用に "password" でログイン可能
          passwordHash: e.password ?? 'password',
        })),
    [employees]
  );

  const visibleNavItems = useMemo(() => {
    if (!session) return [];
    if (isField) return navigationItems.filter((item) => item.id !== 'system-settings');
    return navigationItems;
  }, [session, isField]);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            quoteProjects={quoteProjects}
            purchaseOrders={purchaseOrders}
            onNavigateToQuote={() => setCurrentPage('quote')}
            onNavigateToPurchase={() => setCurrentPage('purchase')}
            onNavigateToProcess={() => setCurrentPage('process')}
          />
        );
      case 'quote':
        return (
          <Quote
            quoteProjects={quoteProjects}
            setQuoteProjects={setQuoteProjects}
            customers={customers}
            setCustomers={setCustomers}
            materials={materials}
            getMaterialPurchasePrice={getMaterialPurchasePrice}
            estimates={estimates}
            setEstimates={setEstimates}
            openEstimateId={openEstimateId}
            setOpenEstimateId={setOpenEstimateId}
          />
        );
      case 'process':
        return <Process customers={customers} setCustomers={setCustomers} />;
      case 'purchase':
        return (
          <Purchase
            quoteProjects={quoteProjects}
            materials={materials}
            purchaseOrders={purchaseOrders}
            setPurchaseOrders={setPurchaseOrders}
            customers={customers}
            estimates={estimates}
            orderTemplates={orderTemplates}
            setOrderTemplates={setOrderTemplates}
            onNavigateToQuote={() => setCurrentPage('quote')}
            selectedPurchaseOrderId={selectedPurchaseOrderId}
            setSelectedPurchaseOrderId={setSelectedPurchaseOrderId}
          />
        );
      case 'invoice':
        return (
          <Invoice
            invoices={invoices}
            setInvoices={setInvoices}
            quoteProjects={quoteProjects}
            customers={customers}
            estimates={estimates}
            openInvoiceId={openInvoiceId}
            setOpenInvoiceId={setOpenInvoiceId}
          />
        );
      case 'customer':
        return (
          <Customer
            customers={customers}
            setCustomers={setCustomers}
            materials={materials}
            purchaseOrders={purchaseOrders}
            onNavigateToPurchaseWithOrder={(orderId) => {
              setSelectedPurchaseOrderId(orderId);
              setCurrentPage('purchase');
            }}
          />
        );
      case 'attendance':
        return (
          <Attendance
            onPaidLeaveRequestedFromApp={(info) => {
              pushLeaveRequestWebNotification({
                leaveRequestId: info.leaveRequestId,
                employeeName: info.employeeName,
                periodLabel: info.periodLabel,
              });
            }}
          />
        );
      case 'training-videos':
        return <TrainingVideos />;
      case 'system-settings':
        return isField ? (
          <Forbidden403 onGoBack={() => setCurrentPage('dashboard')} />
        ) : (
          <SystemSettings
            materials={materials}
            setMaterials={setMaterials}
            employees={employees}
            setEmployees={setEmployees}
            purchasePriceObjects={purchasePriceObjects}
            setPurchasePriceObjects={setPurchasePriceObjects}
            activePurchasePriceObjectId={activePurchasePriceObjectId}
            setActivePurchasePriceObjectId={setActivePurchasePriceObjectId}
          />
        );
      case 'projects':
        return (
          <Projects
            customers={customers}
            setCustomers={setCustomers}
            estimates={estimates}
            invoices={invoices}
            purchaseOrders={purchaseOrders}
            onOpenEstimate={(id) => { setOpenEstimateId(id); setCurrentPage('quote'); }}
            onOpenInvoice={(id) => { setOpenInvoiceId(id); setCurrentPage('invoice'); }}
            onOpenPurchaseOrder={(id) => { setSelectedPurchaseOrderId(id); setCurrentPage('purchase'); }}
          />
        );
      default:
        return (
          <div className="p-6 max-w-screen-xl mx-auto space-y-6">
            <h1 className="text-xl font-medium">
              {navigationItems.find((n) => n.id === currentPage)?.label ?? currentPage}
            </h1>
            <p className="text-muted-foreground">この画面の実装を追加できます。</p>
          </div>
        );
    }
  };

  if (!session) {
    return (
      <>
        <Login users={loginUsers} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar（工程ページ等でメインが横に広くても縮まないよう shrink-0） */}
      <div className="w-60 shrink-0 bg-sidebar border-r border-border flex flex-col">
        <div className="h-14 flex items-center px-6 border-b border-border">
          <h1 className="text-lg font-medium text-foreground">LET'S</h1>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id as Page)}
                  className={`w-full flex items-center px-3 py-2 rounded-md text-sm transition-colors ${
                    currentPage === item.id
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="h-14 bg-surface border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center" />
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="検索..."
                className="w-70 pl-10 bg-input-background border-border"
              />
            </div>
            <Popover
              onOpenChange={(open) => {
                if (open && unreadWebNotificationCount > 0) markAllWebNotificationsRead();
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative shrink-0" title="通知">
                  <Bell className="w-5 h-5" />
                  {unreadWebNotificationCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center px-0.5">
                      {unreadWebNotificationCount > 9 ? '9+' : unreadWebNotificationCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 sm:w-96 p-0">
                <div className="px-3 py-2 border-b border-border font-medium text-sm">通知</div>
                <div className="max-h-72 overflow-y-auto">
                  {webNotifications.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">通知はありません。</p>
                  ) : (
                    webNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-3 py-2.5 border-b border-border/60 text-sm ${n.read ? 'opacity-70' : 'bg-muted/40'}`}
                      >
                        <p className="font-medium">{n.title}</p>
                        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(n.createdAt).toLocaleString('ja-JP')}
                        </p>
                        <Button
                          variant="link"
                          className="h-auto p-0 text-xs mt-1"
                          onClick={() => {
                            setCurrentPage('attendance');
                          }}
                        >
                          勤怠で開く
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {session.user.displayName.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">{session.user.displayName}</span>
              <Button variant="ghost" size="sm" onClick={logout} title="ログアウト">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">{renderPage()}</div>
      </div>

      <Toaster />
    </div>
  );
}
