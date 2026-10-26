import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Lock, User as UserIcon } from 'lucide-react';
import { setCurrentUser } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Mock authentication for offline use
    setTimeout(() => {
      if (username === 'admin' && password === '123456') {
        setCurrentUser({
          id: '1',
          username: 'admin',
          name: 'مدير النظام',
          role: 'آدمن'
        });
        toast({ title: 'تم تسجيل الدخول بنجاح', description: 'مرحباً بك في نظام المنافذ الذكي' });
        navigate('/');
      } else if (username === 'user' && password === '123456') {
        setCurrentUser({
          id: '2',
          username: 'user',
          name: 'مدخل بيانات',
          role: 'مدخل بيانات'
        });
        toast({ title: 'تم تسجيل الدخول بنجاح' });
        navigate('/');
      } else {
        toast({ 
          title: 'خطأ في الدخول', 
          description: 'اسم المستخدم أو كلمة المرور غير صحيحة', 
          variant: 'destructive' 
        });
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4" dir="rtl">
      <Card className="w-full max-w-md shadow-2xl border-primary/10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
            <ShieldCheck className="h-12 w-12 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">نظام المنافذ والجوازات</CardTitle>
            <CardDescription>يرجى تسجيل الدخول للمتابعة</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium pr-1 flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                اسم المستخدم
              </label>
              <Input 
                autoFocus
                placeholder="أدخل اسم المستخدم" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium pr-1 flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                كلمة المرور
              </label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="text-right"
              />
            </div>
            <Button type="submit" className="w-full py-6 text-lg" disabled={isLoading}>
              {isLoading ? 'جاري التحقق...' : 'دخول'}
            </Button>
          </form>
          <div className="mt-8 pt-6 border-t text-center text-xs text-muted-foreground">
            نظام ذكي للتحكم في المنافذ - إصدار 1.0.0
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
