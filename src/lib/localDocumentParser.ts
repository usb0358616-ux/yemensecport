import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
// Vite URL import for local offline pdf.worker
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Traveler } from './types';
import { normalizeArabic, generateId } from './storage';

// Configure local worker strictly offline
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch (err) {
    console.warn('PDF.js worker initialization warning:', err);
  }
}

export interface ExtractedTravelerData {
  firstName: string;
  secondName?: string;
  thirdName?: string;
  fourthName?: string;
  lastName: string;
  idNumber: string;
  idType?: string;
  age?: number;
  country?: string;
  governorate?: string;
  phone?: string;
  destination?: string;
  visitReason?: string;
  visaType?: string;
  center?: string;
  agency?: string;
  receiveDate?: string;
  travelAllowed?: 'نعم' | 'لا';
  status?: string;
  returnReason?: string;
  investigatingOfficer?: string;
  requestNumber?: string;
  vettingResult?: string;
  vettingResult1?: string;
  vettingResult2?: string;
  vettingResult3?: string;
  vettingResult4?: string;
  rawSource?: string;
}

export interface FieldDiff {
  field: keyof Traveler;
  label: string;
  currentValue: string;
  incomingValue: string;
}

export interface ReconciliationRecord {
  tempId: string;
  data: ExtractedTravelerData;
  status: 'new' | 'matched';
  existingTraveler?: Traveler;
  diffs: FieldDiff[];
  selected: boolean;
}

// Helper to look up fuzzy column names
function getColumnValue(row: Record<string, any>, ...aliases: string[]): string {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const normAlias = normalizeArabic(alias).toLowerCase().replace(/[\s_\-\/]/g, '');
    for (const key of keys) {
      const normKey = normalizeArabic(key).toLowerCase().replace(/[\s_\-\/]/g, '');
      if (normKey === normAlias || normKey.includes(normAlias) || normAlias.includes(normKey)) {
        const val = row[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  return '';
}

// Split full Arabic name into standard parts
export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
  const middle = parts.slice(1, -1);
  const secondName = middle[0] || '';
  const thirdName = middle[1] || '';
  const fourthName = middle[2] || '';
  return { firstName, secondName, thirdName, fourthName, lastName };
}

// Convert Excel dates or text to YYYY-MM-DD
function formatParsedDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  // Match standard YYYY-MM-DD or DD/MM/YYYY
  const isoMatch = str.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const dmyMatch = str.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }
  return str;
}

/**
 * 1. Parse Excel (.xlsx, .xls) files locally
 */
