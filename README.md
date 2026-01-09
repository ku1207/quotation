# 네이버 검색광고 견적 분석 도구

Next.js (App Router)와 GPT-4 AI를 활용한 네이버 검색광고 견적 데이터 분석 및 전략 제시 시스템

## 주요 기능

### 1. 데이터 처리 엔진
- **엑셀 2줄 헤더 파싱**: 네이버 검색광고 포맷의 복잡한 헤더 구조 자동 처리
- **중위값 기반 세그먼트 분류**: 클릭수와 CPC 중위값을 기준으로 4개 세그먼트 자동 분류
  - High-Volume: 고성과 (높은 클릭수 & 높은 CPC)
  - Efficiency: 효율형 (높은 클릭수 & 낮은 CPC)
  - Long-tail: 롱테일 (낮은 클릭수 & 낮은 CPC)
  - High-Cost: 고비용 (낮은 클릭수 & 높은 CPC)
- **순위별 시뮬레이션**: 1, 2, 3, 5위 순위별 전체 지표 계산
- **iCPC 분석**: 증분 단가 계산 및 최대 변동 구간 특정

### 2. AI 기반 인사이트
- **세그먼트별 집중 코멘트**: GPT-4가 각 세그먼트의 특징과 전략 제시
- **3가지 전략 시나리오**:
  - 공격 전략: 시장 점유율 확대 목표
  - 효율 전략: ROI 최적화 목표
  - 방어 전략: 비용 절감 목표

### 3. 인터랙티브 대시보드
- **포트폴리오 요약**: 세그먼트별 키워드 수, 예산 비중, 최대 변동 구간 카드
- **세그먼트 탭**: 선택한 세그먼트의 순위별 클릭/비용 변화 그래프 (Recharts)
- **Top 10 키워드 테이블**: 광고비 상위 키워드의 순위별 비용 비교
- **전략 시나리오 카드**: 3가지 전략의 배경, 실행 방법, 예상 KPI 변화

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Validation**: Zod
- **Charts**: Recharts
- **Excel Processing**: xlsx
- **AI**: OpenAI GPT-4
- **Icons**: Lucide React
- **Package Manager**: pnpm

## 설치 및 실행

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 OpenAI API 키를 설정:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. 개발 서버 실행

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000` 접속

### 4. 프로덕션 빌드

```bash
pnpm build
pnpm start
```

## 사용 방법

1. **엑셀 파일 준비**
   - 네이버 검색광고 견적 파일 (.xlsx, .xls)
   - 2줄 헤더 포함 (PC/MO 구분, 순위별 클릭/비용/CPC)
   - PC 1~15위, MO 1~5위 데이터 포함

2. **파일 업로드**
   - 메인 페이지에서 엑셀 파일 선택
   - "분석 시작" 버튼 클릭

3. **대시보드 확인**
   - 포트폴리오 요약 확인
   - 세그먼트별 상세 분석 탐색
   - Top 10 키워드 확인
   - AI 전략 시나리오 검토

## 프로젝트 구조

```
/home/user/quotation/
├── app/
│   ├── api/
│   │   ├── generate/
│   │   │   └── route.ts          # AI 리포트 생성 API
│   │   └── upload/
│   │       └── route.ts          # 엑셀 파일 업로드 & 분석 API
│   ├── dashboard/
│   │   └── page.tsx              # 대시보드 UI
│   ├── globals.css               # 글로벌 스타일
│   ├── layout.tsx                # 루트 레이아웃
│   └── page.tsx                  # 메인 페이지 (파일 업로드)
├── src/
│   ├── lib/
│   │   ├── analyzer.ts           # 데이터 분석 엔진 (핵심 로직)
│   │   └── utils.ts              # 유틸리티 함수
│   └── types/
│       └── index.ts              # TypeScript 타입 정의
├── .env.example                  # 환경 변수 예시
├── next.config.js                # Next.js 설정
├── package.json                  # 프로젝트 의존성
├── tailwind.config.ts            # Tailwind CSS 설정
└── tsconfig.json                 # TypeScript 설정
```

## 핵심 알고리즘

### 중위값 기반 분류

```typescript
const medianClicks = calculateMedian(keywords.map(k => k.totalClicks));
const medianCPC = calculateMedian(keywords.map(k => k.avgCPC));

if (클릭수 > 중위값 && CPC > 중위값) return 'High-Volume';
if (클릭수 > 중위값 && CPC ≤ 중위값) return 'Efficiency';
if (클릭수 ≤ 중위값 && CPC ≤ 중위값) return 'Long-tail';
return 'High-Cost';
```

### 증분 단가 (iCPC) 계산

```typescript
iCPC = (Cost_n - Cost_{n+1}) / (Clicks_n - Clicks_{n+1})
```

## 에러 처리

- **파일 형식 검증**: .xlsx, .xls만 허용
- **파일 크기 제한**: 10MB 이하
- **엑셀 헤더 검증**: 2줄 이상 필수
- **API 에러 핸들링**: Toast 알림 및 에러 섹션 표시

## 타입 안정성

모든 데이터는 TypeScript 인터페이스와 Zod 스키마로 검증:

```typescript
export interface KeywordData {
  keyword: string;
  pc: Record<number, RankData>;
  mo: Record<number, RankData>;
  totalClicks: number;
  totalCost: number;
  avgCPC: number;
  segment: Segment;
}
```

## 포맷팅

모든 숫자는 `Intl.NumberFormat`을 사용하여 한국어 형식으로 표시:

- 화폐: `₩1,234,567`
- 숫자: `1,234`
- 퍼센트: `12.3%`
