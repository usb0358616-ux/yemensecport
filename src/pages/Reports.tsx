import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Report, User } from '@/lib/types';
import { getReports, saveReports, generateId, getCurrentUser, getTravelers } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Trash2, Sparkles, Upload, FileIcon, ShieldCheck, CheckCircle, XCircle, Download, FileJson, FileText, Save, Printer, Image as ImageIcon } from 'lucide-react';
import { analyzeReport } from '@/services/geminiService';
import { Badge } from '@/components/ui/badge';
import { DeleteConfirmation } from '@/components/DeleteConfirmation';
import { exportToExcel, exportToPDF, exportToImage, exportToWord, handlePrint } from '@/lib/exportUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Reports = () => {
  const [reports, setReports] = useState(getReports);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Report | null>(null);
  const [form, setForm] = useState<Partial<Report>>({ title: '', description: '', type: 'عام', status: 'جديد', attachments: [] });
  const [search, setSearch] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

  const canApprove = currentUser?.role === 'آدمن' || currentUser?.role === 'ضابط';

  const handleAnalyze = async () => {
    if (!navigator.onLine) {
      toast({ 
        title: 'لا يوجد اتصال', 
        description: 'هذه الميزة (الذكاء الاصطناعي) تتطلب اتصالاً بالإنترنت والعمل على السيرفر. يرجى إدخال البيانات يدوياً.', 
        variant: 'destructive' 
      });
      return;
    }
    if (!form.description || form.description.length < 10) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال وصف كافٍ للتحليل', variant: 'destructive' });
      return;
    }
    setIsAnalyzing(true);
    try {
      const data = await analyzeReport(form.description);
      setForm(prev => ({ ...prev, ...data }));
      toast({ title: 'تم التحليل', description: 'تم اقتراح العنوان والتصنيف' });
    } catch (err) {
      console.error(err);
      toast({ title: 'خطأ', description: 'فشل التحليل الذكي', variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        setForm(prev => ({
          ...prev,
          attachments: [...(prev.attachments || []), url]
        }));
      };
      reader.readAsDataURL(file);
    });
    // Reset input
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setForm(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== index)
    }));
  };

  const save = () => {
    if (!form.title) return;
    const now = new Date().toISOString();
    let updated: Report[];
    if (editing) {
      updated = reports.map(r => r.id === editing.id ? { ...r, ...form, updatedAt: now } as Report : r);
    } else {
      updated = [...reports, { ...form, id: generateId(), createdAt: now, updatedAt: now } as Report];
    }
    saveReports(updated);
    setReports(updated);
    setOpen(false);
    toast({ title: 'تم حفظ البلاغ' });
  };

  const deleteReport = (id: string) => {
    setReportToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!reportToDelete) return;
    const updated = reports.filter(r => r.id !== reportToDelete);
    saveReports(updated);
    setReports(updated);
    setDeleteConfirmOpen(false);
    setReportToDelete(null);
    toast({ title: 'تم حذف البلاغ' });
  };

  const filtered = reports.filter(r => r.title.includes(search) || r.description.includes(search));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">بلاغات الضبط والتحري</h1>
          <p className="text-slate-500 text-sm mt-1">إدارة واعتماد البلاغات الأمنية والمتابعة</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 shadow-sm border-slate-200">
                <Download className="h-4 w-4" /> تصدير
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir="rtl">
              <DropdownMenuItem onClick={() => exportToExcel(filtered, 'كشف_البلاغات')}>
                <FileJson className="h-4 w-4 ml-2 text-green-600" /> Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => { setEditing(null); setForm({ title: '', description: '', type: 'عام', status: 'جديد' }); setOpen(true); }} className="gap-2 shadow-md">
            <Plus className="h-4 w-4" /> إضافة بلاغ جديد
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="بحث في العناوين، الأوصاف، أو الأرقام المرجعية..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pr-10 bg-slate-50 border-slate-200 focus:bg-white transition-all" 
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Badge variant="outline" className="cursor-pointer hover:bg-slate-100 py-1.5 px-3">الكل ({reports.length})</Badge>
          <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200 py-1.5 px-3">جديد ({reports.filter(r => r.status === 'جديد').length})</Badge>
          <Badge className="bg-green-100 text-green-700 border-green-200 cursor-pointer hover:bg-green-200 py-1.5 px-3">معتمد ({reports.filter(r => r.status === 'معتمد').length})</Badge>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto overflow-y-hidden" id="reports-table">
        <Table className="min-w-[750px] w-full">
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="text-right font-bold py-4">معلومات البلاغ</TableHead>
              <TableHead className="text-right font-bold">المسافر المرتبط</TableHead>
              <TableHead className="text-right font-bold">التصنيف</TableHead>
              <TableHead className="text-right font-bold">الحالة</TableHead>
              <TableHead className="text-right font-bold">التاريخ</TableHead>
              <TableHead className="text-center font-bold no-print">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <FileIcon className="h-12 w-12 mb-3 opacity-20" />
                    <p>لا توجد بلاغات مسجلة حالياً</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.map(r => (
              <TableRow key={r.id} className="group hover:bg-slate-50/80 transition-colors">
                <TableCell className="text-right py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{r.title}</span>
                    <span className="text-xs text-slate-500 line-clamp-1">{r.description}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col gap-1">
                    {(r.linkedTravelerIds || []).length > 0 ? (
                      r.linkedTravelerIds?.slice(0, 2).map(tid => {
                        const t = getTravelers().find(trav => trav.id === tid);
                        return t ? (
                          <div key={tid} className="flex flex-col">
                            <span className="text-xs font-medium text-primary">{t.firstName} {t.lastName}</span>
                            <span className="text-[10px] text-slate-400">{t.idNumber}</span>
                          </div>
                        ) : null;
                      })
                    ) : (
                      <span className="text-xs text-slate-400 italic">غير مرتبط</span>
                    )}
                    {(r.linkedTravelerIds || []).length > 2 && <span className="text-[10px] text-slate-400">+{r.linkedTravelerIds!.length - 2} آخرين</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">{r.type}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={
                    r.status === 'معتمد' ? 'default' : 
                    r.status === 'مرفوض' ? 'destructive' : 
                    r.status === 'قيد التحقيق' ? 'secondary' : 'outline'
                  } className="font-bold">
                    {r.status === 'معتمد' && <CheckCircle className="h-3 w-3 ml-1" />}
                    {r.status === 'مرفوض' && <XCircle className="h-3 w-3 ml-1" />}
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-700">{new Date(r.createdAt).toLocaleDateString('ar-YE')}</span>
                    <span className="text-[10px] text-slate-400">{new Date(r.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </TableCell>
                <TableCell className="no-print">
                  <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setForm(r); setOpen(true); }} className="text-primary hover:bg-primary/5">
                      تعديل
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/5" onClick={() => deleteReport(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DeleteConfirmation 
        isOpen={deleteConfirmOpen} 
        onClose={() => setDeleteConfirmOpen(false)} 
        onConfirm={confirmDelete} 
        title="حذف البلاغ"
        description={`هل أنت متأكد من حذف البلاغ "${reports.find(r => r.id === reportToDelete)?.title}"؟ لا يمكن استرجاع البيانات بعد الحذف.`}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">بيانات البلاغ</DialogTitle>
            <DialogDescription className="text-right">
              أدخل تفاصيل البلاغ الأمني، ويمكنك استخدام ميزة التحليل الذكي لاقتراح العنوان والتصنيف.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm">الوصف / شرح البلاغ</label>
              <div className="relative">
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={5} className="pl-10" />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute left-2 bottom-2 text-primary"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                >
                  <Sparkles className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <div><label className="text-sm">العنوان (المقترح)</label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div><label className="text-sm">التصنيف</label><Input value={form.type} onChange={e => setForm({...form, type: e.target.value})} /></div>
            
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-primary">المسافرين المرتبطين بهذا البلاغ</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="xs" className="h-7">
                      <Plus className="h-3 w-3 ml-1" /> إضافة ارتباط
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 max-h-60 overflow-y-auto" dir="rtl">
                    <DropdownMenuLabel>اختر مسافر للربط</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {getTravelers()
                      .filter(t => !form.linkedTravelerIds?.includes(t.id))
                      .map(t => (
                        <DropdownMenuItem key={t.id} onClick={() => {
                          setForm(prev => ({ ...prev, linkedTravelerIds: [...(prev.linkedTravelerIds || []), t.id] }));
                        }}>
                          <div className="flex flex-col">
                            <span>{t.firstName} {t.lastName}</span>
                            <span className="text-[10px] text-muted-foreground">{t.idNumber}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    {getTravelers().filter(t => !form.linkedTravelerIds?.includes(t.id)).length === 0 && (
                      <div className="p-2 text-center text-xs text-muted-foreground italic">لا يوجد مسافرون آخرون</div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2">
                {(form.linkedTravelerIds || []).length > 0 ? (
                  getReports().find(r => r.id === editing?.id)?.linkedTravelerIds?.map(tid => {
                    const traveler = getTravelers().find(t => t.id === tid);
                    return (
                      <div key={tid} className="flex items-center justify-between p-2 bg-slate-50 border rounded-lg text-xs">
                        <div className="flex flex-col">
                          <span className="font-bold">{traveler ? `${traveler.firstName} ${traveler.lastName}` : 'مسافر غير موجود'}</span>
                          <span className="text-slate-500">{traveler?.idNumber}</span>
                        </div>
                        <div className="flex gap-1">
                          {traveler && (
                             <Button variant="ghost" size="xs" className="h-7 text-primary" onClick={() => {
                               setOpen(false);
                               navigate(`/travelers/${traveler.id}`);
                             }}>عرض الملف</Button>
                          )}
                          <Button variant="ghost" size="xs" className="h-7 text-destructive" onClick={() => {
                            setForm(prev => ({ ...prev, linkedTravelerIds: prev.linkedTravelerIds?.filter(id => id !== tid) }));
                          }}>إزالة الربط</Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center py-4 text-slate-400 text-xs italic">لا يوجد مسافرون مرتبطون بهذا البلاغ حالياً</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm">الحالة</label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v as any})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="جديد">جديد</SelectItem>
                  <SelectItem value="قيد التحقيق">قيد التحقيق</SelectItem>
                  {canApprove && <SelectItem value="معتمد">معتمد (بصمة الضابط)</SelectItem>}
                  {canApprove && <SelectItem value="مرفوض">مرفوض</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">المرفقات (صور / PDF)</label>
              <div className="flex flex-wrap gap-2">
                {(form.attachments || []).map((att, i) => (
                  <div key={i} className="relative group w-20 h-20 border rounded overflow-hidden bg-muted">
                    {att.startsWith('data:image') ? (
                      <img src={att} alt="مرفق" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[10px]">
                        <FileIcon className="h-6 w-6 mb-1" />
                        PDF
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(i)}
                      className="absolute top-0 left-0 bg-destructive text-destructive-foreground p-0.5 rounded-br opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-[10px] mt-1">رفع</span>
                  <input type="file" className="hidden" accept="image/*,.pdf" multiple onChange={handleFileUpload} />
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={save} className="gap-2">
                <Save className="h-4 w-4" /> حفظ التغييرات
              </Button>
              {canApprove && editing && form.status !== 'معتمد' && (
                <Button variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 gap-2" onClick={() => {
                  setForm({...form, status: 'معتمد'});
                  toast({ title: 'تم التجهيز للاعتماد', description: 'يرجى الضغط على حفظ لتأكيد الاعتماد' });
                }}>
                  <ShieldCheck className="h-4 w-4" /> اعتماد الآن
                </Button>
              )}
              {editing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                       <Download className="h-4 w-4" /> تصدير
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent dir="rtl">
                    <DropdownMenuItem onClick={() => handlePrint()}>
                      <Printer className="h-4 w-4 ml-2" /> طباعة
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportToPDF('report-edit-content', `بلاغ_${editing.id}`)}>
                      <FileText className="h-4 w-4 ml-2 text-red-600" /> PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportToImage('report-edit-content', `بلاغ_${editing.id}`)}>
                      <ImageIcon className="h-4 w-4 ml-2 text-purple-600" /> صورة PNG
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
            </div>
            <div id="report-edit-content" className="bg-white p-6 rounded-lg sr-only pointer-events-none">
              <h2 className="text-xl font-bold mb-4">{form.title}</h2>
              <div className="space-y-4">
                <div><label className="text-xs font-bold text-slate-500">التصنيف</label> <p>{form.type}</p></div>
                <div><label className="text-xs font-bold text-slate-500">الحالة</label> <p>{form.status}</p></div>
                <div className="border-t pt-2"><p className="text-sm italic">{form.description}</p></div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
