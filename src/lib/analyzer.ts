import ExcelJS from 'exceljs';
import type {
  KeywordData,
  RankData,
  Segment,
  SegmentCriteria,
  SegmentStats,
  RankSimulation,
  AnalysisResult,
  ExcelRow,
} from '@/types';
import { calculateMedian, sum } from './utils';

/**
 * 엑셀 파일에서 데이터 파싱 (2줄 헤더 처리)
 * 네이버 검색광고 포맷:
 * - Row 1: PC/MO 구분
 * - Row 2: 순위별 클릭수/비용/CPC
 * - Data rows: 키워드별 데이터
 */
export async function parseExcelData(file: ArrayBuffer): Promise<KeywordData[]> {
  const workbook = new ExcelJS.Workbook();
  const buf = Buffer.from(new Uint8Array(file)) as unknown as Buffer;
  await workbook.xlsx.load(buf as any);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('엑셀 시트가 존재하지 않습니다.');
  }

  // 각 행을 배열 형태로 수집 (ExcelJS의 row.values는 1-based 인덱스)
  const rawData: any[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    rawData.push(values);
  });

  if (rawData.length < 3) {
    throw new Error('엑셀 파일 형식이 올바르지 않습니다. 최소 3줄 이상이 필요합니다.');
  }

  const header1 = rawData[0];
  const header2 = rawData[1];
  const dataRows = rawData.slice(2);

  const columnMap = buildColumnMap(header1, header2);

  const keywords: KeywordData[] = dataRows
    .filter((row) => row[0] && String(row[0]).trim())
    .map((row) => parseKeywordRow(row, columnMap));

  return keywords;
}

/**
 * 헤더 정보로부터 컬럼 매핑 생성
 */
function buildColumnMap(header1: any[], header2: any[]): Map<string, number> {
  const map = new Map<string, number>();
  // Merge/propagate device+rank header values when header1 uses merged cells
  let lastDeviceRaw = '';
  for (let i = 1; i < header1.length; i++) {
    const rawDevice = String(header1[i] || '').trim();
    const deviceRaw = rawDevice || lastDeviceRaw;
    if (deviceRaw) lastDeviceRaw = deviceRaw;

    const deviceText = String(deviceRaw || '').trim().toLowerCase();
    const metricText = String(header2[i] || '').trim().toLowerCase();

    // Determine device type from deviceText
    let deviceType = '';
    if (deviceText.includes('pc')) deviceType = 'PC';
    else if (deviceText.includes('mo') || deviceText.includes('mobile') || deviceText.includes('모바일')) deviceType = 'MO';

    // Extract rank from deviceText (e.g., "1순위", "1위") or fallback to header2
    let rank: number | null = null;
    const rankMatchFromDevice = String(deviceRaw || '').match(/(\d+)/);
    if (rankMatchFromDevice) {
      rank = parseInt(rankMatchFromDevice[1]);
    } else {
      const rankMatchFromMetric = metricText.match(/(\d+)/);
      if (rankMatchFromMetric) rank = parseInt(rankMatchFromMetric[1]);
    }

    if (!deviceType || rank === null) continue;

    // Map Korean metric names to internal metric keys
    let metricType = '';
    const m = metricText.replace(/\s+/g, '').toLowerCase();
    if (m.includes('예상노출수') || m.includes('노출수') || m.includes('노출')) metricType = 'impressions';
    else if (m.includes('예상클릭수') || m.includes('클릭수') || m.includes('클릭')) metricType = 'clicks';
    else if (m.includes('예상광고비용') || m.includes('광고비용') || m.includes('비용')) metricType = 'cost';
    else if (m.includes('예상cpc') || m.includes('cpc')) metricType = 'cpc';

    if (deviceType && metricType) {
      const key = `${deviceType}_${rank}_${metricType}`;
      map.set(key, i);
    }
  }

  return map;
}

/**
 * 개별 행 데이터를 KeywordData로 변환
 */
