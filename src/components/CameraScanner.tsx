import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Traveler } from '@/lib/types';
import {
  Camera,
  SwitchCamera,
  Zap,
  ZapOff,
  Check,
  RefreshCw,
  AlertCircle,
  FileText,
  ShieldCheck,
  Upload,
  ScanLine,
  Sparkles,
  FileUp,
} from 'lucide-react';
import { runTesseractOcr, preprocessImageForOcr, OcrProgressUpdate } from '@/services/tesseractOcrService';
import { scanPassport } from '@/services/geminiService';

interface CameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (extractedData: Partial<Traveler>, photoDataUrl: string) => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ isOpen, onClose, onScanComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<Partial<Traveler> | null>(null);
  const [ocrProgress, setOcrProgress] = useState<OcrProgressUpdate>({
    status: '',
    percent: 0,
  });
  const [ocrEngineUsed, setOcrEngineUsed] = useState<string>('Tesseract.js OCR');

  // Start Camera Stream
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setCameraError(null);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }

      // Check Torch support
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities ? (videoTrack.getCapabilities() as any) : null;
        setHasTorch(Boolean(capabilities?.torch));
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let errorMsg = 'تعذر تشغيل الكاميرا. يرجى التأكد من منح الإذن لاستخدام الكاميرا.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'تم رفض الإذن بالوصول للكاميرا من قبل المتصفح أو الجهاز.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'لم يتم العثور على كاميرا متصلة بالجهاز.';
      }
      setCameraError(errorMsg);
    }
  }, [stream]);

  // Stop camera tracks
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setExtractedData(null);
      setOcrProgress({ status: '', percent: 0 });
      startCamera(cameraFacing);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, cameraFacing]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const newTorchState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: newTorchState }],
        });
        setTorchOn(newTorchState);
      } catch (e) {
        console.error('Torch toggle failed', e);
      }
    }
  };

  // Switch between front and back cameras
  const switchCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
  };

  // Core processing function using Tesseract.js with AI / offline fallback
  const processDocumentImage = async (imageDataUrl: string) => {
    setCapturedImage(imageDataUrl);
    setIsProcessing(true);
    setOcrProgress({ status: 'جاري تشغيل محرك Tesseract.js للتعرف الضوئي...', percent: 15 });

    try {
      // 1. Run local Tesseract.js OCR
      const ocrResult = await runTesseractOcr(imageDataUrl, progress => {
        setOcrProgress(progress);
      });

      let finalData = ocrResult.traveler;
      setOcrEngineUsed(ocrResult.engine === 'tesseract' ? 'Tesseract.js OCR' : 'قارئ الأكواد ICAO 9303');

      // 2. If online and online AI is active and missing fields, attempt quick refinement
      if (window.navigator.onLine && (!finalData.firstName || !finalData.idNumber)) {
        try {
          const aiData = await scanPassport(imageDataUrl, 'image/jpeg');
          if (aiData && (aiData.firstName || aiData.idNumber)) {
            finalData = { ...finalData, ...aiData };
            setOcrEngineUsed('Tesseract.js + AI Grounding');
          }
        } catch (aiErr) {
          console.warn('Gemini online refine skipped/offline:', aiErr);
        }
      }

      setExtractedData(finalData);
      setOcrProgress({ status: 'تم استخراج بيانات المسافر بنجاح!', percent: 100 });
    } catch (err: any) {
      console.error('OCR processing error:', err);
      setOcrProgress({ status: 'تم التقاط الصورة، يرجى مراجعة البيانات أدناه.', percent: 100 });
      setExtractedData({
        idType: 'جواز',
        country: 'اليمن',
        travelAllowed: 'نعم',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Capture Frame and Process
  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    
    // Stop camera video track when image is captured to save battery/resources
    stopCamera();

    await processDocumentImage(photoDataUrl);
  };

  // File upload fallback (for desktop or uploading saved passport photos)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        stopCamera();
        await processDocumentImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  // Confirm and apply data
  const handleApply = () => {
    if (capturedImage && extractedData) {
      onScanComplete(extractedData, capturedImage);
      onClose();
    }
  };

  // Retake
  const handleRetake = () => {
    setCapturedImage(null);
    setExtractedData(null);
    setOcrProgress({ status: '', percent: 0 });
    startCamera(cameraFacing);
  };

  const fullName = [
    extractedData?.firstName,
    extractedData?.secondName,
    extractedData?.thirdName,
    extractedData?.lastName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-[96vw] max-h-[92vh] p-4 sm:p-6 overflow-y-auto" dir="rtl">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 text-primary">
              <Camera className="h-5 w-5 text-accent" />
              <span>ماسح الجوازات والبطاقات (Tesseract.js OCR)</span>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            وجّه كاميرا الجهاز نحو جواز السفر أو بطاقة الهوية، أو ارفع صورة من القرص المحلي لقراءة (الاسم، رقم الجواز، الجنسية) بدون إنترنت.
          </DialogDescription>
        </DialogHeader>

        {cameraError && !capturedImage ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 my-3 text-center">
            <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
            <h4 className="font-bold text-amber-900 mb-1">تعذر تشغيل الكاميرا</h4>
            <p className="text-xs text-amber-700 mb-4">{cameraError}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button onClick={() => startCamera(cameraFacing)} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 ml-1" /> إعادة المحاولة
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-primary hover:bg-primary/90 text-white"
                size="sm"
              >
                <Upload className="h-4 w-4 ml-1" /> رفع صورة جواز من الجهاز
              </Button>
              <Button onClick={onClose} variant="secondary" size="sm">إلغاء</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 my-2">
            {/* Viewfinder Container */}
            <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-black rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl flex items-center justify-center">
              {!capturedImage ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-cover"
                  />

                  {/* Passport / ID Card Targeting Frame */}
                  <div className="absolute inset-4 sm:inset-8 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex flex-col justify-between p-3 box-border">
                    {/* Corner brackets */}
                    <div className="flex justify-between">
                      <div className="w-6 h-6 border-t-4 border-r-4 border-accent -mt-1 -mr-1"></div>
                      <div className="w-6 h-6 border-t-4 border-l-4 border-accent -mt-1 -ml-1"></div>
                    </div>

                    {/* Animated Scanning Laser Line */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#22d3ee] animate-bounce my-auto"></div>

                    {/* Bottom MRZ Area Guide */}
                    <div className="bg-black/50 backdrop-blur-xs border border-white/30 rounded p-1 text-center">
                      <p className="text-[10px] sm:text-xs text-white/95 font-mono tracking-wider flex items-center justify-center gap-1.5">
                        <ScanLine className="h-3 w-3 text-cyan-400" />
                        <span>منطقة الكود الآلي (MRZ) أو رقم وثيقة الجواز</span>
                      </p>
                    </div>

                    <div className="flex justify-between">
                      <div className="w-6 h-6 border-b-4 border-r-4 border-accent -mb-1 -mr-1"></div>
                      <div className="w-6 h-6 border-b-4 border-l-4 border-accent -mb-1 -ml-1"></div>
                    </div>
                  </div>

                  {/* Top Camera Controls Overlay */}
                  <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-10">
                    <span className="bg-black/70 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      كاميرا حية ({cameraFacing === 'environment' ? 'الخلفية' : 'الأمامية'})
                    </span>

                    <div className="flex gap-2">
                      {hasTorch && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          className={`p-2 rounded-full backdrop-blur-md transition-all ${
                            torchOn ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/50' : 'bg-black/60 text-white hover:bg-black/80'
                          }`}
                          title="الفلاش"
                        >
                          {torchOn ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={switchCameraFacing}
                        className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-md transition-all"
                        title="تبديل الكاميرا"
                      >
                        <SwitchCamera className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Captured Frame Preview */
                <div className="relative w-full h-full">
                  <img
                    src={capturedImage}
                    alt="صورة الوثيقة الممسوحة"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2 bg-black/75 text-white text-[11px] px-3 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5 border border-white/20">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
                    <span>تمت المعالجة عبر: {ocrEngineUsed}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden Canvas and File Input */}
            <canvas ref={canvasRef} className="hidden" />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Extracted Data Preview Card */}
            {capturedImage && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>البيانات المستخرجة بمحرك Tesseract.js:</span>
                  </h4>
                  <span className="text-[11px] text-primary font-medium">{ocrProgress.status}</span>
                </div>

                {/* Progress bar when processing */}
                {isProcessing ? (
                  <div className="py-6 px-4 text-center space-y-3">
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress.percent || 20}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      <span>{ocrProgress.status || 'جاري المعالجة الضوئية...'}</span>
                      <span className="font-mono font-bold text-slate-700">({ocrProgress.percent}%)</span>
                    </div>
                  </div>
                ) : extractedData ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-muted-foreground block text-[10px] font-semibold mb-0.5">الاسم الكامل:</span>
                      <span className="font-bold text-slate-800 truncate block">
                        {fullName || 'مسافر مجهول (يمكن كتابته يدويًا)'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-muted-foreground block text-[10px] font-semibold mb-0.5">رقم الجواز / الهوية:</span>
                      <span className="font-bold font-mono text-primary text-sm truncate block">
                        {extractedData.idNumber || '-'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-muted-foreground block text-[10px] font-semibold mb-0.5">الجنسية:</span>
                      <span className="font-bold text-slate-800">{extractedData.country || 'اليمن'}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-muted-foreground block text-[10px] font-semibold mb-0.5">نوع الوثيقة:</span>
                      <span className="font-bold text-slate-800">{extractedData.idType || 'جواز'}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-muted-foreground block text-[10px] font-semibold mb-0.5">العمر التقريبي:</span>
                      <span className="font-bold text-slate-800">{extractedData.age ? `${extractedData.age} سنة` : '-'}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-muted-foreground block text-[10px] font-semibold mb-0.5">المحافظة:</span>
                      <span className="font-bold text-slate-800">{extractedData.governorate || '-'}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2 pt-2">
              {!capturedImage ? (
                <>
                  <Button
                    onClick={handleCapture}
                    className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-bold py-5 shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
                  >
                    <Camera className="h-5 w-5" />
                    <span>التقاط ومعالجة بـ Tesseract.js</span>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5 py-5 px-4 border-dashed border-primary/40 text-primary hover:bg-primary/5 cursor-pointer"
                    title="رفع صورة من القرص المحلي"
                  >
                    <FileUp className="h-4 w-4" />
                    <span className="hidden sm:inline">رفع صورة من الجهاز</span>
                  </Button>

                  <Button variant="outline" onClick={onClose} className="px-5 py-5">
                    إلغاء
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleApply}
                    disabled={isProcessing}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-5 shadow-md flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
                  >
                    <Check className="h-5 w-5" />
                    <span>تأكيد واستخدام البيانات في النموذج</span>
                  </Button>
                  <Button
                    onClick={handleRetake}
                    variant="outline"
                    disabled={isProcessing}
                    className="gap-1.5 px-4 py-5 cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>إعادة المحاولة</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
