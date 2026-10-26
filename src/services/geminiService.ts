import { GoogleGenAI, Type } from "@google/genai";

const getApiKey = () => {
  // Priority 1: User setting in LocalStorage
  const savedKey = localStorage.getItem('config_geminiKey');
  if (savedKey && savedKey.length > 10) return savedKey;

  // Priority 2: Build-time environment variable
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey !== 'undefined' && envKey !== 'MY_GEMINI_API_KEY') {
    return envKey;
  }
  
  // Priority 3: Hardcoded fallback provided by user
  return "AIzaSyAAVh__MfT2Ubcx07nPWs5hzYRf3dKJlsg";
};

const getAIClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const scanPassport = async (base64Data: string, mimeType: string = "image/jpeg") => {
  if (!window.navigator.onLine) {
    throw new Error("لا يوجد اتصال بالإنترنت. يرجى الاتصال بالشبكة لاستخدام تقنية التحليل الذكي.");
  }

  const ai = getAIClient();
  if (!ai) {
    throw new Error("لم يتم ضبط مفتاح Gemini API. يرجى الذهاب إلى الإعدادات وادخال مفتاح API أولاً.");
  }

  const prompt = `You are a professional passport and ID card OCR expert. 
  Analyze the provided image and extract all relevant traveler information.
  
  GUIDELINES:
  1. Names: Extract the full name. If it's a 4-part or 5-part name, split it into firstName, secondName, thirdName, fourthName, and lastName.
  2. Language: If the names are in English, translate them accurately to Arabic.
  3. ID Details: Extract the passport number or ID number accurately.
  4. Location: Identify the country of citizenship and the place of birth/governorate.
  5. Dates: If you see a birth date, calculate the age.
  6. Document Type: Identify if it's a Passport (جواز سفر), ID Card (بطاقة شخصية), or other.
  
  Return the data in strict JSON format.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: {
        parts: [
          { inlineData: { data: base64Data.split(',')[1], mimeType } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            firstName: { type: Type.STRING, description: "First name in Arabic" },
            secondName: { type: Type.STRING, description: "Father's name in Arabic" },
            thirdName: { type: Type.STRING, description: "Grandfather's name in Arabic" },
            fourthName: { type: Type.STRING, description: "Great-grandfather's name in Arabic" },
            lastName: { type: Type.STRING, description: "Family name in Arabic" },
            idNumber: { type: Type.STRING, description: "Passport or ID number" },
            idType: { type: Type.STRING, enum: ["جواز", "شخصية", "عائلية", "أخرى"] },
            country: { type: Type.STRING, description: "Country of citizenship" },
            governorate: { type: Type.STRING, description: "Governorate or city of birth" },
            age: { type: Type.NUMBER },
            gender: { type: Type.STRING, enum: ["ذكر", "أنثى"] },
          },
          required: ["firstName", "lastName", "idNumber"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("403") || error.message?.includes("permission")) {
      throw new Error("فشل التحقق من صلاحية مفتاح API. تأكد من أن المفتاح صحيح وله صلاحية الوصول إلى Gemini API.");
    }
    throw error;
  }
};

export const analyzeReport = async (description: string) => {
  if (!window.navigator.onLine) {
    throw new Error("لا يوجد اتصال بالإنترنت لله تحليل البلاغ.");
  }

  const ai = getAIClient();
  if (!ai) {
    throw new Error("لم يتم ضبط مفتاح Gemini API.");
  }

  const prompt = `Analyze this security report description and suggest a concise title and a category (e.g., مطلوب, مرتزق, سجون, عودة, عام).
  Return the data in JSON format with fields: title, type.
  Description: ${description}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            type: { type: Type.STRING },
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("403") || error.message?.includes("permission")) {
      throw new Error("فشل التحقق من صلاحية مفتاح API.");
    }
    throw error;
  }
};
