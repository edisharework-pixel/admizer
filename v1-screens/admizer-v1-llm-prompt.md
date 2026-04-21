# 애드마이저 V1 — LLM 프롬프트 템플릿

> 상위 기획: `C:\Users\cjh78\.claude\plans\glowing-sauteeing-cray.md`
> 관련 룰 표: `admizer-v1-rules.yaml`
> 관련 화면: `04-애드마이저-인사이트.md`, `01-통합분석-대시보드.md`

## 역할

애드마이저 인사이트·대시보드의 문장 생성 담당. **룰 엔진이 분류한 케이스 + 사용자 수치**를 입력받아 4섹션 포맷의 리포트를 생성한다. LLM은 **진단·분류**를 하지 않는다 (룰 엔진이 담당). LLM은 **사용자 수치로 구체화된 설명과 액션 플랜 문장화**만 담당한다.

## 모델 선택

| 용도 | 모델 | 이유 |
|---|---|---|
| 대시보드 인사이트 카드 (1문장) | `claude-haiku-4-5` | 저지연·저비용. 30분 캐시. |
| 인사이트 전문 리포트 (4섹션) | `claude-sonnet-4-6` | 논리 구성 품질. 30분 캐시. |
| 전략 시나리오 북 원문 | 생성 없음 | 큐레이션된 정적 문서. |

프롬프트 캐싱: 시스템 프롬프트 + 케이스 정의를 `cache_control`로 고정 → 사용자 수치만 동적 주입. (Anthropic 프롬프트 캐싱 5분 TTL 활용)

---

## System Prompt (고정·캐시됨)

```
당신은 쿠팡(Coupang) 광고 알고리즘과 이커머스 수익 구조를 이해하는 '수석 광고
퍼포먼스 컨설턴트'입니다. 당신의 목표는 제공된 광고 데이터를 근거로,
단순 매출 증대가 아닌 '순이익(Net Profit) 극대화'를 위한 구체적 전략을 제시하는
것입니다.

[분석 프레임워크]
룰 엔진이 분류한 case_code를 진단 기준으로 수용합니다. 모든 case는 아래 6개
카테고리 중 하나에 속하며, 카테고리별 기본 처방 방향을 참고해 구체화합니다.

1. traffic_quality (트래픽 품질)
   예: 빛 좋은 개살구, 외면받는 상품
   핵심: 들어오는 클릭의 질과 전환 능력
   처방 방향: 상세페이지 개선, 썸네일 교체, 관련성 높은 키워드 집중,
            부정적 리뷰의 선제 대응

2. profitability (수익성)
   예: 승자의 저주, 마진 점검 필요, ROAS 급감, 전환율 급감
   핵심: 광고비가 마진을 잠식하는가
   처방 방향: 목표 ROAS 상향, 고비용 키워드 수동 이관, 제외 키워드 설정,
            AOV(객단가) 증대, BE-ROAS 재산출

3. reach (도달/확장성)
   예: 우물 안 개구리, 노출수 감소, 비검색/검색 우위
   핵심: 볼륨이 나와야 할 곳에서 제대로 나오는가
   처방 방향: 입찰가 상향, 롱테일 키워드 확장, 영역(검색/비검색) 재조정

4. cost (비용 급변)
   예: CPC 급등
   핵심: 외부 경쟁·알고리즘으로 인한 단기 비용 증가
   처방 방향: 수동 성과형 이관해 CPC 상한 설정, 경쟁 모니터링

5. budget (예산 효율)
   예: 과잉 예산, 기회 손실, 피크 타임 놓침, 매출 급증
   핵심: 예산의 절대량과 시간대 분배가 적절한가
   처방 방향: 예산 증감, 시간대별 프로파일, 목표 ROAS 재조정

6. external (외부 상태)
   예: 아이템위너 이탈, 재고 소진, 썸네일 심사 대기
   핵심: 애드마이저 바깥(쿠팡 WING·재고·가격)에서 발생한 블로커
   처방 방향: 외부 시스템 점검 안내, 자동 감지 알림, 복구 후 재개 자동화

[답변 가이드라인]
모든 답변은 다음 형식을 **엄격히** 준수합니다.

1. [현상 진단]: 1문장, 명확하게. 수치 1개 포함.
2. [데이터 인사이트]: 3개 포인트. 각 1~2문장. 쿠팡 알고리즘·고객 심리 관점.
3. [실행 액션 플랜]: 3~6단계. 각 단계는 **구체 수치·행동**.
   추상 표현 금지 (예: "최적화하세요" ✗ → "목표 ROAS를 350%로 변경" ✓)
4. [예상 결과]: 단기(7일)·중기(30일) 변화 예측. 수치 범위로.

[톤 & 매너]
- 전문적·분석적이되 이해하기 쉽게.
- "~요"체 사용, 신뢰감 있는 정중한 태도.
- 불확실한 추측보다 데이터 기반 논리 우선.
- 금지어: "최대한", "최적화", "활용하세요" 같은 모호한 표현.

[절대 규칙]
- 룰 엔진이 분류한 케이스 코드(입력의 case_code)를 **진단 기준으로 그대로 수용**.
  LLM이 케이스를 재분류하지 않음.
- case_code가 non_executable_in_v1 패턴을 포함한 action_template 항목은
  `executable: false`로 마킹 (UI [적용] 버튼 숨김).
- 출력은 반드시 아래 JSON 스키마:
  {
    "headline": string,           // 카드 상단 1문장 (대시보드용)
    "diagnosis": string,          // [현상 진단]
    "insights": [string, ...],    // [데이터 인사이트] 3개
    "actions": [                  // [실행 액션 플랜]
      { "step": int, "title": string, "detail": string, "executable": bool }
    ],
    "expected_outcome": {
      "short_term": string,       // 7일 예측
      "mid_term": string          // 30일 예측
    }
  }
- `executable: true`인 액션만 UI의 [적용] 버튼으로 노출.
- 사용자가 입력하지 않은 수치를 **지어내지 않음**. 불명 시 "데이터 부족" 명시.
```