export async function parseExcelLocally(file: File): Promise<ExtractedTravelerData[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const results: ExtractedTravelerData[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fullName = getColumnValue(
        row,
        'الاسم',
        'الإسم',
        'اسم المسافر',
        'الاسم الكامل',
        'الاسم الرباعي',
        'اسم المسافر رباعي',
        'Full Name',
        'Name'
      );

      const idNumber = getColumnValue(
        row,
        'رقم الجواز',
        'رقم البطاقة',
        'رقم الوثيقة',
        'رقم الهوية',
        'الجواز',
        'الهوية',
        'Passport No',
        'ID Number',
        'Document No'
      );

      // Skip row if neither name nor document number is present
      if (!fullName && !idNumber) continue;

      const { firstName, secondName, thirdName, fourthName, lastName } = splitFullName(fullName);

      // Check idType
      const rawIdType = getColumnValue(row, 'نوع الوثيقة', 'نوع الهوية', 'نوع البطاقة', 'Document Type');
      let idType = 'جواز';
      if (rawIdType.includes('شخص') || rawIdType.includes('بطاق') || rawIdType.includes('وطن')) {
        idType = 'شخصية';
      } else if (rawIdType.includes('عائل')) {
        idType = 'عائلية';
      }

      const country = getColumnValue(row, 'الجنسية', 'الدولة', 'البلد', 'Nationality', 'Country') || 'اليمن';
      const governorate = getColumnValue(row, 'المحافظة', 'المدينة', 'Governorate', 'Province');
      const phone = getColumnValue(row, 'الهاتف', 'رقم الهاتف', 'الجوال', 'تلفون', 'Phone', 'Mobile');
      const destination = getColumnValue(row, 'الوجهة', 'جهة السفر', 'الدولة المقصودة', 'جهة القدوم', 'Destination');
      const visitReason = getColumnValue(row, 'سبب الزيارة', 'الغرض من السفر', 'الغرض', 'نوع التأشيرة', 'التأشيرة', 'Visa Type', 'Reason');
      const visaType = getColumnValue(row, 'التأشيرة', 'نوع الفيزا', 'نوع التأشيرة', 'Visa');
      const center = getColumnValue(row, 'المركز', 'المنفذ', 'نقطة العبور', 'Port', 'Center');
      const agency = getColumnValue(row, 'الوكالة', 'إسم الوكالة', 'اسم الوكالة', 'شركة السفر', 'Agency');
      const receiveDate = formatParsedDate(getColumnValue(row, 'تاريخ الاستلام', 'تاريخ الخروج', 'ت. الخروج', 'تاريخ السفر', 'التاريخ', 'Date'));
      
      const rawTravel = getColumnValue(row, 'قرار السفر', 'حالة السفر', 'السفر مسموح', 'مسموح بالعبور');
      let travelAllowed: 'نعم' | 'لا' = 'نعم';
      if (rawTravel.includes('لا') || rawTravel.includes('منع') || rawTravel.includes('مرفوض') || rawTravel.includes('إرجاع')) {
        travelAllowed = 'لا';
      }

      const status = getColumnValue(row, 'الحالة', 'الوضع', 'Status');
      const returnReason = getColumnValue(row, 'سبب الإرجاع', 'سبب الارتجاع', 'سبب المنع', 'سبب الرفض', 'Return Reason');
      const investigatingOfficer = getColumnValue(row, 'ضابط التحقيق', 'المحقق', 'المستلم', 'Officer');
      const requestNumber = getColumnValue(row, 'رقم الطلب', 'Request Number');

      // Vetting results
      const vr1 = getColumnValue(row, 'نتائج المباينة من قاعدة المطلوبين', 'المطلوبين', 'مطلوب');
      const vr2 = getColumnValue(row, 'نتائج المباينة من قاعدة السجون', 'السجون', 'سجين');
      const vr3 = getColumnValue(row, 'نتائج المباينة من قاعدة مرتزقة', 'مرتزقة', 'مرتزق');
      const vr4 = getColumnValue(row, 'نتائج المباينة من قاعدة مركز العائدين', 'العائدين', 'عائد');
      
      const vettingParts: string[] = [];
      const cleanVr = (v: string) => (v && v !== '-' && v !== 'لا يوجد' && v !== 'لايوجد') ? v : '';
      if (cleanVr(vr1)) vettingParts.push(`المطلوبين: ${cleanVr(vr1)}`);
      if (cleanVr(vr2)) vettingParts.push(`السجون: ${cleanVr(vr2)}`);
      if (cleanVr(vr3)) vettingParts.push(`المرتزقة: ${cleanVr(vr3)}`);
      if (cleanVr(vr4)) vettingParts.push(`العائدين: ${cleanVr(vr4)}`);

      const ageStr = getColumnValue(row, 'العمر', 'السن', 'Age');
      const age = parseInt(ageStr, 10) || 0;

      results.push({
        firstName,
        secondName,
        thirdName,
        fourthName,
        lastName,
        idNumber: idNumber || `AUTO-${Math.floor(100000 + Math.random() * 900000)}`,
        idType,
        age,
        country,
        governorate,
        phone,
        destination,
        visitReason: visitReason || visaType,
        visaType,
        center,
        agency,
        receiveDate,
        travelAllowed,
        status: status || (travelAllowed === 'لا' ? 'مرفوض' : 'معتمد'),
        returnReason,
        investigatingOfficer,
        requestNumber,
        vettingResult: vettingParts.join(' | '),
        vettingResult1: cleanVr(vr1),
        vettingResult2: cleanVr(vr2),
        vettingResult3: cleanVr(vr3),
        vettingResult4: cleanVr(vr4),
        rawSource: `${sheetName} - صف ${i + 2}`
      });
    }
  }

  return results;
}

