import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  users: { id: string; loginId: string; displayName: string; role: string; passwordHash?: string; isActive: boolean }[];
}

const Login: React.FC<LoginProps> = ({ users }) => {
  const { login, lockoutUntil } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const locked = lockoutUntil != null && lockoutUntil > Date.now();
  const lockMinutes = locked ? Math.ceil((lockoutUntil! - Date.now()) / 60000) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = login(loginId, password, users);
    if (result.success) {
      setPassword('');
      return;
    }
    setError(result.error ?? 'ログインに失敗しました');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" style={{ minHeight: '100vh', background: '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card className="w-full max-w-md border border-border" style={{ width: '100%', maxWidth: 448, border: '1px solid #DFE1E6', borderRadius: 6, background: '#fff' }}>
        <CardHeader className="text-center" style={{ padding: '24px 24px 0' }}>
          <CardTitle className="text-xl" style={{ fontSize: '1.25rem', color: '#172B4D' }}>LET'S 管理ポータル</CardTitle>
          <p className="text-sm text-muted-foreground" style={{ color: '#42526E', marginTop: 8 }}>ログイン</p>
        </CardHeader>
        <CardContent>
          {locked ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="font-medium">アカウントがロックされています</p>
              <p className="text-sm mt-2">あと約 {lockMinutes} 分で再試行できます</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="loginId">ログインID</Label>
                <Input
                  id="loginId"
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="admin"
                  required
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full">ログイン</Button>
            </form>
          )}
          <p className="text-xs text-muted-foreground mt-4 text-center">
            デモ: 設定の従業員管理で登録したログインID / パスワード「password」でログインできます。オーナーは admin / password
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
