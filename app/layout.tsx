import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wheelhouse LivePro Training",
  description: "Three LivePro lessons for Wheelhouse staff.",

};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