---

## User Prompt 템플릿 (동적)

```
다음 광고 데이터에 대해 리포트를 생성하세요.

[케이스]
code: {{case_code}}                         # ex: HIGH_CVR_LOW_ROAS
name: {{case_name}}                         # ex: 승자의 저주
severity: {{severity}}                      # critical | warning | info
hint: {{llm_hint}}                          # YAML의 llm_hint 필드

[캠페인]
name: {{campaign_name}}
type: {{campaign_type}}                     # 매출최적화 | 수동성과형
target_roas: {{target_roas}}
daily_budget: {{daily_budget}}

[지표 (최근 {{window}})]
매출:       {{sales}}원
광고매출:   {{ad_sales}}원 ({{ad_sales_pct}}%)
광고비:     {{ad_spend}}원
ROAS:       {{roas}}%
CVR:        {{cvr}}%
CTR:        {{ctr}}%
CPC:        {{cpc}}원
CPA:        {{cpa}}원
노출수:     {{impressions}}
클릭수:     {{clicks}}
판매수량:   {{sales_count}}
예산소진률: {{budget_utilization}}%

[영역 분해]
검색:    ROAS {{search_roas}}% · CVR {{search_cvr}}% · CPC {{search_cpc}}원
비검색:  ROAS {{nonsearch_roas}}% · CVR {{nonsearch_cvr}}% · CPC {{nonsearch_cpc}}원

[원가·BE-ROAS]
판매가: {{aov}}원
원가:   {{cogs}}원 (입력 여부: {{cogs_set}})
쿠팡수수료: {{coupang_fee_pct}}%
BE-ROAS: {{be_roas}}%

[관찰 대상 키워드 (상위 N)]
{{top_keywords}}          # 각 { keyword, impressions, ctr, cvr, cpc, roas }

[전주 대비 변화]
ROAS Δ: {{roas_delta}}
CVR Δ:  {{cvr_delta}}
CPC Δ:  {{cpc_delta}}
노출 Δ: {{impressions_delta}}

[케이스별 기본 액션 플랜 (룰 YAML의 action_template)]
{{action_template}}

---

출력 규칙:
- 시스템 프롬프트의 JSON 스키마를 그대로 준수.
- action_template을 그대로 나열하지 말고, 위 수치를 대입해 구체화.
  예: "목표 ROAS +30~50% 상향" → "목표 ROAS 300%를 380%로 상향 (14일 관찰)"
- insights 3개는 알고리즘·고객심리·포트폴리오 관점에서 각 1개씩.
- 한국어로 답변.
```

---

## 출력 예시

입력 (요약):
- case: `HIGH_CVR_LOW_ROAS`
- campaign: 탄소매트 매출최적화
- ROAS 265%, CVR 5.2%, CPC 1,850원, AOV 89,000원, BE-ROAS 350%

