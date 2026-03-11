import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { FileText, ArrowRight } from 'lucide-react';

interface DashboardProps {
  quoteProjects?: any[];
  purchaseOrders?: any[];
  onNavigateToQuote?: () => void;
  onNavigateToPurchase?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  quoteProjects = [],
  onNavigateToQuote,
}) => {
  const recentProjects = quoteProjects
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 5);

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1>ダッシュボード</h1>
        <p className="text-muted-foreground">プロジェクトの進捗状況と主要指標の概要</p>
      </div>

      <Card className="border border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>最近のプロジェクト</span>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onNavigateToQuote}>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentProjects.length > 0 ? (
            recentProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border"
              >
                <div className="space-y-1 flex-1">
                  <p className="font-medium">{project.projectName}</p>
                  <p className="text-sm text-muted-foreground">
                    {project.lastUpdated}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>プロジェクトがありません</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
