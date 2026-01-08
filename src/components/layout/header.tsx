"use client";

import Link from "next/link";
import { BarChart3, Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 로고 및 타이틀 */}
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-semibold text-gray-900">
            네이버 검색광고 분석
          </span>
        </Link>

        {/* 네비게이션 */}
        <nav className="flex items-center gap-1">
          <Button
            variant={pathname === "/" ? "default" : "ghost"}
            size="sm"
            asChild
          >
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">홈</span>
            </Link>
          </Button>

          <Button
            variant={pathname === "/dashboard" ? "default" : "ghost"}
            size="sm"
            asChild
          >
            <Link href="/dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">대시보드</span>
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