/**
 * 2. Parse PDF files locally using pdfjs-dist
 */
export async function parsePdfLocally(file: File): Promise<ExtractedTravelerData[]> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false
  });

  const pdf = await loadingTask.promise;
  const extractedRecords: ExtractedTravelerData[] = [];
  const fullDocumentLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by roughly their vertical Y position to reconstruct lines
    const lineMap: Map<number, { x: number; text: string }[]> = new Map();
    
    for (const item of textContent.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);
      
      // Find matching Y bucket within 4 points
      let matchedY = y;
      for (const existingY of lineMap.keys()) {
        if (Math.abs(existingY - y) <= 4) {
          matchedY = existingY;
          break;
        }
      }
      
      if (!lineMap.has(matchedY)) {
        lineMap.set(matchedY, []);
      }
      lineMap.get(matchedY)!.push({ x, text: item.str.trim() });
    }

    // Sort lines from top to bottom (higher Y to lower Y in PDF coordinates)
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

    for (const y of sortedYs) {
      const items = lineMap.get(y)!;
      // For Arabic or mixed text, we keep line text
      // Sort items by x (ascending)
      items.sort((a, b) => a.x - b.x);
      const lineText = items.map(it => it.text).join(' ');
      if (lineText.trim()) {
        fullDocumentLines.push(lineText.trim());
      }
    }
  }

  const docText = fullDocumentLines.join('\n');

  // Strategy A: Check if the PDF has Key-Value format (Single traveler report or official clearance form)
  const isKeyValueForm = /رقم (الجواز|البطاقة|الهوية|الوثيقة)|الاسم|الجنسية/i.test(docText);
  
  if (isKeyValueForm) {
    // Attempt to extract structured traveler slip
    const record = extractFromFormText(docText);
    if (record && (record.firstName || record.idNumber)) {
      record.rawSource = `مستند PDF (${pdf.numPages} صفحات)`;
      extractedRecords.push(record);
    }
  }

  // Strategy B: Check if the PDF contains a table or list of travelers (Manifest / Table rows)
  const tableRecords = extractFromTableLines(fullDocumentLines);
  for (const tr of tableRecords) {
    // Avoid exact duplicate if already captured
    if (!extractedRecords.some(r => r.idNumber === tr.idNumber && r.idNumber !== '')) {
      extractedRecords.push(tr);
    }
  }

  return extractedRecords;
}

