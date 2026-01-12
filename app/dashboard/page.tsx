'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  TrendingUp,
  Target,
  Shield,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Info,
} from 'lucide-react';
import type { AnalysisResult, AIReport, Segment } from '@/types';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  getSegmentLabel,
  getSegmentColor,
  getSegmentBgColor,
  cn,
} from '@/lib/utils';

export default function Dashboard() {
  const router = useRouter();
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [aiReports, setAiReports] = useState<{ All?: AIReport; PC?: AIReport; MO?: AIReport }>({});
  const [selectedSegment, setSelectedSegment] = useState<Segment | 'All'>('All');
  const [reportTab, setReportTab] = useState<'All' | 'PC' | 'MO'>('All');
  const [hoveredSegment, setHoveredSegment] = useState<Segment | 'All' | null>(null);
  const [openScenario, setOpenScenario] = useState<{ [k: string]: boolean }>({});
    const [showCriteriaBubble, setShowCriteriaBubble] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // localStorage에서 분석 결과 로드
    const stored = localStorage.getItem('analysisResult');
    if (!stored) {
      router.push('/');
      return;
    }

    const data = JSON.parse(stored) as AnalysisResult;
    setAnalysisResult(data);

    // localStorage에서 AI 리포트 로드
    const storedAiReport = localStorage.getItem('aiReport');
    if (storedAiReport) {
      try {
        const parsed = JSON.parse(storedAiReport);
        // support both legacy single-report and new per-device map
        if (parsed && parsed.strategies) {
          setAiReports({ All: parsed });
        } else {
          setAiReports(parsed || {});
        }
      } catch (err) {
        console.error('AI 리포트 로드 실패:', err);
        // 로드 실패 시 새로 생성
        generateAIReport(data);
      }
    } else {
      // AI 리포트가 없으면 생성
      generateAIReport(data);
    }
  }, [router]);

  const generateAIReport = async (data: AnalysisResult) => {
    setLoadingAI(true);
    setError(null);

    try {
      const devices = ['All', 'PC', 'MO'];
      const calls = devices.map((dev) =>
        fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysisResult: data, device: dev }),
        }).then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'AI 생성 실패');
          return { dev, report: json.report };
        })
      );

      const results = await Promise.all(calls);
      const map: { All?: AIReport; PC?: AIReport; MO?: AIReport } = {};
      results.forEach((r) => {
        if (r.dev === 'All') map.All = r.report;
        if (r.dev === 'PC') map.PC = r.report;
        if (r.dev === 'MO') map.MO = r.report;
      });
      setAiReports(map);
      try {
        localStorage.setItem('aiReport', JSON.stringify(map));
      } catch (e) {
        // ignore storage errors
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoadingAI(false);
    }
  };

  // Card selection is handled via `selectedSegment` (cards act as buttons)

  const getFilteredSegmentStats = () => {
    if (!analysisResult) return [];
    // Always group by overall `kw.segment` to ensure consistent classification across devices
    const keywords = analysisResult.keywords;
    const segmentMap = new Map<Segment, { keywords: typeof keywords, totalCost: number }>();

    keywords.forEach(kw => {
      const segment = kw.segment;
      if (!segmentMap.has(segment)) {
        segmentMap.set(segment, { keywords: [], totalCost: 0 });
      }
      const entry = segmentMap.get(segment)!;
      entry.keywords.push(kw);

      // For budget ratio, sum the 1위 비용 of the selected device when applicable, otherwise sum totalCost
      const cost = reportTab === 'PC' ? (kw.pc[1]?.cost || 0) : reportTab === 'MO' ? (kw.mo[1]?.cost || 0) : (kw.totalCost || 0);
      entry.totalCost += cost;
    });

    const totalCost = Array.from(segmentMap.values()).reduce((sum, entry) => sum + entry.totalCost, 0);

    // Convert to SegmentStats-like objects using original simulations where available
    return Array.from(segmentMap.entries()).map(([segment, entry]) => {
      const originalStats = segmentStats.find(s => s.segment === segment);
      return {
        segment,
        keywordCount: entry.keywords.length,
        budgetRatio: totalCost > 0 ? (entry.totalCost / totalCost) : 0,
        simulations: originalStats?.simulations || [],
        pcSimulations: originalStats?.pcSimulations || [],
        moSimulations: originalStats?.moSimulations || [],
        maxChangeRank: originalStats?.maxChangeRank,
        maxChangeRankPc: originalStats?.maxChangeRankPc,
        maxChangeRankMo: originalStats?.maxChangeRankMo,
      };
    });
  };

  if (!analysisResult) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const { criteria, segmentStats, topKeywords, keywords } = analysisResult;
  const criteriaMarkdown = `
### 분류 기준

- **전체(ALL)**: PC 1위와 Mobile 1위 견적을 합산하여 평균 클릭 및 평균 CPC를 계산합니다.

- **전체 평균 1위 클릭수**: ${formatNumber((criteria as any).overallAvgClicks || 0)}회  
- **전체 평균 1위 CPC**: ${formatCurrency((criteria as any).overallAvgCPC || 0)}

#### PC 기준
- PC 1순위 평균 클릭수: ${formatNumber(criteria.pcAvgClicks || 0)}회  
- PC 1순위 평균 CPC: ${formatCurrency(criteria.pcCPC || 0)}

#### Mobile 기준
- Mobile 1순위 평균 클릭수: ${formatNumber(criteria.moAvgClicks || 0)}회  
- Mobile 1순위 평균 CPC: ${formatCurrency(criteria.moCPC || 0)}

### 세그먼트 정의
- **${getSegmentLabel('High-Volume')}**: 평균 클릭 이상 & 평균 CPC 이상 — 클릭수와 비용이 모두 높은 키워드로, 확장 우선.
- **${getSegmentLabel('Efficiency')}**: 평균 클릭 이상 & 평균 CPC 미만 — 클릭은 많고 비용 효율성이 높은 키워드.
- **${getSegmentLabel('Long-tail')}**: 평균 클릭 미만 & 평균 CPC 미만 — 클릭과 비용이 낮아 롱테일 성격의 키워드.
- **${getSegmentLabel('High-Cost')}**: 평균 클릭 미만 & 평균 CPC 이상 — 클릭은 적지만 CPC가 높아 관리를 요함.
`;
  const hasParsedData = Array.isArray(segmentStats) && segmentStats.length > 0 && Array.isArray(topKeywords) && topKeywords.length > 0;

  // 세그먼트 고정 순서
  const segmentOrder: Array<Segment | 'All'> = ['All', 'High-Volume', 'Efficiency', 'Long-tail', 'High-Cost'];

  // 세그먼트 순서대로 정렬
  const orderedSegmentStats = segmentOrder
    .filter(seg => seg !== 'All')
    .map(seg => segmentStats.find(s => s.segment === seg))
    .filter((s): s is typeof segmentStats[number] => s !== undefined);

  const filteredSegmentStats = getFilteredSegmentStats();

  // 필터링된 결과도 순서대로 정렬
  const orderedFilteredStats = segmentOrder
    .filter(seg => seg !== 'All')
    .map(seg => filteredSegmentStats.find(s => s.segment === seg))
    .filter((s): s is typeof filteredSegmentStats[number] => s !== undefined);

  const currentSegmentStats = selectedSegment === 'All'
    ? undefined
    : orderedFilteredStats.find((s) => s.segment === selectedSegment);

  // segment counts are computed from overall `kw.segment` in getFilteredSegmentStats

  const currentAi = (aiReports as any)[reportTab] || aiReports.All;

  // Build table data for the selected segment and report tab
  const tableData: any[] = (() => {
    // If '전체' selected, compute aggregated simulations across all keywords
    if (selectedSegment === 'All') {
      const ranks = Array.from({ length: 10 }, (_, i) => i + 1);
      return ranks.map((rank) => {
        let totalImpressions = 0;
        let totalClicks = 0;
        let totalCost = 0;
        keywords.forEach((kw) => {
          const pc = kw.pc[rank] || { impressions: 0, clicks: 0, cost: 0 };
          const mo = kw.mo[rank] || { impressions: 0, clicks: 0, cost: 0 };
          totalImpressions += (pc.impressions || 0) + (mo.impressions || 0);
          totalClicks += (pc.clicks || 0) + (mo.clicks || 0);
          totalCost += (pc.cost || 0) + (mo.cost || 0);
        });
        const avgCPC = totalClicks > 0 ? totalCost / totalClicks : 0;
        return { rank, totalImpressions, totalClicks, totalCost, avgCPC } as any;
      });
    }

    if (!currentSegmentStats) return [];
    if (reportTab === 'PC') return currentSegmentStats.pcSimulations || [];
    if (reportTab === 'MO') return currentSegmentStats.moSimulations || [];
    return currentSegmentStats.simulations || [];
  })();

  const hasData = tableData && tableData.length > 0;

  // Ensure tableData is sorted by rank and compute change rates if missing
  const tableDataProcessed = (() => {
    const arr = [...tableData].sort((a, b) => (a.rank || 0) - (b.rank || 0));
    if (!arr.length) return arr;
    return arr.map((sim: any, idx: number) => {
      if (sim.costChangeRate !== undefined && sim.avgCPCChangeRate !== undefined) return sim;
      if (idx === 0) {
        return { ...sim, costChangeRate: undefined, avgCPCChangeRate: undefined };
      }
      const prev = arr[idx - 1];
      const costChange = prev.totalCost > 0 ? ((sim.totalCost - prev.totalCost) / prev.totalCost) * 100 : undefined;
      const avgCPCChange = prev.avgCPC > 0 ? ((sim.avgCPC - prev.avgCPC) / prev.avgCPC) * 100 : undefined;
      return { ...sim, costChangeRate: costChange, avgCPCChangeRate: avgCPCChange };
    });
  })();

  // Chart data for rank vs metrics
  const chartData = tableDataProcessed.map((d) => ({
    rank: d.rank,
    totalClicks: d.totalClicks || 0,
    totalCost: d.totalCost || 0,
    avgCPC: d.avgCPC || 0,
  }));

  // Precompute max-change ranks and highlight rule for table rendering
  let maxAbsCPCChangeRank = -1;
  let maxAbsCostChangeRank = -1;
  let maxAbsCPCChange = 0;
  let maxAbsCostChange = 0;
  tableDataProcessed.forEach((sim: any) => {
    if (sim.avgCPCChangeRate !== undefined && sim.avgCPCChangeRate !== null) {
      const absVal = Math.abs(sim.avgCPCChangeRate);
      if (absVal > maxAbsCPCChange) {
        maxAbsCPCChange = absVal;
        maxAbsCPCChangeRank = sim.rank;
      }
    }
    if (sim.costChangeRate !== undefined && sim.costChangeRate !== null) {
      const absVal = Math.abs(sim.costChangeRate);
      if (absVal > maxAbsCostChange) {
        maxAbsCostChange = absVal;
        maxAbsCostChangeRank = sim.rank;
      }
    }
  });

  const shouldHighlight = (rank: number) => {
    if (maxAbsCPCChangeRank === maxAbsCostChangeRank && rank === maxAbsCPCChangeRank) return true;
    if (maxAbsCPCChangeRank !== maxAbsCostChangeRank) return rank === maxAbsCPCChangeRank || rank === maxAbsCostChangeRank;
    return false;
  };

  // Top 10 키워드를 디바이스별로 정렬 (세그먼트 필터링 시 10개 미만도 허용)
  const getTopKeywords = () => {
    let list = [...keywords];
    if (selectedSegment !== 'All') {
      // Always filter by overall segment classification
      list = list.filter((kw) => kw.segment === selectedSegment);
    }
    // Exclude keywords with rank1 cost === 0 for device tabs; for All exclude sum === 0
    if (reportTab === 'PC') {
      list = list.filter((kw) => (kw.pc?.[1]?.cost || 0) > 0);
    } else if (reportTab === 'MO') {
      list = list.filter((kw) => (kw.mo?.[1]?.cost || 0) > 0);
    } else {
      list = list.filter((kw) => ((kw.pc?.[1]?.cost || 0) + (kw.mo?.[1]?.cost || 0)) > 0);
    }

    const sorted = list.sort((a, b) => {
      const costA = reportTab === 'PC' ? (a.pc[1]?.cost || 0) : reportTab === 'MO' ? (a.mo[1]?.cost || 0) : ((a.pc[1]?.cost || 0) + (a.mo[1]?.cost || 0));
      const costB = reportTab === 'PC' ? (b.pc[1]?.cost || 0) : reportTab === 'MO' ? (b.mo[1]?.cost || 0) : ((b.pc[1]?.cost || 0) + (b.mo[1]?.cost || 0));
      return costB - costA;
    });

    // Return up to 10 keywords, or fewer if segment has less
    return sorted.slice(0, Math.min(10, sorted.length));
  };

  const displayTopKeywords = getTopKeywords();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                네이버 검색광고 분석 리포트
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* 리포트 탭 (전체/PC/Mobile) */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1">
            <button
              onClick={() => setReportTab('All')}
              className={cn(
                'px-6 py-3 font-medium border-b-2 transition-colors',
                reportTab === 'All'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              전체
            </button>
            <button
              onClick={() => setReportTab('PC')}
              className={cn(
                'px-6 py-3 font-medium border-b-2 transition-colors',
                reportTab === 'PC'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              PC
            </button>
            <button
              onClick={() => setReportTab('MO')}
              className={cn(
                'px-6 py-3 font-medium border-b-2 transition-colors',
                reportTab === 'MO'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              Mobile
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* 섹션 1: 전략 시나리오 (moved up) */}
        {( (aiReports as any)[reportTab] || aiReports.All ) && (
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">전략 시나리오</h2>
              {error && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 시나리오 A: 공격 */}
                <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-red-500">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">공격 전략</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">전략 배경</h4>
                      <p className="text-sm text-gray-600">{currentAi.strategies.aggressive.background}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">실행 방법</h4>
                      <p className="text-sm text-gray-600">{currentAi.strategies.aggressive.execution}</p>
                    </div>
                  </div>
                </div>

                {/* 시나리오 B: 효율 */}
                <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-green-500">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Target className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">효율 전략</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">전략 배경</h4>
                      <p className="text-sm text-gray-600">{currentAi.strategies.efficiency.background}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">실행 방법</h4>
                      <p className="text-sm text-gray-600">{currentAi.strategies.efficiency.execution}</p>
                    </div>
                  </div>
                </div>

                {/* 시나리오 C: 방어 */}
                <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-blue-500">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Shield className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">방어 전략</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">전략 배경</h4>
                      <p className="text-sm text-gray-600">{currentAi.strategies.defensive.background}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">실행 방법</h4>
                      <p className="text-sm text-gray-600">{currentAi.strategies.defensive.execution}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            )}

        {/* 섹션 2: 키워드 세그먼트 */}
        <section className="bg-indigo-50 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-bold text-gray-900 mb-0">키워드 세그먼트</h2>
              <p className="text-sm text-gray-600">세그먼트를 클릭하여 데이터를 확인하세요</p>
            </div>
            <button
              aria-label="분류 기준 정보"
              onClick={() => setShowCriteriaBubble(s => !s)}
              className="ml-2 text-gray-500 hover:text-gray-700"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>

          {/* criteria popover */}
          {showCriteriaBubble && (
            <div className="relative">
              <div className="absolute right-0 z-20 mt-2 bg-white border rounded-lg shadow-lg p-4 text-sm text-gray-700" style={{ width: '34rem' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{criteriaMarkdown}</ReactMarkdown>
              </div>
            </div>
          )}
          

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4 pl-4">
            {/* 전체 카드 */}
            {(() => {
              const totalKeywordCount = keywords.length;
              const totalBudgetRatio = 1; // fraction (100% == 1)

              return (
                <div key="All" className={cn('rounded-lg overflow-hidden', 'shadow', 'bg-white')}>
                  <button
                    onClick={() => setSelectedSegment('All')}
                    onMouseEnter={() => setHoveredSegment('All')}
                    onMouseLeave={() => setHoveredSegment(null)}
                    className={cn(
                      'w-full p-4 text-left transition-colors',
                      selectedSegment === 'All' ? 'ring-2 ring-offset-1 ring-blue-300' : ''
                    )}
                    style={hoveredSegment === 'All' ? { backgroundColor: '#f3f4f6' } : undefined}
                  >
                    <div
                      className="inline-block px-2 py-1 rounded-full text-xs font-medium mb-3"
                      style={{
                        backgroundColor: '#f3f4f6',
                        color: '#6b7280',
                      }}
                    >
                      전체
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 mb-1">키워드 수</p>
                        <p className="text-lg font-semibold text-gray-900">{totalKeywordCount}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 mb-1">광고비 비중</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatPercent(totalBudgetRatio)}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })()}

            {/* 세그먼트별 카드 */}
            {orderedFilteredStats.map((stat) => {
              const segmentKeywords = keywords.filter(kw => kw.segment === stat.segment);

              return (
                <div key={stat.segment} className={cn('rounded-lg overflow-hidden', 'shadow', 'bg-white')}>
                  <button
                    onClick={() => setSelectedSegment(stat.segment)}
                    onMouseEnter={() => setHoveredSegment(stat.segment)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    className={cn(
                      'w-full p-4 text-left transition-colors',
                      selectedSegment === stat.segment ? 'ring-2 ring-offset-1' : ''
                    )}
                    style={
                      hoveredSegment === stat.segment
                        ? { backgroundColor: getSegmentBgColor(stat.segment) }
                        : selectedSegment === stat.segment
                        ? { boxShadow: `0 0 0 3px ${getSegmentBgColor(stat.segment)}` }
                        : undefined
                    }
                  >
                    <div
                      className="inline-block px-2 py-1 rounded-full text-xs font-medium mb-3"
                      style={{
                        backgroundColor: getSegmentBgColor(stat.segment),
                        color: getSegmentColor(stat.segment),
                      }}
                    >
                      {getSegmentLabel(stat.segment)}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 mb-1">키워드 수</p>
                        <p className="text-lg font-semibold text-gray-900">{stat.keywordCount}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 mb-1">광고비 비중</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatPercent(stat.budgetRatio)}
                        </p>
                      </div>
                      {/* arrow removed per design */}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {!hasParsedData && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 mt-6">
                    <table className="min-w-full divide-y divide-gray-200 table-fixed">
                      <colgroup>
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '320px' }} />
                        <col style={{ width: '140px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '120px' }} />
                      </colgroup>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">순위</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">키워드</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">세그먼트</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">1위 비용</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">2위 비용</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">3위 비용</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">4위 비용</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">5위 비용</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">비용 배수</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(() => {
                          // 총합 계산
                          let totalCost1 = 0, totalCost2 = 0, totalCost3 = 0, totalCost4 = 0, totalCost5 = 0;

                          const rows = displayTopKeywords.map((kw, idx) => {
                            // show per-device Top5 (1~5) and cost multiple formula
                            const cost1 = reportTab === 'MO' ? (kw.mo[1]?.cost || 0) : (kw.pc[1]?.cost || 0);
                            const cost2 = reportTab === 'MO' ? (kw.mo[2]?.cost || 0) : (kw.pc[2]?.cost || 0);
                            const cost3 = reportTab === 'MO' ? (kw.mo[3]?.cost || 0) : (kw.pc[3]?.cost || 0);
                            const cost4 = reportTab === 'MO' ? (kw.mo[4]?.cost || 0) : (kw.pc[4]?.cost || 0);
                            const cost5 = reportTab === 'MO' ? (kw.mo[5]?.cost || 0) : (kw.pc[5]?.cost || 0);

                            totalCost1 += cost1;
                            totalCost2 += cost2;
                            totalCost3 += cost3;
                            totalCost4 += cost4;
                            totalCost5 += cost5;

                            const costMultiple = cost5 > 0 ? cost1 / cost5 : 0;
                            const isHighCompetition = costMultiple > 3;

                            return (
                              <tr key={idx} className={cn(isHighCompetition && 'bg-red-50')}>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center">{idx + 1}</td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{kw.keyword}</td>
                                <td className="px-6 py-4 text-sm text-center">
                                  <span className="inline-block px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: getSegmentBgColor(kw.segment), color: getSegmentColor(kw.segment) }}>{getSegmentLabel(kw.segment)}</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center">{formatCurrency(cost1)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center">{formatCurrency(cost2)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center">{formatCurrency(cost3)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center">{formatCurrency(cost4)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center">{formatCurrency(cost5)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center font-semibold">{costMultiple > 0 ? `${costMultiple.toFixed(1)}x` : '-'}{isHighCompetition && <AlertCircle className="inline-block w-4 h-4 ml-1 text-red-600" />}</td>
                              </tr>
                            );
                          });

                          const totalMultiple = totalCost5 > 0 ? totalCost1 / totalCost5 : 0;

                          return (
                            <>
                              <tr className="bg-blue-50 font-semibold">
                                <td className="px-6 py-4 text-sm text-gray-900 text-center">-</td>
                                <td className="px-6 py-4 text-sm font-bold text-gray-900">총합</td>
                                <td className="px-6 py-4 text-sm">-</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center font-bold">{formatCurrency(totalCost1)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center font-bold">{formatCurrency(totalCost2)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center font-bold">{formatCurrency(totalCost3)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center font-bold">{formatCurrency(totalCost4)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center font-bold">{formatCurrency(totalCost5)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center font-bold">{totalMultiple > 0 ? `${totalMultiple.toFixed(1)}x` : '-'}</td>
                              </tr>
                              {rows}
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 순위별 변화표 */}
                <div className="mt-6 bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">순위별 변화표</h3>
                  {!hasData ? (
                    <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">해당 세그먼트의 {reportTab === 'All' ? '전체' : reportTab === 'PC' ? 'PC' : 'Mobile'} 데이터가 없습니다.</p>
                    </div>
                  ) : (
                    <div>
                      {/* Chart */}
                      {chartData && chartData.length > 0 && (
                        <div className="w-full h-64 mb-4">
                          <ResponsiveContainer width="100%" height={260}>
                                                <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="rank" tick={{ fontSize: 9 }} label={{ value: '순위', position: 'insideBottom', offset: -15 }} />
                                <YAxis yAxisId="left" stroke="#2563eb" tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 9 }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 9 }} />
                                <Tooltip
                                  formatter={(value: any, name: any) => (name === 'avgCPC' ? formatCurrency(value) : formatNumber(value))}
                                  labelFormatter={(label) => `${label}위`}
                                />
                                                    <Legend
                                                      payload={[
                                                        { value: '비용', type: 'square', color: '#10b981' },
                                                        { value: 'CPC', type: 'line', color: '#f59e0b' },
                                                      ]}
                                                      verticalAlign="top"
                                                      align="center"
                                                      wrapperStyle={{ fontSize: 12 }}
                                                    />
                                <Bar yAxisId="left" dataKey="totalCost" fill="#10b981" name="비용" />
                                <Line yAxisId="left" type="monotone" dataKey="totalClicks" stroke="#2563eb" name="클릭수" strokeWidth={2} dot={{ r: 3 }} />
                                <Line yAxisId="right" type="monotone" dataKey="avgCPC" stroke="#f59e0b" name="CPC" strokeWidth={2} dot={{ r: 3 }} />
                              </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 table-fixed">
                          <colgroup>
                            <col style={{ width: '80px' }} />
                            <col style={{ width: '160px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '140px' }} />
                            <col style={{ width: '140px' }} />
                            <col style={{ width: '140px' }} />
                          </colgroup>
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">순위</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">노출수</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">클릭수</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">평균 CPC</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">비용</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">평균 CPC 변화율</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">비용 변화율</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {tableDataProcessed.map((sim: any) => {
                              const isHighlighted = shouldHighlight(sim.rank);
                              const isCPCMaxChange = sim.rank === maxAbsCPCChangeRank;
                              const isCostMaxChange = sim.rank === maxAbsCostChangeRank;

                              return (
                                <tr key={sim.rank} className={isHighlighted ? 'bg-yellow-50' : ''}>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-center">{sim.rank}위</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-center">{formatNumber(sim.totalImpressions || 0)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-center">{formatNumber(sim.totalClicks)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-center">{formatCurrency(sim.avgCPC)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-center">{formatCurrency(sim.totalCost)}</td>
                                  <td className={cn("px-4 py-2 text-sm text-gray-900 text-center", isCPCMaxChange && "font-bold")}>
                                    {sim.avgCPCChangeRate !== undefined && sim.avgCPCChangeRate !== null ? formatPercent(sim.avgCPCChangeRate) : '-'}
                                  </td>
                                  <td className={cn("px-4 py-2 text-sm text-gray-900 text-center", isCostMaxChange && "font-bold")}>
                                    {sim.costChangeRate !== undefined && sim.costChangeRate !== null ? formatPercent(sim.costChangeRate) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Top 10 광고비 키워드 */}
                <div className="mt-6 bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Top 10 광고비 키워드
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                            순위
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            키워드
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            세그먼트
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            1위 비용
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            2위 비용
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            3위 비용
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            4위 비용
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            5위 비용
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            비용 배수
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(() => {
                          // 총합 계산
                          let totalCost1 = 0, totalCost2 = 0, totalCost3 = 0, totalCost4 = 0, totalCost5 = 0;

                          const rows = displayTopKeywords.map((kw, idx) => {
                            // show per-device Top5 (1~5) and cost multiple formula
                            const cost1 = reportTab === 'MO' ? (kw.mo[1]?.cost || 0) : (kw.pc[1]?.cost || 0);
                            const cost2 = reportTab === 'MO' ? (kw.mo[2]?.cost || 0) : (kw.pc[2]?.cost || 0);
                            const cost3 = reportTab === 'MO' ? (kw.mo[3]?.cost || 0) : (kw.pc[3]?.cost || 0);
                            const cost4 = reportTab === 'MO' ? (kw.mo[4]?.cost || 0) : (kw.pc[4]?.cost || 0);
                            const cost5 = reportTab === 'MO' ? (kw.mo[5]?.cost || 0) : (kw.pc[5]?.cost || 0);

                            totalCost1 += cost1;
                            totalCost2 += cost2;
                            totalCost3 += cost3;
                            totalCost4 += cost4;
                            totalCost5 += cost5;

                            const costMultiple = cost5 > 0 ? cost1 / cost5 : 0;
                            const isHighCompetition = costMultiple > 3;

                              return (
                              <tr key={idx} className={cn(isHighCompetition && 'bg-red-50')}>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center">{idx + 1}</td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{kw.keyword}</td>
                                <td className="px-6 py-4 text-sm">
                                  <span className="inline-block px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: getSegmentBgColor(kw.segment), color: getSegmentColor(kw.segment) }}>{getSegmentLabel(kw.segment)}</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(cost1)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(cost2)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(cost3)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(cost4)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(cost5)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-semibold">
                                  {costMultiple > 0 ? `${costMultiple.toFixed(1)}x` : '-'}
                                  {isHighCompetition && <AlertCircle className="inline-block w-4 h-4 ml-1 text-red-600" />}
                                </td>
                              </tr>
                            );
                          });

                          const totalMultiple = totalCost5 > 0 ? totalCost1 / totalCost5 : 0;

                          return (
                            <>
                              <tr className="bg-blue-50 font-semibold">
                                <td className="px-6 py-4 text-sm text-gray-900 text-center">-</td>
                                <td className="px-6 py-4 text-sm font-bold text-gray-900">총합</td>
                                <td className="px-6 py-4 text-sm">-</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-bold">{formatCurrency(totalCost1)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-bold">{formatCurrency(totalCost2)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-bold">{formatCurrency(totalCost3)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-bold">{formatCurrency(totalCost4)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-bold">{formatCurrency(totalCost5)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-bold">
                                  {totalMultiple > 0 ? `${totalMultiple.toFixed(1)}x` : '-'}
                                </td>
                              </tr>
                              {rows}
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-4 text-sm text-gray-600">
                    * 비용 배수는 선택된 디바이스의 1위 비용을 5위 비용으로 나눈 값입니다. (비용 배수 = 1위 / 5위)
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    * 비용 배수가 3배 이상인 키워드는 경쟁 과열 상태입니다.
                  </p>
                </div>
        </section>
      </main>
    </div>
  );
}
