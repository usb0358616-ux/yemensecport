import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Cloud, 
  FileSpreadsheet, 
  FormInput, 
  LogIn, 
  LogOut, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  ExternalLink, 
  User, 
  Sparkles,
  ArrowRight,
  Info,
  Plus
} from 'lucide-react';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  exportToGoogleSheet, 
  importFromGoogleSheet, 
  createRegistrationForm, 
  getFormResponses 
} from '@/services/googleService';
import { Traveler } from '@/lib/types';
import { generateId } from '@/lib/storage';

interface GoogleWorkspacePortalProps {
  isOpen: boolean;
  onClose: () => void;
  travelers: Traveler[];
  onImportComplete: (updated: Traveler[]) => void;
}

export const GoogleWorkspacePortal = ({ 
  isOpen, 
  onClose, 
  travelers, 
  onImportComplete 
}: GoogleWorkspacePortalProps) => {
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'sheets' | 'forms'>('sheets');
  
  // Sheet states
  const [sheetUrlOrId, setSheetUrlOrId] = useState('');
  const [exportedSheetUrl, setExportedSheetUrl] = useState<string | null>(null);
  
  // Form states
  const [formId, setFormId] = useState(localStorage.getItem('gform_id') || '');
  const [formResponderUri, setFormResponderUri] = useState(localStorage.getItem('gform_responder_uri') || '');
  const [formEditUri, setFormEditUri] = useState(localStorage.getItem('gform_edit_uri') || '');
  
  // Preview / Ingestion states
  const [previewRecords, setPreviewRecords] = useState<Partial<Traveler>[]>([]);
  const [previewType, setPreviewType] = useState<'sheet' | 'form' | null>(null);

  const { toast } = useToast();

  // Initialize Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        toast({
          title: 'تم تسجيل الدخول بنجاح',
          description: `مرحباً بك ${result.user.displayName || 'مستخدم Google'}`
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'فشل تسجيل الدخول',
        description: 'حدث خطأ أثناء الاتصال بحساب Google. يرجى المحاولة مرة أخرى.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await logout();
      setGoogleUser(null);
      setAccessToken(null);
      setPreviewRecords([]);
      setPreviewType(null);
      toast({
        title: 'تم تسجيل الخروج',
        description: 'تم قطع الاتصال بحساب Google وتصفية الجلسة.'
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to extract Spreadsheet ID
  const extractSpreadsheetId = (input: string): string => {
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : input.trim();
  };

  // Helper to extract Form ID
  const extractFormId = (input: string): string => {
    const match = input.match(/\/forms\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : input.trim();
  };

  // Export to Sheets Action
  const handleExportToSheet = async () => {
    if (travelers.length === 0) {
      toast({
        title: 'لا توجد بيانات',
        description: 'قائمة المسافرين فارغة حالياً.',
        variant: 'destructive'
      });
      return;
    }

    const confirmExport = window.confirm(
      `هل أنت متأكد من تصدير قائمة المسافرين الحالية (${travelers.length} مسافر) إلى جدول بيانات Google جديد؟`
    );
    if (!confirmExport) return;

    setIsLoading(true);
    setExportedSheetUrl(null);
    try {
      const dateStr = new Date().toLocaleDateString('ar-YE');
      const title = `كشف المسافرين - نظام المنافذ الذكي (${dateStr})`;
      const url = await exportToGoogleSheet(title, travelers);
      setExportedSheetUrl(url);
      toast({
        title: 'تم التصدير بنجاح',
        description: 'تم إنشاء الجدول ورفع كشف المسافرين إليه.'
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'فشل التصدير',
        description: err.message || 'تعذر تصدير البيانات إلى Google Sheets.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Import from Sheets Action
  const handleImportFromSheet = async () => {
    if (!sheetUrlOrId) {
      toast({
        title: 'تنبيه',
        description: 'يرجى إدخال معرّف أو رابط جدول البيانات أولاً',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    setPreviewRecords([]);
    setPreviewType(null);
    try {
      const id = extractSpreadsheetId(sheetUrlOrId);
      const records = await importFromGoogleSheet(id);
      setPreviewRecords(records);
      setPreviewType('sheet');
      toast({
        title: 'تمت قراءة البيانات بنجاح',
        description: `تم العثور على ${records.length} سجل جاهز للاستيراد. يرجى مراجعة الجدول بالأسفل والتأكيد.`
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'فشل استيراد البيانات',
        description: err.message || 'تعذر الاتصال بالجدول أو قراءة البيانات منه.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create Google Form Action
  const handleCreateForm = async () => {
    const confirmCreate = window.confirm(
      'سيقوم النظام بإنشاء استمارة تسجيل مسبق مخصصة في حساب Google الخاص بك مع حقول الاسم، رقم الجواز، الجنسية، الهاتف، وغيرها. هل ترغب في الاستمرار؟'
    );
    if (!confirmCreate) return;

    setIsLoading(true);
    try {
      const dateStr = new Date().toLocaleDateString('ar-YE');
      const title = `استمارة التسجيل المسبق للمسافرين (${dateStr})`;
      const formInfo = await createRegistrationForm(title);
      
      setFormId(formInfo.formId);
      setFormResponderUri(formInfo.responderUri);
      setFormEditUri(formInfo.editUri);

      localStorage.setItem('gform_id', formInfo.formId);
      localStorage.setItem('gform_responder_uri', formInfo.responderUri);
      localStorage.setItem('gform_edit_uri', formInfo.editUri);

      toast({
        title: 'تم إنشاء الاستمارة بنجاح',
        description: 'تم تصميم استمارة التسجيل وحفظ الروابط بنجاح.'
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'فشل إنشاء الاستمارة',
        description: err.message || 'حدث خطأ غير متوقع أثناء تصميم الاستمارة.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Ingest Google Form Responses Action
  const handleFetchFormResponses = async () => {
    if (!formId) {
      toast({
        title: 'تنبيه',
        description: 'يرجى إدخال معرّف أو رابط الاستمارة أولاً',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    setPreviewRecords([]);
    setPreviewType(null);
    try {
      const cleanId = extractFormId(formId);
      const records = await getFormResponses(cleanId);
      setPreviewRecords(records);
      setPreviewType('form');
      toast({
        title: 'تم جلب الطلبات بنجاح',
        description: `تم العثور على ${records.length} استجابة جديدة في الاستمارة.`
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'فشل جلب الاستجابات',
        description: err.message || 'تعذر قراءة الردود من الاستمارة. تأكد من صحة المعرّف وصلاحية الوصول.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm and merge imported records to storage
  const handleConfirmImport = () => {
    if (previewRecords.length === 0) return;

    let newCount = 0;
    let updatedCount = 0;
    const now = new Date().toISOString();

    const updatedTravelersList = [...travelers];

    previewRecords.forEach(imported => {
      // Look for duplicate using ID number
      const existingIdx = updatedTravelersList.findIndex(t => 
        imported.idNumber && t.idNumber && t.idNumber.trim().toLowerCase() === imported.idNumber.trim().toLowerCase()
      );

      if (existingIdx > -1) {
        // Merge and update existing traveler
        updatedTravelersList[existingIdx] = {
          ...updatedTravelersList[existingIdx],
          ...imported,
          updatedAt: now
        } as Traveler;
        updatedCount++;
      } else {
        // Create new traveler
        updatedTravelersList.push({
          ...imported,
          id: generateId(),
          createdAt: imported.createdAt || now,
          updatedAt: now,
          center: imported.center || 'بوابة Google Workspace',
          agency: imported.agency || 'تسجيل رقمي'
        } as Traveler);
        newCount++;
      }
    });

    onImportComplete(updatedTravelersList);
    setPreviewRecords([]);
    setPreviewType(null);
    
    toast({
      title: 'اكتملت عملية الاستيراد بنجاح',
      description: `تمت إضافة ${newCount} مسافر جديد وتحديث بيانات ${updatedCount} مسافر موجود مسبقاً.`
    });
    
    onClose();
  };

  // Helper to copy text to clipboard
  const copyToClipboard = (text: string, title: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'تم النسخ',
      description: `تم نسخ رابط ${title} إلى الحافظة.`
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right">
          <div className="flex items-center gap-2 text-primary">
            <div className="bg-primary/10 p-2 rounded-xl">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl">بوابة Google Workspace الذكية</DialogTitle>
              <DialogDescription>
                مزامنة وتصدير الكشوفات واستيراد طلبات التسجيل المسبق من نماذج Google وجداول البيانات.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Authentication State Card */}
        <div className="border rounded-2xl p-4 bg-muted/20 flex flex-wrap items-center justify-between gap-4 mt-2">
          {googleUser ? (
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-primary/10 border flex items-center justify-center text-primary overflow-hidden">
                {googleUser.photoURL ? (
                  <img src={googleUser.photoURL} alt={googleUser.displayName || 'Google User'} referrerPolicy="no-referrer" />
                ) : (
                  <User className="h-5 w-5" />
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{googleUser.displayName || 'مستخدم متصل'}</p>
                <p className="text-xs text-muted-foreground">{googleUser.email}</p>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-green-600 font-bold">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>متصل بحساب Google ومصرح بالعمل</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-yellow-50 border border-yellow-200 flex items-center justify-center text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">غير متصل بحساب Google</p>
                <p className="text-xs text-muted-foreground">تحتاج إلى الاتصال بحساب Google لتفعيل ميزات السحب والتصدير.</p>
              </div>
            </div>
          )}

          <div>
            {googleUser ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSignOut} 
                disabled={isLoading}
                className="gap-2 border-destructive/30 hover:bg-destructive/10 text-destructive"
              >
                <LogOut className="h-4 w-4" />
                <span>فصل الاتصال</span>
              </Button>
            ) : (
              <Button 
                onClick={handleSignIn} 
                disabled={isLoading}
                className="gap-2 bg-[#4285F4] text-white hover:bg-[#357AE8]"
              >
                <LogIn className="h-4 w-4" />
                <span>ربط حساب Google</span>
              </Button>
            )}
          </div>
        </div>

        {googleUser && (
          <div className="mt-4 space-y-4">
            {/* Tab switchers */}
            <div className="flex border-b">
              <button 
                onClick={() => { setActiveTab('sheets'); setPreviewRecords([]); }}
                className={`py-2 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'sheets' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>جداول Google Sheets</span>
              </button>
              <button 
                onClick={() => { setActiveTab('forms'); setPreviewRecords([]); }}
                className={`py-2 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'forms' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <FormInput className="h-4 w-4" />
                <span>نماذج Google Forms</span>
              </button>
            </div>

            {/* SHEETS TAB CONTENT */}
            {activeTab === 'sheets' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Export section */}
                  <div className="border rounded-xl p-4 bg-card shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-bold mb-2 text-primary">
                        <FileSpreadsheet className="h-5 w-5" />
                        <h3>تصدير الكشوفات المباشرة</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                        قم بتصدير جميع بيانات المسافرين الحالية مباشرة إلى كشف Google Sheets سحابي جديد على حسابك. ستتم تهيئة الأعمدة والترتيب تلقائياً لتسهيل عرضها ومشاركتها مع الجهات المختصة.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Button 
                        onClick={handleExportToSheet} 
                        disabled={isLoading}
                        className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>تصدير المسافرين الحركيين ({travelers.length})</span>
                      </Button>
                      
                      {exportedSheetUrl && (
                        <div className="bg-green-50 border border-green-200 p-2.5 rounded-lg flex items-center justify-between text-green-800 text-xs animate-in zoom-in-95">
                          <span className="font-medium truncate max-w-[200px]">كشف المسافرين جاهز للمعاينة</span>
                          <div className="flex gap-1.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-700 hover:bg-green-100" onClick={() => copyToClipboard(exportedSheetUrl, 'رابط الجدول')}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <a href={exportedSheetUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-green-100 text-green-700 transition-colors">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Import section */}
                  <div className="border rounded-xl p-4 bg-card shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-bold mb-2 text-blue-600">
                        <Cloud className="h-5 w-5" />
                        <h3>استيراد كشوفات المسافرين</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                        يمكنك استيراد المسافرين مباشرة من أي جدول Google Sheets خارجي. الصق رابط الجدول أو معرّفه بالأسفل، وسيتولى النظام قراءته ومطابقته آلياً مع كشوفات الجوازات المحلية.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">رابط أو معرّف جدول البيانات</label>
                        <Input 
                          placeholder="الصق الرابط هنا (https://docs.google.com/spreadsheets/...)" 
                          value={sheetUrlOrId} 
                          onChange={e => setSheetUrlOrId(e.target.value)} 
                          className="text-right text-xs"
                        />
                      </div>
                      <Button 
                        onClick={handleImportFromSheet} 
                        disabled={isLoading}
                        variant="secondary"
                        className="w-full gap-2 border"
                      >
                        {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span>قراءة وتحليل السجلات</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FORMS TAB CONTENT */}
            {activeTab === 'forms' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Create Form Section */}
                  <div className="border rounded-xl p-4 bg-card shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-bold mb-2 text-purple-600">
                        <Sparkles className="h-5 w-5" />
                        <h3>استمارة التسجيل المسبق للمسافرين</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                        أنشئ نموذجاً مخصصاً على نماذج Google لتوزيعه على المسافرين عبر الإنترنت قبل وصولهم للمنفذ. يملأ المسافر بياناته وهويته، ثم يقوم النظام بسحبها وفحصها أمنياً بضغطة زر واحدة.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Button 
                        onClick={handleCreateForm} 
                        disabled={isLoading}
                        className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Plus className="h-4 w-4" />
                        <span>إنشاء استمارة تسجيل ذكية جديدة</span>
                      </Button>

                      {formId && (
                        <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-xs space-y-2 animate-in zoom-in-95">
                          <p className="font-bold text-purple-800 border-b pb-1 text-[11px] flex items-center gap-1">
                            <Info className="h-3.5 w-3.5" /> استمارة التسجيل الحالية نشطة
                          </p>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">رابط توزيع المسافرين:</span>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-purple-700" onClick={() => copyToClipboard(formResponderUri, 'استمارة المسافرين')}>
                                <Copy className="h-3 w-3" />
                              </Button>
                              <a href={formResponderUri} target="_blank" rel="noreferrer" className="flex items-center justify-center h-6 w-6 rounded hover:bg-purple-100 text-purple-700">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">رابط تحرير التنسيق والأسئلة:</span>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-purple-700" onClick={() => copyToClipboard(formEditUri, 'تعديل الاستمارة')}>
                                <Copy className="h-3 w-3" />
                              </Button>
                              <a href={formEditUri} target="_blank" rel="noreferrer" className="flex items-center justify-center h-6 w-6 rounded hover:bg-purple-100 text-purple-700">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sync Responses Section */}
                  <div className="border rounded-xl p-4 bg-card shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-bold mb-2 text-primary">
                        <FormInput className="h-5 w-5" />
                        <h3>مزامنة استجابات الطلبات المسبقة</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                        اسحب استجابات المسافرين المسجلة في استمارة التسجيل المسبق. سيتم مراجعة الطلبات والبيانات تلقائياً وإدخالها كمسافرين غير مدققين جاهزين لإجراء فحص المطابقة والتحقق الأمني.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">رقم أو معرّف نموذج Google Forms</label>
                        <Input 
                          placeholder="معرّف الاستمارة النشطة" 
                          value={formId} 
                          onChange={e => { setFormId(e.target.value); localStorage.setItem('gform_id', e.target.value); }} 
                          className="text-right text-xs"
                        />
                      </div>
                      <Button 
                        onClick={handleFetchFormResponses} 
                        disabled={isLoading}
                        variant="secondary"
                        className="w-full gap-2 border"
                      >
                        {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span>سحب وتدقيق طلبات المسافرين المسبقة</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PREVIEW IMPORTED RECORDS BLOCK */}
            {previewRecords.length > 0 && (
              <div className="border rounded-2xl p-4 bg-card space-y-3 animate-in slide-in-from-bottom-3 duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <Sparkles className="h-5 w-5 animate-pulse text-yellow-500" />
                    <h3>معاينة السجلات الجاهزة للاستيراد ({previewRecords.length} سجل)</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setPreviewRecords([])} size="sm">إلغاء</Button>
                    <Button onClick={handleConfirmImport} className="gap-1 bg-gradient-to-l from-primary to-primary-foreground text-white font-bold" size="sm">
                      <span>تأكيد دمج واستيراد البيانات</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[250px] border rounded-lg">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-muted border-b text-muted-foreground">
                        <th className="p-2 border-l">اسم المسافر</th>
                        <th className="p-2 border-l">رقم الوثيقة</th>
                        <th className="p-2 border-l">نوع الوثيقة</th>
                        <th className="p-2 border-l">العمر</th>
                        <th className="p-2 border-l">الجنسية</th>
                        <th className="p-2 border-l">الوجهة</th>
                        <th className="p-2">حالة المطابقة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRecords.map((rec, idx) => {
                        // Check if already exists by checking traveler idNumber match
                        const exists = travelers.some(t => 
                          rec.idNumber && t.idNumber && t.idNumber.trim().toLowerCase() === rec.idNumber.trim().toLowerCase()
                        );
                        return (
                          <tr key={idx} className="border-b hover:bg-muted/30">
                            <td className="p-2 border-l font-bold">{rec.firstName} {rec.secondName} {rec.lastName}</td>
                            <td className="p-2 border-l font-mono">{rec.idNumber || '-'}</td>
                            <td className="p-2 border-l">{rec.idType || '-'}</td>
                            <td className="p-2 border-l">{rec.age || '-'}</td>
                            <td className="p-2 border-l">{rec.country || '-'}</td>
                            <td className="p-2 border-l">{rec.destination || '-'}</td>
                            <td className="p-2">
                              {exists ? (
                                <span className="px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 font-bold border border-yellow-200">
                                  موجود (سيتم تحديثه)
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-bold border border-green-200">
                                  جديد كلياً
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t">
          <Button variant="outline" onClick={onClose}>إغلاق البوابة</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
