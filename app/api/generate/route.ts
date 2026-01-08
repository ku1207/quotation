import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { AnalysisResult, AIReport } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { analysisResult } = body as { analysisResult?: AnalysisResult };

    if (!analysisResult) {
      return NextResponse.json({ error: '분석 데이터가 제공되지 않았습니다.' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = buildPrompt(analysisResult);

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: '당신은 전문 디지털 마케팅 전략가입니다. 네이버 검색광고 데이터를 분석하고 실행 가능한 전략을 제시하세요.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_completion_tokens: 2000,
    });

    const aiResponse = completion.choices?.[0]?.message?.content ?? '';
    const aiReport = parseAIResponse(aiResponse);

    return NextResponse.json({ success: true, report: aiReport, rawResponse: aiResponse });
  } catch (err) {
    console.error('AI 생성 중 오류:', err);
    return NextResponse.json(
      { error: 'AI 리포트 생성 중 오류가 발생했습니다.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

function buildPrompt(analysis: AnalysisResult): string {
  const segmentStats = analysis.segmentStats || [];
  const topKeywords = analysis.topKeywords || [];

  const segmentsText = segmentStats
    .map((s) => {
      const sims = (s.simulations || []).map((sim) => `${sim.rank}위: 클릭 ${sim.totalClicks.toFixed(0)}, 비용 ${sim.totalCost.toFixed(0)}, CPC ${sim.avgCPC.toFixed(0)}`);
      return `세그먼트: ${s.segment}\n키워드 수: ${s.keywordCount}\n예산 비중: ${s.budgetRatio.toFixed(1)}%\n최대변동: ${s.maxChangeRank}\n시뮬레이션:\n${sims.join('\n')}`;
    })
    .join('\n\n');

  const topText = topKeywords.slice(0, 10).map((k, i) => `${i + 1}. ${k.keyword} - 1위 비용 ${k.totalCost.toFixed(0)}원, CPC ${k.avgCPC.toFixed(0)}원`).join('\n');

  return `다음은 분석 결과입니다. 세그먼트별 통계와 상위 비용 키워드를 참고하여, 각각의 세그먼트에 대한 인사이트와 3가지 전략(aggressive, efficiency, defensive)을 작성해 주세요. 각 전략의 필드(background, execution, expectedKPI)는 마크다운 형식의 텍스트로 작성해 주세요. 반드시 응답은 JSON으로만 반환해주세요. JSON 내부의 문자열 값은 마크다운 형식이어야 합니다.\n\n세그먼트 통계:\n${segmentsText}\n\nTop 키워드:\n${topText}\n\n응답 예시 구조:\n{\n  "segmentInsights": { "High-Volume": "...", "Efficiency": "...", "Long-tail": "...", "High-Cost": "..." },\n  "strategies": {\n    "aggressive": { "background": "# 배경...", "execution": "# 실행...", "expectedKPI": "# 예상 KPI..." },\n    "efficiency": { "background": "...", "execution": "...", "expectedKPI": "..." },\n    "defensive": { "background": "...", "execution": "...", "expectedKPI": "..." }\n  }\n}`;
}

function parseAIResponse(response: string): AIReport {
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/i);
    const jsonString = jsonMatch ? jsonMatch[1] : response;
    const parsed = JSON.parse(jsonString);

    const defaultReport: AIReport = {
      segmentInsights: {
        'High-Volume': '고성과 세그먼트입니다.',
        'Efficiency': '효율 세그먼트입니다.',
        'Long-tail': '롱테일 세그먼트입니다.',
        'High-Cost': '고비용 세그먼트입니다.',
      },
      strategies: {
        aggressive: { background: '공격적 전략 배경', execution: '집중 실행 방안', expectedKPI: '예상 KPI' },
        efficiency: { background: '효율 전략 배경', execution: '효율 실행 방안', expectedKPI: '예상 KPI' },
        defensive: { background: '수비 전략 배경', execution: '수비 실행 방안', expectedKPI: '예상 KPI' },
      },
    };

    return {
      segmentInsights: {
        'High-Volume': parsed.segmentInsights?.['High-Volume'] || defaultReport.segmentInsights['High-Volume'],
        Efficiency: parsed.segmentInsights?.Efficiency || defaultReport.segmentInsights.Efficiency,
        'Long-tail': parsed.segmentInsights?.['Long-tail'] || defaultReport.segmentInsights['Long-tail'],
        'High-Cost': parsed.segmentInsights?.['High-Cost'] || defaultReport.segmentInsights['High-Cost'],
      },
      strategies: {
        aggressive: {
          background: parsed.strategies?.aggressive?.background || defaultReport.strategies.aggressive.background,
          execution: parsed.strategies?.aggressive?.execution || defaultReport.strategies.aggressive.execution,
          expectedKPI: parsed.strategies?.aggressive?.expectedKPI || defaultReport.strategies.aggressive.expectedKPI,
        },
        efficiency: {
          background: parsed.strategies?.efficiency?.background || defaultReport.strategies.efficiency.background,
          execution: parsed.strategies?.efficiency?.execution || defaultReport.strategies.efficiency.execution,
          expectedKPI: parsed.strategies?.efficiency?.expectedKPI || defaultReport.strategies.efficiency.expectedKPI,
        },
        defensive: {
          background: parsed.strategies?.defensive?.background || defaultReport.strategies.defensive.background,
          execution: parsed.strategies?.defensive?.execution || defaultReport.strategies.defensive.execution,
          expectedKPI: parsed.strategies?.defensive?.expectedKPI || defaultReport.strategies.defensive.expectedKPI,
        },
      },
    };
  } catch (err) {
    console.error('AI 응답 파싱 오류:', err);
    return {
      segmentInsights: {
        'High-Volume': '고성과 세그먼트입니다.',
        Efficiency: '효율 세그먼트입니다.',
        'Long-tail': '롱테일 세그먼트입니다.',
        'High-Cost': '고비용 세그먼트입니다.',
      },
      strategies: {
        aggressive: { background: '공격적 전략 배경', execution: '집중 실행 방안', expectedKPI: '예상 KPI' },
        efficiency: { background: '효율 전략 배경', execution: '효율 실행 방안', expectedKPI: '예상 KPI' },
        defensive: { background: '수비 전략 배경', execution: '수비 실행 방안', expectedKPI: '예상 KPI' },
      },
    };
  }
}
