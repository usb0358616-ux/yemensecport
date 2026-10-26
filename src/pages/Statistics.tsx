import { getTravelers, getReports, getMovements } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, AlertTriangle, CheckCircle, Download, Printer, FileJson, FileText as FileTextIcon, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { exportToExcel, exportToPDF, exportToImage, handlePrint } from '@/lib/exportUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Statistics = () => {
  const travelers = getTravelers();
  const reports = getReports();
  const movements = getMovements();

  const stats = [
    { title: 'إجمالي المسافرين', value: travelers.length, icon: Users, color: 'text-blue-600' },
    { title: 'إجمالي البلاغات', value: reports.length, icon: FileText, color: 'text-orange-600' },
    { title: 'حركة الأطقم', value: movements.filter(m => m.status === 'خروج').length, icon: AlertTriangle, color: 'text-orange-500' },
    { title: 'الممنوعين من السفر', value: travelers.filter(t => t.travelAllowed === 'لا').length, icon: AlertTriangle, color: 'text-red-600' },
  ];

  // Data for Bar Chart (Travelers per day - last 7 days)
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const count = travelers.filter(t => t.createdAt.startsWith(dateStr)).length;
    return { name: d.toLocaleDateString('ar-YE', { weekday: 'short' }), count };
  }).reverse();

  // Data for Pie Chart (Travel Allowed vs Denied)
  const pieData = [
    { name: 'مسموح', value: travelers.filter(t => t.travelAllowed === 'نعم').length, color: '#10b981' },
    { name: 'ممنوع', value: travelers.filter(t => t.travelAllowed === 'لا').length, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center no-print">
        <h1 className="text-2xl font-bold">الإحصائيات والتقارير</h1>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> تصدير الإحصائيات
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir="rtl">
              <DropdownMenuItem onClick={() => exportToExcel(stats, 'إحصائيات_نظام_المنافذ')}>
                <FileJson className="h-4 w-4 ml-2 text-green-600" /> Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPDF('stats-content', 'إحصائيات_نظام_المنافذ')}>
                <FileTextIcon className="h-4 w-4 ml-2 text-red-600" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToImage('stats-content', 'إحصائيات_نظام_المنافذ')}>
                <ImageIcon className="h-4 w-4 ml-2 text-purple-600" /> صورة PNG
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> طباعة
          </Button>
        </div>
      </div>

      <div id="stats-content" className="space-y-6 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Card key={i} className="shadow-sm border-none bg-white/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.title}</CardTitle>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 shadow-sm min-h-[350px]">
          <CardTitle className="text-lg mb-4">حركة المسافرين (آخر 7 أيام)</CardTitle>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <BarChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 shadow-sm min-h-[350px]">
          <CardTitle className="text-lg mb-4">نسبة السماح بالسفر</CardTitle>
          <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 mr-4">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                  <span className="text-sm">{d.name}: {d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
  );
};

export default Statistics;