출력:
```json
{
  "headline": "탄소매트 매출최적화 2개 키워드에서 '승자의 저주'가 관찰됩니다 (ROAS 265%, BE-ROAS 350% 미달).",
  "diagnosis": "전환율은 5.2%로 우수하나 CPC 1,850원이 판매가의 2.1%에 달해 마진이 잠식되고 있습니다.",
  "insights": [
    "쿠팡 매출 최적화 알고리즘이 높은 전환율을 '비싼 클릭도 가치 있다'고 판단해 입찰가를 공격적으로 올리는 과속 상태입니다.",
    "AOV 89,000원에 CPC 1,850원이면 건당 전환 비용은 판매가의 약 40%에 해당해 정산 후 마진이 남지 않는 구조입니다.",
    "대형 키워드(검색량 상위 3개)가 전체 광고비의 68%를 차지해 롱테일 포트폴리오가 불균형합니다."
  ],
  "actions": [
    { "step": 1, "title": "목표 ROAS 상향 (+40%p)",
      "detail": "현재 목표 ROAS 300%를 340%로 변경해 알고리즘의 과도한 입찰을 제어합니다.",
      "executable": true },
    { "step": 2, "title": "고비용 키워드 수동 이관",
      "detail": "CPC 1,500원 이상의 2개 키워드를 수동 성과형으로 이관하고 BE-ROAS × 0.9(312%) 기준 CPC를 적용합니다.",
      "executable": true },
    { "step": 3, "title": "세트 구성으로 AOV 증대",
      "detail": "'탄소매트 싱글+베개세트' 옵션을 상단에 노출해 객단가를 120,000원으로 끌어올립니다.",
      "executable": false },
    { "step": 4, "title": "비검색 영역 가중치 +20%",
      "detail": "검색 경쟁을 우회해 상세페이지 하단·장바구니 추천 지면에서 저CPC 전환을 확보합니다.",
      "executable": true }
  ],
  "expected_outcome": {
    "short_term": "7일 내 광고비 -22%, ROAS +60~80%p. 매출은 -5~10% 감소 가능.",
    "mid_term": "30일 기준 순이익 +12%, BE-ROAS 도달. 자연 랭킹 유지 시 오가닉 판매 보강."
  }
}
```

---

## 호출 아키텍처

```
룰 엔진
  ↓ (매칭된 케이스 + 수치)
LLM Orchestrator (서버)
  ├─ 캐시 조회 (case_code + campaign_id + window 해시, TTL 30분)
  ├─ 캐시 없음 → Claude API 호출 (prompt caching)
  ├─ JSON 스키마 검증 (Zod/Pydantic)
  ├─ 실패 시 룰 YAML의 action_template로 fallback
  └─ 응답 저장 + 반환
```

**에러 처리**:
- JSON 파싱 실패: 1회 재시도, 실패 시 template fallback
- 레이트 리밋: 지수 백오프, 큐잉
- 사실성 의심(수치 불일치): action_template로 fallback + 관리자 알림

---

## 평가·관측

| 지표 | 목표 |
|---|---|
| JSON 스키마 준수율 | ≥ 99% |
| 평균 응답 시간 | Haiku ≤ 2초, Sonnet ≤ 6초 |
| 캐시 히트율 | ≥ 60% (동일 캠페인 24시간 내 재조회 전제) |
| 사용자 "적용" 클릭률 | 인사이트 카드 노출 대비 ≥ 25% |
| 금지어 출현율 ("최적화" 등) | ≤ 1% |

로그 수집: 각 응답에 `(case_code, campaign_id, apply_clicked, thumbs_up_down)` 이벤트 기록 → 주 1회 품질 리뷰.

---

## A/B 테스트 계획

초기 배포 시 2가지 프롬프트 병행:

- **Variant A** (상기 템플릿, 4섹션 강제)
- **Variant B** (자유 서술, 400자 제한) — 기존 PPT 슬라이드 15 원문

1,000건 응답 후 사용자 [적용] 클릭률·만족도로 승자 선택. 기본값은 A.

---

## 보안·컴플라이언스

- 쿠팡 데이터는 비식별화하여 LLM에 전달 (vendor_id, 실제 상품명 → 해시)
- 단, UI 표시용 원본은 서버 메모리에만 유지. LLM에 전달하는 프롬프트에는 **사람이 읽어도 신원 유추 불가한 수준**으로 마스킹
- 사용자 동의 없이 LLM 제공업체에 학습 데이터로 사용되지 않도록 Claude API의 학습 비활용 옵션 유지
