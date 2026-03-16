# AI 과제 어드바이저 설계 — WOW Point

> 작성일: 2026-03-16

## 목표

"이 플랫폼이 내 회사를 이해하고 있다" + "이번 주 우리 회사 과제 기회 4.2억" → 바이럴

현재 플랫폼의 문제: 데이터/UI는 훌륭하나 "그래서 나는 뭘 해야 해?" 가 없음.
→ 모든 기능을 **"귀사(You)" 중심**으로 재설계.

---

## 핵심 구성 3개

### 1. Claude 요건 파싱 파이프라인 (정확도 인프라)

**문제**: bizinfo, subsidy24, kocca 3개 소스의 `target_industry`, `target_age` 필드가 비어있음.
현재 상태로 매칭 % 표시 시 신뢰도 0 → 사용자 이탈.

**해결**: Claude API로 `summary` 텍스트에서 구조화 요건 추출 → `parsed_requirements` JSONB 컬럼에 1회 저장.

```
[신규 과제 수집] → Claude API 파싱 → parsed_requirements 저장
[이후 매칭]      → DB 읽기만 (API 호출 없음)
```

**비용**:
- 기존 10,000건 일괄: ~$5~10 (1회성)
- 이후 신규 과제: ~$0.05~0.20/일

**출력 스키마**:
```json
{
  "max_company_age_years": 3,
  "min_company_age_years": null,
  "allowed_industries": ["IT", "소프트웨어", "AI"],
  "allowed_regions": ["서울", "경기"],
  "max_revenue_krw": 1000000000,
  "target_age_range": "39세 이하",
  "employee_count_max": 50,
  "parse_confidence": "high"
}
```

`parse_confidence`: `"high"` | `"medium"` | `"low"` — 낮으면 UI에서 "공고문 확인 필요" 표시.

---

### 2. 강화된 매칭 — 적격성 점수 + 체크리스트

**매칭 로직** (룰 기반, 100% 결정론적):
```
사용자 프로필 필드 vs parsed_requirements 직접 비교
→ 충족 항목 수 / 전체 확인 가능 항목 수 = 적격성 %
```

**UI (기존 매칭 페이지 /matching 인라인 통합)**:
```
[과제 카드]
──────────────────────────────────────
서울형 AI 스타트업 도약 지원사업 2026
적격성  ████████░░  87%              D-12  최대 5,000만원

✅ 업력 조건 (4년 ≥ 요건 3년)
✅ 업종 일치 (AI/소프트웨어)
✅ 지역 충족 (서울)
⚠️  매출 요건 미기재 → 공고문 확인 필요
──────────────────────────────────────
```

**신뢰도 표시 규칙**:
- `parse_confidence: high` → 적격성 % 표시
- `parse_confidence: medium` → % 표시 + "일부 요건 불명확" 뱃지
- `parse_confidence: low` → % 대신 "관련도 높음" + "공고문 확인 필요"

**프로필 완성도 유도**:
- 사용자 프로필 미기재 필드 있으면: "업력을 입력하면 X건 더 정확한 매칭 가능"

---

### 3. AI 주간 브리핑 — /briefing 페이지

매주 월요일 기준 생성. 로그인 후 대시보드 상단 배너 → /briefing 진입.

**페이지 레이아웃** (Foundry 다크 테마):
```
INTELLIGENCE BRIEFING          2026.03.17  Week 12
(주)포랩스 · AI/소프트웨어 · 서울 · 업력 4년
──────────────────────────────────────────────────

이번 주 귀사 과제 기회
┌──────────┐ ┌──────────┐ ┌──────────────┐
│ 신청가능  │ │ 마감 임박 │ │   총 기회액   │
│   23건   │ │   5건    │ │    4.2억     │
└──────────┘ └──────────┘ └──────────────┘

🔴 지금 바로 신청하세요 (D-7 이내)
1. 서울형 AI 스타트업 도약 지원  ···  D-3  적격성 94%  최대 5,000만원
   ✅ 업력 ✅ 업종 ✅ 지역 ✅ 규모
2. 중기부 기술혁신 개발사업      ···  D-6  적격성 81%  최대 2억원
   ✅ 업력 ✅ 업종 ⚠️ 매출 확인 필요

🟡 이번 주 신규 공고 (귀사 관련)
3~10. ...

[브리핑 공유하기]   [전체 23건 보기]
```

**공유 OG 카드** (바이럴 핵심):
```
📊 이번 주 우리 회사 과제 기회
         4.2억원
신청가능 23건 · 마감임박 5건
govgrants.forlabs.io/briefing
```
→ 카카오톡, 링크드인, 스타트업 커뮤니티 공유 시 이 카드 노출.

**브리핑 데이터 산출 방식** (100% 정확):
- 신청가능 건수: 적격성 % > 60% AND end_date >= today → 카운트
- 마감 임박: end_date 기준 D-7 이내
- 총 기회액: 해당 과제들의 amount_max 합산
- 모두 DB 연산 → API 없음, 비용 없음, 100% 정확

---

## UI 통합 전략 (Foundry 스타일 유지)

| 페이지 | 변경 내용 |
|---|---|
| `/matching` | 기존 리스트에 적격성 % 배지 + 체크리스트 인라인 추가 |
| `/` (대시보드) | 상단에 "이번 주 브리핑" 배너 추가 (클릭 → /briefing) |
| `/briefing` | 신규 페이지, Intelligence Panel 레이아웃 (기존 /intelligence 스타일) |
| `/mypage` | 프로필 완성도 % 표시 + 미기재 필드 유도 메시지 |

---

## 구현 순서

### Phase 1: 파싱 파이프라인 (백엔드)
1. `grant_projects` 테이블에 `parsed_requirements JSONB` 컬럼 추가 (Alembic)
2. `app/services/requirement_parser.py` — Claude API 호출, JSON 추출
3. `scripts/batch_parse.py` — 기존 10,000건 일괄 처리
4. 수집기 파이프라인에 파싱 단계 통합 (신규 과제 자동 파싱)

### Phase 2: 강화된 매칭 엔진 (백엔드)
5. `app/services/eligibility.py` — 프로필 vs parsed_requirements 룰 비교
6. `/api/matching` 엔드포인트 업데이트 — 적격성 점수 + 체크리스트 반환

### Phase 3: UI 업데이트 (프론트엔드)
7. `/matching` 페이지 — 적격성 배지 + 체크리스트 컴포넌트
8. `/mypage` — 프로필 완성도 표시

### Phase 4: 브리핑 (백엔드 + 프론트엔드)
9. `/api/briefing` 엔드포인트 — 브리핑 데이터 산출
10. `/briefing` 페이지 — Foundry 스타일 브리핑 UI
11. OG 이미지 생성 (`/api/briefing/og-image`) — 공유 카드
12. 대시보드 배너 추가

---

## 기술 스택 추가

| 추가 항목 | 용도 |
|---|---|
| `anthropic` Python SDK | requirement_parser.py |
| `satori` 또는 `@vercel/og` | OG 이미지 생성 (Next.js API route) |

---

## 성공 지표

- 프로필 완성도 70% 이상 사용자의 매칭 클릭률
- 브리핑 페이지 공유 수
- 매칭 → 상세 페이지 전환율 (적격성 % 도입 전후 비교)
