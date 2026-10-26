import { useState } from 'react';
import { Movement } from '@/lib/types';
import { getMovements, saveMovements, generateId } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Truck, LogOut, LogIn, Clock, User, Filter, Trash2, Download, FileJson, FileText, Save, Bike } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

const emptyMovement = (): Partial<Movement> => ({
  type: 'طقم',
  plateNumber: '',
  driverName: '',
  personnelCount: 1,
  mission: '',
  departureTime: new Date().toISOString().slice(0, 16),
  expectedReturnTime: '',
  status: 'خروج'
});

const Movements = () => {
  const [movements, setMovements] = useState(getMovements);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [form, setForm] = useState<Partial<Movement>>(emptyMovement());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('الكل');
  const [filterStatus, setFilterStatus] = useState('الكل');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [movementToDelete, setMovementToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const filtered = movements.filter(m => {
    const searchMatch = 
      m.plateNumber.includes(search) || 
      m.driverName.includes(search) || 
      m.mission.includes(search);
    const typeMatch = filterType === 'الكل' || m.type === filterType;
    const statusMatch = filterStatus === 'الكل' || m.status === filterStatus;
    return searchMatch && typeMatch && statusMatch;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const save = () => {
    if (!form.plateNumber || !form.driverName) {
      toast({ title: 'خطأ', description: 'رقم اللوحة واسم السائق مطلوبان', variant: 'destructive' });
      return;
    }

    const now = new Date().toISOString();
    let updated: Movement[];

    if (editing) {
      updated = movements.map(m => m.id === editing.id ? { ...m, ...form, updatedAt: now } as Movement : m);
    } else {
      updated = [...movements, { ...form, id: generateId(), createdAt: now, updatedAt: now } as Movement];
    }

    saveMovements(updated);
    setMovements(updated);
    setOpen(false);
    setForm(emptyMovement());
    setEditing(null);
    toast({ title: 'تم حفظ الحركة' });
  };

  const handleReturnAction = (m: Movement) => {
    const actualReturnTime = new Date().toISOString().slice(0, 16);
    const updated = movements.map(item => 
      item.id === m.id 
        ? { ...item, status: 'عودة' as const, actualReturnTime, updatedAt: new Date().toISOString() } 
        : item
    );
    saveMovements(updated);
    setMovements(updated);
    toast({ title: 'تم تسجيل العودة', description: `تم تسجيل عودة ${m.type} رقم ${m.plateNumber}` });
  };

  const deleteMovement = (id: string) => {
    setMovementToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!movementToDelete) return;
    const updated = movements.filter(m => m.id !== movementToDelete);
    saveMovements(updated);
    setMovements(updated);
    setDeleteConfirmOpen(false);
    setMovementToDelete(null);
    toast({ title: 'تم الحذف' });
  };

  const openEdit = (m: Movement) => {
    setEditing(m);
    setForm(m);
    setOpen(true);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">حركة الأطقم والدراجات</h1>
          <p className="text-muted-foreground mt-1">تسجيل تحركات الأطقم والدراجات النارية والمهام الأمنية</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> تصدير
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir="rtl">
              <DropdownMenuItem onClick={() => exportToExcel(filtered, 'حركة_الأطقم')}>
                <FileJson className="h-4 w-4 ml-2 text-green-600" /> Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPDF('movements-table', 'حركة_الأطقم')}>
                <FileText className="h-4 w-4 ml-2 text-red-600" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => { setEditing(null); setForm(emptyMovement()); setOpen(true); }} className="gap-2">
            <Plus className="h-5 w-5" /> تسجيل حركة جديدة
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm bg-muted/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="البحث برقم اللوحة، السائق، أو المهمة..." 
                className="pr-10 text-right" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="text-right">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span>النوع: {filterType}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="الكل">كل الأنواع</SelectItem>
                  <SelectItem value="طقم">طقم</SelectItem>
                  <SelectItem value="دراجة نارية">دراجة نارية</SelectItem>
                  <SelectItem value="أخرى">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="text-right">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>الحالة: {filterStatus}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="الكل">كل الحالات</SelectItem>
                  <SelectItem value="خروج">في المهمة (خروج)</SelectItem>
                  <SelectItem value="عودة">تمت العودة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-card rounded-xl shadow-md border overflow-x-auto overflow-y-hidden" id="movements-table">
        <Table className="min-w-[800px] w-full">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-right">النوع</TableHead>
              <TableHead className="text-right">رقم اللوحة</TableHead>
              <TableHead className="text-right">السائق</TableHead>
              <TableHead className="text-right">القوة</TableHead>
              <TableHead className="text-right">المهمة</TableHead>
              <TableHead className="text-right">وقت الخروج</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right no-print">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-20 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Truck className="h-12 w-12 opacity-20" />
                    <p>لا توجد سجلات حركة مطابقة</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.map(m => (
              <TableRow key={m.id} className="hover:bg-muted/30 transition-colors group">
                <TableCell className="text-right font-medium">
                  <div className="flex items-center gap-2">
                    {m.type === 'طقم' ? <Truck className="h-4 w-4 text-blue-500" /> : m.type === 'دراجة نارية' ? <Bike className="h-4 w-4 text-orange-500" /> : <Plus className="h-4 w-4 text-slate-500" />}
                    {m.type}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{m.plateNumber}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.3 w-3.5 text-slate-400" />
                    <span>{m.driverName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{m.personnelCount} أفراد</TableCell>
                <TableCell className="text-right max-w-[200px] truncate">{m.mission}</TableCell>
                <TableCell className="text-right text-xs">
                  {new Date(m.departureTime).toLocaleString('ar-YE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                </TableCell>
                <TableCell className="text-right">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${m.status === 'خروج' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {m.status === 'خروج' ? <LogOut className="h-3 w-3" /> : <LogIn className="h-3 w-3" />}
                    {m.status === 'خروج' ? 'في مهمة' : 'عاد'}
                  </span>
                </TableCell>
                <TableCell className="no-print">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {m.status === 'خروج' && (
                      <Button variant="outline" size="sm" onClick={() => handleReturnAction(m)} className="h-8 border-green-200 text-green-600 hover:bg-green-50 px-2">
                         إثبات عودة
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openEdit(m)}><FileText className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMovement(m.id)}><Trash2 className="h-4 w-4" /></Button>
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
        title="حذف سجل الحركة"
        description={`هل أنت متأكد من حذف سجل حركة ${movements.find(m => m.id === movementToDelete)?.type} رقم ${movements.find(m => m.id === movementToDelete)?.plateNumber}؟`}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">{editing ? 'تعديل سجل الحركة' : 'تسجيل حركة جديدة'}</DialogTitle>
            <DialogDescription className="text-right">
              أدخل تفاصيل تحرك الطقم أو الدراجة النارية، بما في ذلك السائق، رقم اللوحة، والمهمة.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">النوع</label>
              <Select value={form.type} onValueChange={v => setForm({...form, type: v as any})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="طقم">طقم عسكري</SelectItem>
                  <SelectItem value="دراجة نارية">دراجة نارية</SelectItem>
                  <SelectItem value="أخرى">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">رقم اللوحة / المعرف</label>
              <Input value={form.plateNumber} onChange={e => setForm({...form, plateNumber: e.target.value})} className="text-right font-mono" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2"><User className="h-4 w-4" /> اسم السائق</label>
              <Input value={form.driverName} onChange={e => setForm({...form, driverName: e.target.value})} className="text-right" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">عدد الأفراد (القوة)</label>
              <Input type="number" value={form.personnelCount} onChange={e => setForm({...form, personnelCount: parseInt(e.target.value)})} className="text-right" />
            </div>
            <div className="space-y-2 col-span-full">
              <label className="text-sm font-medium">المهمة / الوجهة</label>
              <Input value={form.mission} onChange={e => setForm({...form, mission: e.target.value})} className="text-right" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" /> وقت الخروج</label>
              <Input type="datetime-local" value={form.departureTime} onChange={e => setForm({...form, departureTime: e.target.value})} className="text-right" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" /> العودة المتوقعة</label>
              <Input type="datetime-local" value={form.expectedReturnTime} onChange={e => setForm({...form, expectedReturnTime: e.target.value})} className="text-right" />
            </div>
            {editing && m.status === 'عودة' && (
              <div className="space-y-2 col-span-full">
                <label className="text-sm font-medium">نتائج العودة (المباينة)</label>
                <Input value={form.outcome} onChange={e => setForm({...form, outcome: e.target.value})} placeholder="أدخل نتائج المهمة أو أي ملاحظات" className="text-right" />
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end border-t pt-4">
            <Button onClick={save} className="gap-2">
              <Save className="h-4 w-4" /> حفظ الحركة
            </Button>
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
                  <DropdownMenuItem onClick={() => exportToWord(`سجل حركة: ${editing.plateNumber}`, editing, `حركة_${editing.id}`)}>
                    <FileText className="h-4 w-4 ml-2 text-blue-600" /> Word
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Movements;
