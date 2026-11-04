# 📢 익명 불만 접수 & 소통 게시판 (VOC 시스템)

사용자가 별도의 회원가입이나 로그인 없이 **완전 익명**으로 불만 또는 건의사항을 등록하고, 관리자가 이를 검토하여 **공식 답변**을 남길 수 있는 소통 창구(Voice of Customer) 시스템입니다.

---

## 🚀 주요 특징 및 차별점

- **Zero-Dependency (외부 패키지 설치 불필요)**:
  - Node.js v26의 내장 SQLite(`node:sqlite`), 내장 HTTP 서버(`node:http`), 내장 암호화(`node:crypto`)를 활용하여 무거운 외부 라이브러리 설치 없이 즉시 실행 가능합니다.
- **철저한 익명성 및 비밀글 보안**:
  - 회원가입 없이 임의의 닉네임과 4자리 비밀번호만으로 등록.
  - 비밀글 선택 시 타인에게는 제목과 내용이 마스킹되며, 본인(비밀번호 입력자) 및 관리자만 열람 가능.
  - 비밀번호는 scrypt(솔트 적용) 알고리즘으로 안전하게 단방향 암호화 저장.
- **관리자 전용 대시보드 & 공식 답변(VOC)**:
  - 관리자 로그인 (`admin` / `admin1234!`)
  - 실시간 상태별 통계 카드 (전체, 접수대기, 검토중, 답변완료, 보류)
  - 원클릭 상태 변경 (`접수대기` ➔ `검토/처리중` ➔ `답변완료`)
  - 불만글별 공식 답변 작성/수정 기능 및 답변 등록 시 자동 상태 완료 처리.
- **모던하고 깔끔한 반응형 UI**:
  - 모바일, 태블릿, PC 어디서든 최적화된 화면 제공.
  - 카테고리 칩 필터링, 실시간 검색, 페이징 지원.

---

## 📁 프로젝트 구조

```text
complaint-board/
├── data/
│   └── board.sqlite            # SQLite 로컬 데이터베이스
├── public/
│   ├── index.html              # 사용자 게시판 메인 (목록, 검색, 상세/비밀번호 모달)
│   ├── write.html              # 익명 불만 접수 페이지
│   ├── admin.html              # 관리자 전용 대시보드 & 답변 관리
│   ├── style.css               # 모던하고 깔끔한 스타일시트
│   └── app.js                  # 사용자 인터랙션 및 API 통신 스크립트
├── src/
│   ├── auth.js                 # scrypt 비밀번호 해싱 및 HMAC 세션 쿠키 인증
│   ├── db.js                   # node:sqlite 기반 DB 연결 및 테이블 스키마
│   └── routes/
│       ├── posts.js            # 게시글 CRUD 및 비밀번호 검증 API
│       └── admin.js            # 관리자 로그인, 통계, 답변 작성 API
├── scripts/
│   ├── seed.js                 # 기본 관리자 계정 및 샘플 불만 데이터 생성
│   ├── test-direct.js          # API 및 핵심 비즈니스 로직 검증 테스트
│   └── test-server.js          # E2E 서버 테스트 스크립트
├── server.js                   # 내장 HTTP 서버 엔드포인트
├── package.json
└── README.md
```

---

## 💻 실행 방법

### 1. 기본 데이터 시딩 (선택 사항)
관리자 계정(`admin / admin1234!`)과 샘플 불만글 3건이 기본 생성됩니다:
```bash
node scripts/seed.js
```

### 2. 서버 실행
```bash
node server.js
```
실행 후 브라우저에서 아래 주소로 접속합니다:
- **사용자 불만 접수 게시판**: [http://localhost:3000](http://localhost:3000)
- **불만 접수 작성 페이지**: [http://localhost:3000/write](http://localhost:3000/write)
- **관리자 전용 대시보드**: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🔑 기본 관리자 계정 정보
- **아이디**: `admin`
- **비밀번호**: `admin1234!`
- 관리자 로그인 후 불만 상태를 실시간 변경하고 공식 답변을 등록할 수 있습니다.

