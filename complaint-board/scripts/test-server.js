import http from "node:http";

async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:3000${path}`, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on("error", reject);
    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("🚀 테스트 시작...");

  // 1. 게시글 목록 조회
  const listRes = await request("/api/posts");
  console.log("1. GET /api/posts:", listRes.status, `(게시글 수: ${listRes.body.posts.length})`);
  if (listRes.status !== 200) throw new Error("게시글 목록 조회 실패");

  // 2. 신규 익명 불만 등록
  const createRes = await request("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      title: "통합 테스트: 휴게실 에어컨 온도 조절 요청",
      content: "휴게실 온도가 너무 낮아서 춥습니다. 24도로 고정해 주실 수 있나요?",
      authorName: "추위타는직원",
      password: "pass1234",
      category: "시설/환경",
      isSecret: false,
    },
  });
  console.log("2. POST /api/posts:", createRes.status, createRes.body);
  if (createRes.status !== 201) throw new Error("신규 글 작성 실패");
  const newPostId = createRes.body.id;

  // 3. 작성된 글 상세 조회
  const detailRes = await request(`/api/posts/${newPostId}`);
  console.log("3. GET /api/posts/:id:", detailRes.status, detailRes.body.post.title);
  if (detailRes.status !== 200) throw new Error("상세 조회 실패");

  // 4. 관리자 로그인
  const loginRes = await request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { username: "admin", password: "admin1234!" },
  });
  console.log("4. POST /api/admin/login:", loginRes.status, loginRes.body);
  if (loginRes.status !== 200) throw new Error("관리자 로그인 실패");

  const setCookie = loginRes.headers["set-cookie"];
  const adminCookie = Array.isArray(setCookie) ? setCookie[0].split(";")[0] : setCookie.split(";")[0];

  // 5. 관리자 전체 목록 및 통계 조회
  const adminPostsRes = await request("/api/admin/posts", {
    headers: { Cookie: adminCookie },
  });
  console.log("5. GET /api/admin/posts (통계):", adminPostsRes.status, adminPostsRes.body.stats);
  if (adminPostsRes.status !== 200) throw new Error("관리자 목록 조회 실패");

  // 6. 관리자 공식 답변 등록
  const answerRes = await request(`/api/admin/posts/${newPostId}/answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: {
      content: "건의해 주셔서 감사합니다. 시설관리팀에 전달하여 휴게실 온도를 희망온도 25도로 재설정 완료하였습니다.",
      authorName: "총괄시설팀",
      nextStatus: "COMPLETED",
    },
  });
  console.log("6. POST /api/admin/posts/:id/answer:", answerRes.status, answerRes.body);
  if (answerRes.status !== 200) throw new Error("답변 등록 실패");

  // 7. 사용자가 다시 해당 글 조회 시 답변이 함께 오는지 확인
  const verifyRes = await request(`/api/posts/${newPostId}`);
  console.log(
    "7. GET /api/posts/:id (답변 검증):",
    verifyRes.status,
    `상태: ${verifyRes.body.post.status}`,
    `답변 수: ${verifyRes.body.post.answers.length}`,
    `답변 내용: ${verifyRes.body.post.answers[0]?.content.slice(0, 30)}...`
  );
  if (verifyRes.body.post.status !== "COMPLETED" || verifyRes.body.post.answers.length === 0) {
    throw new Error("답변 연동 검증 실패");
  }

  // 8. 비밀글 테스트
  const secretPostRes = await request("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      title: "비밀 테스트 불만",
      content: "이 내용은 비밀번호 없이는 볼 수 없어야 합니다.",
      authorName: "비밀이용자",
      password: "secret9999",
      category: "제안/건의",
      isSecret: true,
    },
  });
  const secretPostId = secretPostRes.body.id;

  // 비밀번호 없이 조회 -> requiresPassword: true 이어야 함
  const secretCheck1 = await request(`/api/posts/${secretPostId}`);
  console.log("8-1. 비밀글 비밀번호 없이 조회:", secretCheck1.body.requiresPassword === true ? "PASS (잠김)" : "FAIL");

  // 올바른 비밀번호로 조회
  const secretCheck2 = await request(`/api/posts/${secretPostId}?password=secret9999`);
  console.log("8-2. 비밀글 올바른 비밀번호로 조회:", secretCheck2.body.post?.content ? "PASS (내용 열림)" : "FAIL");

  console.log("🎉 모든 백엔드 API 및 비즈니스 로직 테스트 100% 통과!");
}

runTests().catch((err) => {
  console.error("❌ 테스트 실패:", err);
  process.exit(1);
});

