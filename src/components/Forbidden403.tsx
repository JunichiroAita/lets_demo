import React from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ShieldAlert } from 'lucide-react';

const Forbidden403: React.FC<{ onGoBack?: () => void }> = ({ onGoBack }) => (
  <div className="min-h-[60vh] flex items-center justify-center p-6">
    <Card className="max-w-md border-border">
      <CardContent className="pt-6 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto text-destructive mb-4" />
        <h2 className="text-lg font-semibold mb-2">403 権限がありません</h2>
        <p className="text-muted-foreground text-sm mb-6">
          この画面へのアクセスは許可されていません。オーナー権限が必要です。
        </p>
        {onGoBack && (
          <Button variant="outline" onClick={onGoBack}>トップに戻る</Button>
        )}
      </CardContent>
    </Card>
  </div>
);

export default Forbidden403;
