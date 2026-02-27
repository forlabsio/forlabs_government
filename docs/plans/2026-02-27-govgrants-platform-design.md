# 정부지원사업 통합 조회 플랫폼 설계안

> 일명: '지원사업의 OP.GG'
> 작성일: 2026-02-27

## 1. 서비스 개요

창업자와 중소기업 실무자들이 매일 루틴하게 접속하는 정부 과제 포털.
토스/노션 스타일의 모던 UI로, 지원 금액과 D-Day를 핵심 정보로 강조.

## 2. 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| 프론트엔드 | Next.js 15 + Tailwind v4 + TypeScript | Vercel 배포 |
| 백엔드 | FastAPI + SQLAlchemy async + Celery | Railway 배포 |
| DB | PostgreSQL + pgvector | Railway 배포 |
| 캐시/큐 | Redis | Celery 브로커 + 캐싱 |
| 인증 | Supabase Auth | 소셜 로그인 + JWT |
| AI 검색 | OpenAI Embedding → pgvector 유사도 검색 | LLM 호출 최소화 |
| 이메일 | Resend (또는 SendGrid) | 오픈율/CTR 트래킹 |
| 스케줄러 | Celery Beat | 10:00/13:00/17:00 KST 하루 3회 |

## 3. 데이터 소스 (6개 공공 API)

1. **기업마당(Bizinfo)** — 범부처 지원사업 통합
2. **NTIS** — 국가 R&D 연구과제
3. **KOCCA** — 콘텐츠 산업 특화
4. **K-Startup** — 창업 특화
5. **보조금24** — 지자체 + 개인 혜택
6. **중소벤처24** — 중기부 계열

## 4. 데이터 파이프라인

```
[6개 공공 API] → Celery Beat (10:00, 13:00, 17:00 KST)
  → FastAPI 수집 워커 → 정제/중복제거 → PostgreSQL 저장
  → 임베딩 생성 → pgvector 저장
  → 수집 로그 기록 → Admin 대시보드 반영
```

- 중복 제거: `title + organization + end_date` → SHA256 해시
- 1사업 N출처 구조: grant_projects(1건) ↔ grant_sources(N건)

## 5. DB 스키마

### users
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | Supabase Auth uid |
| email | VARCHAR UNIQUE | 이메일 |
| name | VARCHAR | 이름 |
| is_admin | BOOLEAN | 관리자 여부 (단일 관리자) |
| company_name | VARCHAR | 기업명 |
| industry | VARCHAR | 업종 |
| company_age | INTEGER | 업력 (년) |
| region | VARCHAR | 소재지 |
| employee_count | INTEGER | 직원 수 |
| revenue_range | VARCHAR | 매출 구간 |
| profile_embedding | VECTOR(1536) | 기업 프로필 임베딩 |
| email_opt_in | BOOLEAN | 이메일 수신 동의 |
| created_at | TIMESTAMPTZ | 생성일 |
| updated_at | TIMESTAMPTZ | 수정일 |

### grant_projects
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| title | VARCHAR | 사업명 |
| summary | TEXT | 사업 개요 |
| category | VARCHAR | 표준 카테고리 (자금/R&D/공간/교육/인력/수출) |
| amount_min | BIGINT | 최소 지원금액 (원) |
| amount_max | BIGINT | 최대 지원금액 (원) |
| target_industry | VARCHAR[] | 대상 업종 |
| target_region | VARCHAR[] | 대상 지역 |
| target_age | VARCHAR | 대상 업력 조건 |
| start_date | DATE | 접수 시작일 |
| end_date | DATE | 접수 마감일 |
| status | VARCHAR | 접수중/마감/예정 |
| organization | VARCHAR | 주관기관 |
| detail_url | VARCHAR | 원문 링크 |
| content_embedding | VECTOR(1536) | AI 검색용 임베딩 |
| dedup_hash | VARCHAR UNIQUE | 중복 제거용 해시 |
| created_at | TIMESTAMPTZ | 생성일 |
| updated_at | TIMESTAMPTZ | 수정일 |

