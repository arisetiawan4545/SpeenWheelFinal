
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MySehati Speen Wheel Gamification",
  description: "Spin Wheel Gamification Management System",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0f172a]">
        {children}
      </body>
    </html>
  );
}