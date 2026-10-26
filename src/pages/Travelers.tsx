import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Traveler } from '@/lib/types';
import { getTravelers, saveTravelers, generateId, normalizeArabic, getReports, saveReports } from '@/lib/storage';
import { YEMEN_GOVERNORATES, COUNTRIES, ID_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Upload, Search, Printer, Trash2, AlertCircle, Scan, Link as LinkIcon, FileText, Globe, User, MapPin, Download, Save, Image as ImageIcon, FileJson, Sparkles, Cloud, Camera, LayoutGrid, TableProperties, Eye, FileSpreadsheet, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { GoogleWorkspacePortal } from '@/components/GoogleWorkspacePortal';
import { CameraScanner } from '@/components/CameraScanner';
import { OfficialPrintReport } from '@/components/OfficialPrintReport';
import { DocumentProcessorModal } from '@/components/DocumentProcessorModal';
import * as XLSX from 'xlsx';
import { QRCodeCanvas } from 'qrcode.react';
import ReactDOMServer from 'react-dom/server';
import { scanPassport } from '@/services/geminiService';
import { DeleteConfirmation } from '@/components/DeleteConfirmation';
import { exportToExcel, exportToPDF, exportToImage, exportToWord, handlePrint } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const emptyTraveler = (): Partial<Traveler> => ({
  firstName: '', secondName: '', thirdName: '', fourthName: '', lastName: '',
  age: 0, idNumber: '', idType: 'شخصية', country: 'اليمن', governorate: '',
  phone: '', vettingResult: '', destination: '', visitReason: '',
  investigatingOfficer: '', travelAllowed: 'نعم',
  center: '', agency: '', receiveDate: '', status: '', returnReason: '', visaType: '',
});

const Travelers = () => {
  const [travelers, setTravelers] = useState(getTravelers);
  const [googlePortalOpen, setGooglePortalOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Traveler | null>(null);
  const [form, setForm] = useState<Partial<Traveler>>(emptyTraveler());
  const [search, setSearch] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [watchlistMatch, setWatchlistMatch] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, message: '' });
  const [viewingTraveler, setViewingTraveler] = useState<Traveler | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [newReportDialogOpen, setNewReportDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [travelerToDelete, setTravelerToDelete] = useState<string | null>(null);
  const [newReportForm, setNewReportForm] = useState({ title: '', description: '', type: 'عام' });
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [docProcessorOpen, setDocProcessorOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50; // Maximum 50 persons per page
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'table');
  const [printableTraveler, setPrintableTraveler] = useState<Traveler | null>(null);
  const [filters, setFilters] = useState({
    country: 'الكل',
    travelAllowed: 'الكل',
    startDate: '',
    endDate: ''
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleCameraScanComplete = (extractedData: Partial<Traveler>, photoDataUrl: string) => {
    const fullName = `${extractedData.firstName || ''} ${extractedData.lastName || ''}`.trim();
    if (fullName) checkWatchlist(fullName);

    setEditing(null);
    setForm(prev => ({
      ...prev,
      ...extractedData,
      photoUrl: photoDataUrl
    }));
    setPhotoPreview(photoDataUrl);
    setOpen(true);
    toast({
      title: 'تم مسح الوثيقة بنجاح',
      description: 'تم استخراج البيانات وملء النموذج تلقائياً بواسطة الكاميرا'
    });
  };

  const handleOfficialPrint = (t?: Traveler | null) => {
    const target = t || viewingTraveler;
    if (!target) return;
    setPrintableTraveler(target);
    // Give state a tick to update the print template
    setTimeout(() => {
      window.print();
    }, 150);
  };

  useEffect(() => {
    const q = searchParams.get('search');
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filters]);

  useEffect(() => {
    if (id) {
      const traveler = travelers.find(t => t.id === id);
      if (traveler) {
        setViewingTraveler(traveler);
      } else {
        toast({ title: 'خطأ', description: 'المسافر غير موجود', variant: 'destructive' });
        navigate('/', { replace: true });
      }
    } else {
      setViewingTraveler(null);
    }
  }, [id, travelers, navigate, toast]);

  const checkWatchlist = (name: string) => {
    if (!name || name.length < 3) return;
    const reports = getReports();
    const normName = normalizeArabic(name);
    const match = reports.find(r => normalizeArabic(r.title).includes(normName) || normalizeArabic(r.description).includes(normName));
    if (match) {
      setWatchlistMatch(match.title);
    } else {
      setWatchlistMatch(null);
    }
  };

  const f = (key: keyof Traveler, value: string | number) => {
    setForm({ ...form, [key]: value });
    if (key === 'firstName' || key === 'lastName') {
      const fullName = `${key === 'firstName' ? value : form.firstName} ${key === 'lastName' ? value : form.lastName}`;
      checkWatchlist(fullName);
    }
  };

  const save = () => {
    if (!form.firstName || !form.idNumber) {
      toast({ title: 'خطأ', description: 'الاسم الأول ورقم البطاقة مطلوبان', variant: 'destructive' });
      return;
    }
    const now = new Date().toISOString();
    let updated: Traveler[];
    if (editing) {
      updated = travelers.map(t => t.id === editing.id ? { ...t, ...form, updatedAt: now } as Traveler : t);
    } else {
      updated = [...travelers, { ...form, id: generateId(), createdAt: now, updatedAt: now } as Traveler];
    }
    saveTravelers(updated);
    setTravelers(updated);
    setOpen(false);
    setForm(emptyTraveler());
    setEditing(null);
    toast({ title: 'تم الحفظ' });
  };

  const deleteTraveler = (id: string) => {
    setTravelerToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!travelerToDelete) return;
    const updated = travelers.filter(t => t.id !== travelerToDelete);
    saveTravelers(updated);
    setTravelers(updated);
    setDeleteConfirmOpen(false);
    setTravelerToDelete(null);
    toast({ title: 'تم الحذف' });
  };

  const linkReport = (reportId: string) => {
    if (!viewingTraveler) return;
    const updatedTravelers = travelers.map(t => {
      if (t.id === viewingTraveler.id) {
        const linkedIds = t.linkedReportIds || [];
        if (linkedIds.includes(reportId)) return t;
        return { ...t, linkedReportIds: [...linkedIds, reportId] };
      }
      return t;
    });
    saveTravelers(updatedTravelers);
    setTravelers(updatedTravelers);
    setViewingTraveler(updatedTravelers.find(t => t.id === viewingTraveler.id) || null);
    setLinkDialogOpen(false);
    toast({ title: 'تم ربط البلاغ' });
  };

  const createAndLinkReport = () => {
    if (!viewingTraveler || !newReportForm.title) return;
    const reports = getReports();
    const newReportId = generateId();
    const now = new Date().toISOString();
    const newReport = {
      ...newReportForm,
      id: newReportId,
      status: 'جديد',
      linkedTravelerIds: [viewingTraveler.id],
      createdAt: now,
      updatedAt: now
    };
    saveReports([...reports, newReport]);
    
    const updatedTravelers = travelers.map(t => {
      if (t.id === viewingTraveler.id) {
        return { ...t, linkedReportIds: [...(t.linkedReportIds || []), newReportId] };
      }
      return t;
    });
    saveTravelers(updatedTravelers);
    setTravelers(updatedTravelers);
    setViewingTraveler(updatedTravelers.find(t => t.id === viewingTraveler.id) || null);
    setNewReportDialogOpen(false);
    setNewReportForm({ title: '', description: '', type: 'عام' });
    toast({ title: 'تم إنشاء وربط البلاغ' });
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        const url = ev.target?.result as string;
        setPhotoPreview(url);
        setForm({ ...form, photoUrl: url });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!navigator.onLine) {
      toast({ 
        title: 'لا يوجد اتصال', 
        description: 'هذه الميزة (الذكاء الاصطناعي) تتطلب اتصالاً بالإنترنت لمسح الوثائق. يرجى إدخال البيانات يدوياً.', 
        variant: 'destructive' 
      });
      return;
    }

    setIsScanning(true);
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const base64 = ev.target?.result as string;
        const mimeType = file.type;
        const data = await scanPassport(base64, mimeType);
        
        // Auto-fill and trigger logic
        const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
        if (fullName) checkWatchlist(fullName);
        
        setForm(prev => ({ 
          ...prev, 
          ...data, 
          photoUrl: base64 // Use scanned image as temporary photo
        }));
        setPhotoPreview(base64);
        setOpen(true); // Open dialog automatically
        
        toast({ title: 'تم المسح بنجاح', description: 'تم استخراج البيانات وفتح النموذج آلياً' });
      } catch (err) {
        console.error(err);
        toast({ title: 'خطأ في المسح', description: 'تعذر استخراج البيانات من الصورة', variant: 'destructive' });
      } finally {
        setIsScanning(false);
        e.target.value = ''; // Reset input
      }
    };
    reader.readAsDataURL(file);
  };

  const findCol = (row: Record<string, string>, ...keys: string[]): string => {
    for (const k of keys) {
      for (const col of Object.keys(row)) {
        if (normalizeArabic(col).includes(normalizeArabic(k))) return String(row[col] ?? '').trim();
      }
    }
    return '';
  };

  const importExcel = (type: 'travelers' | 'vetting') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        const current = getTravelers();
        let totalNew = 0;
        let totalUpdated = 0;

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
          if (rows.length === 0) continue;

          rows.forEach(row => {
            const nameField = findCol(row, 'الاسم', 'الإسم', 'اسم المسافر', 'الاسم الكامل', 'اسم المسافر رباعي', 'الاسم الرباعي');
            const nameParts = nameField.split(/\s+/).filter(Boolean);
            const idNum = findCol(row, 'رقم الجواز', 'رقم البطاقة', 'رقم الوثيقة', 'رقم الجواز / البطاقة', 'رقم الهوية');

            if (!idNum && !nameField) return;

            // Match by ID or normalized name
            const normName = normalizeArabic(nameField);
            const existing = current.find(t => {
              if (idNum && normalizeArabic(String(t.idNumber)) === normalizeArabic(idNum)) return true;
              if (normName) {
                const tName = normalizeArabic(`${t.firstName} ${t.secondName} ${t.thirdName} ${t.fourthName} ${t.lastName}`);
                return tName === normName || tName.includes(normName) || normName.includes(tName);
              }
              return false;
            });

            // Vetting result columns
            const vr1 = findCol(row, 'نتائج المباينة من قاعدة المطلوبين', 'المطلوبين', 'مطلوب');
            const vr2 = findCol(row, 'نتائج المباينة من قاعدة السجون', 'السجون', 'سجين');
            const vr3 = findCol(row, 'نتائج المباينة من قاعدة مرتزقة', 'مرتزقة', 'مرتزق');
            const vr4 = findCol(row, 'نتائج المباينة من قاعدة مركز العائدين', 'العائدين', 'عائد');
            const cleanVr = (v: string) => v && v !== '-' ? v : '';

            if (existing) {
              if (type === 'vetting') {
                const parts: string[] = [];
                if (cleanVr(vr1)) parts.push('المطلوبين: ' + cleanVr(vr1));
                if (cleanVr(vr2)) parts.push('السجون: ' + cleanVr(vr2));
                if (cleanVr(vr3)) parts.push('المرتزقة: ' + cleanVr(vr3));
                if (cleanVr(vr4)) parts.push('العائدين: ' + cleanVr(vr4));
                existing.vettingResult = parts.length > 0 ? parts.join(' | ') : existing.vettingResult;
                existing.vettingResult1 = cleanVr(vr1) || existing.vettingResult1 || '';
                existing.vettingResult2 = cleanVr(vr2) || existing.vettingResult2 || '';
                existing.vettingResult3 = cleanVr(vr3) || existing.vettingResult3 || '';
                existing.vettingResult4 = cleanVr(vr4) || existing.vettingResult4 || '';
                totalUpdated++;
              } else {
                if (!existing.firstName && nameParts.length > 0) {
                  existing.firstName = nameParts[0] || '';
                  existing.secondName = nameParts[1] || '';
                  existing.thirdName = nameParts[2] || '';
                  existing.fourthName = nameParts[3] || '';
                  existing.lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
                }
                // Update additional fields
                const center = findCol(row, 'المركز');
                const agency = findCol(row, 'الوكالة', 'إسم الوكالة', 'اسم الوكالة');
                const visaType = findCol(row, 'التأشيرة', 'نوع التأشيرة', 'نوع الفيزا');
                const exitDate = findCol(row, 'ت. الخروج', 'تاريخ الخروج', 'تاريخ الإستلام', 'تاريخ الاستلام');
                const status = findCol(row, 'الحالة');
                const returnReason = findCol(row, 'سبب الإرتجاع', 'سبب الارتجاع');
                if (center) existing.center = center;
                if (agency) existing.agency = agency;
                if (visaType) existing.visitReason = visaType;
                if (exitDate) existing.receiveDate = exitDate;
                if (status) existing.status = status;
                if (returnReason) existing.returnReason = returnReason;
                totalUpdated++;
              }
            } else {
              const center = findCol(row, 'المركز');
              const agency = findCol(row, 'الوكالة', 'إسم الوكالة', 'اسم الوكالة');
              const visaType = findCol(row, 'التأشيرة', 'نوع التأشيرة', 'نوع الفيزا');
              const exitDate = findCol(row, 'ت. الخروج', 'تاريخ الخروج', 'تاريخ الإستلام', 'تاريخ الاستلام');
              const status = findCol(row, 'الحالة');
              const returnReason = findCol(row, 'سبب الإرتجاع', 'سبب الارتجاع');
              const destination = findCol(row, 'جهة القدوم', 'الدولة');
              const requestNum = findCol(row, 'رقم الطلب');

              const vettingParts: string[] = [];
              if (type === 'vetting') {
                if (cleanVr(vr1)) vettingParts.push('المطلوبين: ' + cleanVr(vr1));
                if (cleanVr(vr2)) vettingParts.push('السجون: ' + cleanVr(vr2));
                if (cleanVr(vr3)) vettingParts.push('المرتزقة: ' + cleanVr(vr3));
                if (cleanVr(vr4)) vettingParts.push('العائدين: ' + cleanVr(vr4));
              }

              const firstName = nameParts[0] || '';
              const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
              const middleParts = nameParts.slice(1, -1);
              const secondName = middleParts[0] || '';
              const thirdName = middleParts[1] || '';
              const fourthName = middleParts[2] || '';

              current.push({
                id: generateId(),
                firstName,
                secondName,
                thirdName,
                fourthName,
                lastName,
                age: 0,
                idNumber: idNum,
                idType: 'جواز',
                country: 'اليمن',
                governorate: '',
                phone: '',
                vettingResult: vettingParts.join(' | '),
                vettingResult1: type === 'vetting' ? cleanVr(vr1) : '',
                vettingResult2: type === 'vetting' ? cleanVr(vr2) : '',
                vettingResult3: type === 'vetting' ? cleanVr(vr3) : '',
                vettingResult4: type === 'vetting' ? cleanVr(vr4) : '',
                destination: destination,
                visitReason: visaType || '',
                investigatingOfficer: '',
                travelAllowed: 'نعم',
                visaType: visaType,
                receiveDate: exitDate,
                agency: agency,
                center: center,
                status: status,
                requestNumber: requestNum,
                returnReason: returnReason,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              totalNew++;
            }
          });
        }

        saveTravelers(current);
        setTravelers([...current]);
        toast({ title: `تم الاستيراد: ${totalNew} مسافر جديد` + (totalUpdated > 0 ? ` وتحديث ${totalUpdated} سجل` : '') });
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  const handleSmartImportClick = () => {
    const input = document.getElementById('smart-batch-input') as HTMLInputElement;
    if (input) input.click();
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSmartBatchProcess = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check for API key if processing media but not solely relying on it
    const fileList = Array.from(files);
    const mediaFiles = fileList.filter(f => f.name.match(/\.(jpg|jpeg|png|pdf)$/i));
    const apiKey = localStorage.getItem('config_geminiKey');

    if (mediaFiles.length > 0 && (!apiKey || apiKey.length < 10) && navigator.onLine) {
      toast({ 
        title: 'تنبيه: مفتاح الذكاء الاصطناعي مفقود', 
        description: 'سيتم استيراد الجداول بشكل طبيعي، ولكن لا يمكن تحليل الصور والوثائق آلياً بدون مفتاح API. يرجى ضبطه في الإعدادات.',
        variant: 'destructive'
      });
    }

    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: fileList.length, message: 'بدء فرز الملفات...' });

    const excelFiles = fileList.filter(f => f.name.match(/\.(xlsx|xls)$/i));

    let currentTravelers = getTravelers();
    let updatedCount = 0;
    let newCount = 0;

    try {
      // 1. Process Excel Files First
      for (const file of excelFiles) {
        setBatchProgress(prev => ({ ...prev, message: `جاري معالجة ملف الإكسل: ${file.name}` }));
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
          
          rows.forEach(row => {
            const nameField = findCol(row, 'الاسم', 'الإسم', 'اسم المسافر', 'الاسم الكامل', 'اسم المسافر رباعي', 'الاسم الرباعي');
            const idNum = findCol(row, 'رقم الجواز', 'رقم البطاقة', 'رقم الوثيقة', 'رقم الجواز / البطاقة', 'رقم الهوية');
            if (!idNum && !nameField) return;

            const normName = normalizeArabic(nameField);
            const foundIdx = currentTravelers.findIndex(t => {
              if (idNum && normalizeArabic(String(t.idNumber)) === normalizeArabic(idNum)) return true;
              if (normName) {
                const tName = normalizeArabic(`${t.firstName} ${t.secondName} ${t.thirdName} ${t.fourthName} ${t.lastName}`);
                return tName === normName;
              }
              return false;
            });

            const center = findCol(row, 'المركز');
            const agency = findCol(row, 'الوكالة');
            const visa = findCol(row, 'نوع التأشيرة', 'نوع الفيزا');
            const receiveDate = findCol(row, 'تاريخ الاستلام', 'تاريخ الإستلام');

            if (foundIdx > -1) {
              const t = currentTravelers[foundIdx];
              if (center) t.center = center;
              if (agency) t.agency = agency;
              if (visa) t.visitReason = visa;
              if (receiveDate) t.receiveDate = receiveDate;
              t.updatedAt = new Date().toISOString();
              updatedCount++;
            } else {
              const nameParts = nameField.split(/\s+/).filter(Boolean);
              currentTravelers.push({
                id: generateId(),
                firstName: nameParts[0] || '',
                secondName: nameParts[1] || '',
                thirdName: nameParts[2] || '',
                fourthName: nameParts[3] || '',
                lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : '',
                idNumber: idNum,
                idType: 'جواز',
                country: 'اليمن',
                center,
                agency,
                visitReason: visa,
                receiveDate,
                travelAllowed: 'نعم',
                status: 'جديد (من إكسل)',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              newCount++;
            }
          });
        }
        setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      // Save initial result of Excel
      saveTravelers(currentTravelers);

      // 2. Process Media Files (Photos/Passports)
      const isOnline = navigator.onLine;
      let attachedCount = 0;

      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i];
        setBatchProgress({ 
          current: excelFiles.length + i + 1, 
          total: fileList.length, 
          message: `جاري تحليل المرفق: ${file.name}` 
        });

        const dataUrl = await readFileAsDataURL(file);
        let matched = false;

        // Try filename matching first (e.g. 054321.jpg)
        const nameWithoutExt = file.name.split('.')[0].trim();
        const normFilename = normalizeArabic(nameWithoutExt);

        let targetIdx = currentTravelers.findIndex(t => 
          normalizeArabic(t.idNumber) === normFilename || 
          normalizeArabic(`${t.firstName} ${t.lastName}`).includes(normFilename)
        );

        if (targetIdx > -1) {
          matched = true;
        } else if (isOnline && apiKey && apiKey.length > 10) {
          // Fallback to Gemini AI for OCR only if key exists
          try {
            const data = await scanPassport(dataUrl, file.type);
            if (data.idNumber || data.firstName) {
              const normExtractedName = normalizeArabic(`${data.firstName} ${data.lastName}`);
              targetIdx = currentTravelers.findIndex(t => 
                (data.idNumber && normalizeArabic(t.idNumber) === normalizeArabic(data.idNumber)) ||
                (normExtractedName && normalizeArabic(`${t.firstName} ${t.lastName}`).includes(normExtractedName))
              );

              if (targetIdx > -1) {
                matched = true;
              } else {
                // Create new traveler from AI data
                const newT = {
                  ...emptyTraveler(),
                  ...data,
                  id: generateId(),
                  status: 'جديد (من مرفق)',
                  photoUrl: dataUrl,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as Traveler;
                currentTravelers.push(newT);
                targetIdx = currentTravelers.length - 1;
                matched = true;
                newCount++;
              }
            }
          } catch (e) {
            console.error('Gemini error during batch', e);
          }
        }

        if (matched && targetIdx > -1) {
          const t = currentTravelers[targetIdx];
          if (!t.documentsUrls) t.documentsUrls = [];
          
          // Check if already attached (avoid duplicates)
          if (!t.documentsUrls.includes(dataUrl)) {
            t.documentsUrls.push(dataUrl);
            // If it's a small photo and we don't have one, set as profile
            if (!t.photoUrl && file.type.startsWith('image')) {
              t.photoUrl = dataUrl;
            }
            attachedCount++;
          }
        }
      }

      saveTravelers(currentTravelers);
      setTravelers([...currentTravelers]);
      toast({ 
        title: 'اكتمل الاستيراد الذكي', 
        description: `تمت معالجة ${fileList.length} ملف. (جديد: ${newCount}، تم تحديثه: ${updatedCount}، وتم ربط ${attachedCount} مرفق)`
      });

    } catch (error) {
      console.error(error);
      toast({ title: 'خطأ أثناء المعالجة', description: 'حدث خطأ غير متوقع أثناء استيراد الملفات مجمعاً', variant: 'destructive' });
    } finally {
      setIsBatchProcessing(false);
      e.target.value = '';
    }
  };

  const filtered = travelers.filter(t => {
    // Search filter
    const normSearch = normalizeArabic(search);
    const fullName = normalizeArabic(`${t.firstName} ${t.secondName} ${t.thirdName} ${t.fourthName} ${t.lastName}`);
    const matchesSearch = !search || fullName.includes(normSearch) || normalizeArabic(t.idNumber).includes(normSearch);

    // Country filter
    const matchesCountry = filters.country === 'الكل' || t.country === filters.country;

    // Travel Allowed filter
    const matchesTravel = filters.travelAllowed === 'الكل' || t.travelAllowed === filters.travelAllowed;

    // Date range filter
    let matchesDate = true;
    if (filters.startDate || filters.endDate) {
      const travelDate = t.receiveDate ? new Date(t.receiveDate) : null;
      if (travelDate && !isNaN(travelDate.getTime())) {
        if (filters.startDate && travelDate < new Date(filters.startDate)) matchesDate = false;
        if (filters.endDate && travelDate > new Date(filters.endDate)) matchesDate = false;
      } else {
        matchesDate = false; // If no date, exclude if date filter is active
      }
    }

    return matchesSearch && matchesCountry && matchesTravel && matchesDate;
  });

  // Pagination calculation - 50 travelers maximum per page
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedTravelers = filtered.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (activePage > 3) pages.push('...');
      const start = Math.max(2, activePage - 1);
      const end = Math.min(totalPages - 1, activePage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (activePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const openEdit = (t: Traveler) => {
    setEditing(t);
    setForm(t);
    setPhotoPreview(t.photoUrl || '');
    setOpen(true);
  };

  const openEditFromView = (t: Traveler) => {
    setViewingTraveler(null);
    navigate('/');
    setTimeout(() => {
      openEdit(t);
    }, 100);
  };

  const printTraveler = (t: Traveler) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const today = new Date();
    const dateStr = `${today.getDate()} / ${today.getMonth() + 1} / ${today.getFullYear()}م`;
    
    // Generate QR Code as Data URL
    const qrCanvas = ReactDOMServer.renderToString(
      <QRCodeCanvas value={`TRAVELER:${t.idNumber}:${t.firstName} ${t.lastName}`} size={80} />
    );

    w.document.write(`<html dir="rtl"><head><title>بيانات المسافر</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Tajawal', Arial, sans-serif; padding: 20px 40px; direction: rtl; color: #1a1a1a; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
      .header-right { text-align: right; }
      .header-right img { height: 50px; margin-bottom: 5px; }
      .header-right p { font-size: 14px; font-weight: 700; margin: 2px 0; }
      .header-center { text-align: center; }
      .header-center img { height: 80px; }
      .header-center p { font-size: 16px; font-weight: 800; margin-top: 5px; }
      .header-left { text-align: left; font-size: 13px; display: flex; flex-direction: column; align-items: flex-end; }
      .header-left p { margin: 3px 0; }
      .qr-code { margin-top: 10px; }
      .header-line { height: 3px; background: linear-gradient(to left, #1e3a5f, #2c5282, #1e3a5f); margin: 10px 0 20px; border-radius: 2px; }
      .content { display: flex; gap: 20px; margin-top: 15px; }
      .photo-section { flex-shrink: 0; width: 120px; }
      .photo-section img { width: 120px; height: 160px; object-fit: cover; border: 2px solid #1e3a5f; border-radius: 4px; }
      .photo-placeholder { width: 120px; height: 160px; border: 2px dashed #aaa; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px; }
      .data-section { flex: 1; }
      table { width: 100%; border-collapse: collapse; }
      td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: right; font-size: 13px; }
      th { background: #1e3a5f; color: white; font-weight: 700; width: 140px; }
      .section-title { background: #e8edf2; font-weight: 700; text-align: center; font-size: 14px; color: #1e3a5f; }
      .vetting-cell { background: #fff3cd; }
      .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 13px; }
      .footer div { text-align: center; }
      .footer .label { font-weight: 700; margin-bottom: 30px; }
      @media print { body { padding: 10px 20px; } }
    </style></head><body>
    <div class="header">
      <div class="header-right">
        <img src="/header-text.jpg" alt="الجمهورية اليمنية" />
        <p>وزارة الداخلية</p>
        <p>قطاع استخبارات الشرطة</p>
        <p>فرع مصلحة الجوازات</p>
      </div>
      <div class="header-center">
        <p>بسم الله الرحمن الرحيم</p>
        <img src="/emblem.jpg" alt="الشعار" />
      </div>
      <div class="header-left">
        <p>الرقـــــم:.............................</p>
        <p>التاريـــــخ: ${dateStr}</p>
        <div class="qr-code">${qrCanvas}</div>
      </div>
    </div>
    <div class="header-line"></div>

    <div class="content">
      <div class="data-section">
        <table>
          <tr><td class="section-title" colspan="4">البيانات الشخصية</td></tr>
          <tr><th>الاسم الكامل</th><td colspan="3">${t.firstName} ${t.secondName} ${t.thirdName} ${t.fourthName} ${t.lastName}</td></tr>
          <tr><th>رقم الجواز/البطاقة</th><td>${t.idNumber}</td><th>نوع الوثيقة</th><td>${t.idType}</td></tr>
          <tr><th>العمر</th><td>${t.age || '-'}</td><th>المحافظة</th><td>${t.governorate || '-'}</td></tr>
          <tr><th>البلاد</th><td>${t.country || '-'}</td><th>رقم الهاتف</th><td>${t.phone || '-'}</td></tr>
          <tr><th>المركز</th><td>${t.center || '-'}</td><th>الوكالة</th><td>${t.agency || '-'}</td></tr>

          <tr><td class="section-title" colspan="4">بيانات السفر</td></tr>
          <tr><th>الدولة المتجه إليها</th><td>${t.destination || '-'}</td><th>سبب الزيارة/التأشيرة</th><td>${t.visitReason || '-'}</td></tr>
          <tr><th>تاريخ الخروج</th><td>${t.receiveDate || '-'}</td><th>الحالة</th><td>${t.status || '-'}</td></tr>
          <tr><th>سبب الإرتجاع</th><td colspan="3">${t.returnReason || '-'}</td></tr>
          <tr><th>السماح بالسفر</th><td colspan="3"><strong style="color:${t.travelAllowed === 'نعم' ? 'green' : 'red'}">${t.travelAllowed}</strong></td></tr>

          <tr><td class="section-title" colspan="4">نتائج المباينة الأمنية</td></tr>
          <tr class="vetting-cell"><th>النتائج</th><td colspan="3">${t.vettingResult || 'لا توجد نتائج'}</td></tr>

          <tr><td class="section-title" colspan="4">الإجراء</td></tr>
          <tr><th>الضابط المحقق</th><td colspan="3">${t.investigatingOfficer || '-'}</td></tr>
        </table>
      </div>
      <div class="photo-section">
        ${t.photoUrl ? `<img src="${t.photoUrl}" alt="صورة المسافر" />` : '<div class="photo-placeholder">صورة<br/>4×6</div>'}
      </div>
    </div>

    <div class="footer">
      <div><p class="label">الضابط المحقق</p><p>التوقيع: ..................</p></div>
      <div><p class="label">المشرف</p><p>التوقيع: ..................</p></div>
      <div><p class="label">المدير</p><p>التوقيع: ..................</p></div>
    </div>
    ${(t.documentsUrls || []).map((doc: string, i: number) => {
      if (doc.startsWith('data:image')) {
        return '<div style="page-break-before:always;text-align:center;padding:20px;"><h3 style="color:#1e3a5f;">مرفق ' + (i + 1) + '</h3><img src="' + doc + '" style="max-width:90%;max-height:80vh;border:1px solid #ccc;margin-top:10px;" /></div>';
      }
      return '<div style="page-break-before:always;text-align:center;padding:20px;"><h3 style="color:#1e3a5f;">مرفق ' + (i + 1) + '</h3><iframe src="' + doc + '" style="width:100%;height:80vh;border:1px solid #ccc;"></iframe></div>';
    }).join('')}
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">المسافرين</h1>
        {isBatchProcessing && (
          <div className="flex-1 max-w-md bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <Sparkles className="h-5 w-5 text-blue-600 animate-pulse" />
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-blue-800">{batchProgress.message}</span>
                <span className="text-blue-600">{batchProgress.current} / {batchProgress.total}</span>
              </div>
              <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300" 
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> تصدير الكشف
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir="rtl">
              <DropdownMenuItem onClick={() => exportToExcel(filtered, 'كشف_المسافرين')}>
                <FileJson className="h-4 w-4 ml-2 text-green-600" /> Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPDF('travelers-table', 'كشف_المسافرين')}>
                <FileText className="h-4 w-4 ml-2 text-red-600" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => setGooglePortalOpen(true)} variant="outline" className="gap-2 border-blue-200 hover:bg-blue-50/50 hover:text-blue-700 hover:border-blue-300">
            <Cloud className="h-4 w-4 text-blue-600" /> بوابة Google Workspace
          </Button>

          <Button 
            onClick={() => setCameraScannerOpen(true)} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-sm"
          >
            <Camera className="h-4 w-4 ml-1" /> مسح بالكاميرا
          </Button>

          <Button onClick={() => scanRef.current?.click()} variant="outline" disabled={isScanning}>
            <Scan className={`h-4 w-4 ml-2 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'جاري المسح...' : 'مسح صورة (AI)'}
          </Button>
          <input ref={scanRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleScan} />

          <div className="flex border rounded-lg overflow-hidden bg-muted/40 p-0.5">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-9 px-2.5 text-xs gap-1"
              title="عرض البطاقات (مناسب للجوال)"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">بطاقات</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-9 px-2.5 text-xs gap-1"
              title="عرض الجدول"
            >
              <TableProperties className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">جدول</span>
            </Button>
          </div>

          <Button 
            onClick={() => setDocProcessorOpen(true)} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4 ml-1" />
            معالجة Excel و PDF محلياً
          </Button>

          <Button onClick={() => handleSmartImportClick()} variant="default" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md gap-2" disabled={isBatchProcessing}>
            <Sparkles className={`h-4 w-4 ${isBatchProcessing ? 'animate-spin' : ''}`} />
            {isBatchProcessing ? 'جاري المعالجة...' : 'استيراد ذكي مجمع'}
          </Button>
          <input id="smart-batch-input" type="file" multiple className="hidden" onChange={handleSmartBatchProcess} />
          <Button onClick={() => importExcel('travelers')} variant="outline"><Upload className="h-4 w-4 ml-2" />استيراد الجوازات الخارجة (Excel)</Button>
          <Button onClick={() => importExcel('vetting')} variant="outline"><Upload className="h-4 w-4 ml-2" />استيراد ملف المباينة (Excel)</Button>
          <Button onClick={() => { setEditing(null); setForm(emptyTraveler()); setPhotoPreview(''); setOpen(true); }}><Plus className="h-4 w-4 ml-2" />إضافة مسافر</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 bg-muted/30 p-4 rounded-lg border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو رقم الجواز..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        
        <div className="w-40">
          <Select value={filters.country} onValueChange={v => setFilters({...filters, country: v})}>
            <SelectTrigger><SelectValue placeholder="الدولة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="الكل">كل الدول</SelectItem>
              {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="w-40">
          <Select value={filters.travelAllowed} onValueChange={v => setFilters({...filters, travelAllowed: v})}>
            <SelectTrigger><SelectValue placeholder="حالة السفر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="الكل">كل الحالات</SelectItem>
              <SelectItem value="نعم">مسموح</SelectItem>
              <SelectItem value="لا">ممنوع</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-40" />
          <span className="text-muted-foreground">إلى</span>
          <Input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-40" />
        </div>

        <Button variant="ghost" onClick={() => {
          setSearch('');
          setFilters({ country: 'الكل', travelAllowed: 'الكل', startDate: '', endDate: '' });
        }}>إعادة ضبط</Button>
      </div>

      {/* Cards View (Optimized for Mobile Smartphones & Touch) */}
      <div className={`${viewMode === 'cards' ? 'grid' : 'hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-4`}>
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-card rounded-2xl border border-slate-200 text-muted-foreground">
            لا توجد بيانات مطابقة للبحث
          </div>
        ) : (
          paginatedTravelers.map(t => (
            <div
              key={t.id}
              onClick={() => navigate(`/travelers/${t.id}`)}
              className="bg-card rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                  {t.photoUrl ? (
                    <img src={t.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-6 w-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="font-bold text-sm text-slate-800 truncate group-hover:text-primary transition-colors">
                      {t.firstName} {t.secondName} {t.lastName}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        t.travelAllowed === 'نعم'
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-red-100 text-red-700 border border-red-200'
                      }`}
                    >
                      {t.travelAllowed === 'نعم' ? 'مسموح' : 'ممنوع'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-bold text-slate-700">{t.idNumber}</span>
                    <span>·</span>
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">{t.idType}</span>
                    {t.country && (
                      <>
                        <span>·</span>
                        <span className="text-[10px] text-slate-500">{t.country}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-100 bg-slate-50/60 p-2 rounded-xl">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate">{t.destination || 'غير محدد'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate">{t.center || t.agency || 'المنفذ الرئيسي'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 no-print" onClick={e => e.stopPropagation()}>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1 border-slate-200 hover:bg-slate-100"
                    onClick={() => navigate(`/travelers/${t.id}`)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>تفاصيل</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1 text-primary border-primary/20 hover:bg-primary/5"
                    onClick={() => handleOfficialPrint(t)}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>طباعة</span>
                  </Button>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-primary"
                    onClick={() => openEdit(t)}
                    title="تعديل"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => deleteTraveler(t.id)}
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Table View (Optimized for Wide Screens / High Density & 4-Way Scroll) */}
      <div className={`${viewMode === 'table' ? 'block' : 'hidden'} rounded-lg border bg-card overflow-x-auto overflow-y-hidden shadow-xs`} id="travelers-table">
        <Table className="min-w-[850px] w-full">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">رقم الوثيقة</TableHead>
              <TableHead className="text-right">المركز/الوكالة</TableHead>
              <TableHead className="text-right">الوجهة</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">السفر</TableHead>
              <TableHead className="text-right no-print">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
            ) : paginatedTravelers.map(t => (
              <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => navigate(`/travelers/${t.id}`)}>
                <TableCell className="font-medium text-right">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <span>{t.firstName} {t.lastName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col">
                    <span className="font-mono text-xs">{t.idNumber}</span>
                    <span className="text-[10px] text-muted-foreground">{t.idType}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-1.5 text-xs">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span>{t.center} / {t.agency}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    <span>{t.destination}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs">{t.status || '-'}</TableCell>
                <TableCell className="text-right">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.travelAllowed === 'نعم' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {t.travelAllowed === 'نعم' ? 'مسموح' : 'ممنوع'}
                  </span>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} className="no-print">
                  <div className="flex gap-1 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleOfficialPrint(t)} title="طباعة التقرير">
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)} title="تعديل">
                      <FileText className="h-4 w-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTraveler(t.id)} title="حذف">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls - Max 50 persons per page with page numbers below */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border rounded-xl p-3 sm:px-5 mt-4 shadow-xs">
          {/* Summary Indicator */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
            <span>
              عرض <strong className="text-foreground font-bold">{startIndex + 1}</strong> إلى{' '}
              <strong className="text-foreground font-bold">{endIndex}</strong> من إجمالي{' '}
              <strong className="text-foreground font-bold">{totalItems}</strong> مسافر
            </span>
            <span className="hidden md:inline-flex bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px] font-medium">
              50 شخص كحد أقصى لكل صفحة
            </span>
          </div>

          {/* Page Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center order-1 sm:order-2">
            <Button
              variant="outline"
              size="sm"
              disabled={activePage === 1}
              onClick={() => setCurrentPage(1)}
              className="h-8 px-2 text-xs gap-1"
              title="الصفحة الأولى"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">الأولى</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={activePage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="h-8 px-2.5 text-xs gap-1"
              title="الصفحة السابقة"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              <span>السابق</span>
            </Button>

            <div className="flex items-center gap-1">
              {getPageNumbers().map((pageItem, pIdx) => {
                if (pageItem === '...') {
                  return (
                    <span key={`dots-${pIdx}`} className="px-1 text-xs text-muted-foreground select-none">
                      ...
                    </span>
                  );
                }
                const pageNum = pageItem as number;
                const isActive = pageNum === activePage;
                return (
                  <Button
                    key={pageNum}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-8 w-8 p-0 text-xs font-bold transition-all ${
                      isActive ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-muted/80'
                    }`}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={activePage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="h-8 px-2.5 text-xs gap-1"
              title="الصفحة التالية"
            >
              <span>التالي</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={activePage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="h-8 px-2 text-xs gap-1"
              title="الصفحة الأخيرة"
            >
              <span className="hidden sm:inline">الأخيرة</span>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <DeleteConfirmation 
        isOpen={deleteConfirmOpen} 
        onClose={() => setDeleteConfirmOpen(false)} 
        onConfirm={confirmDelete} 
        title="حذف بيانات المسافر"
        description={`هل أنت متأكد من حذف بيانات المسافر "${travelers.find(t => t.id === travelerToDelete)?.firstName}"؟`}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">{editing ? 'تعديل بيانات المسافر' : 'إضافة مسافر جديد'}</DialogTitle>
            <DialogDescription className="text-right">
              أدخل البيانات الشخصية للمسافر، بما في ذلك الاسم ورقم الجواز والمحافظة والمعلومات المتعلقة بالسفر.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-6">
            {/* Form fields on the right */}
            <div className="flex-1 space-y-4">
              {watchlistMatch && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-center gap-3 text-red-800 animate-pulse">
                  <AlertCircle className="h-5 w-5" />
                  <p className="font-bold">تنبيه: هذا الاسم مطابق لبلاغ ضبط: {watchlistMatch}</p>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className="text-xs text-muted-foreground">الاسم الأول *</label><Input value={form.firstName} onChange={e => f('firstName', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">الاسم الثاني</label><Input value={form.secondName} onChange={e => f('secondName', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">الاسم الثالث</label><Input value={form.thirdName} onChange={e => f('thirdName', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">الاسم الرابع</label><Input value={form.fourthName} onChange={e => f('fourthName', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">اللقب</label><Input value={form.lastName} onChange={e => f('lastName', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">العمر</label><Input type="number" value={form.age} onChange={e => f('age', +e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">رقم الجواز/البطاقة *</label><Input value={form.idNumber} onChange={e => f('idNumber', e.target.value)} className="text-right" /></div>
              <div>
                <label className="text-xs text-muted-foreground">نوع الوثيقة</label>
                <Select value={form.idType} onValueChange={v => f('idType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ID_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">البلاد</label>
                <Select value={form.country} onValueChange={v => f('country', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">المحافظة</label>
                <Select value={form.governorate} onValueChange={v => f('governorate', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{YEMEN_GOVERNORATES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs text-muted-foreground">رقم الهاتف</label><Input value={form.phone} onChange={e => f('phone', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">المركز</label><Input value={form.center} onChange={e => f('center', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">الوكالة</label><Input value={form.agency} onChange={e => f('agency', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">الدولة المتجه إليها</label><Input value={form.destination} onChange={e => f('destination', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">سبب الزيارة / التأشيرة</label><Input value={form.visitReason} onChange={e => f('visitReason', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">تاريخ الخروج</label><Input value={form.receiveDate} onChange={e => f('receiveDate', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">الحالة</label><Input value={form.status} onChange={e => f('status', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">سبب الإرتجاع</label><Input value={form.returnReason} onChange={e => f('returnReason', e.target.value)} className="text-right" /></div>
              <div className="col-span-full"><label className="text-xs text-muted-foreground">نتائج المباينة الأمنية</label><Textarea value={form.vettingResult} onChange={e => f('vettingResult', e.target.value)} className="text-right" /></div>
              <div><label className="text-xs text-muted-foreground">الضابط المحقق</label><Input value={form.investigatingOfficer} onChange={e => f('investigatingOfficer', e.target.value)} className="text-right" /></div>
              <div>
                <label className="text-xs text-muted-foreground">السماح بالسفر</label>
                <Select value={form.travelAllowed} onValueChange={v => f('travelAllowed', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="نعم">نعم</SelectItem>
                    <SelectItem value="لا">لا</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Photo on the left */}
            <div className="flex-shrink-0 w-40">
              <label className="text-xs text-muted-foreground block mb-2 text-center">صورة المسافر (4×6)</label>
              <div
                className="border-2 border-dashed rounded-lg p-2 text-center cursor-pointer hover:bg-muted/50 h-52 flex items-center justify-center"
                onClick={() => fileRef.current?.click()}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="صورة" className="h-full w-full object-cover rounded" />
                ) : (
                  <p className="text-sm text-muted-foreground">اضغط لرفع صورة</p>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </div>
          </div>

          {/* Document attachments section */}
          <div className="border-t pt-4 mt-4">
            <label className="text-sm font-medium block mb-2">مرفقات إضافية (صور / PDF)</label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <input type="file" accept="image/*,.pdf" multiple className="hidden" id="doc-attach"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files) return;
                  Array.from(files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const url = ev.target?.result as string;
                      setForm(prev => ({ ...prev, documentsUrls: [...(prev.documentsUrls || []), url] }));
                    };
                    reader.readAsDataURL(file);
                  });
                  e.target.value = '';
                }}
              />
              <Button variant="outline" size="sm" onClick={() => document.getElementById('doc-attach')?.click()}>
                <Upload className="h-4 w-4 ml-2" />رفع مرفقات
              </Button>
            </div>
            {(form.documentsUrls || []).length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {(form.documentsUrls || []).map((doc, i) => (
                  <div key={i} className="relative border rounded p-1 group">
                    {doc.startsWith('data:image') ? (
                      <img src={doc} alt={`مرفق ${i + 1}`} className="w-full h-20 object-cover rounded" />
                    ) : (
                      <div className="w-full h-20 bg-muted flex items-center justify-center rounded text-xs text-muted-foreground">PDF</div>
                    )}
                    <Button variant="destructive" size="sm"
                      className="absolute top-0 left-0 h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                      onClick={() => setForm(prev => ({ ...prev, documentsUrls: (prev.documentsUrls || []).filter((_, idx) => idx !== i) }))}
                    ><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-start mt-6 border-t pt-4">
            <Button onClick={save} className="gap-2">
              <Save className="h-4 w-4" /> حفظ البيانات
            </Button>
            {editing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> تصدير
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent dir="rtl">
                  <DropdownMenuItem onClick={() => printTraveler(editing)}>
                    <Printer className="h-4 w-4 ml-2" /> طباعة
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToWord(`بيانات المسافر: ${editing.firstName}`, editing, `مسافر_${editing.idNumber}`)}>
                    <FileText className="h-4 w-4 ml-2 text-blue-600" /> Word
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToPDF(`traveler-card-${editing.id}`, `مسافر_${editing.idNumber}`)}>
                    <FileText className="h-4 w-4 ml-2 text-red-600" /> PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToImage(`traveler-card-${editing.id}`, `مسافر_${editing.idNumber}`)}>
                    <ImageIcon className="h-4 w-4 ml-2 text-purple-600" /> صورة
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* View Details Dialog */}
      <Dialog open={!!viewingTraveler} onOpenChange={(open) => {
        if (!open) navigate('/');
      }}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-right flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-slate-800">تفاصيل المسافر</span>
              <div className="flex gap-2 flex-wrap items-center">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleOfficialPrint(viewingTraveler)}
                  className="h-8 bg-primary hover:bg-primary/90 text-white font-bold gap-1.5 shadow-sm px-3"
                >
                  <Printer className="h-4 w-4 ml-1" />
                  <span>طباعة التقرير</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <Download className="h-4 w-4 ml-1" /> تصدير
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent dir="rtl">
                    <DropdownMenuItem onClick={() => exportToImage('traveler-view-content', `مسافر_${viewingTraveler.idNumber}`)}>
                      <ImageIcon className="h-4 w-4 ml-2 text-purple-600" /> صورة PNG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportToPDF('traveler-view-content', `مسافر_${viewingTraveler.idNumber}`)}>
                      <FileText className="h-4 w-4 ml-2 text-red-600" /> ملف PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={() => openEditFromView(viewingTraveler)} className="h-8 text-primary border-primary/20 hover:bg-primary/5">
                  <FileText className="h-4 w-4 ml-1" /> تعديل
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setViewingTraveler(null); navigate('/'); deleteTraveler(viewingTraveler.id); }} className="h-8 text-destructive border-destructive/20 hover:bg-destructive/5">
                  <Trash2 className="h-4 w-4" /> حذف
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription className="text-right">
              عرض البيانات الكاملة للمسافر وسجل البلاغات المرتبطة والمرفقات.
            </DialogDescription>
          </DialogHeader>
          <div id="traveler-view-content" className="bg-white p-6 rounded-lg">
            {viewingTraveler && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 py-4">
              <div className="md:col-span-1 flex flex-col items-center gap-4">
                {viewingTraveler.photoUrl ? (
                  <img src={viewingTraveler.photoUrl} alt="صورة" className="w-full aspect-[3/4] object-cover rounded-lg border-2 border-primary/20" />
                ) : (
                  <div className="w-full aspect-[3/4] bg-muted flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 text-muted-foreground text-xs text-center">لا توجد صورة</div>
                )}
                <div className={`w-full py-2 rounded text-center font-bold ${viewingTraveler.travelAllowed === 'نعم' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {viewingTraveler.travelAllowed === 'نعم' ? 'مسموح بالسفر' : 'ممنوع من السفر'}
                </div>
                <div className="w-full">
                  <QRCodeCanvas value={`TRAVELER:${viewingTraveler.idNumber}:${viewingTraveler.firstName} ${viewingTraveler.lastName}`} size={120} className="mx-auto" />
                </div>
              </div>
              <div className="md:col-span-3 grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div className="col-span-2 border-b pb-1 font-bold text-primary">البيانات الشخصية</div>
                <div><span className="text-muted-foreground block text-xs">الاسم الكامل</span> {viewingTraveler.firstName} {viewingTraveler.secondName} {viewingTraveler.thirdName} {viewingTraveler.fourthName} {viewingTraveler.lastName}</div>
                <div><span className="text-muted-foreground block text-xs">رقم الوثيقة ({viewingTraveler.idType})</span> {viewingTraveler.idNumber}</div>
                <div><span className="text-muted-foreground block text-xs">العمر</span> {viewingTraveler.age || '-'}</div>
                <div><span className="text-muted-foreground block text-xs">المحل / المحافظة</span> {viewingTraveler.country} - {viewingTraveler.governorate}</div>
                <div><span className="text-muted-foreground block text-xs">رقم الهاتف</span> {viewingTraveler.phone || '-'}</div>
                
                <div className="col-span-2 border-b pb-1 font-bold text-primary mt-2">بيانات السفر</div>
                <div><span className="text-muted-foreground block text-xs">الوجهة</span> {viewingTraveler.destination || '-'}</div>
                <div><span className="text-muted-foreground block text-xs">الوكالة / المركز</span> {viewingTraveler.agency} / {viewingTraveler.center}</div>
                <div><span className="text-muted-foreground block text-xs">تاريخ الاستلام</span> {viewingTraveler.receiveDate || '-'}</div>
                <div><span className="text-muted-foreground block text-xs">الحالة</span> {viewingTraveler.status || '-'}</div>
                <div className="col-span-2"><span className="text-muted-foreground block text-xs">سبب الزيارة / التأشيرة</span> {viewingTraveler.visitReason || '-'}</div>
                {viewingTraveler.returnReason && <div className="col-span-2 text-red-600"><span className="text-muted-foreground block text-xs">سبب الارتجاع</span> {viewingTraveler.returnReason}</div>}
                
                <div className="col-span-2 border-b pb-1 font-bold text-primary mt-2">المباينة الأمنية</div>
                <div className="col-span-2 bg-muted/50 p-2 rounded text-xs">{viewingTraveler.vettingResult || 'لا توجد نتائج مباينة مسجلة'}</div>
                
                <div className="col-span-2 border-b pb-1 font-bold text-primary mt-4 flex items-center justify-between">
                  <span>البلاغات المرتبطة</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="xs" onClick={() => setLinkDialogOpen(true)} className="h-7 text-[10px]">
                      <LinkIcon className="h-3 w-3 ml-1" /> ربط بلاغ موجود
                    </Button>
                    <Button variant="outline" size="xs" onClick={() => setNewReportDialogOpen(true)} className="h-7 text-[10px]">
                      <Plus className="h-3 w-3 ml-1" /> بلاغ جديد
                    </Button>
                  </div>
                </div>
                <div className="col-span-2 space-y-2">
                  {(viewingTraveler.linkedReportIds || []).length > 0 ? (
                    getReports().filter(r => viewingTraveler.linkedReportIds?.includes(r.id)).map(r => (
                      <div key={r.id} className="flex items-center justify-between p-2 bg-muted/30 rounded border text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3 w-3 text-primary" />
                          <span className="font-bold">{r.title}</span>
                          <span className="text-muted-foreground">({r.type})</span>
                        </div>
                        <Button variant="ghost" size="xs" className="h-6 w-6 p-0 text-destructive" onClick={() => {
                          const updated = travelers.map(t => t.id === viewingTraveler.id ? { ...t, linkedReportIds: t.linkedReportIds?.filter(id => id !== r.id) } : t);
                          saveTravelers(updated);
                          setTravelers(updated);
                          setViewingTraveler(updated.find(t => t.id === viewingTraveler.id) || null);
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-xs italic">لا توجد بلاغات مرتبطة</div>
                  )}
                </div>

                {viewingTraveler.documentsUrls && viewingTraveler.documentsUrls.length > 0 && (
                  <div className="col-span-2 mt-2">
                    <span className="text-muted-foreground block text-xs mb-2">المرفقات ({viewingTraveler.documentsUrls.length})</span>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {viewingTraveler.documentsUrls.map((doc, i) => (
                        <div key={i} className="flex-shrink-0 w-20 h-20 border rounded overflow-hidden bg-muted">
                          {doc.startsWith('data:image') ? (
                            <img src={doc} alt="مرفق" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px]">PDF</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setViewingTraveler(null)}>إغلاق</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Existing Report Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">ربط بلاغ موجود</DialogTitle>
            <DialogDescription className="text-right">
              اختر أحد البلاغات المسجلة في النظام لربطها بملف هذا المسافر.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto p-1">
            {getReports().filter(r => !viewingTraveler?.linkedReportIds?.includes(r.id)).length > 0 ? (
              getReports().filter(r => !viewingTraveler?.linkedReportIds?.includes(r.id)).map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 cursor-pointer" onClick={() => linkReport(r.id)}>
                  <div>
                    <div className="font-bold">{r.title}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[300px]">{r.description}</div>
                  </div>
                  <Button size="sm">ربط</Button>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-muted-foreground">لا توجد بلاغات إضافية للربط</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create New Report Dialog */}
      <Dialog open={newReportDialogOpen} onOpenChange={setNewReportDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">إنشاء بلاغ جديد وربطه</DialogTitle>
            <DialogDescription className="text-right">
              قم بإنشاء بلاغ جديد وسيتم ربطه تلقائياً بملف هذا المسافر بعد الحفظ.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm">عنوان البلاغ</label><Input value={newReportForm.title} onChange={e => setNewReportForm({...newReportForm, title: e.target.value})} /></div>
            <div><label className="text-sm">التصنيف</label><Input value={newReportForm.type} onChange={e => setNewReportForm({...newReportForm, type: e.target.value})} /></div>
            <div><label className="text-sm">الوصف</label><Textarea value={newReportForm.description} onChange={e => setNewReportForm({...newReportForm, description: e.target.value})} rows={4} /></div>
            <div className="flex gap-2">
              <Button onClick={createAndLinkReport}>إنشاء وربط</Button>
              <Button variant="outline" onClick={() => setNewReportDialogOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Google Workspace Portal */}
      <GoogleWorkspacePortal
        isOpen={googlePortalOpen}
        onClose={() => setGooglePortalOpen(false)}
        travelers={travelers}
        onImportComplete={(updated) => {
          saveTravelers(updated);
          setTravelers(updated);
        }}
      />

      {/* Official Printable Border Clearance Report (Triggered by window.print()) */}
      <OfficialPrintReport traveler={printableTraveler || viewingTraveler} />

      {/* Camera-Based Passport & ID Scanner */}
      <CameraScanner
        isOpen={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onScanComplete={handleCameraScanComplete}
      />

      {/* Local Excel & PDF Document Processor & Matcher */}
      <DocumentProcessorModal
        open={docProcessorOpen}
        onOpenChange={setDocProcessorOpen}
        currentTravelers={travelers}
        onDataUpdated={(updated) => {
          saveTravelers(updated);
          setTravelers(updated);
        }}
      />
    </div>
  );
};

export default Travelers;
