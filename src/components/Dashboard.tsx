import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { FileText, ArrowRight, Calendar, MapPin, User } from 'lucide-react';

/** 工程の期間表示用（Process の初期データと同期したデモ用） */
const DEMO_SCHEDULE = [
  { id: 1, project: 'A邸内装工事', location: '東京都品川区〇〇1-2-3', assignee: '田中太郎', startDate: '2024-12-01', endDate: '2024-12-15', status: 'in-progress', color: '#0052CC' },
  { id: 2, project: 'Bビル改修工事', location: '東京都新宿区△△4-5-6', assignee: '佐藤花子', startDate: '2024-12-05', endDate: '2024-12-20', status: 'in-progress', color: '#36B37E' },
  { id: 3, project: 'C工場改装', location: '埼玉県さいたま市□□7-8-9', assignee: '山田次郎', startDate: '2024-12-10', endDate: '2024-12-25', status: 'scheduled', color: '#FFAB00' },
];

function formatDateJa(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface DashboardProps {
  quoteProjects?: any[];
  purchaseOrders?: any[];
  onNavigateToQuote?: () => void;
  onNavigateToPurchase?: () => void;
  onNavigateToProcess?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  quoteProjects = [],
  onNavigateToQuote,
  onNavigateToProcess,
}) => {
  const recentProjects = quoteProjects
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 5);

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">ダッシュボード</h1>
        <p className="text-muted-foreground">プロジェクトと工程の期間を一覧で確認できます</p>
      </div>

      {/* 最近のプロジェクト（工程の期間＋見積プロジェクトをひとまとめ） */}
      <Card className="border border-border overflow-hidden shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-row items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              最近のプロジェクト
            </CardTitle>
            <div className="flex items-center gap-2">
              {onNavigateToProcess && (
                <Button variant="outline" size="sm" onClick={onNavigateToProcess}>
                  <Calendar className="w-4 h-4 mr-1.5" />
                  工程
                </Button>
              )}
              {onNavigateToQuote && (
                <Button variant="outline" size="sm" onClick={onNavigateToQuote}>
                  見積
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-0 space-y-0">
          {/* 工程の期間（開始予定～終了予定） */}
          <section className="px-6 pb-5">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              工程の期間（開始予定 ～ 終了予定）
            </h3>
            <ul className="rounded-lg border border-border overflow-hidden bg-muted/20">
              {DEMO_SCHEDULE.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 sm:py-2.5 border-b border-border last:border-b-0 hover:bg-background/60 transition-colors"
                >
                  <div
                    className="hidden sm:block w-1 shrink-0 rounded-full self-stretch min-h-[2.5rem]"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.project}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {formatDateJa(item.startDate)} ～ {formatDateJa(item.endDate)}
                      </span>
                      <span className="flex items-center gap-1 truncate max-w-[180px]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {item.location}
                      </span>
                      <span>{item.assignee}</span>
                    </div>
                  </div>
                  <div className="shrink-0 sm:pl-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.status === 'in-progress'
                          ? 'bg-primary/10 text-primary'
                          : item.status === 'scheduled'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {item.status === 'in-progress' ? '進行中' : item.status === 'scheduled' ? '予定' : item.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* 見積の最近のプロジェクト */}
          <section className="border-t border-border px-6 py-5 bg-muted/10">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              見積プロジェクト
            </h3>
            {recentProjects.length > 0 ? (
              <ul className="rounded-lg border border-border overflow-hidden bg-card">
                {recentProjects.map((project) => (
                  <li key={project.id}>
                    <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{project.projectName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {project.lastUpdated}
                          {project.customerName && ` ・ ${project.customerName}`}
                        </p>
                      </div>
                      {onNavigateToQuote && (
                        <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={onNavigateToQuote}>
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-border border-dashed bg-card/50 flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <FileText className="h-9 w-9 mb-2 opacity-40" />
                <p className="text-sm font-medium">見積プロジェクトがありません</p>
                <p className="text-xs mt-1">見積タブでプロジェクトを作成するとここに表示されます</p>
                {onNavigateToQuote && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={onNavigateToQuote}>
                    見積を開く
                  </Button>
                )}
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
