import { Traveler, Report, Movement, User } from './types';

export const getTravelers = (): Traveler[] => {
  const data = localStorage.getItem('travelers');
  return data ? JSON.parse(data) : [];
};

export const saveTravelers = (travelers: Traveler[]) => {
  localStorage.setItem('travelers', JSON.stringify(travelers));
};

export const getReports = (): Report[] => {
  const data = localStorage.getItem('reports');
  return data ? JSON.parse(data) : [];
};

export const saveReports = (reports: Report[]) => {
  localStorage.setItem('reports', JSON.stringify(reports));
};

export const getMovements = (): Movement[] => {
  const data = localStorage.getItem('movements');
  return data ? JSON.parse(data) : [];
};

export const saveMovements = (movements: Movement[]) => {
  localStorage.setItem('movements', JSON.stringify(movements));
};

export const getCurrentUser = (): User | null => {
  const data = localStorage.getItem('currentUser');
  return data ? JSON.parse(data) : null;
};

export const setCurrentUser = (user: User | null) => {
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  } else {
    localStorage.removeItem('currentUser');
  }
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const normalizeArabic = (text: string) => {
  if (!text) return '';
  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
};
