import { z } from 'zod';

// 순위별 데이터 (PC/MO 각각 1~15위, 1~5위)
export interface RankData {
  clicks: number;
  cost: number;
  cpc: number;
}

// 키워드별 전체 데이터
export interface KeywordData {
  keyword: string;
  pc: Record<number, RankData>; // 1~15위
  mo: Record<number, RankData>; // 1~5위
  totalClicks: number; // PC 1위 + MO 1위 클릭수 합
  totalCost: number; // PC 1위 + MO 1위 비용 합
  avgCPC: number; // 평균 CPC (PC 1위 + MO 1위)
  // 기존 전체 기준 세그먼트
  segment: Segment;
  // 디바이스별 세그먼트 분류 (선택된 디바이스에 따라 UI에서 사용)
  segmentPc?: Segment;
  segmentMo?: Segment;
}

// 세그먼트 타입
export type Segment = 'High-Volume' | 'Efficiency' | 'Long-tail' | 'High-Cost';

// 세그먼트별 분류 기준
export interface SegmentCriteria {
  // 기존(합산) 기준 유지(하위 호환)
  medianClicks: number;
  medianCPC: number;
  // 디바이스별 기준 (요청대로 PC/MO 분리)
  pcAvgClicks?: number; // PC 1위 클릭수 평균 (mean)
  moAvgClicks?: number; // MO 1위 클릭수 평균 (mean)
  pcCPC?: number; // PC 1위 전체 비용 합 / 클릭수 합 (정수)
  moCPC?: number; // MO 1위 전체 비용 합 / 클릭수 합 (정수)
}

// 순위별 시뮬레이션 데이터
export interface RankSimulation {
  rank: number;
  totalClicks: number;
  totalCost: number;
  avgCPC: number;
  incrementalCPC?: number; // iCPC (증분 단가)
  costChangeRate?: number; // 비용 변화율
  avgCPCChangeRate?: number; // 평균 CPC 변화율
}

// 확장: PC/MO 분해된 시뮬레이션
export interface RankSimulationPerDevice extends RankSimulation {
  pcClicks: number;
  pcCost: number;
  pcAvgCPC: number;
  moClicks: number;
  moCost: number;
  moAvgCPC: number;
}

// 세그먼트별 통계
export interface SegmentStats {
  segment: Segment;
  keywordCount: number;
  budgetRatio: number; // 예산 비중 (%)
  simulations: RankSimulation[]; // 전체/요약 시뮬레이션
  pcSimulations: RankSimulation[]; // PC 1~15위 시뮬레이션
  moSimulations: RankSimulation[]; // MO 1~5위 시뮬레이션
  maxChangeRank?: number; // 최대 변동 구간 (요약)
  maxChangeRankPc?: number; // PC 최대 변동 구간
  maxChangeRankMo?: number; // MO 최대 변동 구간
}

// 전체 분석 결과
export interface AnalysisResult {
  criteria: SegmentCriteria;
  keywords: KeywordData[];
  segmentStats: SegmentStats[];
  topKeywords: KeywordData[]; // 광고비 상위 10개
}

// 세그먼트 설명(한글) 추가
export interface AnalysisResultWithDescriptions extends AnalysisResult {
  segmentDescriptions?: Record<string, string>;
}

// AI 생성 리포트
export interface AIReport {
  segmentInsights: Record<Segment, string>; // 세그먼트별 집중 코멘트
  strategies: {
    aggressive: StrategyDetail; // 공격
    efficiency: StrategyDetail; // 효율
    defensive: StrategyDetail; // 방어
  };
}

// 전략 상세
export interface StrategyDetail {
  background: string; // 전략 배경
  execution: string; // 실행 방법
  expectedKPI: string; // 예상 KPI 변화
}

// Zod 스키마
export const RankDataSchema = z.object({
  clicks: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  cpc: z.number().nonnegative(),
});

export const KeywordDataSchema = z.object({
  keyword: z.string(),
  pc: z.record(z.string(), RankDataSchema),
  mo: z.record(z.string(), RankDataSchema),
  totalClicks: z.number(),
  totalCost: z.number(),
  avgCPC: z.number(),
  segment: z.enum(['High-Volume', 'Efficiency', 'Long-tail', 'High-Cost']),
  segmentPc: z.enum(['High-Volume', 'Efficiency', 'Long-tail', 'High-Cost']).optional(),
  segmentMo: z.enum(['High-Volume', 'Efficiency', 'Long-tail', 'High-Cost']).optional(),
});

// 엑셀 원본 데이터 행
export interface ExcelRow {
  keyword: string;
  [key: string]: string | number; // 동적 컬럼 (순위별 클릭/비용/CPC)
}
