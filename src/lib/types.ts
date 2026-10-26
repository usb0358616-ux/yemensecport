export interface Traveler {
  id: string;
  firstName: string;
  secondName: string;
  thirdName: string;
  fourthName: string;
  lastName: string;
  age: number;
  idNumber: string;
  idType: string;
  country: string;
  governorate: string;
  phone: string;
  vettingResult: string;
  vettingResult1?: string;
  vettingResult2?: string;
  vettingResult3?: string;
  vettingResult4?: string;
  destination: string;
  visitReason: string;
  investigatingOfficer: string;
  travelAllowed: 'نعم' | 'لا';
  center?: string;
  agency?: string;
  receiveDate?: string;
  status?: string;
  returnReason?: string;
  visaType?: string;
  requestNumber?: string;
  photoUrl?: string;
  documentsUrls?: string[];
  linkedReportIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  type: string;
  status: 'جديد' | 'قيد التحقيق' | 'معتمد' | 'مرفوض';
  attachments?: string[];
  linkedTravelerIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Movement {
  id: string;
  type: 'طقم' | 'دراجة نارية' | 'أخرى';
  plateNumber: string;
  driverName: string;
  personnelCount: number;
  mission: string;
  departureTime: string;
  expectedReturnTime: string;
  actualReturnTime?: string;
  outcome?: string;
  status: 'خروج' | 'عودة';
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  username: string;
  role: 'آدمن' | 'ضابط' | 'مدخل بيانات';
  name: string;
}
