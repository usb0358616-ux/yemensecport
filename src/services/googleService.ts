import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Traveler } from '../lib/types';

// Initialize Firebase App and Auth
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();

// Workspace scopes
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly'
];

SCOPES.forEach(scope => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Google Sign-In popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Get cached or stored token
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Logout
export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

/**
 * GOOGLE SHEETS API UTILITIES
 */

// Create a new spreadsheet and export traveler records
export const exportToGoogleSheet = async (title: string, travelers: Traveler[]): Promise<string> => {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً');

  // 1. Create the spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title }
    })
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err.error?.message || 'فشل في إنشاء جدول البيانات');
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;

  // 2. Prepare spreadsheet rows
  const headers = [
    'الرقم التعريفي',
    'الاسم الأول',
    'اسم الأب',
    'اسم الجد',
    'اللقب',
    'السن',
    'رقم الهوية',
    'نوع الهوية',
    'الجنسية',
    'المحافظة',
    'الهاتف',
    'حالة التدقيق',
    'مسموح بالسفر',
    'الوجهة',
    'سبب الزيارة',
    'تاريخ التسجيل'
  ];

  const rows = travelers.map(t => [
    t.id || '',
    t.firstName || '',
    t.secondName || '',
    t.thirdName || '',
    t.lastName || '',
    t.age?.toString() || '',
    t.idNumber || '',
    t.idType || '',
    t.country || '',
    t.governorate || '',
    t.phone || '',
    t.vettingResult || 'غير مدقق',
    t.travelAllowed || 'نعم',
    t.destination || '',
    t.visitReason || '',
    t.createdAt ? new Date(t.createdAt).toLocaleDateString('ar-YE') : ''
  ]);

  const values = [headers, ...rows];

  // 3. Write data to sheet
  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values
    })
  });

  if (!updateRes.ok) {
    const err = await updateRes.json();
    throw new Error(err.error?.message || 'فشل في إدخال البيانات في جدول البيانات');
  }

  return spreadsheetUrl;
};

