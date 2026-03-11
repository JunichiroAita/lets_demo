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
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { toast } from 'sonner';

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
  const [correctDialogOpen, setCorrectDialogOpen] = useState(false);
  const [correctingRecord, setCorrectingRecord] = useState<AttendanceRecord | null>(null);
  const [correctForm, setCorrectForm] = useState({ reason: '', checkIn: '', checkOut: '' });

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'normal': return <Badge className="bg-green-600 text-white">出勤</Badge>;
      case 'absent': return <Badge className="bg-red-600 text-white">欠勤</Badge>;
      case 'holiday': return <Badge variant="outline">休暇</Badge>;
      default: return <Badge variant="outline">-</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'absent': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  const filteredRecords = attendanceRecords.filter(record => {
    const matchesEmployee = selectedEmployee === 'all' || record.employeeId === selectedEmployee;
    const matchesSearch = record.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || record.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMonth = record.date.startsWith(selectedMonth);
    return matchesEmployee && matchesSearch && matchesMonth;
  });

  const totalWorkHours = filteredRecords.reduce((sum, record) => sum + record.workHours, 0);
  const averageWorkHours = filteredRecords.length > 0 ? (totalWorkHours / filteredRecords.length).toFixed(1) : 0;
  const attendanceCount = filteredRecords.filter(r => r.status === 'normal').length;
  const absentCount = filteredRecords.filter(r => r.status === 'absent').length;

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
    setCorrectForm({ reason: '', checkIn: record.checkIn, checkOut: record.checkOut });
    setCorrectDialogOpen(true);
  };

  const saveCorrection = () => {
    if (!correctForm.reason.trim()) {
      toast.error('補正理由を入力してください（US-1212）');
      return;
    }
    if (!correctingRecord) return;
    setAttendanceRecords(prev =>
      prev.map((r) =>
        r.id === correctingRecord.id
          ? { ...r, checkIn: correctForm.checkIn, checkOut: correctForm.checkOut, memo: (r.memo || '') + ` [補正: ${correctForm.reason}]` }
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
    const matchesEmployee = selectedEmployee === 'all' || request.employeeId === selectedEmployee;
    const matchesStatus = leaveStatusFilter === 'all' || request.status === leaveStatusFilter;
    const matchesSearch = request.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || request.reason.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesEmployee && matchesStatus && matchesSearch;
  });

  const totalLeaveRequests = leaveRequests.length;
  const pendingLeaveRequests = leaveRequests.filter(r => r.status === 'pending').length;
  const approvedLeaveRequests = leaveRequests.filter(r => r.status === 'approved').length;
  const rejectedLeaveRequests = leaveRequests.filter(r => r.status === 'rejected').length;

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1>勤怠管理</h1>
          <p className="text-muted-foreground">従業員の勤怠状況を確認・管理します</p>
        </div>
        <Button onClick={() => alert('エクスポート')} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          エクスポート
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">総勤務時間</p><p className="text-2xl font-bold text-primary">{totalWorkHours.toFixed(1)}h</p></div><Clock className="w-8 h-8 text-primary" /></div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">平均勤務時間</p><p className="text-2xl font-bold text-primary">{averageWorkHours}h</p></div><TrendingUp className="w-8 h-8 text-primary" /></div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">出勤日数</p><p className="text-2xl font-bold text-green-600">{attendanceCount}日</p></div><CheckCircle className="w-8 h-8 text-green-600" /></div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">欠勤</p><p className="text-2xl font-bold text-red-600">{absentCount}件</p></div><AlertCircle className="w-8 h-8 text-red-600" /></div></CardContent></Card>
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
            <CardHeader><div className="flex items-center justify-between"><CardTitle>有給申請一覧</CardTitle><div className="flex items-center space-x-4"><Select value={leaveStatusFilter} onValueChange={setLeaveStatusFilter}><SelectTrigger className="w-40"><SelectValue placeholder="ステータス" /></SelectTrigger><SelectContent><SelectItem value="all">すべて</SelectItem><SelectItem value="pending">申請中</SelectItem><SelectItem value="approved">承認済</SelectItem><SelectItem value="rejected">却下</SelectItem></SelectContent></Select><Select value={selectedEmployee} onValueChange={setSelectedEmployee}><SelectTrigger className="w-48"><SelectValue placeholder="従業員を選択" /></SelectTrigger><SelectContent><SelectItem value="all">全従業員</SelectItem>{employees.map(emp => (<SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>))}</SelectContent></Select><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-56 pl-10" /></div></div></div></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>申請日</TableHead><TableHead>従業員</TableHead><TableHead>休暇期間</TableHead><TableHead>日数</TableHead><TableHead>理由</TableHead><TableHead>ステータス</TableHead><TableHead>アクション</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredLeaveRequests.length === 0 ? (<TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">有給申請データがありません</TableCell></TableRow>) : filteredLeaveRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.requestDate}</TableCell>
                      <TableCell><div className="flex items-center space-x-2"><Avatar className="w-8 h-8"><AvatarFallback className="text-xs">{employees.find(e => e.id === request.employeeId)?.initials}</AvatarFallback></Avatar><span>{request.employeeName}</span></div></TableCell>
                      <TableCell><div>{request.leaveStartDate}{request.leaveStartDate !== request.leaveEndDate && <span className="text-sm text-muted-foreground"> ～ {request.leaveEndDate}</span>}</div></TableCell>
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
            <CardHeader><div className="flex items-center justify-between"><CardTitle>日次勤怠記録</CardTitle><div className="flex items-center space-x-4"><div className="flex items-center space-x-2"><Button variant="outline" size="sm" onClick={goToPreviousMonth}><ChevronLeft className="w-4 h-4" /></Button><span className="min-w-32 text-center">{getMonthLabel()}</span><Button variant="outline" size="sm" onClick={goToNextMonth}><ChevronRight className="w-4 h-4" /></Button></div><Select value={selectedEmployee} onValueChange={setSelectedEmployee}><SelectTrigger className="w-48"><SelectValue placeholder="従業員を選択" /></SelectTrigger><SelectContent><SelectItem value="all">全従業員</SelectItem>{employees.map(emp => (<SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>))}</SelectContent></Select><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-56 pl-10" /></div></div></div></CardHeader>
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
                      <TableCell>{record.location}</TableCell>
                      <TableCell><div className="flex items-center space-x-2">{getStatusIcon(record.status)}{getStatusBadge(record.status)}</div></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{record.memo || '-'}</TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => openCorrectDialog(record)} title="補正（理由必須）"><Edit className="w-4 h-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>従業員別勤怠サマリー（{getMonthLabel()}）</CardTitle></CardHeader>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>勤怠補正（理由必須）</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {correctingRecord && (
              <>
                <p className="text-sm text-muted-foreground">{correctingRecord.employeeName} / {correctingRecord.date}</p>
                <div className="space-y-2">
                  <Label>補正理由 *</Label>
                  <Input value={correctForm.reason} onChange={(e) => setCorrectForm((f) => ({ ...f, reason: e.target.value }))} placeholder="出勤忘れの後入力" />
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