// Regex extraction from Form/Report PDF
function extractFromFormText(text: string): ExtractedTravelerData | null {
  const getMatch = (...patterns: RegExp[]): string => {
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  };

  const name = getMatch(
    /(?:الاسم الكامل|اسم المسافر|الاسم الرباعي|الاسم)[\s:：]+([^\n\r\|]{3,60})/i,
    /(?:السيد\/ة|المسافر)[\s:：]+([^\n\r\|]{3,60})/i
  );

  const idNumber = getMatch(
    /(?:رقم الجواز|رقم البطاقة|رقم الهوية|رقم الوثيقة|الجواز)[\s:：]+([0-9A-Za-z\-]{5,20})/i,
    /(?:جواز سفر رقم|بطاقة رقم)[\s:：]+([0-9A-Za-z\-]{5,20})/i
  );

  if (!name && !idNumber) return null;

  const { firstName, secondName, thirdName, fourthName, lastName } = splitFullName(name);

  const country = getMatch(/(?:الجنسية|الدولة)[\s:：]+([^\n\r\|]{2,30})/i) || 'اليمن';
  const governorate = getMatch(/(?:المحافظة|المدينة)[\s:：]+([^\n\r\|]{2,30})/i);
  const phone = getMatch(/(?:رقم الهاتف|الهاتف|الجوال)[\s:：]+([0-9\+\-\s]{7,20})/i);
  const destination = getMatch(/(?:الوجهة|جهة السفر|الدولة المقصودة|جهة القدوم)[\s:：]+([^\n\r\|]{2,40})/i);
  const visitReason = getMatch(/(?:سبب الزيارة|الغرض من السفر|نوع التأشيرة|التأشيرة)[\s:：]+([^\n\r\|]{2,40})/i);
  const center = getMatch(/(?:المركز|المنفذ|نقطة العبور)[\s:：]+([^\n\r\|]{2,40})/i);
  const agency = getMatch(/(?:الوكالة|إسم الوكالة|اسم الوكالة|شركة السفر)[\s:：]+([^\n\r\|]{2,40})/i);
  const receiveDate = formatParsedDate(getMatch(/(?:تاريخ الاستلام|تاريخ الخروج|تاريخ السفر|التاريخ)[\s:：]+([^\n\r\|]{6,25})/i));
  const officer = getMatch(/(?:ضابط التحقيق|المحقق|المستلم)[\s:：]+([^\n\r\|]{2,40})/i);
  const statusMatch = getMatch(/(?:الحالة|القرار|حالة السفر)[\s:：]+([^\n\r\|]{2,40})/i);

  let travelAllowed: 'نعم' | 'لا' = 'نعم';
  if (/ممنوع|مرفوض|لا يسمح|إرجاع|معمم عليه/.test(text) || statusMatch.includes('ممنوع') || statusMatch.includes('مرفوض')) {
    travelAllowed = 'لا';
  }

  // Vetting notes
  const vetting = getMatch(/(?:المباينة|المطلوبين|نتائج التدقيق)[\s:：]+([^\n\r]{2,80})/i);

  return {
    firstName: firstName || name,
    secondName,
    thirdName,
    fourthName,
    lastName,
    idNumber: idNumber || `PDF-${Math.floor(100000 + Math.random() * 900000)}`,
    idType: idNumber && /^[A-Z0-9]{6,10}$/i.test(idNumber) ? 'جواز' : 'شخصية',
    country,
    governorate,
    phone,
    destination,
    visitReason,
    center,
    agency,
    receiveDate,
    travelAllowed,
    status: statusMatch || (travelAllowed === 'لا' ? 'ممنوع من السفر' : 'مسموح بالعبور'),
    investigatingOfficer: officer,
    vettingResult: vetting
  };
}

// Regex extraction from PDF tabular rows
function extractFromTableLines(lines: string[]): ExtractedTravelerData[] {
  const records: ExtractedTravelerData[] = [];

  // Match rows with passport/ID number (e.g., 6-9 digits or standard alphanumeric passport code)
  // and multiple Arabic words indicating name
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (line.length < 15) continue;
    
    // Look for ID pattern
    const idMatch = line.match(/\b([A-Z]{0,2}\d{6,10})\b/i);
    if (!idMatch) continue;

    const idNumber = idMatch[1];
    // Remove the ID from line to extract text
    const textWithoutId = line.replace(idNumber, ' ').trim();
    // Extract Arabic name candidate: 2 to 5 consecutive Arabic words
    const arabicWords = textWithoutId.match(/[\u0600-\u06FF]{2,}/g) || [];
    
    if (arabicWords.length >= 2) {
      // Pick first 3-4 words as traveler name
      const nameWords = arabicWords.slice(0, Math.min(arabicWords.length, 4));
      const fullName = nameWords.join(' ');
      const { firstName, secondName, thirdName, fourthName, lastName } = splitFullName(fullName);

      // Remaining words might indicate destination or status
      const remainingWords = arabicWords.slice(nameWords.length);
      const remainingText = remainingWords.join(' ');

      let destination = '';
      if (remainingWords.length > 0) {
        destination = remainingWords[0];
      }

      let travelAllowed: 'نعم' | 'لا' = 'نعم';
      if (line.includes('ممنوع') || line.includes('رفض') || line.includes('إرجاع') || line.includes('معمم')) {
        travelAllowed = 'لا';
      }

      records.push({
        firstName,
        secondName,
        thirdName,
        fourthName,
        lastName,
        idNumber,
        idType: /^[A-Z]/.test(idNumber) ? 'جواز' : 'شخصية',
        country: 'اليمن',
        destination,
        travelAllowed,
        status: travelAllowed === 'لا' ? 'ممنوع' : 'مسموح',
        rawSource: `سطر ${idx + 1}: ${line.slice(0, 50)}...`
      });
    }
  }

  return records;
}