// Fetch data from a Google Sheet to import travelers
export const importFromGoogleSheet = async (spreadsheetId: string): Promise<Partial<Traveler>[]> => {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً');

  // 1. Fetch metadata to get the first sheet's name
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!metaRes.ok) {
    const err = await metaRes.json();
    throw new Error(err.error?.message || 'فشل في العثور على جدول البيانات. تأكد من أن المعرّف صحيح.');
  }

  const metaData = await metaRes.json();
  const sheetName = metaData.sheets[0]?.properties?.title || 'Sheet1';

  // 2. Fetch the values
  const valuesRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:Z500`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!valuesRes.ok) {
    const err = await valuesRes.json();
    throw new Error(err.error?.message || 'فشل في قراءة بيانات الجدول');
  }

  const data = await valuesRes.json();
  const rows: string[][] = data.values || [];

  if (rows.length < 2) {
    throw new Error('الجدول فارغ أو لا يحتوي على صفوف بيانات كافية');
  }

  const headers = rows[0].map(h => h.trim());
  const records: Partial<Traveler>[] = [];

  // Index helper
  const findCol = (names: string[]) => {
    return headers.findIndex(h => names.some(n => h.includes(n) || n.includes(h)));
  };

  const idCol = findCol(['الرقم التعريفي', 'ID', 'id']);
  const firstNameCol = findCol(['الاسم الأول', 'الاسم', 'First Name', 'first_name']);
  const secondNameCol = findCol(['اسم الأب', 'الأب', 'Second Name', 'father_name']);
  const thirdNameCol = findCol(['اسم الجد', 'الجد', 'Third Name', 'grandfather_name']);
  const lastNameCol = findCol(['اللقب', 'العائلة', 'Last Name', 'last_name']);
  const ageCol = findCol(['السن', 'العمر', 'Age', 'age']);
  const idNumberCol = findCol(['رقم الهوية', 'رقم الجواز', 'Passport', 'ID Number', 'id_number']);
  const idTypeCol = findCol(['نوع الهوية', 'نوع الجواز', 'ID Type', 'id_type']);
  const countryCol = findCol(['الجنسية', 'البلد', 'Citizenship', 'Country', 'country']);
  const govCol = findCol(['المحافظة', 'مكان الميلاد', 'Governorate', 'governorate']);
  const phoneCol = findCol(['الهاتف', 'رقم الهاتف', 'Phone', 'phone']);
  const vettingCol = findCol(['حالة التدقيق', 'التدقيق', 'Vetting', 'vetting']);
  const allowedCol = findCol(['مسموح بالسفر', 'السفر', 'Allowed', 'travel_allowed']);
  const destCol = findCol(['الوجهة', 'Destination', 'destination']);
  const reasonCol = findCol(['سبب الزيارة', 'السبب', 'Reason', 'visit_reason']);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // We require at least a name or ID number to import
    const idVal = idCol > -1 ? row[idCol] : undefined;
    const firstNameVal = firstNameCol > -1 ? row[firstNameCol] : '';
    const idNumVal = idNumberCol > -1 ? row[idNumberCol] : '';

    if (!firstNameVal && !idNumVal) continue;

    records.push({
      id: idVal,
      firstName: firstNameVal || '',
      secondName: secondNameCol > -1 ? row[secondNameCol] || '' : '',
      thirdName: thirdNameCol > -1 ? row[thirdNameCol] || '' : '',
      fourthName: '',
      lastName: lastNameCol > -1 ? row[lastNameCol] || '' : '',
      age: ageCol > -1 ? parseInt(row[ageCol] || '0') || 0 : 0,
      idNumber: idNumVal || '',
      idType: idTypeCol > -1 ? row[idTypeCol] || 'جواز' : 'جواز',
      country: countryCol > -1 ? row[countryCol] || 'اليمن' : 'اليمن',
      governorate: govCol > -1 ? row[govCol] || '' : '',
      phone: phoneCol > -1 ? row[phoneCol] || '' : '',
      vettingResult: vettingCol > -1 ? row[vettingCol] || 'غير مدقق' : 'غير مدقق',
      travelAllowed: (allowedCol > -1 ? row[allowedCol] : 'نعم') === 'لا' ? 'لا' : 'نعم',
      destination: destCol > -1 ? row[destCol] || '' : '',
      visitReason: reasonCol > -1 ? row[reasonCol] || '' : '',
    });
  }

  return records;
};

/**
 * GOOGLE FORMS API UTILITIES
 */

// Create a new Registration Google Form with standard fields
export const createRegistrationForm = async (title: string): Promise<{ formId: string; responderUri: string; editUri: string }> => {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً');

  // 1. Create empty form
  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: { title, description: 'استمارة التسجيل المسبق للمسافرين لتسهيل وتنسيق حركات السير في المنفذ.' }
    })
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err.error?.message || 'فشل في إنشاء الاستمارة');
  }

  const formData = await createRes.json();
  const formId = formData.formId;
  const responderUri = formData.responderUri;

  // 2. Add questions
  const fields = [
    { title: 'الاسم الأول', required: true, type: 'TEXT' },
    { title: 'اسم الأب', required: true, type: 'TEXT' },
    { title: 'اسم الجد', required: true, type: 'TEXT' },
    { title: 'اللقب (اسم العائلة)', required: true, type: 'TEXT' },
    { title: 'العمر', required: true, type: 'TEXT' },
    { title: 'رقم الهوية / الجواز', required: true, type: 'TEXT' },
    { 
      title: 'نوع الوثيقة', 
      required: true, 
      type: 'CHOICE', 
      options: ['جواز سفر', 'بطاقة شخصية', 'بطاقة عائلية', 'أخرى'] 
    },
    { title: 'الجنسية', required: true, type: 'TEXT' },
    { title: 'محافظة الميلاد', required: false, type: 'TEXT' },
    { title: 'رقم الهاتف', required: true, type: 'TEXT' },
    { title: 'الوجهة المقصودة', required: false, type: 'TEXT' },
    { title: 'سبب الزيارة / السفر', required: false, type: 'TEXT' },
  ];

  const requests = fields.map((field, index) => {
    const item: any = {
      title: field.title,
      questionItem: {
        question: {
          required: field.required,
        }
      }
    };

    if (field.type === 'TEXT') {
      item.questionItem.question.textQuestion = {};
    } else if (field.type === 'CHOICE' && field.options) {
      item.questionItem.question.choiceQuestion = {
        type: 'RADIO',
        options: field.options.map(opt => ({ value: opt }))
      };
    }

    return {
      createItem: {
        item,
        location: { index }
      }
    };
  });

  const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests
    })
  });

  if (!updateRes.ok) {
    const err = await updateRes.json();
    throw new Error(err.error?.message || 'فشل في إضافة الأسئلة في الاستمارة');
  }

  const editUri = `https://docs.google.com/forms/d/${formId}/edit`;

  return { formId, responderUri, editUri };
};

