import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { QueryProvider } from "@/lib/query/provider";

export const metadata: Metadata = {
  title: "NOVEX",
  description: "SaaS multi-tenant de gestion des associations.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "NOVEX",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b4ed8"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr-CI">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
