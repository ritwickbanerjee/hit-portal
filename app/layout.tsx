import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MAAP - Math Attendance Assignment Portal",
  description: "MAAP - Math Attendance Assignment Portal",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MAAP",
  }
};

export const viewport = {
  themeColor: "#0a0f1a",
};

import connectDB from '@/lib/db';
import Config from '@/models/Config';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let activePlatform = 'vercel';
  try {
      await connectDB();
      const config = await Config.findOne({}).lean();
      if (config?.activePlatform) {
          activePlatform = config.activePlatform;
      }
  } catch (e) {
      console.error("Failed to fetch routing config:", e);
  }

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
              const hostname = window.location.hostname;
              const activePlatform = "${activePlatform}";
              if (activePlatform === "vercel" && hostname.includes("netlify.app")) {
                  window.location.href = "https://hit-portal.vercel.app" + window.location.pathname + window.location.search;
              } else if (activePlatform === "netlify" && hostname.includes("vercel.app")) {
                  window.location.href = "https://hit-portal.netlify.app" + window.location.pathname + window.location.search;
              }
          })();
        ` }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