// Fetch form structure and all responses, returning partial traveler records
export const getFormResponses = async (formId: string): Promise<Partial<Traveler>[]> => {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً');

  // 1. Fetch form metadata to get question ID mapping
  const formRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!formRes.ok) {
    const err = await formRes.json();
    throw new Error(err.error?.message || 'فشل في جلب هيكل الاستمارة');
  }

  const formMeta = await formRes.json();
  const items = formMeta.items || [];

  // Map questionId -> question title
  const questionMap: { [questionId: string]: string } = {};
  items.forEach((item: any) => {
    if (item.questionItem?.question?.questionId) {
      questionMap[item.questionItem.question.questionId] = item.title;
    }
  });

  // 2. Fetch responses
  const responsesRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!responsesRes.ok) {
    const err = await responsesRes.json();
    throw new Error(err.error?.message || 'فشل في جلب استجابات الاستمارة');
  }

  const responsesData = await responsesRes.json();
  const rawResponses: any[] = responsesData.responses || [];

  const importedTravelers: Partial<Traveler>[] = [];

  rawResponses.forEach((resp: any) => {
    const answers = resp.answers || {};
    const entry: Partial<Traveler> = {
      id: resp.responseId,
      createdAt: resp.createTime,
      vettingResult: 'غير مدقق',
      travelAllowed: 'نعم'
    };

    // Helper to find answer by question title keyword
    const getAnswerText = (keywords: string[]): string => {
      for (const qId in answers) {
        const title = questionMap[qId];
        if (title && keywords.some(key => title.includes(key))) {
          const answerObj = answers[qId];
          const textAnswers = answerObj.textAnswers?.answers || [];
          if (textAnswers.length > 0) {
            return textAnswers[0].value || '';
          }
        }
      }
      return '';
    };

    entry.firstName = getAnswerText(['الاسم الأول', 'الاول']);
    entry.secondName = getAnswerText(['اسم الأب', 'الأب', 'الاب']);
    entry.thirdName = getAnswerText(['اسم الجد', 'الجد']);
    entry.lastName = getAnswerText(['اللقب', 'العائلة', 'العائله']);
    entry.age = parseInt(getAnswerText(['العمر', 'السن'])) || 0;
    entry.idNumber = getAnswerText(['الهوية', 'الجواز', 'رقم الوثيقة', 'الرقم']);
    
    const docType = getAnswerText(['نوع الوثيقة', 'نوع الهوية', 'نوع الجواز']);
    entry.idType = docType.includes('شخصية') ? 'شخصية' : docType.includes('عائلية') ? 'عائلية' : 'جواز';

    entry.country = getAnswerText(['الجنسية', 'البلد']) || 'اليمن';
    entry.governorate = getAnswerText(['المحافظة', 'مكان الميلاد', 'الميلاد']);
    entry.phone = getAnswerText(['الهاتف', 'الجوال', 'التواصل']);
    entry.destination = getAnswerText(['الوجهة', 'السفر إلى']);
    entry.visitReason = getAnswerText(['سبب', 'الغرض']);

    if (entry.firstName || entry.idNumber) {
      importedTravelers.push(entry);
    }
  });

  return importedTravelers;
};
