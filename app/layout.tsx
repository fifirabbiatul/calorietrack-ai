import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "CalorieTrack.ai — Asisten Nutrisi Harian", description: "Lacak kalori dan nutrisi harian dengan bantuan AI." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="id"><body>{children}</body></html>; }
