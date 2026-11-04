import crypto from "node:crypto";
import { queryAll, queryOne, runQuery } from "../db.js";
import {
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  parseCookies,
} from "../auth.js";

function requireAdmin(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.complaint_admin_token;
  const admin = verifySessionToken(token);
  if (!admin) {
    res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "관리자 인증이 필요합니다." }));
    return null;
  }
  return admin;
}

export function handleAdminLogin(req, res, body) {
  const { username, password } = body;
  if (!username || !password) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "아이디와 비밀번호를 입력해주세요." }));
  }

  const admin = queryOne("SELECT * FROM admins WHERE username = ?", [username.trim()]);
  if (!admin) {
    res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "관리자 계정을 찾을 수 없습니다." }));
  }

  const isMatch = verifyPassword(password, admin.password_hash);
  if (!isMatch) {
    res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "비밀번호가 일치하지 않습니다." }));
  }

  const token = createSessionToken({
    id: admin.id,
    username: admin.username,
    name: admin.name,
  });

  const cookieHeader = `complaint_admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie": cookieHeader,
  });
  res.end(
    JSON.stringify({
      message: "관리자 로그인 성공",
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
      },
    })
  );
}

export function handleAdminLogout(req, res) {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie": "complaint_admin_token=; Path=/; HttpOnly; Max-Age=0",
  });
  res.end(JSON.stringify({ message: "로그아웃 되었습니다." }));
}

export function handleAdminMe(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.complaint_admin_token;
  const admin = verifySessionToken(token);

  if (!admin) {
    res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ authenticated: false }));
  }

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ authenticated: true, admin }));
}

export function handleAdminGetPosts(req, res, url) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");

  // 통계 집계
  const totalRow = queryOne("SELECT COUNT(*) as cnt FROM posts");
  const waitingRow = queryOne("SELECT COUNT(*) as cnt FROM posts WHERE status = 'WAITING'");
  const processingRow = queryOne("SELECT COUNT(*) as cnt FROM posts WHERE status = 'PROCESSING'");
  const completedRow = queryOne("SELECT COUNT(*) as cnt FROM posts WHERE status = 'COMPLETED'");
  const rejectedRow = queryOne("SELECT COUNT(*) as cnt FROM posts WHERE status = 'REJECTED'");

  const stats = {
    total: totalRow?.cnt || 0,
    waiting: waitingRow?.cnt || 0,
    processing: processingRow?.cnt || 0,
    completed: completedRow?.cnt || 0,
    rejected: rejectedRow?.cnt || 0,
  };

  const conditions = [];
  const params = [];

  if (status && status !== "ALL") {
    conditions.push("p.status = ?");
    params.push(status);
  }

  if (category && category !== "전체") {
    conditions.push("p.category = ?");
    params.push(category);
  }

  if (search && search.trim()) {
    conditions.push("(p.title LIKE ? OR p.content LIKE ? OR p.author_name LIKE ?)");
    const q = `%${search.trim()}%`;
    params.push(q, q, q);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRow = queryOne(`SELECT COUNT(*) as total FROM posts p ${whereClause}`, params);
  const filteredCount = countRow?.total || 0;

  const offset = (page - 1) * limit;
  const listSql = `
    SELECT p.id, p.title, p.content, p.author_name, p.category, p.is_secret, p.status, p.view_count, p.created_at,
           a.id as answer_id, a.content as answer_content, a.author_name as answer_author, a.created_at as answer_created_at
    FROM posts p
    LEFT JOIN answers a ON a.post_id = p.id
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const rows = queryAll(listSql, [...params, limit, offset]);

  const posts = rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    authorName: r.author_name,
    category: r.category,
    isSecret: r.is_secret === 1,
    status: r.status,
    viewCount: r.view_count,
    createdAt: r.created_at,
    answer: r.answer_id
      ? {
          id: r.answer_id,
          content: r.answer_content,
          authorName: r.answer_author,
          createdAt: r.answer_created_at,
        }
      : null,
  }));

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      stats,
      posts,
      pagination: {
        page,
        limit,
        totalCount: filteredCount,
        totalPages: Math.ceil(filteredCount / limit),
      },
    })
  );
}

export function handleAdminAnswer(req, res, id, body) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { content, authorName, nextStatus } = body;
  if (!content || !content.trim()) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "답변 내용을 입력해주세요." }));
  }

  const post = queryOne("SELECT * FROM posts WHERE id = ?", [id]);
  if (!post) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "게시글을 찾을 수 없습니다." }));
  }

  const existingAnswer = queryOne("SELECT * FROM answers WHERE post_id = ?", [id]);
  const now = new Date().toISOString();
  const author = authorName?.trim() || admin.name || "운영팀";

  if (existingAnswer) {
    runQuery(
      `UPDATE answers SET content = ?, author_name = ?, admin_id = ?, updated_at = ? WHERE id = ?`,
      [content.trim(), author, admin.id, now, existingAnswer.id]
    );
  } else {
    runQuery(
      `INSERT INTO answers (id, post_id, admin_id, author_name, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), id, admin.id, author, content.trim(), now, now]
    );
  }

  const statusToSet = nextStatus || "COMPLETED";
  runQuery("UPDATE posts SET status = ?, updated_at = ? WHERE id = ?", [statusToSet, now, id]);

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      message: "답변이 정상적으로 등록되었습니다.",
      status: statusToSet,
    })
  );
}

export function handleAdminUpdateStatus(req, res, id, body) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { status } = body;
  if (!["WAITING", "PROCESSING", "COMPLETED", "REJECTED"].includes(status)) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "유효하지 않은 상태값입니다." }));
  }

  const now = new Date().toISOString();
  runQuery("UPDATE posts SET status = ?, updated_at = ? WHERE id = ?", [status, now, id]);

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ message: "상태가 변경되었습니다.", status }));
}

