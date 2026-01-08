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
  const [selectedSegment, setSelectedSegment] = useState<Segment>('High-Volume');
  const [selectedDevice, setSelectedDevice] = useState<'PC' | 'MO'>('PC');
  const [criteriaDevice, setCriteriaDevice] = useState<'PC' | 'MO'>('PC');
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

    // AI 리포트 생성
    generateAIReport(data);
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

  if (!analysisResult) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const { criteria, segmentStats, topKeywords } = analysisResult;
  const hasParsedData = Array.isArray(segmentStats) && segmentStats.length > 0 && Array.isArray(topKeywords) && topKeywords.length > 0;
  const currentSegmentStats = segmentStats.find((s) => s.segment === selectedSegment);

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

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* 섹션 1: 키워드 세그먼트 */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">키워드 세그먼트</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-blue-900">분류 기준</p>
              <div className="inline-flex rounded-lg bg-blue-100 p-1">
                <button
                  onClick={() => setCriteriaDevice('PC')}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium',
                    criteriaDevice === 'PC' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-700'
                  )}
                >
                  PC
                </button>
                <button
                  onClick={() => setCriteriaDevice('MO')}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium',
                    criteriaDevice === 'MO' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-700'
                  )}
                >
                  Mobile
                </button>
              </div>
            </div>
            <p className="text-sm text-blue-900">
              {criteriaDevice === 'PC' ? (
                <>
                  <strong>PC 1순위 평균 클릭수:</strong> {formatNumber(criteria.pcAvgClicks || 0)}회 /
                  <strong className="ml-2">PC 1순위 평균 CPC:</strong> {formatCurrency(criteria.pcCPC || 0)}
                </>
              ) : (
                <>
                  <strong>Mobile 1순위 평균 클릭수:</strong> {formatNumber(criteria.moAvgClicks || 0)}회 /
                  <strong className="ml-2">Mobile 1순위 평균 CPC:</strong> {formatCurrency(criteria.moCPC || 0)}
                </>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {segmentStats.map((stat) => (
              <div
                key={stat.segment}
                className="bg-white rounded-lg shadow p-4 border-l-4 flex flex-col"
                style={{ borderColor: getSegmentColor(stat.segment) }}
              >
                <div
                  className="inline-block px-2 py-1 rounded-full text-xs font-medium mb-2 self-start"
                  style={{
                    backgroundColor: getSegmentBgColor(stat.segment),
                    color: getSegmentColor(stat.segment),
                  }}
                >
                  {getSegmentLabel(stat.segment)}
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-xs text-gray-600">키워드 수</p>
                    <p className="text-xl font-bold text-gray-900">{stat.keywordCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">예산 비중</p>
                    <p className="text-base font-semibold text-gray-900">
                      {formatPercent(stat.budgetRatio)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {!hasParsedData && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
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

        {/* 섹션 2: 세그먼트별 상세 분석 */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">세그먼트별 상세 분석</h2>

          {/* 탭 */}
          <div className="flex space-x-2 mb-4 overflow-x-auto">
            {segmentStats.map((stat) => (
              <button
                key={stat.segment}
                onClick={() => setSelectedSegment(stat.segment)}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap',
                  selectedSegment === stat.segment
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
                style={{
                  backgroundColor:
                    selectedSegment === stat.segment
                      ? getSegmentColor(stat.segment)
                      : undefined,
                }}
              >
                {getSegmentLabel(stat.segment)}
              </button>
            ))}
          </div>

          {/* 장치 탭 */}
          <div className="mb-4">
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setSelectedDevice('PC')}
                className={cn(
                  'px-3 py-1 rounded-md text-sm font-medium',
                  selectedDevice === 'PC' ? 'bg-white text-gray-900' : 'text-gray-600'
                )}
              >
                PC
              </button>
              <button
                onClick={() => setSelectedDevice('MO')}
                className={cn(
                  'px-3 py-1 rounded-md text-sm font-medium',
                  selectedDevice === 'MO' ? 'bg-white text-gray-900' : 'text-gray-600'
                )}
              >
                Mobile
              </button>
            </div>
          </div>

          {/* 그래프 */}
          {currentSegmentStats && (
            <>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  순위별 클릭수 & 비용 변화 ({selectedDevice === 'PC' ? 'PC' : 'Mobile'})
                </h3>
                {(() => {
                  const chartData = selectedDevice === 'PC' ? currentSegmentStats.pcSimulations : currentSegmentStats.moSimulations;
                  // PC의 경우 1-10위만 표시
                  const displayChartData = selectedDevice === 'PC' ? chartData.slice(0, 10) : chartData;
                  const hasData = displayChartData && displayChartData.length > 0 && displayChartData.some(d => d.totalClicks > 0 || d.totalCost > 0);

                  if (!hasData) {
                    return (
                      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">해당 세그먼트의 {selectedDevice === 'PC' ? 'PC' : 'Mobile'} 데이터가 없습니다.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="flex justify-center">
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart
                          data={displayChartData}
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
                          {selectedDevice === 'PC' ? (
                            <>
                              <Bar yAxisId="left" dataKey="totalClicks" fill="#2563eb" name="PC 클릭수" />
                              <Bar yAxisId="right" dataKey="totalCost" fill="#059669" name="PC 비용" />
                            </>
                          ) : (
                            <>
                              <Bar yAxisId="left" dataKey="totalClicks" fill="#60a5fa" name="Mobile 클릭수" />
                              <Bar yAxisId="right" dataKey="totalCost" fill="#34d399" name="Mobile 비용" />
                            </>
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </div>

              {/* 순위별 변화표 */}
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">
                  순위별 변화표 ({selectedDevice === 'PC' ? 'PC' : 'Mobile'})
                </h4>
                {(() => {
                  const tableData = selectedDevice === 'PC' ? currentSegmentStats.pcSimulations : currentSegmentStats.moSimulations;
                  const hasData = tableData && tableData.length > 0;

                  if (!hasData) {
                    return (
                      <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">해당 세그먼트의 {selectedDevice === 'PC' ? 'PC' : 'Mobile'} 데이터가 없습니다.</p>
                      </div>
                    );
                  }

                  // PC의 경우 1-10위만 표시
                  const displayData = selectedDevice === 'PC' ? tableData.slice(0, 10) : tableData;

                  // 1위를 제외하고 비용 변화율과 평균 CPC 변화율의 최대값(절대값 기준) 찾기
                  const dataExcludingFirst = displayData.filter(d => d.rank > 1);

                  let maxCostChangeRank = 0;
                  let maxCostChangeValue = 0;
                  let maxCPCChangeRank = 0;
                  let maxCPCChangeValue = 0;

                  dataExcludingFirst.forEach((sim: any) => {
                    if (sim.costChangeRate !== undefined && sim.costChangeRate !== null) {
                      const absValue = Math.abs(sim.costChangeRate);
                      if (absValue > maxCostChangeValue) {
                        maxCostChangeValue = absValue;
                        maxCostChangeRank = sim.rank;
                      }
                    }
                    if (sim.avgCPCChangeRate !== undefined && sim.avgCPCChangeRate !== null) {
                      const absValue = Math.abs(sim.avgCPCChangeRate);
                      if (absValue > maxCPCChangeValue) {
                        maxCPCChangeValue = absValue;
                        maxCPCChangeRank = sim.rank;
                      }
                    }
                  });

                  return (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">순위</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">클릭수</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">비용</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">평균 CPC</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">비용 변화율</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">평균 CPC 변화율</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {displayData.map((sim: any) => {
                            const isMaxCostChange = sim.rank === maxCostChangeRank;
                            const isMaxCPCChange = sim.rank === maxCPCChangeRank;
                            const shouldHighlight = isMaxCostChange || isMaxCPCChange;

                            return (
                              <tr key={sim.rank} className={shouldHighlight ? 'bg-yellow-50' : ''}>
                                <td className="px-4 py-2 text-sm text-gray-900">{sim.rank}위</td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatNumber(sim.totalClicks)}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(sim.totalCost)}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(sim.avgCPC)}</td>
                                <td className={cn("px-4 py-2 text-sm text-gray-900 text-right", isMaxCostChange && "font-bold")}>
                                  {sim.costChangeRate !== undefined && sim.costChangeRate !== null ? formatPercent(sim.costChangeRate) : '-'}
                                </td>
                                <td className={cn("px-4 py-2 text-sm text-gray-900 text-right", isMaxCPCChange && "font-bold")}>
                                  {sim.avgCPCChangeRate !== undefined && sim.avgCPCChangeRate !== null ? formatPercent(sim.avgCPCChangeRate) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </section>

        {/* 섹션 3: Top 10 키워드 비교 */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Top 10 광고비 키워드
          </h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
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
                    {topKeywords.map((kw, idx) => {
                    // show per-device Top5 (1~5) and cost multiple formula
                    const cost1 = selectedDevice === 'PC' ? (kw.pc[1]?.cost || 0) : (kw.mo[1]?.cost || 0);
                    const cost2 = selectedDevice === 'PC' ? (kw.pc[2]?.cost || 0) : (kw.mo[2]?.cost || 0);
                    const cost3 = selectedDevice === 'PC' ? (kw.pc[3]?.cost || 0) : (kw.mo[3]?.cost || 0);
                    const cost4 = selectedDevice === 'PC' ? (kw.pc[4]?.cost || 0) : (kw.mo[4]?.cost || 0);
                    const cost5 = selectedDevice === 'PC' ? (kw.pc[5]?.cost || 0) : (kw.mo[5]?.cost || 0);
                    const costMultiple = cost5 > 0 ? cost1 / cost5 : 0;
                    const isHighCompetition = costMultiple > 3;

                    return (
                      <tr key={idx} className={cn(isHighCompetition && 'bg-red-50')}>
                        <td className="px-6 py-4 text-sm text-gray-900">{idx + 1}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{kw.keyword}</td>
                        <td className="px-6 py-4 text-sm">
                          {(() => {
                            const seg = selectedDevice === 'PC' ? (kw.segmentPc || kw.segment) : (kw.segmentMo || kw.segment);
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
                        <td className="px-6 py-4 text-sm text-gray-900 text-right font-semibold">
                          {costMultiple > 0 ? `${costMultiple.toFixed(1)}x` : '-'}
                          {isHighCompetition && <AlertCircle className="inline-block w-4 h-4 ml-1 text-red-600" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            비용 배수는 선택된 디바이스의 1위 비용을 5위 비용으로 나눈 값입니다. (비용 배수 = 1위 / 5위)
          </p>
          <p className="mt-2 text-sm text-gray-600">
            * 비용 배수가 3배 이상인 키워드는 경쟁 과열 상태입니다.
          </p>
        </section>

        {/* 섹션 4: 전략 시나리오 */}
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
      </main>
    </div>
  );
}
