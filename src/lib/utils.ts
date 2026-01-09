import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind CSS 클래스 병합 유틸리티
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 숫자를 한국 원화 형식으로 포맷 (예: 1,234,567원)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * 숫자를 세 자리 콤마 형식으로 포맷
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * 퍼센트 형식으로 포맷
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${formatNumber(value, decimals)}%`;
}

/**
 * 배열의 중위값(median) 계산
 */
export function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * 배열의 합계 계산
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((acc, val) => acc + val, 0);
}

/**
 * 배열의 평균 계산
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

/**
 * 세그먼트 이름을 한글로 변환
 */
export function getSegmentLabel(segment: string): string {
  const labels: Record<string, string> = {
    'High-Volume': '고 클릭&CPC',
    'Efficiency': '고 클릭&저 CPC',
    'Long-tail': '저 클릭&저 CPC',
    'High-Cost': '저 클릭&고 CPC',
  };
  return labels[segment] || segment;
}

/**
 * 세그먼트별 색상 코드
 */
export function getSegmentColor(segment: string): string {
  const colors: Record<string, string> = {
    'High-Volume': '#3b82f6', // blue-500
    'Efficiency': '#10b981', // green-500
    'Long-tail': '#f59e0b', // amber-500
    'High-Cost': '#ef4444', // red-500
  };
  return colors[segment] || '#6b7280';
}

/**
 * 세그먼트별 배경 색상 (연한 버전)
 */
export function getSegmentBgColor(segment: string): string {
  const colors: Record<string, string> = {
    'High-Volume': '#dbeafe', // blue-100
    'Efficiency': '#d1fae5', // green-100
    'Long-tail': '#fef3c7', // amber-100
    'High-Cost': '#fee2e2', // red-100
  };
  return colors[segment] || '#f3f4f6';
}
