import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "WANT.",
  description: "AI shopping agent",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
