import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Building2, Save, ShieldCheck, MapPin, BadgeCheck, Bell, Sparkles } from 'lucide-react';

const Settings = () => {
  const [config, setConfig] = useState({
    centerName: localStorage.getItem('config_centerName') || 'منفذ الوديعة البري',
    agencyName: localStorage.getItem('config_agencyName') || 'فرع مصلحة الجوازات',
    region: localStorage.getItem('config_region') || 'حضرموت',
    branchCode: localStorage.getItem('config_branchCode') || 'SHW-01',
    geminiKey: localStorage.getItem('config_geminiKey') || 'AIzaSyAAVh__MfT2Ubcx07nPWs5hzYRf3dKJlsg',
  });
  const { toast } = useToast();

  const handleSave = () => {
    localStorage.setItem('config_centerName', config.centerName);
    localStorage.setItem('config_agencyName', config.agencyName);
    localStorage.setItem('config_region', config.region);
    localStorage.setItem('config_branchCode', config.branchCode);
    localStorage.setItem('config_geminiKey', config.geminiKey);
    toast({ title: 'تم حفظ الإعدادات', description: 'سيتم تطبيق الإعدادات على التقارير والواجهة.' });
    // Reload to apply new API key
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold text-primary">إعدادات النظام</h1>
        <p className="text-muted-foreground mt-1">تكوين معلومات المركز والمصلحة المحلية</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>معلومات الجهة</CardTitle>
              </div>
              <CardDescription>تظهر هذه المعلومات في ترويسة التقارير المطبوعة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">اسم المركز / المنفذ</label>
                  <Input 
                    value={config.centerName} 
                    onChange={e => setConfig({...config, centerName: e.target.value})}
                    className="text-right"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">اسم الوكالة / الفرع</label>
                  <Input 
                    value={config.agencyName} 
                    onChange={e => setConfig({...config, agencyName: e.target.value})}
                    className="text-right"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> المحافظة / النطاق
                  </label>
                  <Input 
                    value={config.region} 
                    onChange={e => setConfig({...config, region: e.target.value})}
                    className="text-right"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4" /> كود الفرع الاستخباراتي
                  </label>
                  <Input 
                    value={config.branchCode} 
                    onChange={e => setConfig({...config, branchCode: e.target.value})}
                    className="text-right font-mono"
                  />
                </div>
                <div className="space-y-2 col-span-full border-t pt-4 mt-2">
                  <label className="text-sm font-medium flex items-center gap-2 text-primary">
                    <Sparkles className="h-4 w-4" /> مفتاح Gemini API (للذكاء الاصطناعي)
                  </label>
                  <Input 
                    type="password"
                    placeholder="أدخل مفتاح API هنا..."
                    value={config.geminiKey} 
                    onChange={e => setConfig({...config, geminiKey: e.target.value})}
                    className="text-right"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    هذا المفتاح مطلوب لمسح الجوازات آلياً وتحليل البلاغات. يمكنك الحصول عليه من Google AI Studio.
                  </p>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button onClick={handleSave} className="gap-2">
                  <Save className="h-4 w-4" /> حفظ الإعدادات
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle>أمان النظام</CardTitle>
              </div>
              <CardDescription>إعدادات حماية البيانات والتشفير المحلي</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">النسخ الاحتياطي التلقائي</p>
                  <p className="text-sm text-muted-foreground">حفظ نسخة من البيانات كل 6 ساعات في مجلد البرنامج</p>
                </div>
                <BadgeCheck className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">التشفير (Offline AES-256)</p>
                  <p className="text-sm text-muted-foreground">حماية بيانات المسافرين في حالة فقدان الجهاز</p>
                </div>
                <BadgeCheck className="h-5 w-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-lg">حالة النظام</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span>الإصدار</span>
                <span className="font-mono">v1.1.2 (Standard)</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>قاعدة البيانات</span>
                <span className="font-mono">SQLite / LocalStorage</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>تاريخ التفعيل</span>
                <span>16 أبريل 2026</span>
              </div>
              <div className="pt-2">
                <div className="h-2 bg-primary-foreground/20 rounded-full overflow-hidden">
                  <div className="h-full bg-accent w-[92%]"></div>
                </div>
                <p className="text-[10px] mt-1 opacity-80">مساحة التخزين المتاحة: 4.2 GB</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <CardTitle className="text-md">التنبيهات</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">لا توجد تنبيهات فنية حالياً.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
