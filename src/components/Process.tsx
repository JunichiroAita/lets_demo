import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import { useAudit } from '../contexts/AuditContext';
import {
  ChevronLeft, ChevronRight, Filter, Calendar, Users, Plus, X, Building2, Move, Trash2
} from 'lucide-react';

interface GanttItem {
  id: number;
  project: string;
  location: string;
  assignee: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: 'completed' | 'in-progress' | 'scheduled' | 'delayed';
  color: string;
}

interface CalendarPerson {
  id: number;
  assignee: string;
  monday: ProjectAssignment[];
  tuesday: ProjectAssignment[];
  wednesday: ProjectAssignment[];
  thursday: ProjectAssignment[];
  friday: ProjectAssignment[];
  saturday: ProjectAssignment[];
  sunday: ProjectAssignment[];
}

interface ProjectAssignment {
  id: string;
  name: string;
  hours: number;
  color: string;
  /** ガントタスクID（割当同期用 US-0712） */
  taskId?: number;
}

interface ProcessProps {
  customers: any[];
  setCustomers: React.Dispatch<React.SetStateAction<any[]>>;
}

const weekdays = ['月', '火', '水', '木', '金', '土', '日'];
const weekdayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const projectColors = ['#0052CC', '#36B37E', '#FFAB00', '#DE350B', '#6554C0', '#00B8D9'];
const assigneeList = ['田中太郎', '佐藤花子', '山田次郎', '鈴木一郎', '高橋美咲', '渡辺健太'];

