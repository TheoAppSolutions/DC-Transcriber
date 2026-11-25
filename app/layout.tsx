import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Noted — Audio Transcript Builder", description: "A little more clarity for the things worth hearing." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