### grant_sources
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| grant_id | UUID FK | → grant_projects |
| source | VARCHAR | bizinfo/ntis/kocca/kstartup/subsidy24/smes |
| source_id | VARCHAR | 원본 API 고유 ID |
| raw_data | JSONB | 원본 데이터 보존 |
| fetched_at | TIMESTAMPTZ | 수집 시점 |
| UNIQUE | (source, source_id) | |

### user_bookmarks
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK | → users |
| grant_id | UUID FK | → grant_projects |
| calendar_synced | BOOLEAN | 구글캘린더 연동 여부 |
| created_at | TIMESTAMPTZ | |
| UNIQUE | (user_id, grant_id) | |

### search_logs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK (nullable) | → users |
| query_text | VARCHAR | 원문 검색어 |
| result_count | INTEGER | 결과 수 |
| filters_used | JSONB | 적용된 필터 |
| created_at | TIMESTAMPTZ | |

### fetch_logs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| source | VARCHAR | API 출처 |
| schedule_time | VARCHAR | 10:00/13:00/17:00 |
| status | VARCHAR | success/partial/failed |
| total_fetched | INTEGER | 수집 건수 |
| new_count | INTEGER | 신규 등록 건수 |
| updated_count | INTEGER | 업데이트 건수 |
| duplicate_count | INTEGER | 중복 스킵 건수 |
| error_message | TEXT | 에러 내용 |
| started_at | TIMESTAMPTZ | |
| finished_at | TIMESTAMPTZ | |

### banners
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| title | VARCHAR | 배너 제목 |
| image_url | VARCHAR | 이미지 URL |
| link_url | VARCHAR | 클릭 시 이동 URL |
| target_industry | VARCHAR[] | 타겟 업종 |
| target_region | VARCHAR[] | 타겟 지역 |
| is_active | BOOLEAN | 활성 여부 |
| impressions | INTEGER | 노출수 |
| clicks | INTEGER | 클릭수 |
| start_date | DATE | 게시 시작일 |
| end_date | DATE | 게시 종료일 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### email_logs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK | → users |
| email_type | VARCHAR | curation/welcome/... |
| grant_ids | UUID[] | 포함된 사업 ID들 |
| sent_at | TIMESTAMPTZ | 발송 시점 |
| opened_at | TIMESTAMPTZ | 오픈 시점 |
| clicked_at | TIMESTAMPTZ | 클릭 시점 |

## 6. 핵심 기능

### User 웹사이트
1. 통합 리스트 (중복 제거, 카테고리 필터, 출처 필터)
2. 자연어 AI 검색 (임베딩 기반 유사도 검색)
3. 마이페이지 (기업 프로필, AI 매칭 점수, 북마크, 구글캘린더 연동)
4. 개인화 이메일 큐레이션 (매일 아침 자동 발송)

### Admin 관리자 페이지 (단일 관리자)
1. 대시보드 (DAU/MAU/Retention, 이메일 오픈율/CTR, 수집 로그)
2. 검색어 인사이트 (검색어 랭킹, Zero-Result 통계)
3. 배너 광고 관리 (CRUD, 타겟팅, 노출/클릭 통계)

## 7. 관리자 인증

- Supabase Auth 이메일로 관리자 판별
- `users.is_admin = true`인 계정만 /admin 라우트 접근 허용
- 프론트 미들웨어 + 백엔드 API 양쪽에서 검증

## 8. 트래픽 대비

- 1~3월 연초 트래픽 집중 예상
- Vercel 자동 스케일링 (프론트)
- Railway 자동 스케일링 (백엔드)
- Redis 캐싱으로 DB 부하 분산
- ISR(Incremental Static Regeneration)으로 정적 페이지 캐싱
