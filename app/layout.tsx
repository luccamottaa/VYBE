import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "vybe · Music & Data Intel",
  description: "Charts do Apple Music e do Spotify, streams, posições e histórico.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
