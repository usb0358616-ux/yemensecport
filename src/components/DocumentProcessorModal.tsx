import { useState, useRef } from 'react';
import { Traveler } from '@/lib/types';
import { generateId, saveTravelers } from '@/lib/storage';
import {
  parseExcelLocally,
  parsePdfLocally,
  reconcileWithDatabase,
  ReconciliationRecord,
  ExtractedTravelerData
} from '@/lib/localDocumentParser';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  FileSpreadsheet,
  FileText,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  UserPlus,
  Users,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  Download,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface DocumentProcessorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTravelers: Traveler[];
  onDataUpdated: (updatedList: Traveler[]) => void;
}

export function DocumentProcessorModal({
  open,
  onOpenChange,
  currentTravelers,
  onDataUpdated
}: DocumentProcessorModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [records, setRecords] = useState<ReconciliationRecord[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'new' | 'matched'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);
    setRecords([]);

    try {
      const fileName = selectedFile.name.toLowerCase();
      let extracted: ExtractedTravelerData[] = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        extracted = await parseExcelLocally(selectedFile);
      } else if (fileName.endsWith('.pdf')) {
        extracted = await parsePdfLocally(selectedFile);
      } else {
        toast({
          title: 'صيغة ملف غير مدعومة',
          description: 'يرجى اختيار ملف Excel (.xlsx, .xls) أو ملف PDF (.pdf)',
          variant: 'destructive'
        });
        setIsProcessing(false);
        return;
      }

      if (extracted.length === 0) {
        toast({
          title: 'لم يتم العثور على سجلات مسافرين',
          description: 'تأكد من أن الملف يحتوي على أعمدة أو نصوص تتضمن اسم المسافر أو رقم الجواز.',
          variant: 'destructive'
        });
        setIsProcessing(false);
        return;
      }

      // Reconcile locally with current system travelers
      const reconciled = reconcileWithDatabase(extracted, currentTravelers);
      setRecords(reconciled);

      const matchedCount = reconciled.filter(r => r.status === 'matched').length;
      const newCount = reconciled.filter(r => r.status === 'new').length;

      toast({
        title: 'تم استخراج البيانات بنجاح محلياً',
        description: `تم استخراج ${reconciled.length} سجلاً (${newCount} جديد، ${matchedCount} مطابق لقاعدة البيانات الحالية)`
      });
    } catch (err: any) {
      console.error('Error processing file:', err);
      toast({
        title: 'حدث خطأ أثناء معالجة الملف',
        description: err?.message || 'تعذر استخراج البيانات من الملف محلياً.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const toggleSelectRecord = (tempId: string) => {
    setRecords(prev =>
      prev.map(r => (r.tempId === tempId ? { ...r, selected: !r.selected } : r))
    );
  };

  const selectAll = (select: boolean) => {
    setRecords(prev => prev.map(r => ({ ...r, selected: select })));
  };

  // Commit changes into database
  const applyImport = (targetStatus: 'all' | 'new_only' | 'matched_only') => {
    const selectedRecords = records.filter(r => {
      if (!r.selected) return false;
      if (targetStatus === 'new_only') return r.status === 'new';
      if (targetStatus === 'matched_only') return r.status === 'matched';
      return true;
    });

    if (selectedRecords.length === 0) {
      toast({
        title: 'تنبيه',
        description: 'يرجى تحديد سجل واحد على الأقل للتطبيق.',
        variant: 'destructive'
      });
      return;
    }

    const now = new Date().toISOString();
    const updatedList = [...currentTravelers];
    let addedCount = 0;
    let updatedCount = 0;

    for (const rec of selectedRecords) {
      if (rec.status === 'new') {
        const newTraveler: Traveler = {
          id: generateId(),
          firstName: rec.data.firstName || 'مسافر',
          secondName: rec.data.secondName || '',
          thirdName: rec.data.thirdName || '',
          fourthName: rec.data.fourthName || '',
          lastName: rec.data.lastName || '',
          age: rec.data.age || 0,
          idNumber: rec.data.idNumber,
          idType: rec.data.idType || 'جواز',
          country: rec.data.country || 'اليمن',
          governorate: rec.data.governorate || '',
          phone: rec.data.phone || '',
          vettingResult: rec.data.vettingResult || '',
          vettingResult1: rec.data.vettingResult1,
          vettingResult2: rec.data.vettingResult2,
          vettingResult3: rec.data.vettingResult3,
          vettingResult4: rec.data.vettingResult4,
          destination: rec.data.destination || '',
          visitReason: rec.data.visitReason || '',
          visaType: rec.data.visaType || '',
          center: rec.data.center || '',
          agency: rec.data.agency || '',
          receiveDate: rec.data.receiveDate || '',
          travelAllowed: rec.data.travelAllowed || 'نعم',
          status: rec.data.status || 'معتمد',
          returnReason: rec.data.returnReason || '',
          investigatingOfficer: rec.data.investigatingOfficer || '',
          requestNumber: rec.data.requestNumber || '',
          createdAt: now,
          updatedAt: now
        };
        updatedList.unshift(newTraveler);
        addedCount++;
      } else if (rec.status === 'matched' && rec.existingTraveler) {
        const targetIndex = updatedList.findIndex(t => t.id === rec.existingTraveler!.id);
        if (targetIndex !== -1) {
          const current = updatedList[targetIndex];
          const updated: Traveler = {
            ...current,
            // Apply only provided values from extracted data
            destination: rec.data.destination || current.destination,
            center: rec.data.center || current.center,
            agency: rec.data.agency || current.agency,
            receiveDate: rec.data.receiveDate || current.receiveDate,
            travelAllowed: rec.data.travelAllowed || current.travelAllowed,
            status: rec.data.status || current.status,
            returnReason: rec.data.returnReason || current.returnReason,
            phone: rec.data.phone || current.phone,
            visitReason: rec.data.visitReason || current.visitReason,
            visaType: rec.data.visaType || current.visaType,
            investigatingOfficer: rec.data.investigatingOfficer || current.investigatingOfficer,
            vettingResult: rec.data.vettingResult
              ? (current.vettingResult ? `${current.vettingResult} | ${rec.data.vettingResult}` : rec.data.vettingResult)
              : current.vettingResult,
            vettingResult1: rec.data.vettingResult1 || current.vettingResult1,
            vettingResult2: rec.data.vettingResult2 || current.vettingResult2,
            vettingResult3: rec.data.vettingResult3 || current.vettingResult3,
            vettingResult4: rec.data.vettingResult4 || current.vettingResult4,
            updatedAt: now
          };
          updatedList[targetIndex] = updated;
          updatedCount++;
        }
      }
    }

    saveTravelers(updatedList);
    onDataUpdated(updatedList);

    toast({
      title: 'تم اعتماد وتطبيق البيانات بنجاح',
      description: `تمت إضافة ${addedCount} مسافر جديد وتحديث بيانات ${updatedCount} مسافر موجود.`
    });

    onOpenChange(false);
  };

  // Export reconciliation report to Excel
  const exportReconciliationReport = () => {
    if (records.length === 0) return;
    const exportData = records.map(r => ({
      'الحالة في النظام': r.status === 'new' ? 'مسافر جديد' : `مطابق لـ: ${r.existingTraveler?.firstName} ${r.existingTraveler?.lastName}`,
      'الاسم الكامل': `${r.data.firstName} ${r.data.secondName || ''} ${r.data.thirdName || ''} ${r.data.lastName || ''}`.trim(),
      'رقم الوثيقة': r.data.idNumber,
      'نوع الوثيقة': r.data.idType,
      'الجنسية': r.data.country,
      'الوجهة': r.data.destination,
      'المركز': r.data.center,
      'الوكالة': r.data.agency,
      'قرار السفر': r.data.travelAllowed,
      'حالة السفر': r.data.status,
      'تاريخ الاستلام': r.data.receiveDate,
      'نتائج المباينة': r.data.vettingResult,
      'مصدر الاستخراج': r.data.rawSource || 'الملف المرفوع'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير المعالجة والمطابقة');
    XLSX.writeFile(wb, `تقرير_معالجة_الملفات_${Date.now()}.xlsx`);
  };

  // Filtered list
  const filteredRecords = records.filter(r => {
    if (filterType === 'new' && r.status !== 'new') return false;
    if (filterType === 'matched' && r.status !== 'matched') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = `${r.data.firstName} ${r.data.secondName || ''} ${r.data.lastName || ''}`.toLowerCase();
      const id = (r.data.idNumber || '').toLowerCase();
      return name.includes(q) || id.includes(q);
    }
    return true;
  });

  const matchedTotal = records.filter(r => r.status === 'matched').length;
  const newTotal = records.filter(r => r.status === 'new').length;
  const selectedCount = records.filter(r => r.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden text-right" dir="rtl">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  معالجة ملفات Excel و PDF محلياً
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                    محلي 100% دون إنترنت
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  استخراج قوائم المسافرين من جداول Excel وملفات PDF، والمطابقة الآلية مع قاعدة البيانات لتحديث السجلات أو إضافة الجدد.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* File Upload Zone */}
          {records.length === 0 ? (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-primary/30 hover:border-primary/60 bg-muted/10 hover:bg-muted/20 transition-all rounded-xl p-8 text-center flex flex-col items-center justify-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, .pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shadow-sm">
                  <FileSpreadsheet className="h-7 w-7" />
                </div>
                <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shadow-sm">
                  <FileText className="h-7 w-7" />
                </div>
              </div>

              <h3 className="text-base font-bold text-foreground mb-1">
                اسحب وأفلت ملف Excel أو PDF هنا، أو انقر للاختيار
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mb-4 leading-relaxed">
                يدعم كشوفات المسافرين، ملفات المباينة الأمنية، تقارير المنافذ، والتأشيرات بصيغ Excel (.xlsx, .xls) و PDF.
                تتم القراءة والمعالجة بالكامل محلياً داخل المتصفح بمكتبات <span className="font-semibold text-foreground">xlsx</span> و <span className="font-semibold text-foreground">pdfjs-dist</span>.
              </p>

              <Button
                type="button"
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    جاري التحليل والاستخراج محلياً...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    اختيار ملف من الجهاز
                  </>
                )}
              </Button>
            </div>
          ) : (
            /* Uploaded File Banner & Statistics */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-muted/40 border rounded-lg">
                <div className="flex items-center gap-2.5">
                  {file?.name.toLowerCase().endsWith('.pdf') ? (
                    <FileText className="h-5 w-5 text-rose-600" />
                  ) : (
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  )}
                  <div>
                    <span className="font-bold text-sm block">{file?.name}</span>
                    <span className="text-xs text-muted-foreground">
                      الحجم: {file ? `${(file.size / 1024).toFixed(1)} KB` : ''} • تم استخراج {records.length} سجل
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRecords([]);
                      setFile(null);
                    }}
                    className="text-xs gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    اختيار ملف آخر
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportReconciliationReport}
                    className="text-xs gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    تصدير تقرير المعالجة
                  </Button>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div
                  onClick={() => setFilterType('all')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    filterType === 'all' ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>إجمالي السجلات</span>
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-2xl font-black">{records.length}</div>
                </div>

                <div
                  onClick={() => setFilterType('new')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    filterType === 'new' ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500' : 'bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 mb-1">
                    <span>مسافرون جدد (إضافة)</span>
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{newTotal}</div>
                </div>

                <div
                  onClick={() => setFilterType('matched')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    filterType === 'matched' ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500' : 'bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 mb-1">
                    <span>مطابقون لقيد (تحديث)</span>
                    <RefreshCw className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{matchedTotal}</div>
                </div>
              </div>

              {/* Filter & Selection Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث في السجلات المستخرجة بالاسم أو رقم الجواز..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pr-9 h-9 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => selectAll(true)}
                    className="h-8 text-xs gap-1"
                  >
                    <Check className="h-3.5 w-3.5" /> تحديد الكل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => selectAll(false)}
                    className="h-8 text-xs gap-1"
                  >
                    <X className="h-3.5 w-3.5" /> إلغاء التحديد
                  </Button>
                  <span className="text-xs text-muted-foreground mr-1">
                    تم تحديد {selectedCount} من {records.length}
                  </span>
                </div>
              </div>

              {/* Records List / Table */}
              <div className="border rounded-lg overflow-hidden bg-card divide-y">
                {filteredRecords.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    لا توجد سجلات تطابق معايير البحث الحالية.
                  </div>
                ) : (
                  filteredRecords.map(rec => {
                    const isExpanded = expandedId === rec.tempId;
                    const fullName = `${rec.data.firstName} ${rec.data.secondName || ''} ${rec.data.thirdName || ''} ${rec.data.lastName || ''}`.trim();
                    return (
                      <div
                        key={rec.tempId}
                        className={`p-3.5 transition-colors ${
                          rec.selected ? 'bg-background hover:bg-muted/30' : 'bg-muted/20 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={rec.selected}
                              onChange={() => toggleSelectRecord(rec.tempId)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            />

                            {/* Main Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-bold text-sm text-foreground truncate">
                                  {fullName || 'مسافر بدون اسم'}
                                </span>

                                {rec.status === 'new' ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[11px] gap-1">
                                    <UserPlus className="h-3 w-3" /> مسافر جديد (إضافة)
                                  </Badge>
                                ) : (
                                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 text-[11px] gap-1">
                                    <RefreshCw className="h-3 w-3" /> مطابق لقيد: {rec.existingTraveler?.firstName} {rec.existingTraveler?.lastName}
                                  </Badge>
                                )}

                                {rec.data.travelAllowed === 'لا' ? (
                                  <Badge variant="destructive" className="text-[10px] gap-1">
                                    <ShieldAlert className="h-3 w-3" /> ممنوع من السفر
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-[10px] gap-1">
                                    <ShieldCheck className="h-3 w-3" /> مسموح
                                  </Badge>
                                )}
                              </div>

                              {/* Details Row */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>
                                  <strong className="text-foreground">الوثيقة:</strong> {rec.data.idType || 'جواز'} ({rec.data.idNumber})
                                </span>
                                <span>
                                  <strong className="text-foreground">الجنسية:</strong> {rec.data.country || 'اليمن'}
                                </span>
                                {rec.data.destination && (
                                  <span>
                                    <strong className="text-foreground">الوجهة:</strong> {rec.data.destination}
                                  </span>
                                )}
                                {rec.data.center && (
                                  <span>
                                    <strong className="text-foreground">المركز:</strong> {rec.data.center}
                                  </span>
                                )}
                                {rec.data.receiveDate && (
                                  <span>
                                    <strong className="text-foreground">التاريخ:</strong> {rec.data.receiveDate}
                                  </span>
                                )}
                              </div>

                              {/* Vetting summary if available */}
                              {rec.data.vettingResult && (
                                <div className="mt-1.5 p-1.5 px-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-[11px] text-amber-800 dark:text-amber-300">
                                  <strong>نتائج المباينة:</strong> {rec.data.vettingResult}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Diffs Button if Matched */}
                          {rec.status === 'matched' && rec.diffs.length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedId(isExpanded ? null : rec.tempId)}
                              className="text-xs text-blue-600 gap-1 h-7"
                            >
                              <Info className="h-3.5 w-3.5" />
                              {isExpanded ? 'إخفاء الفروقات' : `تحديث ${rec.diffs.length} حقول`}
                            </Button>
                          )}
                        </div>

                        {/* Collapsible Diffs Table */}
                        {isExpanded && rec.diffs.length > 0 && (
                          <div className="mt-3 mr-7 p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs space-y-2">
                            <div className="font-bold text-blue-900 dark:text-blue-200 text-xs mb-1">
                              الحقول التي سيتم تحديثها في القيد الحالي:
                            </div>
                            <div className="divide-y divide-blue-200/60 dark:divide-blue-800">
                              {rec.diffs.map((diff, dIdx) => (
                                <div key={dIdx} className="py-1 flex items-center justify-between text-xs">
                                  <span className="font-medium text-foreground">{diff.label}:</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground line-through">{diff.currentValue}</span>
                                    <ArrowRight className="h-3 w-3 text-blue-500" />
                                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                      {diff.incomingValue}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {records.length > 0 && (
          <div className="p-4 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              جاهز لمعالجة <strong className="text-foreground">{selectedCount}</strong> سجل محدد.
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                إلغاء
              </Button>

              {matchedTotal > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyImport('matched_only')}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50 gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  تحديث المطابقين فقط ({matchedTotal})
                </Button>
              )}

              {newTotal > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyImport('new_only')}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  إضافة الجدد فقط ({newTotal})
                </Button>
              )}

              <Button
                size="sm"
                onClick={() => applyImport('all')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5 shadow"
              >
                <CheckCircle2 className="h-4 w-4" />
                اعتماد وتطبيق الكل ({selectedCount})
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
