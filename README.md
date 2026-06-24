# 🫒 MATE — 올리브영 자소 포인트 관리 프론트엔드

올리브영 자소(자기소개서) 포인트를 조회하고 사용하는 크루 전용 웹 앱입니다.  
포인트 사용 내역 캘린더, 근무일 등록, 어드민 관리 화면을 제공합니다.

---

## ✨ 주요 기능

- 🔐 **로그인 / 회원가입** — 사번 기반 JWT 인증, 로그인 유지 옵션
- 📊 **대시보드** — 포인트 잔액, 이번 달 적립/사용 현황, 근무일 캘린더
- 💳 **포인트 사용** — 제품명(메모) 입력, 당일 사용 취소(10초 undo)
- 📅 **내역 탭** — 월별 캘린더로 날짜별 적립·사용·소멸 내역 확인
- ⚠️ **소멸 예정 알림** — 가장 빠른 만료 포인트 배너 표시
- 🛠 **어드민** — 크루 등록, 포인트 소급 적립, 근무일 및 내역 관리

---

## 🛠 기술 스택

| 분류 | 사용 기술 |
|------|----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Runtime | React 19 |
| Styling | Inline Style (CSS-in-JS 없음) |
| Deploy | Vercel |
| API | REST (백엔드: Render) |

---

## 🚀 빠른 시작

### 1. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하세요.

```env
NEXT_PUBLIC_ADMIN_KEY=mate-admin-secret-key
```

### 2. 패키지 설치 및 실행

```bash
npm install
npm run dev
```

앱이 `http://localhost:3000`에서 시작됩니다.

### 3. 빌드

```bash
npm run build
npm start
```

---

## 📁 프로젝트 구조

```
app/
├── page.tsx                  # 로그인
├── signup/page.tsx           # 회원가입 (3단계: 계정 → 초기 포인트 → 근무 요일)
├── dashboard/page.tsx        # 메인 대시보드 (포인트 사용, 근무 등록)
├── history/page.tsx          # 포인트 내역 (월별 캘린더)
├── mypage/page.tsx           # 마이페이지
├── admin/
│   ├── login/page.tsx        # 어드민 로그인
│   └── page.tsx              # 어드민 관리 화면
├── components/
│   └── TopProgressBar.tsx    # 전역 로딩 프로그레스 바
└── api/
    └── bugs/route.ts         # 버그 리포트 로컬 API
```

---

## 🔗 API 연동

`next.config.ts`에서 `/api/*` 요청을 백엔드로 프록시합니다.

```ts
async rewrites() {
  return [
    {
      source: "/api/:path*",
      destination: "https://olivemate-api.onrender.com/api/:path*",
    },
  ];
}
```

모든 인증 요청에는 아래 헤더가 포함됩니다.

```http
Authorization: Bearer {accessToken}
X-Admin-Key: {adminSecretKey}
```

---

## 📱 화면 구성

| 경로 | 화면 | 주요 기능 |
|------|------|----------|
| `/` | 로그인 | 사번·비밀번호, 로그인 유지 |
| `/signup` | 회원가입 | 계정 생성 → 초기 포인트 → 근무 요일 |
| `/dashboard` | 대시보드 | 잔액, 포인트 사용, 근무일 캘린더 |
| `/history` | 내역 | 월별 캘린더, 날짜별 상세, 사용 취소 |
| `/mypage` | 마이페이지 | 계정 정보 |
| `/admin` | 어드민 | 크루·포인트·근무일 관리 |

---

## ⚙️ 환경별 동작

| 환경 | API 대상 |
|------|---------|
| 로컬 (`npm run dev`) | `https://olivemate-api.onrender.com` (프록시) |
| Vercel 배포 | `https://olivemate-api.onrender.com` (프록시) |

> 로컬 백엔드를 사용하려면 `next.config.ts`의 `destination`을 `http://localhost:8080/api/:path*`로 변경하세요.