function parseKeywordRow(row: any[], columnMap: Map<string, number>): KeywordData {
  const keyword = String(row[0]).trim();

  // PC 데이터 (1~10위)
  const pc: Record<number, RankData> = {};
  for (let rank = 1; rank <= 10; rank++) {
    pc[rank] = {
      impressions: getColumnValue(row, columnMap, 'PC', rank, 'impressions'),
      clicks: getColumnValue(row, columnMap, 'PC', rank, 'clicks'),
      cost: getColumnValue(row, columnMap, 'PC', rank, 'cost'),
      cpc: getColumnValue(row, columnMap, 'PC', rank, 'cpc'),
    };
  }

  // MO 데이터 (1~5위)
  const mo: Record<number, RankData> = {};
  for (let rank = 1; rank <= 5; rank++) {
    mo[rank] = {
      impressions: getColumnValue(row, columnMap, 'MO', rank, 'impressions'),
      clicks: getColumnValue(row, columnMap, 'MO', rank, 'clicks'),
      cost: getColumnValue(row, columnMap, 'MO', rank, 'cost'),
      cpc: getColumnValue(row, columnMap, 'MO', rank, 'cpc'),
    };
  }

  // 디바이스별 개별 지표 (1위 기준)
  const pcClicks = pc[1].clicks;
  const moClicks = mo[1].clicks;
  const pcCost = pc[1].cost;
  const moCost = mo[1].cost;
  const pcCPC = pcClicks > 0 ? pcCost / pcClicks : 0;
  const moCPC = moClicks > 0 ? moCost / moClicks : 0;

  // 합산 지표 (PC 1위 + MO 1위)
  const totalClicks = pcClicks + moClicks;
  const totalCost = pcCost + moCost;
  const avgCPC = totalClicks > 0 ? totalCost / totalClicks : 0;

  return {
    keyword,
    pc,
    mo,
    pcClicks,
    moClicks,
    totalClicks,
    pcCost,
    moCost,
    totalCost,
    pcCPC,
    moCPC,
    avgCPC,
    segment: 'Long-tail', // 초기값, 나중에 분류
  };
}

/**
 * 컬럼 값 추출 헬퍼
 */
