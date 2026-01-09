'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
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
  ChevronDown,
  ChevronUp,
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
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<Segment | 'All'>('All');
  const [reportTab, setReportTab] = useState<'All' | 'PC' | 'MO'>('All');
  const [hoveredSegment, setHoveredSegment] = useState<Segment | 'All' | null>(null);
  const [openScenario, setOpenScenario] = useState<{ [k: string]: boolean }>({});
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
        const report = JSON.parse(storedAiReport) as AIReport;
        setAiReport(report);
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
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analysisResult: data }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'AI 리포트 생성에 실패했습니다.');
      }

      setAiReport(result.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoadingAI(false);
    }
  };

  // Card selection is handled via `selectedSegment` (cards act as buttons)

  const getFilteredSegmentStats = () => {
    if (!analysisResult) return [];

    if (reportTab === 'All') {
      return segmentStats;
    }

    // PC 또는 MO 탭일 때: 해당 디바이스 기준으로 재분류된 세그먼트만 표시
    const deviceField = reportTab === 'PC' ? 'segmentPc' : 'segmentMo';
    const keywords = analysisResult.keywords;

    // 해당 디바이스 기준으로 세그먼트별 키워드 수와 예산 비중 재계산
    const segmentMap = new Map<Segment, { keywords: typeof keywords, totalCost: number }>();

    keywords.forEach(kw => {
      const segment = kw[deviceField] || kw.segment;
      if (!segmentMap.has(segment)) {
        segmentMap.set(segment, { keywords: [], totalCost: 0 });
      }
      const entry = segmentMap.get(segment)!;
      entry.keywords.push(kw);

      // 해당 디바이스의 1순위 비용만 집계
      const cost = reportTab === 'PC' ? (kw.pc[1]?.cost || 0) : (kw.mo[1]?.cost || 0);
      entry.totalCost += cost;
    });

    const totalCost = Array.from(segmentMap.values()).reduce((sum, entry) => sum + entry.totalCost, 0);

    // SegmentStats 배열로 변환
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

  // Top 10 키워드를 디바이스별로 정렬
  const getTopKeywords = () => {
    let list = [...keywords];
    if (selectedSegment !== 'All') {
      list = list.filter((kw) => {
        if (reportTab === 'PC') return (kw.segmentPc || kw.segment) === selectedSegment;
        if (reportTab === 'MO') return (kw.segmentMo || kw.segment) === selectedSegment;
        return kw.segment === selectedSegment;
      });
    }

    const sorted = list.sort((a, b) => {
      if (reportTab === 'PC') {
        return b.pcCost - a.pcCost;
      } else if (reportTab === 'MO') {
        return b.moCost - a.moCost;
      } else {
        return b.totalCost - a.totalCost;
      }
    });

    return sorted.slice(0, 10);
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
        {aiReport && (
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
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">
                      전략 배경
                    </h4>
                    <p className="text-sm text-gray-600">
                      {aiReport.strategies.aggressive.background}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">
                      실행 방법
                    </h4>
                    <p className="text-sm text-gray-600">
                      {aiReport.strategies.aggressive.execution}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">
                      예상 KPI 변화
                    </h4>
                    <p className="text-sm text-gray-600">
                      {aiReport.strategies.aggressive.expectedKPI}
                    </p>
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
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">
                      전략 배경
                    </h4>
                    <p className="text-sm text-gray-600">
                      {aiReport.strategies.efficiency.background}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">
                      실행 방법
                    </h4>
                    <p className="text-sm text-gray-600">
                      {aiReport.strategies.efficiency.execution}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">
                      예상 KPI 변화
                    </h4>
                    <p className="text-sm text-gray-600">
                      {aiReport.strategies.efficiency.expectedKPI}
                    </p>
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
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">
                      전략 배경
                    </h4>
                    <p className="text-sm text-gray-600">
                      {aiReport.strategies.defensive.background}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">
                      실행 방법
                    </h4>
                    <p className="text-sm text-gray-600">
                      {aiReport.strategies.defensive.execution}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">
                      예상 KPI 변화
                    </h4>
                    <p className="text-sm text-gray-600">
                      {aiReport.strategies.defensive.expectedKPI}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 섹션 2: 키워드 세그먼트 */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">키워드 세그먼트</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-blue-900 mb-2">분류 기준</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="text-sm text-blue-900">
                <strong>PC 1순위 평균 클릭수:</strong> {formatNumber(criteria.pcAvgClicks || 0)}회<br/>
                <strong>PC 1순위 평균 CPC:</strong> {formatCurrency(criteria.pcCPC || 0)}
                <div className="mt-2 text-xs text-gray-700">
                  {/* 계산식 상세: 재계산해 표시 (합계, 분자/분모) */}
                  {(() => {
                    const pcTotalClicks = keywords.reduce((s, k) => s + (k.pc[1]?.clicks || 0), 0);
                    const pcTotalCost = keywords.reduce((s, k) => s + (k.pc[1]?.cost || 0), 0);
                    const pcAvgClicksCalc = keywords.length > 0 ? pcTotalClicks / keywords.length : 0;
                    const pcCPCalc = pcTotalClicks > 0 ? Math.floor(pcTotalCost / pcTotalClicks) : 0;
                    return (
                      <div>
                        <div>계산식: PC 총 1위 클릭수 = {formatNumber(pcTotalClicks)} (1위 클릭수의 합)</div>
                        <div>키워드 수 = {keywords.length}</div>
                        <div>평균 클릭수 = PC 총 1위 클릭수 / 키워드 수 = {formatNumber(pcTotalClicks)} / {keywords.length} = {formatNumber(pcAvgClicksCalc, 1)}회</div>
                        <div className="mt-1">PC 1위 평균 CPC = 총 1위 비용 / 총 1위 클릭수 = {formatCurrency(pcTotalCost)} / {formatNumber(pcTotalClicks)} = {formatCurrency(pcCPCalc)}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="text-sm text-blue-900">
                <strong>Mobile 1순위 평균 클릭수:</strong> {formatNumber(criteria.moAvgClicks || 0)}회<br/>
                <strong>Mobile 1순위 평균 CPC:</strong> {formatCurrency(criteria.moCPC || 0)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                      <div className="flex-shrink-0">
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </button>
                </div>
              );
            })()}

            {/* 세그먼트별 카드 */}
            {orderedFilteredStats.map((stat) => {
              const segmentKeywords = keywords.filter(kw => {
                if (reportTab === 'All') return kw.segment === stat.segment;
                const deviceField = reportTab === 'PC' ? 'segmentPc' : 'segmentMo';
                return (kw[deviceField] || kw.segment) === stat.segment;
              });

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
              <p className="text-sm text-yellow-800">
                엑셀 파일이 정상적으로 파싱되지 않았습니다. 업로드 페이지로 이동하여 파일을 다시 업로드해주세요.
              </p>
              <div className="mt-2">
                <button
                  onClick={() => router.push('/')}
                  className="text-sm text-blue-700 underline"
                >
                  업로드 페이지로 이동
                </button>
              </div>
            </div>
          )}

          {/* 그래프 */}
          {(() => {
            // 'All' 선택 시 모든 세그먼트의 시뮬레이션 집계
            let chartData: any[] = [];
            let tableData: any[] = [];

            if (selectedSegment === 'All') {
              // 모든 세그먼트의 시뮬레이션을 집계
              const allSimulations = reportTab === 'MO'
                ? orderedFilteredStats.flatMap(s => s.moSimulations || [])
                : reportTab === 'PC'
                  ? orderedFilteredStats.flatMap(s => s.pcSimulations || [])
                  : orderedFilteredStats.flatMap(s => s.simulations || []);

              // 순위별로 그룹화하여 합산 (노출수, 클릭수, 광고비)
              const rankMap = new Map<number, { totalImpressions: number; totalClicks: number; totalCost: number }>();

              allSimulations.forEach(sim => {
                if (!rankMap.has(sim.rank)) {
                  rankMap.set(sim.rank, { totalImpressions: 0, totalClicks: 0, totalCost: 0 });
                }
                const entry = rankMap.get(sim.rank)!;
                entry.totalImpressions += sim.totalImpressions || 0;
                entry.totalClicks += sim.totalClicks || 0;
                entry.totalCost += sim.totalCost || 0;
              });

              const maxRank = reportTab === 'MO' ? 5 : 10;
              for (let rank = 1; rank <= maxRank; rank++) {
                const entry = rankMap.get(rank) || { totalImpressions: 0, totalClicks: 0, totalCost: 0 };
                const avgCPC = entry.totalClicks > 0 ? entry.totalCost / entry.totalClicks : 0;

                chartData.push({
                  rank,
                  totalImpressions: entry.totalImpressions,
                  totalClicks: entry.totalClicks,
                  totalCost: entry.totalCost,
                  avgCPC,
                });
              }

              // 변화율 계산
              tableData = chartData.map((data, idx) => {
                const prevData = chartData[idx - 1];
                return {
                  ...data,
                  costChangeRate: prevData && prevData.totalCost > 0 ? ((data.totalCost - prevData.totalCost) / prevData.totalCost) * 100 : undefined,
                  avgCPCChangeRate: prevData && prevData.avgCPC > 0 ? ((data.avgCPC - prevData.avgCPC) / prevData.avgCPC) * 100 : undefined,
                };
              });
            } else if (currentSegmentStats) {
              if (reportTab === 'All') {
                chartData = currentSegmentStats.simulations || [];
                tableData = currentSegmentStats.simulations || [];
              } else if (reportTab === 'MO') {
                chartData = currentSegmentStats.moSimulations || [];
                tableData = currentSegmentStats.moSimulations || [];
              } else {
                chartData = currentSegmentStats.pcSimulations || [];
                tableData = currentSegmentStats.pcSimulations || [];
              }
              // PC/All일 때는 1-10위까지만 표시
              if (reportTab !== 'MO' && tableData) {
                tableData = tableData.filter(sim => sim.rank <= 10);
              }
            }

            const hasData = chartData && chartData.length > 0 && chartData.some(d => d.totalClicks > 0 || d.totalCost > 0);

            return (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    순위별 클릭수 & 비용 변화{reportTab !== 'All' ? ` (${reportTab === 'PC' ? 'PC' : 'Mobile'})` : ''}
                  </h3>
                  {!hasData ? (
                    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">해당 세그먼트의 {reportTab === 'All' ? '전체' : reportTab === 'PC' ? 'PC' : 'Mobile'} 데이터가 없습니다.</p>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <ResponsiveContainer width="110%" height={350}>
                        <BarChart
                          data={chartData}
                          margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="rank"
                            label={{ value: '순위', position: 'insideBottom', offset: -10 }}
                            style={{ fontSize: 12 }}
                          />
                          <YAxis
                            yAxisId="left"
                            orientation="left"
                            stroke="#3b82f6"
                            style={{ fontSize: 12 }}
                            label={{ value: '클릭수', angle: -90, position: 'insideLeft' }}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#10b981"
                            style={{ fontSize: 12 }}
                            label={{ value: '비용', angle: 90, position: 'insideRight' }}
                          />
                          <Tooltip
                            formatter={(value: any) => formatNumber(value)}
                            labelFormatter={(label) => `${label}위`}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          {/* Show impressions + clicks on left axis, cost on right, avgCPC as line (right) */}
                          <Bar yAxisId="left" dataKey="totalImpressions" fill="#93c5fd" name="노출수" />
                          <Bar yAxisId="left" dataKey="totalClicks" fill="#2563eb" name="클릭수" />
                          <Bar yAxisId="right" dataKey="totalCost" fill="#059669" name="비용" />
                          <Line yAxisId="right" type="monotone" dataKey="avgCPC" stroke="#ef4444" dot={false} name="평균 CPC" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* 동일 영역: 순위별 변화표 */}
                <div className="border-t px-6 pb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    순위별 변화표{reportTab !== 'All' ? ` (${reportTab === 'PC' ? 'PC' : 'Mobile'})` : ''}
                  </h4>
                  <div className="overflow-x-auto">
                    {!hasData ? (
                      <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg p-6">
                        <p className="text-sm text-gray-500">해당 세그먼트의 {reportTab === 'All' ? '전체' : reportTab === 'PC' ? 'PC' : 'Mobile'} 데이터가 없습니다.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">순위</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">노출수</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">클릭수</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">평균 CPC</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">비용</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">평균 CPC 변화율</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">비용 변화율</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {tableData.map((sim: any) => {
                              const isMaxChange = selectedSegment !== 'All' && currentSegmentStats && (
                                reportTab === 'MO'
                                  ? sim.rank === currentSegmentStats.maxChangeRankMo
                                  : sim.rank === currentSegmentStats.maxChangeRankPc
                              );
                              return (
                                <tr key={sim.rank} className={isMaxChange ? 'bg-yellow-50' : ''}>
                                  <td className="px-4 py-2 text-sm text-gray-900">{sim.rank}위</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatNumber(sim.totalImpressions || 0)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatNumber(sim.totalClicks)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(sim.avgCPC)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(sim.totalCost)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{sim.avgCPCChangeRate !== undefined && sim.avgCPCChangeRate !== null ? formatPercent(sim.avgCPCChangeRate) : '-'}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{sim.costChangeRate !== undefined && sim.costChangeRate !== null ? formatPercent(sim.costChangeRate) : '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* 동일 영역: Top 10 광고비 키워드 */}
                <div className="border-t px-6 pb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Top 10 광고비 키워드</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">순위</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">키워드</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">세그먼트</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">1위 비용</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">2위 비용</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">3위 비용</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">4위 비용</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">5위 비용</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">비용 배수</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(() => {
                          let totalCost1 = 0, totalCost2 = 0, totalCost3 = 0, totalCost4 = 0, totalCost5 = 0;
                          const rows = displayTopKeywords.map((kw, idx) => {
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
                                <td className="px-6 py-4 text-sm text-gray-900">{idx + 1}</td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{kw.keyword}</td>
                                <td className="px-6 py-4 text-sm">
                                  {(() => {
                                    const seg = reportTab === 'MO' ? (kw.segmentMo || kw.segment) : (kw.segmentPc || kw.segment);
                                    return (
                                      <span className="inline-block px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: getSegmentBgColor(seg), color: getSegmentColor(seg) }}>{getSegmentLabel(seg)}</span>
                                    );
                                  })()}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(cost1)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(cost2)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(cost3)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(cost4)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(cost5)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-semibold">{costMultiple > 0 ? `${costMultiple.toFixed(1)}x` : '-'}{isHighCompetition && <AlertCircle className="inline-block w-4 h-4 ml-1 text-red-600" />}</td>
                              </tr>
                            );
                          });

                          const totalMultiple = totalCost5 > 0 ? totalCost1 / totalCost5 : 0;

                          return (
                            <>
                              <tr className="bg-blue-50 font-semibold">
                                <td className="px-6 py-4 text-sm text-gray-900">-</td>
                                <td className="px-6 py-4 text-sm font-bold text-gray-900">총합</td>
                                <td className="px-6 py-4 text-sm">-</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-bold">{formatCurrency(totalCost1)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-bold">{formatCurrency(totalCost2)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-bold">{formatCurrency(totalCost3)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-bold">{formatCurrency(totalCost4)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-bold">{formatCurrency(totalCost5)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-right font-bold">{totalMultiple > 0 ? `${totalMultiple.toFixed(1)}x` : '-'}</td>
                              </tr>
                              {rows}
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">비용 배수는 선택된 디바이스의 1위 비용을 5위 비용으로 나눈 값입니다. (비용 배수 = 1위 / 5위)</p>
                  <p className="mt-2 text-sm text-gray-600">* 비용 배수가 3배 이상인 키워드는 경쟁 과열 상태입니다.</p>
                </div>
              </div>
            );
          })()}
        </section>
      </main>
    </div>
  );
}
