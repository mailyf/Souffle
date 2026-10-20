import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soufflé | Bakery Studio",
  description: "The daily operations studio for Soufflé Bakery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