function getColumnValue(
  row: any[],
  columnMap: Map<string, number>,
  device: string,
  rank: number,
  metric: string
): number {
  const key = `${device}_${rank}_${metric}`;
  const colIndex = columnMap.get(key);
  if (colIndex === undefined) return 0;

  const value = row[colIndex];
  if (typeof value === 'number') return value;
  if (value === undefined || value === null) return 0;
  const cleaned = String(value).replace(/[,\s]+/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 중위값 기반 세그먼트 분류
 */
export function classifySegments(keywords: KeywordData[]): {
  keywords: KeywordData[];
  criteria: SegmentCriteria;
} {
  // 변경된 기준:
  // - 클릭수: 1위 클릭수의 평균(Mean)을 사용
  // - CPC: 1위 비용 합계 / 1위 클릭수 합계 (정수)
  // 또한 PC / MO를 분리하여 디바이스별 세그먼트를 생성

  // PC 1위 집계
  const pcTotalClicks = keywords.reduce((sum, k) => sum + k.pcClicks, 0);
  const pcTotalCost = keywords.reduce((sum, k) => sum + k.pcCost, 0);
  const pcAvgClicks = keywords.length > 0 ? pcTotalClicks / keywords.length : 0;
  const pcCPC = pcTotalClicks > 0 ? Math.floor(pcTotalCost / pcTotalClicks) : 0;

  // MO 1위 집계
  const moTotalClicks = keywords.reduce((sum, k) => sum + k.moClicks, 0);
  const moTotalCost = keywords.reduce((sum, k) => sum + k.moCost, 0);
  const moAvgClicks = keywords.length > 0 ? moTotalClicks / keywords.length : 0;
  const moCPC = moTotalClicks > 0 ? Math.floor(moTotalCost / moTotalClicks) : 0;

  // 기존 합산(하위호환) 기준: PC1 + MO1 기반 평균/비교(기존 로직 유지)
  const clicksRank1 = keywords.map((k) => (k.pc[1]?.clicks || 0) + (k.mo[1]?.clicks || 0));
  const cpcsRank1 = keywords.map((k) => {
    const clicks = (k.pc[1]?.clicks || 0) + (k.mo[1]?.clicks || 0);
    const cost = (k.pc[1]?.cost || 0) + (k.mo[1]?.cost || 0);
    return clicks > 0 ? cost / clicks : 0;
  });
  const medianClicks = calculateMedian(clicksRank1);
  const medianCPC = calculateMedian(cpcsRank1);

  // 세그먼트 분류: 디바이스별로 판단하여 추가 필드로 저장
  const classified = keywords.map((keyword) => {
    const segPc = determineSegmentPerDevice(keyword, pcAvgClicks, pcCPC, 'PC');
    const segMo = determineSegmentPerDevice(keyword, moAvgClicks, moCPC, 'MO');
    return {
      ...keyword,
      segment: determineSegment(keyword, medianClicks, medianCPC), // 기존 전체 기준
      segmentPc: segPc,
      segmentMo: segMo,
    } as KeywordData;
  });

  return {
    keywords: classified,
    criteria: {
      medianClicks,
      medianCPC,
      pcAvgClicks,
      moAvgClicks,
      pcCPC,
      moCPC,
    },
  };
}

/**
 * 개별 키워드의 세그먼트 결정
 */
function determineSegment(
  keyword: KeywordData,
  medianClicks: number,
  medianCPC: number
): Segment {
  const highClicks = keyword.totalClicks > medianClicks;
  const highCPC = keyword.avgCPC > medianCPC;

  if (highClicks && highCPC) return 'High-Volume';
  if (highClicks && !highCPC) return 'Efficiency';
  if (!highClicks && !highCPC) return 'Long-tail';
  return 'High-Cost';
}

/**
 * 디바이스별로 분리된 세그먼트 결정 함수
 */
function determineSegmentPerDevice(
  keyword: KeywordData,
  avgClicks: number,
  deviceCPC: number,
  device: 'PC' | 'MO'
): Segment {
  const rank1 = device === 'PC' ? keyword.pc[1] || { clicks: 0, cost: 0, cpc: 0 } : keyword.mo[1] || { clicks: 0, cost: 0, cpc: 0 };
  const clicks = rank1.clicks || 0;
  const cost = rank1.cost || 0;
  const cpc = clicks > 0 ? Math.floor(cost / clicks) : 0;

  const highClicks = clicks > avgClicks;
  const highCPC = cpc > deviceCPC;

  if (highClicks && highCPC) return 'High-Volume';
  if (highClicks && !highCPC) return 'Efficiency';
  if (!highClicks && !highCPC) return 'Long-tail';
  return 'High-Cost';
}

/**
 * 세그먼트별 통계 및 순위 시뮬레이션 계산
 */
export function calculateSegmentStats(keywords: KeywordData[]): SegmentStats[] {
  const segments: Segment[] = ['High-Volume', 'Efficiency', 'Long-tail', 'High-Cost'];
  const totalBudget = sum(keywords.map((k) => k.totalCost));

  return segments.map((segment) => {
    // Use device-specific segmentation when aggregating simulations
    const pcKeywords = keywords.filter((k) => (k.segmentPc || k.segment) === segment);
    const moKeywords = keywords.filter((k) => (k.segmentMo || k.segment) === segment);
    const segmentKeywordsUnion = keywords.filter((k) => (k.segmentPc || k.segment) === segment || (k.segmentMo || k.segment) === segment);
    // for backward compatibility and used in UI counts
    const segmentKeywords = segmentKeywordsUnion;
    const segmentBudget = sum(segmentKeywordsUnion.map((k) => k.totalCost));

    // PC 시뮬레이션 (1~10위)
    const pcRanks = Array.from({ length: 10 }, (_, i) => i + 1);
    const pcSimulations: RankSimulation[] = pcRanks.map((rank) => {
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalCost = 0;
      pcKeywords.forEach((kw) => {
        const d = kw.pc[rank] || { impressions: 0, clicks: 0, cost: 0, cpc: 0 };
        totalImpressions += d.impressions;
        totalClicks += d.clicks;
        totalCost += d.cost;
      });
      const avgCPC = totalClicks > 0 ? totalCost / totalClicks : 0;
      return { rank, totalImpressions, totalClicks, totalCost, avgCPC } as RankSimulation;
    });

    // MO 시뮬레이션 (1~5위)
    const moRanks = Array.from({ length: 5 }, (_, i) => i + 1);
    const moSimulations: RankSimulation[] = moRanks.map((rank) => {
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalCost = 0;
      moKeywords.forEach((kw) => {
        const d = kw.mo[rank] || { impressions: 0, clicks: 0, cost: 0, cpc: 0 };
        totalImpressions += d.impressions;
        totalClicks += d.clicks;
        totalCost += d.cost;
      });
      const avgCPC = totalClicks > 0 ? totalCost / totalClicks : 0;
      return { rank, totalImpressions, totalClicks, totalCost, avgCPC } as RankSimulation;
    });

    // 변화율 계산: 각 순위를 바로 이전 순위와 비교하여 비용/avgCPC 변화율을 구함 (1위는 '-')
    for (let i = 0; i < pcSimulations.length; i++) {
      const sim = pcSimulations[i];
      if (i === 0) {
        sim.costChangeRate = undefined;
        sim.avgCPCChangeRate = undefined;
      } else {
        const prev = pcSimulations[i - 1];
        sim.costChangeRate = prev.totalCost > 0 ? ((sim.totalCost - prev.totalCost) / prev.totalCost) * 100 : undefined;
        sim.avgCPCChangeRate = prev.avgCPC > 0 ? ((sim.avgCPC - prev.avgCPC) / prev.avgCPC) * 100 : undefined;
      }
    }

    for (let i = 0; i < moSimulations.length; i++) {
      const sim = moSimulations[i];
      if (i === 0) {
        sim.costChangeRate = undefined;
        sim.avgCPCChangeRate = undefined;
      } else {
        const prev = moSimulations[i - 1];
        sim.costChangeRate = prev.totalCost > 0 ? ((sim.totalCost - prev.totalCost) / prev.totalCost) * 100 : undefined;
        sim.avgCPCChangeRate = prev.avgCPC > 0 ? ((sim.avgCPC - prev.avgCPC) / prev.avgCPC) * 100 : undefined;
      }
    }

    const maxChangeRankPc = findMaxChangeRank(pcSimulations);
    const maxChangeRankMo = findMaxChangeRank(moSimulations);

    // 전체 순위(1~10) 시뮬레이션을 모두 포함하여 반환
    const allRanks = Array.from({ length: 10 }, (_, i) => i + 1);
    const simulations = allRanks.map((rank) => {
      const pc = pcSimulations.find((s) => s.rank === rank) || { totalImpressions: 0, totalClicks: 0, totalCost: 0, avgCPC: 0 };
      const mo = moSimulations.find((s) => s.rank === rank) || { totalImpressions: 0, totalClicks: 0, totalCost: 0, avgCPC: 0 };
      const totalImpressions = (pc.totalImpressions || 0) + (mo.totalImpressions || 0);
      const totalClicks = (pc.totalClicks || 0) + (mo.totalClicks || 0);
      const totalCost = (pc.totalCost || 0) + (mo.totalCost || 0);
      const avgCPC = totalClicks > 0 ? totalCost / totalClicks : 0;
      return { rank, totalImpressions, totalClicks, totalCost, avgCPC } as RankSimulation;
    });

    return {
      segment,
      keywordCount: segmentKeywords.length,
      // budgetRatio: fraction (0-1) to be formatted by utils.formatPercent
      budgetRatio: totalBudget > 0 ? (segmentBudget / totalBudget) : 0,
      simulations,
      pcSimulations,
      moSimulations,
      maxChangeRank: findMaxChangeRank(simulations),
      maxChangeRankPc,
      maxChangeRankMo,
    } as SegmentStats;
  });
}

/**
 * 특정 순위에서의 세그먼트 전체 합산 지표 계산
 */
function calculateRankSimulation(
  keywords: KeywordData[],
  rank: number
): RankSimulation {
  let totalClicks = 0;
  let totalCost = 0;

  // per-device breakdown
  let pcClicks = 0;
  let pcCost = 0;
  let moClicks = 0;
  let moCost = 0;

  keywords.forEach((keyword) => {
    const pcData = keyword.pc[rank] || { clicks: 0, cost: 0, cpc: 0 };
    const moData = keyword.mo[rank] || { clicks: 0, cost: 0, cpc: 0 };

    pcClicks += pcData.clicks;
    pcCost += pcData.cost;

    moClicks += moData.clicks;
    moCost += moData.cost;

    totalClicks += pcData.clicks + moData.clicks;
    totalCost += pcData.cost + moData.cost;
  });

  const avgCPC = totalClicks > 0 ? totalCost / totalClicks : 0;
  const pcAvgCPC = pcClicks > 0 ? pcCost / pcClicks : 0;
  const moAvgCPC = moClicks > 0 ? moCost / moClicks : 0;

  return {
    rank,
    totalClicks,
    totalCost,
    avgCPC,
    pcClicks,
    pcCost,
    pcAvgCPC,
    moClicks,
    moCost,
    moAvgCPC,
  } as any;
}

/**
 * 최대 변동 구간 찾기 (비용 변화율이 가장 큰 구간)
 */
function findMaxChangeRank(simulations: RankSimulation[]): number {
  let maxRate = 0;
  let maxRank = 1;

  simulations.forEach((sim) => {
    if (sim.costChangeRate && sim.costChangeRate > maxRate) {
      maxRate = sim.costChangeRate;
      maxRank = sim.rank;
    }
  });

  return maxRank;
}

/**
 * 전체 분석 실행
 */
export async function analyzeData(file: ArrayBuffer): Promise<AnalysisResult> {
  const parsedKeywords = await parseExcelData(file);

  const { keywords, criteria } = classifySegments(parsedKeywords);

  const segmentStats = calculateSegmentStats(keywords);

  // Top 10은 리포트 탭(All/PC/MO)에 따라 동적으로 결정되므로
  // 여기서는 전체 totalCost 기준으로 정렬 (UI에서 재정렬 가능)
  const topKeywords = [...keywords]
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10);

  return {
    criteria,
    keywords,
    segmentStats,
    topKeywords,
  };
}

// 세그먼트 별 개념 설명 (한글)
export const SEGMENT_DESCRIPTIONS: Record<string, string> = {
  'High-Volume': '고성과: 클릭수와 광고비가 모두 높은 키워드로, 즉각적인 확장에 유리합니다.',
  'Efficiency': '효율형: 클릭수는 높지만 CPC가 낮아 비용 효율성이 좋은 키워드입니다.',
  'Long-tail': '롱테일: 클릭수와 비용이 낮지만 전환 가능성이 있는 키워드입니다.',
  'High-Cost': '고비용: 클릭수는 낮지만 CPC가 높아 관리가 필요한 키워드입니다.',
};
