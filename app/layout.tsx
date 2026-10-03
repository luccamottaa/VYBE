import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VYBE · Charts de música",
  description: "Rankings musicais, posições e histórico por país.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
