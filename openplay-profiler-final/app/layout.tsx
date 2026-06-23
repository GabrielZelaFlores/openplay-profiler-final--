import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenPlay Profiler",
  description: "Herramienta de profiling y visualización para el dataset OpenPlay",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col bg-gray-50">{children}</body>
    </html>
  );
}
