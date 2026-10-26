import React from 'react';
import { Traveler } from '@/lib/types';
import { QRCodeCanvas } from 'qrcode.react';

interface OfficialPrintReportProps {
  traveler: Traveler | null;
}

export const OfficialPrintReport: React.FC<OfficialPrintReportProps> = ({ traveler }) => {
  if (!traveler) return null;

  const today = new Date();
  const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}م`;
  const timeStr = today.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });
  const referenceNumber = `SEC-${today.getFullYear()}-${traveler.idNumber || traveler.id.substring(0, 6).toUpperCase()}`;

  const fullName = [
    traveler.firstName,
    traveler.secondName,
    traveler.thirdName,
    traveler.fourthName,
    traveler.lastName
  ].filter(Boolean).join(' ') || 'غير محدد';

  return (
    <div
      id="official-printable-report"
      className="hidden print:block bg-white text-black p-8 font-sans print:m-0 print:p-6"
      dir="rtl"
    >
      {/* Official State Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
        {/* Right: State Authorities */}
        <div className="text-right space-y-1 text-xs sm:text-sm font-bold text-slate-900 leading-snug">
          <p className="text-base font-extrabold text-slate-950">الجمهورية اليمنية</p>
          <p>وزارة الداخلية</p>
          <p>مصلحة الهجرة والجوازات والجنسية</p>
          <p className="text-[11px] text-slate-700">الإدارة العامة للمنافذ والرقابة الحدودية</p>
          <p className="text-[11px] text-slate-700">غرفة العمليات والمباينة الأمنية</p>
        </div>

        {/* Center: Emblem & Title */}
        <div className="text-center flex flex-col items-center">
          <div className="w-16 h-16 border-2 border-slate-900 rounded-full flex items-center justify-center p-1 mb-1 shadow-xs">
            {/* Official Eagle Emblem Representation */}
            <svg viewBox="0 0 100 100" className="w-full h-full text-slate-800" fill="currentColor">
              <path d="M50 10 C35 25, 20 40, 15 60 C30 55, 45 65, 50 85 C55 65, 70 55, 85 60 C80 40, 65 25, 50 10 Z" opacity="0.85" />
              <circle cx="50" cy="40" r="10" fill="#c026d3" opacity="0.3" />
              <rect x="42" y="55" width="16" height="20" rx="2" fill="currentColor" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-slate-600">بسم الله الرحمن الرحيم</p>
          <h1 className="text-lg font-extrabold text-slate-950 mt-1 tracking-wide">
            استمارة مباينة وتصريح مرور مسافر
          </h1>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">
            OFFICIAL BORDER CLEARANCE & VETTING REPORT
          </span>
        </div>

        {/* Left: Document Info & QR Verification */}
        <div className="text-left flex flex-col items-end text-xs space-y-1 text-slate-800">
          <p className="font-mono text-[11px] font-bold">
            <span className="text-slate-500">الرقم المرجعي: </span>{referenceNumber}
          </p>
          <p className="text-[11px]">
            <span className="text-slate-500">التاريخ: </span>{dateStr}
          </p>
          <p className="text-[11px]">
            <span className="text-slate-500">الوقت: </span>{timeStr}
          </p>
          <div className="mt-2 border border-slate-400 p-1 bg-white rounded">
            <QRCodeCanvas
              value={`OFFICIAL-VERIFICATION:${referenceNumber}:${traveler.idNumber}:${traveler.firstName} ${traveler.lastName}:${traveler.travelAllowed}`}
              size={72}
            />
          </div>
        </div>
      </div>

      {/* Official Security Clearance Badge Banner */}
      <div className="flex items-center justify-between bg-slate-100 border border-slate-300 px-4 py-2 rounded mb-5">
        <div className="text-xs font-bold text-slate-800">
          <span>المنفذ / النقطة: </span>
          <span className="text-primary font-extrabold">{traveler.center || 'المنفذ الحدودي الرئيسي'}</span>
          <span className="mx-2">|</span>
          <span>الجهة / الوكالة: </span>
          <span className="font-semibold">{traveler.agency || 'إدارة الجوازات'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold">القرار الأمني:</span>
          <span
            className={`px-3 py-1 text-xs font-black rounded border ${
              traveler.travelAllowed === 'نعم'
                ? 'bg-green-100 text-green-900 border-green-600'
                : 'bg-red-100 text-red-900 border-red-600'
            }`}
          >
            {traveler.travelAllowed === 'نعم' ? '✓ مسموح له بالسفر والعبور' : '✕ ممنوع من السفر والعبور'}
          </span>
        </div>
      </div>

      {/* Main Content Grid: Photo + Tables */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {/* Photo Box (1 Column) */}
        <div className="col-span-1 flex flex-col items-center">
          <div className="w-full aspect-[3/4] max-h-48 border-2 border-slate-800 p-1 bg-slate-50 rounded flex items-center justify-center overflow-hidden mb-2">
            {traveler.photoUrl ? (
              <img
                src={traveler.photoUrl}
                alt={fullName}
                className="w-full h-full object-cover rounded"
              />
            ) : (
              <div className="text-center text-slate-400 text-xs font-bold p-2">
                صورة رسمية<br />(4 × 6)
              </div>
            )}
          </div>
          <div className="w-full border border-dashed border-slate-400 p-1.5 text-center bg-slate-50 rounded">
            <span className="text-[10px] text-slate-500 block">حالة الوثيقة</span>
            <span className="text-xs font-bold text-slate-800">سارية ومعتمدة</span>
          </div>
        </div>

        {/* Data Tables (3 Columns) */}
        <div className="col-span-3 space-y-4">
          {/* 1. Personal Information */}
          <div>
            <div className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-t flex justify-between">
              <span>أولاً: البيانات الشخصية للمسافر</span>
              <span className="text-[10px] opacity-80">PERSONAL INFORMATION</span>
            </div>
            <table className="w-full text-xs border border-slate-400 border-collapse">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="bg-slate-100 font-bold p-1.5 w-28 border-l border-slate-300">الاسم الكامل:</td>
                  <td className="p-1.5 font-bold text-slate-900" colSpan={3}>{fullName}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="bg-slate-100 font-bold p-1.5 border-l border-slate-300">رقم الوثيقة:</td>
                  <td className="p-1.5 font-mono font-bold text-slate-900">{traveler.idNumber}</td>
                  <td className="bg-slate-100 font-bold p-1.5 w-24 border-l border-r border-slate-300">نوع الوثيقة:</td>
                  <td className="p-1.5">{traveler.idType}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="bg-slate-100 font-bold p-1.5 border-l border-slate-300">الجنسية:</td>
                  <td className="p-1.5">{traveler.country || 'اليمن'}</td>
                  <td className="bg-slate-100 font-bold p-1.5 border-l border-r border-slate-300">المحافظة:</td>
                  <td className="p-1.5">{traveler.governorate || '-'}</td>
                </tr>
                <tr>
                  <td className="bg-slate-100 font-bold p-1.5 border-l border-slate-300">العمر:</td>
                  <td className="p-1.5">{traveler.age ? `${traveler.age} عاماً` : '-'}</td>
                  <td className="bg-slate-100 font-bold p-1.5 border-l border-r border-slate-300">رقم الهاتف:</td>
                  <td className="p-1.5 font-mono">{traveler.phone || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 2. Travel & Movement Information */}
          <div>
            <div className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-t flex justify-between">
              <span>ثانياً: بيانات السفر والمقصد</span>
              <span className="text-[10px] opacity-80">TRAVEL & DESTINATION</span>
            </div>
            <table className="w-full text-xs border border-slate-400 border-collapse">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="bg-slate-100 font-bold p-1.5 w-28 border-l border-slate-300">دولة الوجهة:</td>
                  <td className="p-1.5 font-semibold text-slate-900">{traveler.destination || '-'}</td>
                  <td className="bg-slate-100 font-bold p-1.5 w-24 border-l border-r border-slate-300">تاريخ العبور:</td>
                  <td className="p-1.5">{traveler.receiveDate || dateStr}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="bg-slate-100 font-bold p-1.5 border-l border-slate-300">الغرض / التأشيرة:</td>
                  <td className="p-1.5" colSpan={3}>{traveler.visitReason || 'سياحة / عمل'}</td>
                </tr>
                {traveler.returnReason && (
                  <tr>
                    <td className="bg-red-50 text-red-800 font-bold p-1.5 border-l border-slate-300">سبب الإرجاع:</td>
                    <td className="p-1.5 text-red-700 font-bold" colSpan={3}>{traveler.returnReason}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. Security Vetting and Screening Results */}
      <div className="mb-6">
        <div className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-t flex justify-between">
          <span>ثالثاً: نتائج الفحص والتدقيق الأمني وقوائم الترقب</span>
          <span className="text-[10px] opacity-80">SECURITY VETTING & CLEARANCE</span>
        </div>
        <div className="border border-slate-400 p-3 bg-slate-50 text-xs rounded-b">
          <div className="grid grid-cols-2 gap-2 mb-2 pb-2 border-b border-slate-200">
            <div>
              <span className="text-slate-500 block text-[10px]">نتيجة الفحص الجنائي وقوائم الحظر:</span>
              <span className="font-bold text-slate-900">
                {traveler.vettingResult || 'تمت المطابقة الأمنية - لا توجد قيود أمنية أو بلاغات سارية'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">الضابط المحقق المسئول:</span>
              <span className="font-bold text-slate-900">{traveler.investigatingOfficer || 'ضابط المناوبة بالمنفذ'}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            تمت مطابقة بيانات المسافر أعلاه مع قاعدة بيانات المنظومة الأمنية الموحدة وقوائم المنع والترقب الصادرة عن الأجهزة المختصة، وبموجبه تم اتخاذ القرار المبيّن أعلاه.
          </p>
        </div>
      </div>

      {/* Official Signatures & Official Port Stamps Section */}
      <div className="mt-8 pt-4 border-t-2 border-slate-900 grid grid-cols-3 gap-6 text-center text-xs">
        {/* Officer */}
        <div className="flex flex-col items-center justify-between h-28 border border-slate-300 p-2 rounded bg-slate-50/50">
          <p className="font-bold text-slate-900">الضابط المحقق (المناوب)</p>
          <p className="text-[11px] text-slate-600 font-medium">{traveler.investigatingOfficer || 'ملازم أول / مناوب'}</p>
          <div className="w-full border-t border-slate-400 pt-1 text-[10px] text-slate-400">
            التوقيع: ...........................
          </div>
        </div>

        {/* Supervisor */}
        <div className="flex flex-col items-center justify-between h-28 border border-slate-300 p-2 rounded bg-slate-50/50">
          <p className="font-bold text-slate-900">مشرف المنفذ والعمليات</p>
          <p className="text-[11px] text-slate-600 font-medium">غرفة الرقابة الميدانية</p>
          <div className="w-full border-t border-slate-400 pt-1 text-[10px] text-slate-400">
            التوقيع: ...........................
          </div>
        </div>

        {/* Port Director / Stamp Box */}
        <div className="flex flex-col items-center justify-between h-28 border-2 border-dashed border-slate-500 p-2 rounded bg-slate-50/50 relative">
          <p className="font-extrabold text-slate-950">مدير مصلحة الجوازات بالمنفذ</p>
          <div className="w-16 h-16 border-2 border-red-500/40 rounded-full flex items-center justify-center text-[9px] text-red-600 font-bold rotate-[-12deg] select-none">
            الختم الرسمي للمنفذ
          </div>
          <div className="w-full border-t border-slate-400 pt-1 text-[10px] text-slate-400">
            الاعتماد والختم
          </div>
        </div>
      </div>

      {/* Security Disclaimer Footer */}
      <div className="mt-6 pt-3 border-t border-slate-300 text-center text-[10px] text-slate-500 flex justify-between items-center">
        <span>نظام المنافذ والجوازات الذكي · نسخة طباعة رسمية مشفرة</span>
        <span>لا يُعتد بهذا التقرير إذا تم الكشط أو التعديل أو خلوه من الختم الرسمي</span>
        <span className="font-mono">SYS-VER: 1.2.0</span>
      </div>
    </div>
  );
};