const Process: React.FC<ProcessProps> = () => {
  const { log: auditLog } = useAudit();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [currentWeek, setCurrentWeek] = useState('今週');
  const [calendarPersonFilter, setCalendarPersonFilter] = useState<string>('all');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<number | null>(null);
  const [editingLocationValue, setEditingLocationValue] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const selectedProject = selectedProjectId != null ? ganttData.find(p => p.id === selectedProjectId) ?? null : null;
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [addingToCell, setAddingToCell] = useState<{ personId: number; day: typeof weekdayKeys[number] } | null>(null);
  const [selectedProjectForCell, setSelectedProjectForCell] = useState<string>('new');
  const [newProjectName, setNewProjectName] = useState('');
  const [draggedProject, setDraggedProject] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'move' | 'resize-left' | 'resize-right' | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragStarted, setIsDragStarted] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** US-0701: デフォルトは前月〜2ヶ月先（例: 3月なら2月〜5月）。過去・未来はクォーター単位 */
  const getDefaultViewRange = () => {
    const today = new Date();
    const y = today.getFullYear();
    let m = today.getMonth(); // 0-indexed
    m -= 1; // 前月
    if (m < 0) { m += 12; }
    const startMonth1Based = m + 1;
    return { year: m < today.getMonth() ? y : y - 1, month: startMonth1Based };
  };
  const [currentViewStart, setCurrentViewStart] = useState(getDefaultViewRange());

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const today = new Date();
    const firstDay = new Date(currentViewStart.year, currentViewStart.month - 1, 1);
    const lastDay = new Date(currentViewStart.year, currentViewStart.month + 2, 0);
    const totalDays = Math.ceil((lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const diffDays = Math.round((today.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24));
    const ratio = Math.max(0, Math.min(1, diffDays / totalDays));
    el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth) - el.clientWidth * 0.3;
  }, [currentViewStart.month, currentViewStart.year]);

  const [newProjectData, setNewProjectData] = useState({
    project: '',
    location: '',
    assignee: [] as string[],
    startDate: '',
    endDate: '',
    color: '#0052CC'
  });

  const [ganttData, setGanttData] = useState<GanttItem[]>([
    { id: 1, project: 'A邸内装工事', location: '東京都品川区〇〇1-2-3', assignee: '田中太郎', startDate: '2024-12-01', endDate: '2024-12-15', progress: 60, status: 'in-progress', color: '#0052CC' },
    { id: 2, project: 'Bビル改修工事', location: '東京都新宿区△△4-5-6', assignee: '佐藤花子', startDate: '2024-12-05', endDate: '2024-12-20', progress: 30, status: 'in-progress', color: '#36B37E' },
    { id: 3, project: 'C工場改装', location: '埼玉県さいたま市□□7-8-9', assignee: '山田次郎', startDate: '2024-12-10', endDate: '2024-12-25', progress: 10, status: 'scheduled', color: '#FFAB00' }
  ]);

  const [calendarData, setCalendarData] = useState<CalendarPerson[]>([
    { id: 1, assignee: '田中太郎', monday: [{ id: '1-mon-1', name: 'A邸内装', hours: 8, color: '#0052CC' }], tuesday: [{ id: '1-tue-1', name: 'A邸内装', hours: 8, color: '#0052CC' }], wednesday: [{ id: '1-wed-1', name: 'A邸内装', hours: 8, color: '#0052CC' }], thursday: [{ id: '1-thu-1', name: 'A邸内装', hours: 4, color: '#0052CC' }, { id: '1-thu-2', name: 'Bビル改修', hours: 4, color: '#36B37E' }], friday: [{ id: '1-fri-1', name: 'Bビル改修', hours: 8, color: '#36B37E' }], saturday: [], sunday: [] },
    { id: 2, assignee: '佐藤花子', monday: [{ id: '2-mon-1', name: 'Bビル改修', hours: 8, color: '#36B37E' }], tuesday: [{ id: '2-tue-1', name: 'Bビル改修', hours: 8, color: '#36B37E' }], wednesday: [{ id: '2-wed-1', name: 'Bビル改修', hours: 8, color: '#36B37E' }], thursday: [{ id: '2-thu-1', name: 'Bビル改修', hours: 8, color: '#36B37E' }], friday: [{ id: '2-fri-1', name: 'Bビル改修', hours: 8, color: '#36B37E' }], saturday: [], sunday: [] },
    { id: 3, assignee: '山田次郎', monday: [], tuesday: [], wednesday: [{ id: '3-wed-1', name: 'C工場改装', hours: 8, color: '#FFAB00' }], thursday: [{ id: '3-thu-1', name: 'C工場改装', hours: 8, color: '#FFAB00' }], friday: [{ id: '3-fri-1', name: 'C工場改装', hours: 8, color: '#FFAB00' }], saturday: [{ id: '3-sat-1', name: 'C工場改装', hours: 6, color: '#FFAB00' }], sunday: [] }
  ]);

  const updateGanttItem = (id: number, field: keyof GanttItem, value: any) => {
    const current = ganttData.find(i => i.id === id);
    if (!current) return;
    const nextItem = { ...current, [field]: value };
    if ((field === 'startDate' || field === 'endDate') && new Date(nextItem.endDate) < new Date(nextItem.startDate)) {
      toast.error('終了日は開始日以降にしてください。保存できません。');
      return;
    }
    setGanttData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    auditLog({ userId: '', action: '工程タスク更新', targetId: String(id), result: 'success' });
    toast.success('更新されました');
  };

  /** US-0712: タスクの担当・期間をカレンダーに同期 */
  const syncTaskToCalendar = useCallback((task: GanttItem) => {
    if (!task.assignee) return;
    const start = new Date(task.startDate);
    const end = new Date(task.endDate);
    const dayKeys: typeof weekdayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    setCalendarData(prev => prev.map(p => {
      const next = { ...p, monday: p.monday.filter(a => a.taskId !== task.id), tuesday: p.tuesday.filter(a => a.taskId !== task.id), wednesday: p.wednesday.filter(a => a.taskId !== task.id), thursday: p.thursday.filter(a => a.taskId !== task.id), friday: p.friday.filter(a => a.taskId !== task.id), saturday: p.saturday.filter(a => a.taskId !== task.id), sunday: p.sunday.filter(a => a.taskId !== task.id) };
      if (p.assignee !== task.assignee) return next;
      for (let d = new Date(start.getTime()); d <= end; d.setDate(d.getDate() + 1)) {
        const dayIdx = d.getDay();
        const key = dayKeys[dayIdx === 0 ? 6 : dayIdx - 1];
        next[key] = [...next[key], { id: `${task.id}-${d.toISOString().slice(0,10)}`, name: task.project.replace(/工事|改修|改装/g, '').trim() || task.project, hours: 8, color: task.color, taskId: task.id }];
      }
      return next;
    }));
  }, []);

  const removeTaskFromCalendar = useCallback((taskId: number) => {
    setCalendarData(prev => prev.map(p => ({
      ...p,
      monday: p.monday.filter(a => a.taskId !== taskId),
      tuesday: p.tuesday.filter(a => a.taskId !== taskId),
      wednesday: p.wednesday.filter(a => a.taskId !== taskId),
      thursday: p.thursday.filter(a => a.taskId !== taskId),
      friday: p.friday.filter(a => a.taskId !== taskId),
      saturday: p.saturday.filter(a => a.taskId !== taskId),
      sunday: p.sunday.filter(a => a.taskId !== taskId),
    })));
  }, []);

  /** US-0712: 同日に別割当があるか（競合） */
  const checkAssignConflict = (assignee: string, startDate: string, endDate: string, excludeTaskId?: number): boolean => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const person = calendarData.find(p => p.assignee === assignee);
    if (!person) return false;
    const dayKeys: typeof weekdayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayIdx = d.getDay();
      const key = dayKeys[dayIdx === 0 ? 6 : dayIdx - 1];
      const hasOther = person[key].some(a => a.taskId !== excludeTaskId && a.taskId != null);
      if (hasOther) return true;
    }
    return false;
  };

  /** 表示範囲: デフォルト4ヶ月（前月〜2ヶ月先）。ラベル用 */
  const getViewMonths = () => {
    const startMonth = currentViewStart.month;
    const startYear = currentViewStart.year;
    let endMonth = startMonth + 3; // 4ヶ月表示
    let endYear = startYear;
    if (endMonth > 12) { endMonth -= 12; endYear += 1; }
    return { startMonth, endMonth, year: startYear, endYear };
  };

  const getQuarterLabel = () => {
    const { startMonth, endMonth, endYear } = getViewMonths();
    return `${currentViewStart.year}年${startMonth}月 - ${endYear}年${endMonth}月`;
  };

  /** US-0701: 過去・未来はクォーター単位で移動 */
  const navigateQuarter = (direction: 'prev' | 'next') => {
    setCurrentViewStart(prev => {
      const monthsToAdd = direction === 'next' ? 3 : -3;
      let newMonth = prev.month + monthsToAdd;
      let newYear = prev.year;
      while (newMonth > 12) { newMonth -= 12; newYear += 1; }
      while (newMonth <= 0) { newMonth += 12; newYear -= 1; }
      return { year: newYear, month: newMonth };
    });
  };

  const generateWeeks = (startMonth: number, endMonth: number, year: number, endYear?: number) => {
    const weeks: { start: Date; end: Date }[] = [];
    const actualEndYear = endYear ?? year;
    const currentDate = new Date(year, startMonth - 1, 1);
    const endDate = new Date(actualEndYear, endMonth, 0);
    const firstDay = currentDate.getDay();
    currentDate.setDate(currentDate.getDate() - firstDay);
    let count = 0;
    while (currentDate <= endDate && count < 25) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weeks.push({ start: new Date(weekStart), end: new Date(weekEnd) });
      currentDate.setDate(currentDate.getDate() + 7);
      count++;
    }
    return weeks;
  };

  const addNewProject = () => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 14);
    setNewProjectData({
      project: '',
      location: '',
      assignee: [],
      startDate: today.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      color: '#0052CC'
    });
    setNewProjectModalOpen(true);
  };

  /** US-0702: タスク追加。名称/開始/終了/担当（任意）。終了<開始は保存不可。US-0712: 競合時は警告＋継続可。監査ログ。 */
  const createNewProject = () => {
    if (!newProjectData.project.trim()) { toast.error('タスク名を入力してください'); return; }
    if (!newProjectData.startDate || !newProjectData.endDate) { toast.error('開始日と終了日を入力してください'); return; }
    if (new Date(newProjectData.endDate) < new Date(newProjectData.startDate)) { toast.error('終了日は開始日以降にしてください。保存できません。'); return; }
    const assigneeStr = newProjectData.assignee.length ? newProjectData.assignee[0] : '';
    if (assigneeStr && checkAssignConflict(assigneeStr, newProjectData.startDate, newProjectData.endDate)) {
      toast.warning('この担当者は同日に別の割当があります。競合の可能性があります。');
    }
    const newProject: GanttItem = {
      id: Date.now(),
      project: newProjectData.project,
      location: newProjectData.location,
      assignee: assigneeStr,
      startDate: newProjectData.startDate,
      endDate: newProjectData.endDate,
      progress: 0,
      status: 'scheduled',
      color: newProjectData.color
    };
    setGanttData(prev => [...prev, newProject]);
    setNewProjectModalOpen(false);
    if (assigneeStr) syncTaskToCalendar(newProject);
    auditLog({ userId: '', action: '工程タスク作成', targetId: String(newProject.id), result: 'success' });
    toast.success('タスクを追加しました');
  };

  /** US-0703: タスク削除。ガントから除外・カレンダーからも削除。監査ログ。（実績紐づきは暫定で削除可） */
  const deleteTask = (id: number) => {
    setGanttData(prev => prev.filter(item => item.id !== id));
    removeTaskFromCalendar(id);
    auditLog({ userId: '', action: '工程タスク削除', targetId: String(id), result: 'success' });
    setProjectModalOpen(false);
    setSelectedProjectId(null);
    toast.success('タスクを削除しました');
  };

  const openAddProjectDialog = (personId: number, day: typeof weekdayKeys[number]) => {
    setAddingToCell({ personId, day });
    setSelectedProjectForCell('new');
    setNewProjectName('');
  };

  const confirmAddProjectToCell = () => {
    if (!addingToCell) return;
    const { personId, day } = addingToCell;
    let projectName = '';
    let projectColor = '';
    if (selectedProjectForCell === 'new') {
      if (!newProjectName.trim()) { toast.error('プロジェクト名を入力してください'); return; }
      projectName = newProjectName;
      projectColor = projectColors[Math.floor(Math.random() * projectColors.length)];
    } else {
      const sp = ganttData.find(p => p.id.toString() === selectedProjectForCell);
      if (!sp) return;
      projectName = sp.project;
      projectColor = sp.color;
    }
    const newAssignment: ProjectAssignment = { id: `${personId}-${day}-${Date.now()}`, name: projectName, hours: 8, color: projectColor };
    setCalendarData(prev => prev.map(person => person.id === personId ? { ...person, [day]: [...person[day], newAssignment] } : person));
    setAddingToCell(null);
    toast.success('プロジェクトを追加しました');
  };

  const removeProjectFromCell = (personId: number, day: typeof weekdayKeys[number], projectId: string) => {
    setCalendarData(prev => prev.map(person => person.id === personId ? { ...person, [day]: person[day].filter(p => p.id !== projectId) } : person));
    toast.success('プロジェクトを削除しました');
  };

  const updateProjectInCell = (personId: number, day: typeof weekdayKeys[number], projectId: string, field: keyof ProjectAssignment, value: any) => {
    setCalendarData(prev => prev.map(person => person.id === personId ? { ...person, [day]: person[day].map(p => p.id === projectId ? { ...p, [field]: value } : p) } : person));
  };

  const updateProjectDates = useCallback((projectId: number, newStart: Date, newEnd: Date) => {
    const startStr = newStart.toISOString().split('T')[0];
    const endStr = newEnd.toISOString().split('T')[0];
    const current = ganttData.find(i => i.id === projectId);
    if (current?.assignee) { removeTaskFromCalendar(projectId); syncTaskToCalendar({ ...current, startDate: startStr, endDate: endStr }); }
    setGanttData(prev => prev.map(item => item.id === projectId ? { ...item, startDate: startStr, endDate: endStr } : item));
    auditLog({ userId: '', action: '工程タスク更新', targetId: String(projectId), result: 'success' });
    toast.success('期間を更新しました');
  }, [ganttData, auditLog, removeTaskFromCalendar, syncTaskToCalendar]);

  const calculateDateFromPosition = useCallback((position: number, weeks: { start: Date; end: Date }[]) => {
    if (!weeks.length || !timelineRef.current) return new Date();
    const rect = timelineRef.current.getBoundingClientRect();
    const rel = Math.max(0, Math.min(position, rect.width));
    const ratio = rel / rect.width;
    const totalDays = Math.ceil((weeks[weeks.length - 1].end.getTime() - weeks[0].start.getTime()) / (1000 * 60 * 60 * 24));
    const targetDate = new Date(weeks[0].start);
    targetDate.setDate(targetDate.getDate() + Math.round(ratio * totalDays));
    return targetDate;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, project: any, type: 'move' | 'resize-left' | 'resize-right') => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedProject(project);
    setDragType(type);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setIsDragStarted(false);
    dragTimeoutRef.current = setTimeout(() => {
      setIsDragging(true);
      setIsDragStarted(true);
      document.body.style.cursor = type === 'move' ? 'move' : type === 'resize-left' ? 'w-resize' : 'e-resize';
      document.body.style.userSelect = 'none';
    }, 100);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggedProject || !dragStartPos) return;
    const dist = Math.sqrt(Math.pow(e.clientX - dragStartPos.x, 2) + Math.pow(e.clientY - dragStartPos.y, 2));
    if (dist > 5 && !isDragStarted) {
      if (dragTimeoutRef.current) { clearTimeout(dragTimeoutRef.current); dragTimeoutRef.current = null; }
      setIsDragging(true);
      setIsDragStarted(true);
      document.body.style.cursor = dragType === 'move' ? 'move' : dragType === 'resize-left' ? 'w-resize' : 'e-resize';
      document.body.style.userSelect = 'none';
    }
    if (!isDragging) return;
  }, [isDragging, draggedProject, dragStartPos, dragType, isDragStarted]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (dragTimeoutRef.current) { clearTimeout(dragTimeoutRef.current); dragTimeoutRef.current = null; }
    if (!isDragStarted && draggedProject) {
      setSelectedProjectId(draggedProject.id);
      setProjectModalOpen(true);
    }
    if (isDragging && draggedProject && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const { startMonth, endMonth, year, endYear } = getViewMonths();
      const weeks = generateWeeks(startMonth, endMonth, year, endYear);
      const newDate = calculateDateFromPosition(relativeX, weeks);
      const currentStart = new Date(draggedProject.startDate);
      const currentEnd = new Date(draggedProject.endDate);
      if (dragType === 'move') {
        const duration = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));
        const newEnd = new Date(newDate);
        newEnd.setDate(newEnd.getDate() + duration);
        updateProjectDates(draggedProject.id, newDate, newEnd);
      } else if (dragType === 'resize-left' && newDate < currentEnd) {
        updateProjectDates(draggedProject.id, newDate, currentEnd);
      } else if (dragType === 'resize-right' && newDate > currentStart) {
        updateProjectDates(draggedProject.id, currentStart, newDate);
      }
    }
    setDraggedProject(null);
    setDragType(null);
    setIsDragging(false);
    setIsDragStarted(false);
    setDragStartPos(null);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [isDragging, isDragStarted, draggedProject, dragType, updateProjectDates, calculateDateFromPosition, ganttData]);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const projectTimelines = ganttData.map(project => {
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return { ...project, totalDays };
  });

  const filteredProjectTimelines = projectFilter === 'all' ? projectTimelines : projectTimelines.filter(p => p.id.toString() === projectFilter);

  const filteredCalendarData = (projectFilter === 'all' ? calendarData : calendarData.map(person => {
    const names = ganttData.filter(p => p.id.toString() === projectFilter).map(p => p.project.split('工事')[0].split('改修')[0].split('改装')[0]);
    const filterDay = (arr: ProjectAssignment[]) => arr.filter(a => names.some(n => a.name.includes(n)));
    return {
      ...person,
      monday: filterDay(person.monday), tuesday: filterDay(person.tuesday), wednesday: filterDay(person.wednesday),
      thursday: filterDay(person.thursday), friday: filterDay(person.friday), saturday: filterDay(person.saturday), sunday: filterDay(person.sunday)
    };
  })).filter(person => calendarPersonFilter === 'all' || person.assignee === calendarPersonFilter);

  const renderCalendarCard = (a: ProjectAssignment, personId: number, day: typeof weekdayKeys[number]) => {
    const isEditing = editingCell === `${personId}-${day}-${a.id}`;
    return (
      <div key={a.id} className="group relative mb-1 p-2 rounded text-white text-xs cursor-pointer hover:shadow-md" style={{ backgroundColor: a.color }}>
        <div className="flex items-center justify-between">
          {isEditing ? (
            <Input value={a.name} onChange={(e) => updateProjectInCell(personId, day, a.id, 'name', e.target.value)} onBlur={() => setEditingCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)} className="text-xs h-6 bg-white/20 border-white/30 text-white w-full" autoFocus />
          ) : (
            <span className="flex-1 font-medium" onClick={() => setEditingCell(`${personId}-${day}-${a.id}`)}>{a.name}</span>
          )}
          <Button variant="ghost" size="sm" className="w-4 h-4 p-0 opacity-0 group-hover:opacity-100 hover:bg-white/20" onClick={() => removeProjectFromCell(personId, day, a.id)}><X className="w-3 h-3" /></Button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1>工程管理</h1>
          <p className="text-muted-foreground">プロジェクトの進捗と人員配置を直接編集できます。ドラッグで期間変更も可能です。</p>
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="プロジェクトを選択" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのプロジェクト</SelectItem>
              {ganttData.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.project}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="calendar" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar" className="flex items-center space-x-2"><Users className="w-4 h-4" /><span>人員カレンダー</span></TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center space-x-2"><Calendar className="w-4 h-4" /><span>工程表</span></TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>人員カレンダー（F-05 / US-0711）</CardTitle>
                  <p className="text-muted-foreground">人員×日付で稼働状況を表示。期間・人員・案件で絞り込み可能。</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-sm text-muted-foreground">期間</Label>
                  <Select value={currentWeek} onValueChange={setCurrentWeek}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="前々週">前々週</SelectItem>
                      <SelectItem value="前週">前週</SelectItem>
                      <SelectItem value="今週">今週</SelectItem>
                      <SelectItem value="来週">来週</SelectItem>
                      <SelectItem value="再来週">再来週</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="text-sm text-muted-foreground ml-2">人員</Label>
                  <Select value={calendarPersonFilter} onValueChange={setCalendarPersonFilter}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="すべて" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      {assigneeList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">担当者</TableHead>
                      {weekdays.map((d, i) => <TableHead key={d} className={`text-center min-w-32 ${i >= 5 ? 'bg-muted/50' : ''}`}>{d}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCalendarData.map((person) => (
                      <TableRow key={person.id}>
                        <TableCell className="font-medium">{person.assignee}</TableCell>
                        {weekdayKeys.map((dayKey, di) => (
                          <TableCell key={dayKey} className={`p-2 min-h-20 align-top ${di >= 5 ? 'bg-muted/30' : ''}`}>
                            <div className="space-y-1 min-h-16">
                              {person[dayKey].map((a) => renderCalendarCard(a, person.id, dayKey))}
                              {projectFilter === 'all' && (
                                <Button variant="outline" size="sm" className="w-full h-6 text-xs opacity-0 hover:opacity-100" onClick={() => openAddProjectDialog(person.id, dayKey)}>
                                  <Plus className="w-3 h-3 mr-1" />追加
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <Card className="border border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>工程ガント（F-04 / US-0701）</CardTitle>
                  <p className="text-muted-foreground mt-1">タスクをガント形式で表示。名称・開始・終了・担当者（1名）</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => navigateQuarter('prev')}><ChevronLeft className="w-4 h-4" /></Button>
                  <span className="font-medium px-3">{getQuarterLabel()}</span>
                  <Button variant="outline" size="sm" onClick={() => navigateQuarter('next')}><ChevronRight className="w-4 h-4" /></Button>
                  <Button size="sm" onClick={addNewProject}><Plus className="w-4 h-4 mr-2" />新規</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div ref={scrollContainerRef} className="max-h-[75vh] overflow-auto flex min-h-[580px]">
                <div className="w-48 flex-shrink-0 border-r border-border bg-surface">
                  <div className="sticky top-0 z-10 bg-surface border-b-2 border-border">
                    <div className="py-3 border-b border-border/30 px-4"><span className="font-medium text-base">タスク</span></div>
                    <div className="h-[60px] border-b border-border/30" />
                  </div>
                  <div>
                  {filteredProjectTimelines.map((project) => (
                    <div key={project.id} className="p-3 border-b border-border/30 bg-card cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedProjectId(project.id); setProjectModalOpen(true); }}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                          <h3 className="font-medium text-sm truncate">{project.project}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">開始: {project.startDate}</p>
                        <p className="text-xs text-muted-foreground">終了: {project.endDate}</p>
                        <p className="text-xs text-muted-foreground">担当: {project.assignee || '未割当'}</p>
                        {editingLocation === project.id ? (
                          <Input value={editingLocationValue} onChange={(e) => setEditingLocationValue(e.target.value)} onBlur={() => { updateGanttItem(project.id, 'location', editingLocationValue); setEditingLocation(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { updateGanttItem(project.id, 'location', editingLocationValue); setEditingLocation(null); } else if (e.key === 'Escape') setEditingLocation(null); }} autoFocus className="h-6 text-xs" placeholder="場所" />
                        ) : (
                          <p className="text-xs text-muted-foreground flex items-center cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5" onClick={() => { setEditingLocation(project.id); setEditingLocationValue(project.location || ''); }} title="場所を編集">
                            <Building2 className="w-3 h-3 mr-1" />{project.location || '場所...'}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>

                <div className="flex-1 min-w-0 overflow-x-auto">
                <div className="min-w-max">
                  {(() => {
                    const { startMonth, endMonth, year, endYear } = getViewMonths();
                    const weeks = generateWeeks(startMonth, endMonth, year, endYear);
                    if (!weeks.length) return <div className="p-4 text-muted-foreground">表示する期間がありません</div>;
                    const timelineStart = weeks[0].start;
                    const timelineEnd = weeks[weeks.length - 1].end;
                    const totalDays = Math.ceil((timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24));

                    return (
                      <>
                        <div className="sticky top-0 bg-surface z-20 border-b-2 border-border">
                          <div className="py-3 border-b border-border/30 px-4 text-lg font-medium">
                            {year === endYear ? `${year}年 ${startMonth}月 - ${endMonth}月` : `${year}年${startMonth}月 - ${endYear}年${endMonth}月`}
                          </div>
                          <div className="flex">
                            {weeks.flatMap((week, wi) =>
                              [0, 1, 2, 3, 4, 5, 6].map((i) => {
                                const d = new Date(week.start);
                                d.setDate(week.start.getDate() + i);
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                const today = new Date();
                                const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                                return (
                                  <div key={`${wi}-${i}`} className={`flex-1 min-w-0 p-2 text-center border-r border-border/30 ${d.getDay() === 0 ? 'bg-red-50' : d.getDay() === 6 ? 'bg-blue-50' : ''}`}>
                                    <div className="text-xs font-medium text-muted-foreground">{['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}</div>
                                    <div className={`text-sm font-medium rounded-full w-6 h-6 flex items-center justify-center mx-auto ${isToday ? 'bg-primary text-primary-foreground' : isWeekend ? 'text-muted-foreground' : ''}`}>{d.getDate()}</div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div ref={timelineRef} className="min-h-0">
                          {filteredProjectTimelines.map((project) => {
                            const projectStart = new Date(project.startDate);
                            const projectEnd = new Date(project.endDate);
                            const startDays = Math.ceil((projectStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24));
                            const duration = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
                            const leftOffset = Math.max(0, (startDays / totalDays) * 100);
                            const barWidth = Math.max(0, (duration / totalDays) * 100);
                            return (
                              <div key={project.id} className="relative border-b border-border/30 h-[88px]">
                                <div className="absolute inset-0 flex">
                                  {weeks.flatMap((w, wi) => [0, 1, 2, 3, 4, 5, 6].map((i) => {
                                    const d = new Date(w.start);
                                    d.setDate(w.start.getDate() + i);
                                    const today = new Date();
                                    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                                    return <div key={`${wi}-${i}`} className={`relative flex-1 border-r border-border/20 ${d.getDay() === 0 || d.getDay() === 6 ? 'bg-muted/30' : ''}`}>{isToday && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-500 z-10" />}</div>;
                                  }))}
                                </div>
                                <div
                                  className={`absolute top-2 bottom-2 rounded-md cursor-pointer group transition-all duration-200 ${isDragging && draggedProject?.id === project.id ? 'opacity-50' : 'shadow-sm hover:shadow-md'}`}
                                  style={{ backgroundColor: project.color, left: `${leftOffset}%`, width: `${Math.max(barWidth, 2)}%` }}
                                  onMouseDown={(e) => handleMouseDown(e, project, 'move')}
                                >
                                  <div className="absolute inset-0 flex items-center px-2">
                                    <span className="text-white text-xs font-medium truncate">{project.project.replace(/工事|改修|改装/g, '')}</span>
                                  </div>
                                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"><Move className="w-3 h-3 text-white" /></div>
                                  {barWidth > 3 && (
                                    <>
                                      <div className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize opacity-0 hover:opacity-100" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, project, 'resize-left'); }}><div className="w-1 h-full bg-white/60 rounded-l-md" /></div>
                                      <div className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize opacity-0 hover:opacity-100" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, project, 'resize-right'); }}><div className="w-1 h-full bg-white/60 rounded-r-md ml-auto" /></div>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={newProjectModalOpen} onOpenChange={setNewProjectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新規プロジェクト作成</DialogTitle>
            <DialogDescription>新しいプロジェクトの詳細を入力してください</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">プロジェクト名 *</label>
              <Input value={newProjectData.project} onChange={(e) => setNewProjectData(prev => ({ ...prev, project: e.target.value }))} placeholder="例：A邸内装工事" className="w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center"><Building2 className="w-4 h-4 mr-1" />現場の場所</label>
              <Input value={newProjectData.location} onChange={(e) => setNewProjectData(prev => ({ ...prev, location: e.target.value }))} placeholder="例：東京都品川区〇〇1-2-3" className="w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">担当者（任意・1名）</label>
              <Select value={newProjectData.assignee[0] || '_none_'} onValueChange={(v) => setNewProjectData(prev => ({ ...prev, assignee: v === '_none_' ? [] : [v] }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="未割当" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">未割当</SelectItem>
                  {assigneeList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">開始日 *</label>
                <Input type="date" value={newProjectData.startDate} onChange={(e) => setNewProjectData(prev => ({ ...prev, startDate: e.target.value }))} className="w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">終了日 *</label>
                <Input type="date" value={newProjectData.endDate} onChange={(e) => setNewProjectData(prev => ({ ...prev, endDate: e.target.value }))} className="w-full" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">プロジェクトカラー</label>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-md border border-border" style={{ backgroundColor: newProjectData.color }} />
                <div className="flex flex-wrap gap-2">
                  {projectColors.map(c => (
                    <div key={c} className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-all ${newProjectData.color === c ? 'border-ring scale-110' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: c }} onClick={() => setNewProjectData(prev => ({ ...prev, color: c }))} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setNewProjectModalOpen(false)}>キャンセル</Button>
            <Button onClick={createNewProject}>作成</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={projectModalOpen} onOpenChange={(open) => { if (!open) setSelectedProjectId(null); setProjectModalOpen(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>タスク詳細（US-0702）</DialogTitle>
            <DialogDescription>名称・開始・終了・担当を編集できます。終了が開始より前の場合は保存できません。</DialogDescription>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: selectedProject.color }} />
                  <h3 className="text-lg font-medium">{selectedProject.project}</h3>
                </div>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => { if (confirm('このタスクを削除しますか？')) deleteTask(selectedProject.id); }}><Trash2 className="w-4 h-4 mr-1" />削除</Button>
              </div>
              <div>
                <Label className="text-sm">タスク名</Label>
                <Input value={selectedProject.project} onChange={(e) => updateGanttItem(selectedProject.id, 'project', e.target.value)} placeholder="名称" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm flex items-center"><Building2 className="w-4 h-4 mr-1" />場所</Label>
                <Input value={selectedProject.location || ''} onChange={(e) => updateGanttItem(selectedProject.id, 'location', e.target.value)} placeholder="現場の場所" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">開始日</Label>
                  <Input
                    type="date"
                    value={selectedProject.startDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateGanttItem(selectedProject.id, 'startDate', v);
                      if (selectedProject.assignee) { removeTaskFromCalendar(selectedProject.id); syncTaskToCalendar({ ...selectedProject, startDate: v }); }
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">終了日</Label>
                  <Input
                    type="date"
                    value={selectedProject.endDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateGanttItem(selectedProject.id, 'endDate', v);
                      if (selectedProject.assignee) { removeTaskFromCalendar(selectedProject.id); syncTaskToCalendar({ ...selectedProject, endDate: v }); }
                    }}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm">担当者（1名）</Label>
                <Select
                  value={selectedProject.assignee || '_none_'}
                  onValueChange={(v) => {
                    const assignee = v === '_none_' ? '' : v;
                    if (assignee && checkAssignConflict(assignee, selectedProject.startDate, selectedProject.endDate, selectedProject.id)) toast.warning('この担当者は同日に別の割当があります。');
                    removeTaskFromCalendar(selectedProject.id);
                    updateGanttItem(selectedProject.id, 'assignee', assignee);
                    if (assignee) syncTaskToCalendar({ ...selectedProject, assignee });
                    auditLog({ userId: '', action: '人員割当変更', targetId: String(selectedProject.id), result: 'success' });
                  }}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="担当を選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">未割当</SelectItem>
                    {assigneeList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">終了日が開始日より前の場合は保存できません。変更は自動保存されます。</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addingToCell !== null} onOpenChange={(open) => !open && setAddingToCell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>プロジェクトを追加</DialogTitle>
            <DialogDescription>既存のプロジェクトを選択するか、新しいプロジェクトを作成してください</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>プロジェクト選択</Label>
              <Select value={selectedProjectForCell} onValueChange={(v) => { setSelectedProjectForCell(v); if (v !== 'new') setNewProjectName(''); }}>
                <SelectTrigger><SelectValue placeholder="プロジェクトを選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new"><div className="flex items-center"><Plus className="w-4 h-4 mr-2" />新規プロジェクトを作成</div></SelectItem>
                  <Separator className="my-2" />
                  {ganttData.map(p => <SelectItem key={p.id} value={p.id.toString()}><div className="flex items-center space-x-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} /><span>{p.project}</span></div></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedProjectForCell === 'new' && (
              <div>
                <Label>新規プロジェクト名</Label>
                <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="プロジェクト名を入力" onKeyDown={(e) => e.key === 'Enter' && confirmAddProjectToCell()} />
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setAddingToCell(null)}>キャンセル</Button>
              <Button onClick={confirmAddProjectToCell} className="bg-primary hover:bg-primary-hover">追加</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Process;
