# CalorieTrack.ai

MVP pelacak kalori berbasis Next.js, Supabase, Tailwind, Recharts, dan Google Gemini. Mendukung login email/password dan Google, analisis foto/teks makanan, target kalori, grafik 7 hari, serta log makanan dengan RLS per pengguna.

## Menjalankan

1. Buat proyek Supabase, lalu jalankan `supabase/schema.sql` di SQL Editor.
2. Di Authentication > URL Configuration, tambahkan `http://localhost:3000/auth/callback`. Aktifkan Google provider bila diperlukan.
3. Salin `.env.example` menjadi `.env.local` dan isi semua nilainya.
4. Jalankan `npm install`, lalu `npm run dev`.

Kunci Gemini hanya dibaca oleh API route server dan tidak pernah dikirim ke browser. Foto dikirim ke Gemini untuk analisis tetapi tidak disimpan permanen pada implementasi awal ini; bucket privat tersedia bila penyimpanan foto ingin ditambahkan nanti.
