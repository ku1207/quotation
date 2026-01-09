import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "네이버 검색광고 견적 분석 도구",
  description: "네이버 검색광고 견적을 AI 기반으로 분석하고 전략을 제시합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="antialiased">
        <Header />
        <main className="min-h-[calc(100vh-65px)]">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
