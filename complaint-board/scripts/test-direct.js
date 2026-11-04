import { initDb, queryOne } from "../src/db.js";
import {
  handleCreatePost,
  handleGetPosts,
  handleGetPostDetail,
  handleDeletePost,
} from "../src/routes/posts.js";
import {
  handleAdminLogin,
  handleAdminGetPosts,
  handleAdminAnswer,
  handleAdminUpdateStatus,
} from "../src/routes/admin.js";

// Mock Response Helper
function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    writeHead(code, headers = {}) {
      this.statusCode = code;
      this.headers = { ...this.headers, ...headers };
    },
    end(data) {
      this.body = data;
    },
    json() {
      try {
        return JSON.parse(this.body);
      } catch {
        return this.body;
      }
    },
  };
}

async function runDirectTests() {
  console.log("🔍 [단위/통합 테스트] 비즈니스 로직 및 API 핸들러 직접 검증 시작...\n");
  initDb();

  // 1. 글 작성 테스트 (공개글)
  console.log("Test 1: 익명 불만 접수 (공개글)");
  const createReq = {
    headers: { "x-forwarded-for": "192.168.1.100" },
  };
  const createRes = createMockRes();
  handleCreatePost(createReq, createRes, {
    title: "통합 테스트: 로비 안내데스크 호출벨 고장 건의",
    content: "로비 안내데스크의 벨이 작동하지 않습니다. 점검 요청드립니다.",
    authorName: "방문객A",
    password: "test1234password",
    category: "시설/환경",
    isSecret: false,
  });

  const createdData = createRes.json();
  console.log(`- 결과: status=${createRes.statusCode}, id=${createdData.id}`);
  if (createRes.statusCode !== 201 || !createdData.id) {
    throw new Error("글 작성 실패!");
  }
  const postId = createdData.id;

  // 2. 글 목록 조회 테스트
  console.log("\nTest 2: 익명 게시판 목록 조회");
  const listReq = {};
  const listRes = createMockRes();
  const listUrl = new URL("http://localhost/api/posts?page=1&limit=5");
  handleGetPosts(listReq, listRes, listUrl);

  const listData = listRes.json();
  console.log(`- 결과: status=${listRes.statusCode}, 총 게시글 수=${listData.pagination.totalCount}`);
  if (listRes.statusCode !== 200 || !listData.posts) {
    throw new Error("글 목록 조회 실패!");
  }

  // 3. 비밀글 작성 및 잠금 검증
  console.log("\nTest 3: 비밀글 등록 및 접근 제어 검증");
  const secretRes = createMockRes();
  handleCreatePost(createReq, secretRes, {
    title: "비공개 제보: 사내 복지 개선 건의",
    content: "이 내용은 비밀번호 없이는 절대 노출되면 안 됩니다.",
    authorName: "비밀제보자",
    password: "mysecret9999",
    category: "제안/건의",
    isSecret: true,
  });
  const secretPostId = secretRes.json().id;

  // 3-1. 비밀번호 없이 비밀글 조회
  const secretDetailRes1 = createMockRes();
  const secretUrl1 = new URL(`http://localhost/api/posts/${secretPostId}`);
  handleGetPostDetail({ headers: {} }, secretDetailRes1, secretPostId, secretUrl1);
  const secretData1 = secretDetailRes1.json();
  console.log(`- 비밀번호 없이 조회 시 requiresPassword: ${secretData1.requiresPassword} (제목: ${secretData1.post?.title})`);
  if (!secretData1.requiresPassword || secretData1.post?.title !== "🔒 비밀글입니다.") {
    throw new Error("비밀글 잠금 실패!");
  }

  // 3-2. 올바른 비밀번호로 비밀글 조회
  const secretDetailRes2 = createMockRes();
  const secretUrl2 = new URL(`http://localhost/api/posts/${secretPostId}?password=mysecret9999`);
  handleGetPostDetail({ headers: {} }, secretDetailRes2, secretPostId, secretUrl2);
  const secretData2 = secretDetailRes2.json();
  console.log(`- 올바른 비밀번호 입력 시 본문 열림: "${secretData2.post?.content}"`);
  if (secretData2.post?.content !== "이 내용은 비밀번호 없이는 절대 노출되면 안 됩니다.") {
    throw new Error("비밀글 잠금 해제 실패!");
  }

  // 4. 관리자 로그인 테스트
  console.log("\nTest 4: 관리자 인증");
  const loginRes = createMockRes();
  handleAdminLogin({}, loginRes, { username: "admin", password: "admin1234!" });
  const loginData = loginRes.json();
  const cookieHeader = loginRes.headers["Set-Cookie"];
  console.log(`- 결과: status=${loginRes.statusCode}, 관리자: ${loginData.admin?.name}`);
  if (loginRes.statusCode !== 200 || !cookieHeader) {
    throw new Error("관리자 로그인 실패!");
  }

  // 쿠키 파싱
  const adminCookieVal = cookieHeader.split(";")[0];
  const adminReq = {
    headers: { cookie: adminCookieVal },
  };

  // 5. 관리자 대시보드 통계 및 전체 목록 조회
  console.log("\nTest 5: 관리자 대시보드 통계 및 목록 조회");
  const adminListRes = createMockRes();
  const adminListUrl = new URL("http://localhost/api/admin/posts?status=ALL");
  handleAdminGetPosts(adminReq, adminListRes, adminListUrl);
  const adminListData = adminListRes.json();
  console.log(`- 통계 요약: 전체=${adminListData.stats.total}, 대기=${adminListData.stats.waiting}, 완료=${adminListData.stats.completed}`);

  // 6. 관리자 공식 답변 등록 및 상태 자동 완료 전이
  console.log("\nTest 6: 관리자 공식 답변 작성 및 상태 'COMPLETED' 전환");
  const answerRes = createMockRes();
  handleAdminAnswer(adminReq, answerRes, postId, {
    content: "현장 확인 결과 호출벨 회선 접촉 불량으로 확인되어 즉시 배선 교체 및 테스트를 마쳤습니다. 감사합니다.",
    authorName: "총괄시설팀",
    nextStatus: "COMPLETED",
  });
  console.log(`- 답변 결과: status=${answerRes.statusCode}, postStatus=${answerRes.json().status}`);
  if (answerRes.statusCode !== 200 || answerRes.json().status !== "COMPLETED") {
    throw new Error("관리자 답변 등록 실패!");
  }

  // 7. 일반 사용자가 답변 확인
  console.log("\nTest 7: 일반 이용자 상세 화면에서 공식 답변 연동 확인");
  const verifyRes = createMockRes();
  handleGetPostDetail({ headers: {} }, verifyRes, postId, new URL(`http://localhost/api/posts/${postId}`));
  const verifyData = verifyRes.json();
  console.log(`- 게시글 상태: ${verifyData.post.status}, 등록된 공식 답변 수: ${verifyData.post.answers.length}`);
  console.log(`- 공식 답변 내용: "${verifyData.post.answers[0]?.content}"`);
  if (verifyData.post.status !== "COMPLETED" || verifyData.post.answers.length !== 1) {
    throw new Error("공식 답변 조회 연동 실패!");
  }

  console.log("\n========================================================");
  console.log("🎉 모든 핵심 비즈니스 로직 및 보안/권한/답변 기능 검증 100% 성공!");
  console.log("========================================================");
}

runDirectTests().catch((err) => {
  console.error("❌ 테스트 에러:", err);
  process.exit(1);
});

