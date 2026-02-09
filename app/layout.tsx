import "./globals.css"; 
import type { Metadata, Viewport } from "next"; // Added Viewport type
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

// 1. Metadata: Tells the browser about your app name and icon file
export const metadata: Metadata = {
  title: "Yangerila CRM",
  description: "Internal Management System",
  manifest: "/manifest.json", // 👈 This connects your PWA file
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Yangerila CRM",
  },
};

// 2. Viewport: Tells the phone how to scale the app (No zooming allowed)
export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Makes it feel like a real app
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}