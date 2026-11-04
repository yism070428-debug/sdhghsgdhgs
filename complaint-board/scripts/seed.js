import crypto from "node:crypto";
import { initDb, queryOne, runQuery } from "../src/db.js";
import { hashPassword } from "../src/auth.js";

initDb();

console.log("🌱 데이터베이스 시딩을 시작합니다...");

// 1. 관리자 계정 생성 (admin / admin1234!)
let admin = queryOne("SELECT * FROM admins WHERE username = ?", ["admin"]);
let adminId;

if (!admin) {
  adminId = crypto.randomUUID();
  const passwordHash = hashPassword("admin1234!");
  const now = new Date().toISOString();
  runQuery(
    `INSERT INTO admins (id, username, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`,
    [adminId, "admin", passwordHash, "총괄운영팀", now]
  );
  console.log("✅ 관리자 계정 생성 완료 (admin / admin1234!)");
} else {
  adminId = admin.id;
}

// 2. 기존 글 비우고 사진과 동일한 분위기의 샘플 데이터 생성
runQuery("DELETE FROM answers");
runQuery("DELETE FROM posts");

const samplePosts = [
  {
    category: "세탁용품>오투액션 스프레이",
    title: "과장사기광고 중단하고 오투액션 생산 판매 금지 요청",
    content: "광고에서는 뿌리기만 하면 얼룩이 다 지워진다고 나오는데 전혀 지워지지 않고 옷감만 상했습니다. 이에 대한 공식 입장과 환불 조치를 요구합니다.",
    authorName: "runner",
    status: "COMPLETED",
    createdAt: "2026-08-04T09:12:00.000Z",
    answer: {
      authorName: "총괄운영팀",
      content: "고객님 안녕하십니까, 오투액션 고객만족센터입니다.\n\n먼저 제품 사용 과정에서 큰 불편과 실망을 드려 대단히 죄송합니다.\n해당 제품의 얼룩 제거 가이드라인 및 표기 사항을 전면 재검토 중이며, 구매 영수증을 고객센터로 접수해주시면 확인 후 100% 전액 환불 및 회수 처리를 진행해 드리겠습니다.",
      createdAt: "2026-08-04T14:30:00.000Z",
    },
  },
  {
    category: "세탁용품>옥시크린",
    title: "옥시크린 절대로 사용하지마세요!! 피해 심각",
    content: "흰 옷 표백하려고 설명서대로 정량 사용했는데 전체가 누렇게 변색되고 옷감이 찢어졌습니다. 보상해주세요.",
    authorName: "kudh81",
    status: "PROCESSING",
    createdAt: "2026-07-20T11:45:00.000Z",
  },
  {
    category: "세탁용품>옥시크린",
    title: "옥시크린.. 과대, 허위광고 아닙니까? 환불해주세요.",
    content: "티비 광고보고 믿고 샀는데 일반 세제보다도 세척력이 떨어집니다. 허위광고 심의 요청 넣겠습니다.",
    authorName: "dldl7336",
    status: "WAITING",
    createdAt: "2026-07-12T16:20:00.000Z",
  },
  {
    category: "세탁용품>옥시크린",
    title: "옥시크린 광고 사기 건에 대한 추가 문의",
    content: "지난번 문의에 답변이 없으셔서 다시 등록합니다. 담당자분 빠른 확인 부탁드립니다.",
    authorName: "runner",
    status: "COMPLETED",
    createdAt: "2026-07-08T10:05:00.000Z",
    answer: {
      authorName: "품질관리팀",
      content: "안녕하세요 고객님, 답변 지연으로 불편을 드려 죄송합니다. 유선 연락을 통해 안내드린 대로 금일 교환 제품 발송 및 보상 절차가 접수되었습니다.",
      createdAt: "2026-07-09T09:00:00.000Z",
    },
  },
  {
    category: "세탁용품>오투액션 분말형",
    title: "오투액션 분말형 절대사용하지 마세요 찬물에 안녹음",
    content: "찬물 세탁 시 가루가 그대로 뭉쳐서 옷에 하얗게 들러붙어 나옵니다. 헹굼을 5번을 해도 안 빠져요.",
    authorName: "sin00430",
    status: "PROCESSING",
    createdAt: "2026-07-05T13:10:00.000Z",
  },
  {
    category: "세탁용품>오투액션 스프레이",
    title: "오투액션 스프레이 분사 노즐 불량 건의",
    content: "스프레이 손잡이를 몇 번 누르지도 않았는데 노즐이 헛돌고 액이 손으로 줄줄 흘러내립니다. 용기 개선 필요합니다.",
    authorName: "comangei",
    status: "WAITING",
    createdAt: "2026-06-10T17:35:00.000Z",
  },
  {
    category: "세탁용품>오투액션 스프레이",
    title: "오투액션 스프레이 솔직 사용후기 올립니다.",
    content: "와이셔츠 목 때에는 효과가 약간 있으나 기름때나 음식물 얼룩에는 거의 효과가 없습니다. 참고하세요.",
    authorName: "y601227",
    status: "WAITING",
    createdAt: "2026-06-08T08:50:00.000Z",
  },
  {
    category: "세탁용품>오투액션",
    title: "오투액션 피부 트러블 발생 문의 (비밀글)",
    content: "오투액션 손빨래 시 맨손으로 만졌다가 손가락 껍질이 벗겨지고 발진이 일어났습니다. 비공개 상담 원합니다.",
    authorName: "habin092",
    isSecret: true,
    status: "WAITING",
    createdAt: "2026-06-06T19:00:00.000Z",
  },
  {
    category: "세탁용품>오투액션 젤",
    title: "<오투액션젤> 용기가 너무 불편합니다.. 개선요청",
    content: "젤 형태라 끈적거리는데 뚜껑 닫을 때마다 옆으로 흘러내려 세탁기 주변이 난장판이 됩니다.",
    authorName: "sejinwin",
    status: "WAITING",
    createdAt: "2025-12-03T14:15:00.000Z",
  },
  {
    category: "세탁용품>오투액션 젤",
    title: "오투액션 젤 겨울철에 왜 어는 건가요?",
    content: "베란다 세탁실에 두었는데 젤이 얼어붙어서 나오질 않습니다. 보관 온도 주의사항이 너무 작게 쓰여있어요.",
    authorName: "thefirst",
    status: "WAITING",
    createdAt: "2025-11-20T10:30:00.000Z",
  },
];

for (const p of samplePosts) {
  const postId = crypto.randomUUID();
  const passwordHash = hashPassword("1234");

  runQuery(
    `INSERT INTO posts (id, title, content, author_name, password_hash, category, is_secret, status, view_count, client_ip_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 10, 'seed', ?, ?)`,
    [
      postId,
      p.title,
      p.content,
      p.authorName,
      passwordHash,
      p.category,
      p.isSecret ? 1 : 0,
      p.status,
      p.createdAt,
      p.createdAt,
    ]
  );

  if (p.answer) {
    runQuery(
      `INSERT INTO answers (id, post_id, admin_id, author_name, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        postId,
        adminId,
        p.answer.authorName,
        p.answer.content,
        p.answer.createdAt,
        p.answer.createdAt,
      ]
    );
  }
}

console.log("✨ 사진 속 데이터 스타일로 10건 샘플 및 공식 답변 시딩 완료!");
