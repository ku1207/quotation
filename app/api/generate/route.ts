import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { AnalysisResult, AIReport } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { analysisResult, device } = body as { analysisResult?: AnalysisResult; device?: string };

    if (!analysisResult) {
      return NextResponse.json({ error: '분석 데이터가 제공되지 않았습니다.' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = buildPrompt(analysisResult, device || 'All');

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: '당신은 전문 디지털 마케팅 전략가입니다. 네이버 검색광고 데이터를 분석하고 실행 가능한 전략을 제시하세요.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_completion_tokens: 1200,
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

function buildPrompt(analysis: AnalysisResult, device: string): string {
  const segmentStats = analysis.segmentStats || [];
  const keywords = analysis.keywords || [];

  // build device-aware top keywords:
  let topKeywords: { keyword: string; totalCost: number; avgCPC: number }[] = [];
  if ((device || 'All') === 'PC') {
    topKeywords = keywords
      .filter((k: any) => (k.pc?.[1]?.cost || 0) > 0)
      .sort((a: any, b: any) => (b.pc?.[1]?.cost || 0) - (a.pc?.[1]?.cost || 0))
      .slice(0, 10)
      .map((k: any) => {
        const cost = k.pc?.[1]?.cost || 0;
        const clicks = k.pc?.[1]?.clicks || 0;
        return { keyword: k.keyword, totalCost: cost, avgCPC: clicks > 0 ? cost / clicks : 0 };
      });
  } else if ((device || 'All') === 'MO') {
    topKeywords = keywords
      .filter((k: any) => (k.mo?.[1]?.cost || 0) > 0)
      .sort((a: any, b: any) => (b.mo?.[1]?.cost || 0) - (a.mo?.[1]?.cost || 0))
      .slice(0, 10)
      .map((k: any) => {
        const cost = k.mo?.[1]?.cost || 0;
        const clicks = k.mo?.[1]?.clicks || 0;
        return { keyword: k.keyword, totalCost: cost, avgCPC: clicks > 0 ? cost / clicks : 0 };
      });
  } else {
    // All: sum PC1 + MO1 and exclude where sum is 0
    topKeywords = keywords
      .map((k: any) => {
        const pcCost = k.pc?.[1]?.cost || 0;
        const moCost = k.mo?.[1]?.cost || 0;
        const pcClicks = k.pc?.[1]?.clicks || 0;
        const moClicks = k.mo?.[1]?.clicks || 0;
        const totalCost = pcCost + moCost;
        const totalClicks = pcClicks + moClicks;
        return { keyword: k.keyword, totalCost, avgCPC: totalClicks > 0 ? totalCost / totalClicks : 0 };
      })
      .filter((k) => k.totalCost > 0)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);
  }

  const segmentsText = segmentStats
    .map((s) => {
      const sims = (s.simulations || []).map((sim) => `${sim.rank}위: 클릭 ${sim.totalClicks.toFixed(0)}, 비용 ${sim.totalCost.toFixed(0)}, CPC ${sim.avgCPC.toFixed(0)}`);
      return `세그먼트: ${s.segment}\n키워드 수: ${s.keywordCount}\n예산 비중: ${s.budgetRatio.toFixed(1)}%\n최대변동: ${s.maxChangeRank}\n시뮬레이션:\n${sims.join('\n')}`;
    })
    .join('\n\n');

  const topText = topKeywords.slice(0, 10).map((k, i) => `${i + 1}. ${k.keyword} - 1위 비용 ${k.totalCost.toFixed(0)}원, CPC ${k.avgCPC.toFixed(0)}원`).join('\n');

  return `You are a senior digital marketing strategist. Use the provided analysis to generate concise, actionable strategies for device: ${device}.\n\nRequirements:\n- Provide output strictly as PARSABLE JSON only (no surrounding text, no markdown code fences).\n- For each of the three strategies (aggressive, efficiency, defensive) return two fields: "background" (<=200 characters, Korean) and "execution" (Korean). The "execution" must be written exactly as: "각 키워드 세그먼트 별 최적의 순위 및 운영 전략 형태로 작성하십시오."\n- Do not include any other fields.\n\nInput data:\n${segmentsText}\n\nTop keywords:\n${topText}\n\nRequired JSON structure example:\n{\"segmentInsights\": {\"High-Volume\": \"...\", \"Efficiency\": \"...\", \"Long-tail\": \"...\", \"High-Cost\": \"...\"}, \"strategies\": {\"aggressive\": {\"background\": \"...\", \"execution\": \"...\"}, \"efficiency\": {\"background\": \"...\", \"execution\": \"...\"}, \"defensive\": {\"background\": \"...\", \"execution\": \"...\"}}}`;
}

function parseAIResponse(response: string): AIReport {
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

  try {
    // 빈 응답 체크
    if (!response || response.trim() === '') {
      console.error('AI 응답이 비어있습니다.');
      return defaultReport;
    }

    // JSON 코드 블록 추출 시도
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/i);
    let jsonString = jsonMatch ? jsonMatch[1].trim() : response.trim();

    // JSON 문자열이 비어있는지 체크
    if (!jsonString) {
      console.error('추출된 JSON 문자열이 비어있습니다.');
      return defaultReport;
    }

    const parsed = JSON.parse(jsonString);

    // 파싱된 객체 유효성 검증
    if (!parsed || typeof parsed !== 'object') {
      console.error('파싱된 결과가 유효하지 않습니다.');
      return defaultReport;
    }

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
          expectedKPI: '',
        },
        efficiency: {
          background: parsed.strategies?.efficiency?.background || defaultReport.strategies.efficiency.background,
          execution: parsed.strategies?.efficiency?.execution || defaultReport.strategies.efficiency.execution,
          expectedKPI: '',
        },
        defensive: {
          background: parsed.strategies?.defensive?.background || defaultReport.strategies.defensive.background,
          execution: parsed.strategies?.defensive?.execution || defaultReport.strategies.defensive.execution,
          expectedKPI: '',
        },
      },
    };
  } catch (err) {
    console.error('AI 응답 파싱 오류:', err);
    console.error('원본 응답:', response);
    return defaultReport;
  }
}
