import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Viximate CRM",
  description: "Viximate internal CRM",
  icons: {
    icon: [
      { url: "/brand/favicon-32.png?v=4", type: "image/png", sizes: "32x32" },
      { url: "/brand/favicon.png?v=4", type: "image/png", sizes: "64x64" },
      { url: "/icon.png?v=4", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/brand/icon-192.png?v=4", type: "image/png", sizes: "192x192" }],
    shortcut: ["/brand/favicon-32.png?v=4"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
