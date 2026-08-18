# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository

## Project Overview

CrewCheck 프론트엔드. 올리브영 매장 크루가 근무일을 등록하고 적립된 포인트를 조회·사용하는 모바일 퍼스트 웹앱이다.
백엔드는 **별도 저장소**(`mate`, Java/Spring Boot)이며, `next.config.ts`의 `rewrites()`로 프록시한다.

> **명칭 주의**: 서비스명은 CrewCheck로 변경되었으나 저장소명(`mate-front`), 메타데이터(`layout.tsx`의 `title: "MATE"`), UI 텍스트에는 아직 이전 명칭이 남아 있다. 신규 텍스트는 CrewCheck로 표기한다.

## Critical Rules (절대 규칙)

- `.env.local` 등 시크릿 파일 절대 커밋 금지
- main 브랜치에 직접 push 금지 - 반드시 PR을 통해 머지
- **API 호출은 반드시 `authFetch` 경유.** 직접 `fetch`를 쓰면 `Authorization` 헤더 첨부와 401 자동 갱신이 누락된다. (예외: `/api/bugs` 같은 Next.js 자체 Route Handler)
- **백엔드 응답은 `res.data ?? res`로 언래핑할 것.** 응답 포맷이 컨트롤러마다 다르다.
- **요일 번호는 서버(1=월~7=일)와 JS(0=일~6=토)가 다르다.** `serverDayToJsDay()` 변환 필수.
- `next.config.ts`의 `rewrites()` destination을 로컬 주소로 바꾼 채 커밋하지 말 것. 프로덕션이 로컬을 가리키게 된다.

## Tech Stack

- **Framework**: Next.js 16.2.6 (App Router). 전 페이지 `"use client"`로 사실상 SPA — SSR·서버 컴포넌트 미사용
- **React**: 19.2.4 / **TypeScript**: 5
- **Styling**: Tailwind CSS v4 **+ inline style 객체 혼재** (레이아웃은 Tailwind, 페이지 내부는 inline)
- **Test**: Playwright (E2E)
- **Backend**: 별도 저장소 `mate`. 모든 `/api/v1/*` 요청이 Render 배포 백엔드로 프록시됨

## Commands

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run start    # 빌드 결과 실행
```

> `lint` 스크립트 미정의. ESLint 도입 시 `package.json`에 추가할 것.

**로컬 백엔드로 개발하려면** `next.config.ts`의 `destination`을 `http://localhost:8080/...`으로 바꿔야 한다.
(개선 예정: `API_BASE_URL` 환경변수로 분리)

## Domain Context

| 정책 | 내용 |
|---|---|
| 적립 | 근무일 등록 후 **익일 오전 1시**(KST) 자동 지급 |
| 만료 | 적립일 기준 **21일 후** 소멸 |
| 차감 | **FIFO** — 만료 임박한 포인트부터 |
| 취소 | **당일 사용 건만** 가능 |
| 원장 타입 | `INIT`(초기 지급) / `EARN`(적립) / `USE`(사용) / `EXPIRE`(소멸) |

- 근무일은 `소정근무일`(정기)과 `연장근무`(비정기)로 나뉜다. 결근 처리(`skipped=true`)되면 적립되지 않는다.
- 날짜 계산은 KST 기준. `new Date(now.getTime() + 9 * 60 * 60 * 1000)` 패턴 사용.
- `crewId`는 JWT payload의 `sub`에서 추출한다. 별도 API 호출 없음.

## Auth Flow