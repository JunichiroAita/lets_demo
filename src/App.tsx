import React, { useState, useMemo } from 'react';
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
  ChevronDown,
  Search,
  LogOut,
} from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { Input } from './components/ui/input';
import { Avatar, AvatarFallback } from './components/ui/avatar';
import { Button } from './components/ui/button';
import Dashboard from './components/Dashboard';
import Quote from './components/Quote';
import Process from './components/Process';
import Purchase from './components/Purchase';
import Invoice from './components/Invoice';
import Customer from './components/Customer';
import type { CustomerRecord } from './components/Customer';
import Attendance from './components/Attendance';
import SystemSettings from './components/SystemSettings';
import Projects from './components/Projects';
import Login from './components/Login';
import Forbidden403 from './components/Forbidden403';
import type { PurchaseOrderRecord } from './components/Purchase_history';
import { useAuth } from './contexts/AuthContext';

type Page =
  | 'dashboard'
  | 'quote'
  | 'process'
  | 'purchase'
  | 'invoice'
  | 'customer'
  | 'attendance'
  | 'system-settings'
  | 'projects';

const navigationItems = [
  { id: 'dashboard', label: 'ダッシュボード', icon: Home },
  { id: 'projects', label: '案件', icon: Briefcase },
  { id: 'quote', label: '見積', icon: FileText },
  { id: 'process', label: '工程', icon: Calendar },
  { id: 'purchase', label: '購買', icon: ShoppingCart },
  { id: 'invoice', label: '請求', icon: Receipt },
  { id: 'customer', label: '顧客', icon: Users },
  { id: 'attendance', label: '勤怠', icon: User },
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
  standardPrice: number;
  code: string;
  memo?: string;
  isActive?: boolean;
};

/** 見積明細（US-0601: 単価元でマスタ/AIを区別） */
export type EstimateLineItem = {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  unitPriceSource: 'master' | 'ai';
};

/** 見積（F-03: 下書き/確定/取消・見積番号・顧客・案件・改版元） */
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

/** 材料発注ひな型 1行（US-0901: 品目/数量/単位/備考） */
export type OrderTemplateItem = {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  memo?: string;
};

/** 材料発注ひな型（F-06） */
export type OrderTemplateRecord = {
  id: string;
  name: string;
  items: OrderTemplateItem[];
  createdAt: string;
  updatedAt: string;
};

const initialMaterials: MaterialRecord[] = [
  { id: 'M1', name: '石膏ボード 12.5mm', unit: '枚', category: '建材', standardPrice: 850, code: 'GP-12.5', isActive: true },
  { id: 'M2', name: 'LGS @455', unit: 'm', category: '建材', standardPrice: 1200, code: 'LGS-455', isActive: true },
];

/** 請求明細行（F-12） */
export type InvoiceLineItem = {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
};

/** 請求（F-12）US-1011: 請求番号は内部管理用・支払い期限は設けない */
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
  dueDate?: string;
  updateHistory?: Array<{ at: string; action: string }>;
};

const initialInvoices: InvoiceRecord[] = [
  { id: 'inv1', invoiceNumber: 'INV-202603-0001', customerId: 'CUST-001', customerName: 'A邸プロジェクト', projectName: '内装工事（品川）', status: 'issued', billingDayDisplay: 20, items: [{ id: '1', item: '工事請負', quantity: 1, unit: '式', unitPrice: 153500, amount: 153500 }], subtotal: 153500, taxAmount: 15350, totalAmount: 168850, lastUpdated: '2026-03-01' },
  { id: 'inv2', invoiceNumber: 'INV-202603-0002', customerId: '', customerName: 'Bビル改修', projectName: 'オフィス改装工事（新宿）', status: 'issued', items: [{ id: '1', item: '工事請負', quantity: 1, unit: '式', unitPrice: 850000, amount: 850000 }], subtotal: 850000, taxAmount: 85000, totalAmount: 935000, lastUpdated: '2026-03-05' },
  { id: 'inv3', invoiceNumber: 'INV-202603-0003', customerId: 'CUST-001', customerName: 'A邸プロジェクト', projectName: '追加工事（品川）', status: 'draft', items: [{ id: '1', item: '追加工事', quantity: 1, unit: '式', unitPrice: 50000, amount: 50000 }], subtotal: 50000, taxAmount: 5000, totalAmount: 55000, lastUpdated: '2026-03-10' },
];

const initialEstimates: EstimateRecord[] = [];
const initialOrderTemplates: OrderTemplateRecord[] = [];

// ログイン用ユーザー（US-0001: 有効な認証情報でログイン可能。設定の従業員管理と連携する場合は state で同期可）
const initialLoginUsers = [
  { id: 'U1', loginId: 'admin', displayName: '管理者', role: 'owner', isActive: true, passwordHash: 'demo' },
  { id: 'U2', loginId: 'field1', displayName: '現場', role: 'field', isActive: true, passwordHash: 'demo' },
];

export default function App() {
  const { session, logout, isField } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [quoteProjects, setQuoteProjects] = useState(initialQuoteProjects);
  const [customers, setCustomers] = useState<CustomerRecord[]>(initialCustomers);
  const [materials, setMaterials] = useState<MaterialRecord[]>(initialMaterials);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(initialInvoices);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>(initialPurchaseOrders);
  const [estimates, setEstimates] = useState<EstimateRecord[]>(initialEstimates);
  const [orderTemplates, setOrderTemplates] = useState<OrderTemplateRecord[]>(initialOrderTemplates);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string | null>(null);
  const [openEstimateId, setOpenEstimateId] = useState<string | null>(null);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [loginUsers] = useState(initialLoginUsers);

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
        return <Attendance />;
      case 'system-settings':
        return isField ? <Forbidden403 onGoBack={() => setCurrentPage('dashboard')} /> : <SystemSettings materials={materials} setMaterials={setMaterials} />;
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
      {/* Sidebar */}
      <div className="w-60 bg-sidebar border-r border-border flex flex-col">
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
