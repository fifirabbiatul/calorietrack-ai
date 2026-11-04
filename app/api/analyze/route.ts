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

// Urutan model cepat dengan latensi rendah (1-3 detik)
const MODEL_PRIORITY = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

async function generateWithFallback(parts: unknown[], apiKey: string) {
  const configured = process.env.GEMINI_MODEL?.trim();
  // Hindari gemini-3.5-flash yang sudah deprecated karena routing tambahannya menambah latensi
  const normalizedConfigured =
    configured === "gemini-3.5-flash" ? "gemini-3.6-flash" : configured;

  const models = Array.from(
    new Set([normalizedConfigured, ...MODEL_PRIORITY].filter(Boolean) as string[])
  );

  let lastError = "Gemini gagal menganalisis makanan.";

  for (const model of models) {
    try {
      const supportsZeroThinkingBudget =
        model.startsWith("gemini-2.5-") || model.includes("flash-lite");

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(9000),
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: schema,
              temperature: 0.2,
              ...(supportsZeroThinkingBudget
                ? { thinkingConfig: { thinkingBudget: 0 } }
                : {}),
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

      // Jika error karena API key salah / request tidak valid (400/401/403), jangan lanjut ke model lain kecuali 400 karena parameter
      if (res.status === 401 || res.status === 403) {
        break;
      }
    } catch (err) {
      lastError =
        err instanceof Error && err.name === "TimeoutError"
          ? `Model ${model} terlalu lama merespons, mencoba model cadangan...`
          : err instanceof Error
          ? err.message
          : "Koneksi ke Gemini terputus.";
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
        text: `Anda ahli estimasi nutrisi makanan Indonesia. Analisis makanan berikut secara konservatif dan cepat. Semua makro dalam gram dan kalori bilangan bulat. Tentukan waktu makan yang paling mungkin berdasarkan waktu lokal saat ini. Deskripsi pengguna: ${description || "Tidak ada deskripsi"}. Jangan memberi saran medis.`,
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
