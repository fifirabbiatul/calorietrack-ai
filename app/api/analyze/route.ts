import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const schema = {
  type: "OBJECT",
  properties: {
    nama_makanan: { type: "STRING" },
    kalori: { type: "INTEGER" },
    rincian_nutrisi: {
      type: "OBJECT",
      properties: {
        karbo: { type: "NUMBER" },
        protein: { type: "NUMBER" },
        lemak: { type: "NUMBER" },
      },
      required: ["karbo", "protein", "lemak"],
    },
    waktu_makan: { type: "STRING", enum: ["Pagi", "Siang", "Sore", "Malam"] },
    confidence: { type: "STRING" },
  },
  required: ["nama_makanan", "kalori", "rincian_nutrisi", "waktu_makan"],
};

const MODEL_PRIORITY = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
];

async function generateWithFallback(parts: unknown[], apiKey: string) {
  const configured = process.env.GEMINI_MODEL?.trim();
  const models = Array.from(
    new Set([configured, ...MODEL_PRIORITY].filter(Boolean) as string[])
  );

  let lastError = "Gemini gagal menganalisis makanan.";

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: schema,
              temperature: 0.2,
            },
          }),
        }
      );

      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return JSON.parse(text);
      }

      lastError =
        json?.error?.message || `Model ${model} gagal merespons (${res.status}).`;

      // Jika model sedang penuh (503) atau terkena limit sesaat (429), coba ulang sekali lalu pindah ke model berikutnya
      if (res.status === 503 || res.status === 429) {
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
        continue;
      }
      break;
    }
  }

  throw new Error(lastError);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && bearerToken) {
    const tokenRes = await supabase.auth.getUser(bearerToken);
    user = tokenRes.data.user;
  }

  if (!user) {
    return NextResponse.json(
      { error: "Sesi telah berakhir. Silakan muat ulang halaman atau login kembali." },
      { status: 401 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY belum dikonfigurasi." },
      { status: 500 }
    );
  }

  try {
    const form = await request.formData();
    const description = String(form.get("description") || "").trim();
    const image = form.get("image");

    if (!description && !(image instanceof File)) {
      return NextResponse.json(
        { error: "Tambahkan foto atau deskripsi makanan." },
        { status: 400 }
      );
    }

    const parts: unknown[] = [
      {
        text: `Anda ahli estimasi nutrisi makanan Indonesia. Analisis makanan berikut secara konservatif. Semua makro dalam gram dan kalori bilangan bulat. Tentukan waktu makan yang paling mungkin berdasarkan waktu lokal saat ini. Deskripsi pengguna: ${description || "Tidak ada deskripsi"}. Jangan memberi saran medis.`,
      },
    ];

    if (image instanceof File && image.size) {
      if (image.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Ukuran foto maksimal 5 MB." },
          { status: 400 }
        );
      }
      const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
      parts.push({
        inline_data: {
          mime_type: image.type || "image/jpeg",
          data: base64,
        },
      });
    }

    const result = await generateWithFallback(parts, process.env.GEMINI_API_KEY);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan saat analisis.",
      },
      { status: 500 }
    );
  }
}
