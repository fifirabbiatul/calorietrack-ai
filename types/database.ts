export type MealTime = "Pagi" | "Siang" | "Sore" | "Malam";
export type Nutrition = { karbo: number; protein: number; lemak: number };
export type FoodAnalysis = { nama_makanan: string; kalori: number; rincian_nutrisi: Nutrition; waktu_makan: MealTime; confidence?: string };
export type FoodLog = { id: string; user_id: string; waktu_makan: MealTime; nama_makanan: string; kalori: number; rincian_nutrisi: Nutrition | string; tanggal: string; created_at: string; image_path?: string | null };
