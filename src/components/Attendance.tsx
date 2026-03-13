import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import {
  Clock, Calendar as CalendarIcon, Users, TrendingUp, AlertCircle, CheckCircle, Download, Filter,
  ChevronLeft, ChevronRight, Search, BarChart3, FileText, XCircle, Check, X, Edit
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { toast } from 'sonner';

const DEFAULT_BREAK = {
  break1Start: '10:00',
  break1End: '10:30',
  break2Start: '12:00',
  break2End: '13:00',
  break3Start: '15:00',
  break3End: '15:30',
}; // 合計2時間/日

function parseTimeToMinutes(t: string): number {
  if (!t || t === '-') return 0;
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function breakMinutes(b: { break1Start: string; break1End: string; break2Start: string; break2End: string; break3Start: string; break3End: string }): number {
  const seg = (s: string, e: string) => Math.max(0, parseTimeToMinutes(e) - parseTimeToMinutes(s));
  return seg(b.break1Start, b.break1End) + seg(b.break2Start, b.break2End) + seg(b.break3Start, b.break3End);
}
function calcWorkHours(checkIn: string, checkOut: string, breakMin: number): number {
  const inM = parseTimeToMinutes(checkIn);
  const outM = parseTimeToMinutes(checkOut);
  if (inM === 0 || outM === 0) return 0;
  return Math.max(0, (outM - inM - breakMin) / 60);
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  workHours: number;
  status: 'normal' | 'absent' | 'holiday';
  location: string;
  memo?: string;
  break1Start?: string;
  break1End?: string;
  break2Start?: string;
  break2End?: string;
  break3Start?: string;
  break3End?: string;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  initials: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  requestDate: string;
  leaveStartDate: string;
  leaveEndDate: string;
  leaveDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedDate?: string;
  rejectedReason?: string;
}

const Attendance = () => {
  const { session } = useAuth();
  const { log: auditLog } = useAudit();
  const [selectedMonth, setSelectedMonth] = useState('2024-12');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('all');
  const [leaveEmployeeFilter, setLeaveEmployeeFilter] = useState<string>('all');
  const [leaveDateFrom, setLeaveDateFrom] = useState<string>('');
  const [leaveDateTo, setLeaveDateTo] = useState<string>('');
  const [correctDialogOpen, setCorrectDialogOpen] = useState(false);
  const [correctingRecord, setCorrectingRecord] = useState<AttendanceRecord | null>(null);
  const [correctForm, setCorrectForm] = useState({
    reason: '',
    checkIn: '',
    checkOut: '',
    status: 'normal' as 'normal' | 'absent' | 'holiday',
    ...DEFAULT_BREAK,
  });

  const employees: Employee[] = [
    { id: 'EMP-001', name: '田中太郎', role: '現場監督', initials: '田中' },
    { id: 'EMP-002', name: '佐藤花子', role: '作業員', initials: '佐藤' },
    { id: 'EMP-003', name: '山田次郎', role: '作業員', initials: '山田' },
    { id: 'EMP-004', name: '鈴木一郎', role: '現場監督', initials: '鈴木' },
    { id: 'EMP-005', name: '高橋美咲', role: '事務', initials: '高橋' },
    { id: 'EMP-006', name: '渡辺健太', role: '作業員', initials: '渡辺' },
    { id: 'EMP-007', name: '伊藤真由美', role: '作業員', initials: '伊藤' },
    { id: 'EMP-008', name: '中村大輔', role: '現場監督', initials: '中村' },
  ];

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    { id: 'LR-001', employeeId: 'EMP-001', employeeName: '田中太郎', requestDate: '2024-12-01', leaveStartDate: '2024-12-15', leaveEndDate: '2024-12-15', leaveDays: 1, reason: '私用', status: 'approved', approvedBy: '管理者', approvedDate: '2024-12-02' },
    { id: 'LR-002', employeeId: 'EMP-002', employeeName: '佐藤花子', requestDate: '2024-12-03', leaveStartDate: '2024-12-20', leaveEndDate: '2024-12-22', leaveDays: 3, reason: '年末休暇', status: 'pending' },
    { id: 'LR-003', employeeId: 'EMP-003', employeeName: '山田次郎', requestDate: '2024-12-04', leaveStartDate: '2024-12-18', leaveEndDate: '2024-12-18', leaveDays: 1, reason: '通院', status: 'approved', approvedBy: '管理者', approvedDate: '2024-12-05' },
  ]);

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([
    { id: 'ATT-001', employeeId: 'EMP-001', employeeName: '田中太郎', date: '2024-12-01', checkIn: '08:00', checkOut: '17:30', workHours: 8.5, status: 'normal', location: 'A邸現場' },
    { id: 'ATT-002', employeeId: 'EMP-002', employeeName: '佐藤花子', date: '2024-12-01', checkIn: '08:00', checkOut: '17:30', workHours: 8.5, status: 'normal', location: 'Bビル現場' },
    { id: 'ATT-003', employeeId: 'EMP-003', employeeName: '山田次郎', date: '2024-12-01', checkIn: '08:00', checkOut: '17:00', workHours: 8.0, status: 'normal', location: 'C工場現場' },
    { id: 'ATT-008', employeeId: 'EMP-003', employeeName: '山田次郎', date: '2024-12-02', checkIn: '-', checkOut: '-', workHours: 0, status: 'absent', location: '-', memo: '体調不良' },
  ]);

  const getStatusBadge = (status: string, needsReview?: boolean) => {
    if (needsReview) return <Badge className="bg-amber-500 text-black">要確認</Badge>;
    switch (status) {
      case 'normal': return <Badge className="bg-green-600 text-white">出勤</Badge>;
      case 'absent': return <Badge className="bg-red-600 text-white">欠勤</Badge>;
      case 'holiday': return <Badge variant="outline">休暇</Badge>;
      default: return <Badge variant="outline">-</Badge>;
    }
  };

  const getStatusIcon = (status: string, needsReview?: boolean) => {
    if (needsReview) return <AlertCircle className="w-4 h-4 text-amber-500" />;
    switch (status) {
      case 'normal': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'absent': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  // 打刻が複数ある場合: 出勤=最も早い時刻・退勤=最も遅い時刻で集約
  const aggregatedByDay = React.useMemo(() => {
    const byKey: Record<string, AttendanceRecord[]> = {};
    attendanceRecords.forEach((r) => {
      const key = `${r.employeeId}-${r.date}`;
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(r);
    });
    const result: (AttendanceRecord & { needsReview?: boolean })[] = [];
    Object.entries(byKey).forEach(([key, recs]) => {
      const first = recs[0];
      const validCheckIns = recs.map((r) => r.checkIn).filter((t) => t && t !== '-');
      const validCheckOuts = recs.map((r) => r.checkOut).filter((t) => t && t !== '-');
      const checkIn = validCheckIns.length > 0 ? validCheckIns.reduce((a, b) => (a < b ? a : b)) : first.checkIn;
      const checkOut = validCheckOuts.length > 0 ? validCheckOuts.reduce((a, b) => (a > b ? a : b)) : first.checkOut;
      const needsReview = !checkIn || checkIn === '-' || !checkOut || checkOut === '-';
      result.push({
        ...first,
        id: first.id,
        checkIn,
        checkOut,
        needsReview,
      });
    });
    return result;
  }, [attendanceRecords]);

  const filteredRecords = aggregatedByDay.filter(record => {
    const matchesEmployee = selectedEmployee === 'all' || record.employeeId === selectedEmployee;
    const matchesSearch = record.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || (record.location || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMonth = record.date.startsWith(selectedMonth);
    return matchesEmployee && matchesSearch && matchesMonth;
  });

  const employeeSummary = employees.map(emp => {
    const empRecords = filteredRecords.filter(r => r.employeeId === emp.id);
    const totalHours = empRecords.reduce((sum, r) => sum + r.workHours, 0);
    const workDays = empRecords.filter(r => r.status !== 'absent' && r.status !== 'holiday').length;
    const absentCountEmp = empRecords.filter(r => r.status === 'absent').length;
    return { ...emp, totalHours, workDays, absentCount: absentCountEmp, averageHours: workDays > 0 ? (totalHours / workDays).toFixed(1) : 0 };
  });

  const goToPreviousMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    setSelectedMonth(`${prevYear}-${String(prevMonth).padStart(2, '0')}`);
  };

  const goToNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    setSelectedMonth(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);
  };

  const getMonthLabel = () => {
    const [year, month] = selectedMonth.split('-');
    return `${year}年${month}月`;
  };

  const getLeaveStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-600 text-white">承認済</Badge>;
      case 'pending': return <Badge className="bg-amber-500 text-black">申請中</Badge>;
      case 'rejected': return <Badge className="bg-red-600 text-white">却下</Badge>;
      default: return <Badge variant="outline">-</Badge>;
    }
  };

  const openCorrectDialog = (record: AttendanceRecord) => {
    setCorrectingRecord(record);
    setCorrectForm({
      reason: '',
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      status: record.status,
      break1Start: record.break1Start ?? DEFAULT_BREAK.break1Start,
      break1End: record.break1End ?? DEFAULT_BREAK.break1End,
      break2Start: record.break2Start ?? DEFAULT_BREAK.break2Start,
      break2End: record.break2End ?? DEFAULT_BREAK.break2End,
      break3Start: record.break3Start ?? DEFAULT_BREAK.break3Start,
      break3End: record.break3End ?? DEFAULT_BREAK.break3End,
    });
    setCorrectDialogOpen(true);
  };

  const saveCorrection = () => {
    if (!correctingRecord) return;
    const brMin = breakMinutes(correctForm);
    const workHours = correctForm.status === 'normal' ? calcWorkHours(correctForm.checkIn, correctForm.checkOut, brMin) : 0;
    const reasonSuffix = correctForm.reason.trim() ? ` [補正: ${correctForm.reason.trim()}]` : '';
    setAttendanceRecords(prev =>
      prev.map((r) =>
        r.id === correctingRecord.id
          ? {
              ...r,
              checkIn: correctForm.checkIn,
              checkOut: correctForm.checkOut,
              status: correctForm.status,
              break1Start: correctForm.break1Start,
              break1End: correctForm.break1End,
              break2Start: correctForm.break2Start,
              break2End: correctForm.break2End,
              break3Start: correctForm.break3Start,
              break3End: correctForm.break3End,
              workHours,
              memo: (r.memo || '') + reasonSuffix,
            }
          : r
      )
    );
    auditLog({
      userId: session?.user?.id ?? '',
      action: '勤怠補正',
      targetId: correctingRecord.id,
      result: 'success',
    });
    toast.success('勤怠を補正しました');
    setCorrectDialogOpen(false);
    setCorrectingRecord(null);
  };

  const exportDailyToExcel = () => {
    const headers = ['日付', '従業員', '出勤', '退勤', '勤務時間', '勤務地', 'ステータス', '備考'];
    const statusLabel = (r: AttendanceRecord & { needsReview?: boolean }) =>
      r.needsReview ? '要確認' : r.status === 'normal' ? '出勤' : r.status === 'absent' ? '欠勤' : '休暇';
    const rows = [
      headers,
      ...filteredRecords.map((r) => [
        r.date,
        r.employeeName,
        r.checkIn,
        r.checkOut,
        r.workHours > 0 ? `${r.workHours}h` : '-',
        r.location || '-',
        statusLabel(r),
        r.memo || '-',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '日次勤怠');
    XLSX.writeFile(wb, `勤怠_${selectedMonth}.xlsx`);
    toast.success('Excelで出力しました');
  };

  const handleApproveLeave = (requestId: string) => {
    setLeaveRequests(prev => prev.map(req => req.id === requestId ? { ...req, status: 'approved', approvedBy: session?.user?.displayName ?? '管理者', approvedDate: new Date().toISOString().split('T')[0] } : req));
    auditLog({ userId: session?.user?.id ?? '', action: '有給承認', targetId: requestId, result: 'success' });
    toast.success('承認しました');
  };

  const handleRejectLeave = (requestId: string) => {
    const reason = prompt('却下理由を入力してください:');
    if (reason) {
      setLeaveRequests(prev => prev.map(req => req.id === requestId ? { ...req, status: 'rejected', approvedBy: session?.user?.displayName ?? '管理者', approvedDate: new Date().toISOString().split('T')[0], rejectedReason: reason } : req));
      auditLog({ userId: session?.user?.id ?? '', action: '有給却下', targetId: requestId, result: 'success' });
      toast.success('却下しました');
    }
  };

  const filteredLeaveRequests = leaveRequests.filter(request => {
    const matchesEmployee = leaveEmployeeFilter === 'all' || request.employeeId === leaveEmployeeFilter;
    const matchesStatus = leaveStatusFilter === 'all' || request.status === leaveStatusFilter;
    const matchesSearch = request.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || request.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPeriod =
      (!leaveDateFrom && !leaveDateTo) ||
      (leaveDateFrom && leaveDateTo && request.requestDate >= leaveDateFrom && request.requestDate <= leaveDateTo) ||
      (leaveDateFrom && !leaveDateTo && request.requestDate >= leaveDateFrom) ||
      (!leaveDateFrom && leaveDateTo && request.requestDate <= leaveDateTo);
    return matchesEmployee && matchesStatus && matchesSearch && matchesPeriod;
  });

  const exportLeaveToExcel = () => {
    const headers = ['申請者', '日付', '単位', '理由', '状態'];
    const statusLabel = (s: string) => (s === 'approved' ? '承認' : s === 'rejected' ? '却下' : '申請中');
    const rows = [
      headers,
      ...filteredLeaveRequests.map((r) => [
        r.employeeName,
        r.leaveStartDate === r.leaveEndDate ? r.leaveStartDate : `${r.leaveStartDate} ～ ${r.leaveEndDate}`,
        `${r.leaveDays}日`,
        r.reason,
        statusLabel(r.status),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '有給申請');
    XLSX.writeFile(wb, `有給申請_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Excelで出力しました');
  };

  const totalLeaveRequests = leaveRequests.length;
  const pendingLeaveRequests = leaveRequests.filter(r => r.status === 'pending').length;
  const approvedLeaveRequests = leaveRequests.filter(r => r.status === 'approved').length;
  const rejectedLeaveRequests = leaveRequests.filter(r => r.status === 'rejected').length;

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1>勤怠管理</h1>
        <p className="text-muted-foreground">従業員の勤怠状況を確認・管理します</p>
      </div>

      <Tabs defaultValue="daily" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily" className="flex items-center space-x-2"><CalendarIcon className="w-4 h-4" /><span>日次勤怠</span></TabsTrigger>
          <TabsTrigger value="leave" className="flex items-center space-x-2"><FileText className="w-4 h-4" /><span>有給申請管理</span></TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center space-x-2"><BarChart3 className="w-4 h-4" /><span>従業員別サマリー</span></TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">総申請数</p><p className="text-2xl font-bold text-primary">{totalLeaveRequests}件</p></div><FileText className="w-8 h-8 text-primary" /></div></CardContent></Card>
            <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">申請中</p><p className="text-2xl font-bold text-amber-500">{pendingLeaveRequests}件</p></div><Clock className="w-8 h-8 text-amber-500" /></div></CardContent></Card>
            <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">承認済</p><p className="text-2xl font-bold text-green-600">{approvedLeaveRequests}件</p></div><CheckCircle className="w-8 h-8 text-green-600" /></div></CardContent></Card>
            <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">却下</p><p className="text-2xl font-bold text-red-600">{rejectedLeaveRequests}件</p></div><XCircle className="w-8 h-8 text-red-600" /></div></CardContent></Card>
          </div>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={leaveStatusFilter} onValueChange={setLeaveStatusFilter}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="状態" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">すべて</SelectItem><SelectItem value="pending">申請中</SelectItem><SelectItem value="approved">承認済</SelectItem><SelectItem value="rejected">却下</SelectItem></SelectContent>
                  </Select>
                  <Select value={leaveEmployeeFilter} onValueChange={setLeaveEmployeeFilter}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="申請者" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">全員</SelectItem>{employees.map(emp => (<SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>))}</SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={leaveDateFrom} onChange={(e) => setLeaveDateFrom(e.target.value)} placeholder="期間From" className="w-40" />
                    <span className="text-muted-foreground">～</span>
                    <Input type="date" value={leaveDateTo} onChange={(e) => setLeaveDateTo(e.target.value)} placeholder="期間To" className="w-40" />
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-48 pl-10" />
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={exportLeaveToExcel}>
                  <Download className="w-4 h-4 mr-2" />
                  Excel出力
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>申請者</TableHead><TableHead>日付</TableHead><TableHead>単位</TableHead><TableHead>理由</TableHead><TableHead>状態</TableHead><TableHead>アクション</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredLeaveRequests.length === 0 ? (<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">該当する有給申請がありません</TableCell></TableRow>) : filteredLeaveRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell><div className="flex items-center space-x-2"><Avatar className="w-8 h-8"><AvatarFallback className="text-xs">{employees.find(e => e.id === request.employeeId)?.initials}</AvatarFallback></Avatar><span>{request.employeeName}</span></div></TableCell>
                      <TableCell>{request.leaveStartDate === request.leaveEndDate ? request.leaveStartDate : `${request.leaveStartDate} ～ ${request.leaveEndDate}`}</TableCell>
                      <TableCell>{request.leaveDays}日</TableCell>
                      <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                      <TableCell>{getLeaveStatusBadge(request.status)}</TableCell>
                      <TableCell>{request.status === 'pending' && (<div className="flex items-center space-x-2"><Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApproveLeave(request.id)}><Check className="w-4 h-4 mr-1" />承認</Button><Button size="sm" variant="outline" className="text-red-600 hover:bg-red-500/10" onClick={() => handleRejectLeave(request.id)}><X className="w-4 h-4 mr-1" />却下</Button></div>)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={goToPreviousMonth}><ChevronLeft className="w-4 h-4" /></Button>
                    <span className="min-w-28 text-center text-sm">{getMonthLabel()}</span>
                    <Button variant="outline" size="sm" onClick={goToNextMonth}><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="人員" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">全員</SelectItem>{employees.map(emp => (<SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>))}</SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-48 pl-10" />
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={exportDailyToExcel}>
                  <Download className="w-4 h-4 mr-2" />
                  Excel出力
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>日付</TableHead><TableHead>従業員</TableHead><TableHead>出勤</TableHead><TableHead>退勤</TableHead><TableHead>勤務時間</TableHead><TableHead>勤務地</TableHead><TableHead>ステータス</TableHead><TableHead>備考</TableHead><TableHead className="w-20">操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredRecords.length === 0 ? (<TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">勤怠データがありません</TableCell></TableRow>) : filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.date}</TableCell>
                      <TableCell><div className="flex items-center space-x-2"><Avatar className="w-8 h-8"><AvatarFallback className="text-xs">{employees.find(e => e.id === record.employeeId)?.initials}</AvatarFallback></Avatar><span>{record.employeeName}</span></div></TableCell>
                      <TableCell>{record.checkIn}</TableCell><TableCell>{record.checkOut}</TableCell>
                      <TableCell><div className="flex items-center space-x-2"><Clock className="w-3 h-3 text-muted-foreground" /><span>{record.workHours > 0 ? `${record.workHours}h` : '-'}</span></div></TableCell>
                      <TableCell>{record.location || '-'}</TableCell>
                      <TableCell><div className="flex items-center space-x-2">{getStatusIcon(record.status, record.needsReview)}{getStatusBadge(record.status, record.needsReview)}</div></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{record.memo || '-'}</TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => openCorrectDialog(record)} title="勤怠を補正"><Edit className="w-4 h-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>従業員別勤怠サマリー（{getMonthLabel()}）</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">基本休憩時間: 10:00～10:30 / 12:00～13:00 / 15:00～15:30（合計2時間/日）</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>従業員</TableHead><TableHead>役職</TableHead><TableHead>出勤日数</TableHead><TableHead>総勤務時間</TableHead><TableHead>平均勤務時間</TableHead><TableHead>欠勤</TableHead></TableRow></TableHeader>
                <TableBody>
                  {employeeSummary.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell><div className="flex items-center space-x-2"><Avatar className="w-8 h-8"><AvatarFallback className="text-xs">{emp.initials}</AvatarFallback></Avatar><span>{emp.name}</span></div></TableCell>
                      <TableCell>{emp.role}</TableCell><TableCell>{emp.workDays}日</TableCell>
                      <TableCell><div className="flex items-center space-x-2"><Clock className="w-3 h-3 text-muted-foreground" /><span>{emp.totalHours.toFixed(1)}h</span></div></TableCell>
                      <TableCell>{emp.averageHours}h</TableCell>
                      <TableCell>{emp.absentCount > 0 ? <Badge className="bg-red-600 text-white">{emp.absentCount}件</Badge> : <span className="text-muted-foreground">0件</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={correctDialogOpen} onOpenChange={setCorrectDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>勤怠補正</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {correctingRecord && (
              <>
                <p className="text-sm text-muted-foreground">{correctingRecord.employeeName} / {correctingRecord.date}</p>
                <div className="space-y-2">
                  <Label>補正理由（任意）</Label>
                  <Input value={correctForm.reason} onChange={(e) => setCorrectForm((f) => ({ ...f, reason: e.target.value }))} placeholder="出勤忘れの後入力、予定だったが欠勤 等" />
                </div>
                <div className="space-y-2">
                  <Label>ステータス</Label>
                  <Select value={correctForm.status} onValueChange={(v: 'normal' | 'absent' | 'holiday') => setCorrectForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">出勤</SelectItem>
                      <SelectItem value="absent">欠勤</SelectItem>
                      <SelectItem value="holiday">休暇</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>出勤</Label>
                    <Input type="time" value={correctForm.checkIn} onChange={(e) => setCorrectForm((f) => ({ ...f, checkIn: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>退勤</Label>
                    <Input type="time" value={correctForm.checkOut} onChange={(e) => setCorrectForm((f) => ({ ...f, checkOut: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-base">休憩時間</Label>
                  <p className="text-xs text-muted-foreground">各休憩の「開始」と「終了」を設定します。合計休憩時間で勤務時間が計算されます。</p>
                  <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
                    <div className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                      <span className="text-sm font-medium">休憩1</span>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">開始</span>
                        <Input type="time" value={correctForm.break1Start} onChange={(e) => setCorrectForm((f) => ({ ...f, break1Start: e.target.value }))} className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">終了</span>
                        <Input type="time" value={correctForm.break1End} onChange={(e) => setCorrectForm((f) => ({ ...f, break1End: e.target.value }))} className="h-9" />
                      </div>
                    </div>
                    <div className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                      <span className="text-sm font-medium">休憩2</span>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">開始</span>
                        <Input type="time" value={correctForm.break2Start} onChange={(e) => setCorrectForm((f) => ({ ...f, break2Start: e.target.value }))} className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">終了</span>
                        <Input type="time" value={correctForm.break2End} onChange={(e) => setCorrectForm((f) => ({ ...f, break2End: e.target.value }))} className="h-9" />
                      </div>
                    </div>
                    <div className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                      <span className="text-sm font-medium">休憩3</span>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">開始</span>
                        <Input type="time" value={correctForm.break3Start} onChange={(e) => setCorrectForm((f) => ({ ...f, break3Start: e.target.value }))} className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">終了</span>
                        <Input type="time" value={correctForm.break3End} onChange={(e) => setCorrectForm((f) => ({ ...f, break3End: e.target.value }))} className="h-9" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">合計休憩: {Math.floor(breakMinutes(correctForm) / 60)}h {breakMinutes(correctForm) % 60}分</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectDialogOpen(false)}>キャンセル</Button>
            <Button onClick={saveCorrection}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Attendance;