/**
 * 3. Match extracted records against the current travelers database
 */
export function reconcileWithDatabase(
  extractedList: ExtractedTravelerData[],
  existingTravelers: Traveler[]
): ReconciliationRecord[] {
  return extractedList.map((data, index) => {
    const tempId = `rec-${Date.now()}-${index}`;
    
    // Match 1: By Document / ID Number (Clean string match)
    const normExtractedId = data.idNumber ? data.idNumber.trim().toLowerCase().replace(/[\s\-_]/g, '') : '';
    let match = existingTravelers.find(t => {
      if (!normExtractedId || !t.idNumber) return false;
      const normCurId = String(t.idNumber).trim().toLowerCase().replace(/[\s\-_]/g, '');
      return normCurId === normExtractedId;
    });

    // Match 2: By Full Name if not matched by ID
    if (!match && data.firstName) {
      const extractedFullName = normalizeArabic(`${data.firstName} ${data.secondName || ''} ${data.thirdName || ''} ${data.lastName || ''}`.trim());
      if (extractedFullName.length >= 6) {
        match = existingTravelers.find(t => {
          const curFullName = normalizeArabic(`${t.firstName} ${t.secondName || ''} ${t.thirdName || ''} ${t.lastName || ''}`.trim());
          return curFullName === extractedFullName || (curFullName.length > 8 && extractedFullName.includes(curFullName)) || (extractedFullName.length > 8 && curFullName.includes(extractedFullName));
        });
      }
    }

    const diffs: FieldDiff[] = [];
    if (match) {
      const checkDiff = (field: keyof Traveler, label: string, incomingVal?: string | number) => {
        if (incomingVal !== undefined && incomingVal !== '' && incomingVal !== 0) {
          const currentVal = match![field] ? String(match![field]) : '';
          const incStr = String(incomingVal);
          if (currentVal !== incStr) {
            diffs.push({
              field,
              label,
              currentValue: currentVal || '(فارغ)',
              incomingValue: incStr
            });
          }
        }
      };

      checkDiff('destination', 'الوجهة', data.destination);
      checkDiff('center', 'المركز / المنفذ', data.center);
      checkDiff('agency', 'الوكالة', data.agency);
      checkDiff('receiveDate', 'تاريخ الاستلام', data.receiveDate);
      checkDiff('travelAllowed', 'قرار السفر', data.travelAllowed);
      checkDiff('status', 'الحالة', data.status);
      checkDiff('returnReason', 'سبب الارتجاع', data.returnReason);
      checkDiff('vettingResult', 'نتيجة المباينة', data.vettingResult);
      checkDiff('phone', 'الهاتف', data.phone);
      checkDiff('visitReason', 'الغرض / التأشيرة', data.visitReason);
      checkDiff('investigatingOfficer', 'ضابط التحقيق', data.investigatingOfficer);
    }

    return {
      tempId,
      data,
      status: match ? 'matched' : 'new',
      existingTraveler: match,
      diffs,
      selected: true
    };
  });
}
