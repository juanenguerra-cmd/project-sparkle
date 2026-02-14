import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Lock, User } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { initSessionMonitoring, login } from '@/lib/auth';

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const user = login(username, password);
      if (!user) {
        sonnerToast.error('Login Failed', { description: 'Invalid username or password' });
        return;
      }

      initSessionMonitoring();
      sonnerToast.success('Welcome back!', { description: `Logged in as ${user.displayName}` });
      navigate('/');
    } catch {
      sonnerToast.error('Login Error', { description: 'An error occurred during login' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Project Sparkle</CardTitle>
          <CardDescription className="text-center">Infection Control & Clinical Compliance System</CardDescription>
        </CardHeader>
        <CardContent>
          {reason === 'timeout' && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">Your session expired due to inactivity. Please log in again.</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input id="username" type="text" className="pl-10" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input id="password" type="password" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'Logging in...' : 'Log In'}</Button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            <p>Default: admin / admin123</p>
            <p className="mt-1">⚠️ Change password after first login</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
