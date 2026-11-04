import crypto from "node:crypto";
import { queryAll, queryOne, runQuery } from "../db.js";
import { hashPassword, verifyPassword, parseCookies, verifySessionToken } from "../auth.js";

function getClientIpHash(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.socket.remoteAddress || "127.0.0.1";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function checkAdminAuth(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.complaint_admin_token;
  return verifySessionToken(token);
}

export function handleGetPosts(req, res, url) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10)));
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  const conditions = [];
  const params = [];

  if (category && category !== "전체") {
    conditions.push("category = ?");
    params.push(category);
  }

  if (status && status !== "ALL") {
    conditions.push("status = ?");
    params.push(status);
  }

  if (search && search.trim()) {
    conditions.push("(title LIKE ? OR author_name LIKE ?)");
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // 카운트 조회
  const countRow = queryOne(`SELECT COUNT(*) as total FROM posts ${whereClause}`, params);
  const totalCount = countRow ? countRow.total : 0;

  // 목록 조회
  const offset = (page - 1) * limit;
  const listSql = `
    SELECT p.id, p.title, p.author_name, p.category, p.is_secret, p.status, p.view_count, p.created_at,
           (SELECT COUNT(*) FROM answers a WHERE a.post_id = p.id) as answer_count
    FROM posts p
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const posts = queryAll(listSql, [...params, limit, offset]);

  const sanitized = posts.map((post) => ({
    id: post.id,
    title: post.is_secret === 1 ? "🔒 비밀글입니다." : post.title,
    authorName: post.author_name,
    category: post.category,
    isSecret: post.is_secret === 1,
    status: post.status,
    viewCount: post.view_count,
    createdAt: post.created_at,
    hasAnswer: post.answer_count > 0,
  }));

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      posts: sanitized,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  );
}

export function handleCreatePost(req, res, body) {
  const { title, content, authorName, password, category, isSecret } = body;

  if (!title || !title.trim()) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "제목을 입력해주세요." }));
  }

  if (!content || !content.trim()) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "내용을 입력해주세요." }));
  }

  if (!password || password.length < 4) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(
      JSON.stringify({ error: "비밀번호는 4자리 이상이어야 합니다. (글 수정/삭제/비밀글 조회용)" })
    );
  }

  const id = crypto.randomUUID();
  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();
  const clientIpHash = getClientIpHash(req);

  runQuery(
    `INSERT INTO posts (id, title, content, author_name, password_hash, category, is_secret, status, view_count, client_ip_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'WAITING', 0, ?, ?, ?)`,
    [
      id,
      title.trim(),
      content.trim(),
      (authorName && authorName.trim()) || "익명",
      passwordHash,
      category || "일반",
      isSecret ? 1 : 0,
      clientIpHash,
      now,
      now,
    ]
  );

  res.writeHead(201, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      message: "불만글이 정상적으로 접수되었습니다.",
      id,
    })
  );
}

export function handleGetPostDetail(req, res, id, url) {
  const password = url.searchParams.get("password");
  const admin = checkAdminAuth(req);

  const post = queryOne("SELECT * FROM posts WHERE id = ?", [id]);
  if (!post) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "게시글을 찾을 수 없습니다." }));
  }

  // 비밀글 처리
  if (post.is_secret === 1 && !admin) {
    if (!password) {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(
        JSON.stringify({
          requiresPassword: true,
          post: {
            id: post.id,
            title: "🔒 비밀글입니다.",
            authorName: post.author_name,
            category: post.category,
            isSecret: true,
            status: post.status,
            createdAt: post.created_at,
          },
        })
      );
    }

    const isMatch = verifyPassword(password, post.password_hash);
    if (!isMatch) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(
        JSON.stringify({ error: "비밀번호가 일치하지 않습니다.", requiresPassword: true })
      );
    }
  }

  // 조회수 증가
  runQuery("UPDATE posts SET view_count = view_count + 1 WHERE id = ?", [id]);

  // 답변 목록 조회
  const answers = queryAll(
    `SELECT id, author_name as authorName, content, created_at as createdAt, updated_at as updatedAt
     FROM answers WHERE post_id = ? ORDER BY created_at ASC`,
    [id]
  );

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        authorName: post.author_name,
        category: post.category,
        isSecret: post.is_secret === 1,
        status: post.status,
        viewCount: post.view_count + 1,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        answers,
        isAdmin: Boolean(admin),
      },
    })
  );
}

export function handleUpdatePost(req, res, id, body) {
  const { password, title, content, category, isSecret } = body;
  const admin = checkAdminAuth(req);

  const post = queryOne("SELECT * FROM posts WHERE id = ?", [id]);
  if (!post) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "게시글을 찾을 수 없습니다." }));
  }

  if (!admin) {
    if (!password) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "비밀번호를 입력해주세요." }));
    }
    const isMatch = verifyPassword(password, post.password_hash);
    if (!isMatch) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "비밀번호가 일치하지 않습니다." }));
    }
  }

  const newTitle = title !== undefined ? title.trim() : post.title;
  const newContent = content !== undefined ? content.trim() : post.content;
  const newCategory = category !== undefined ? category : post.category;
  const newIsSecret = isSecret !== undefined ? (isSecret ? 1 : 0) : post.is_secret;
  const now = new Date().toISOString();

  runQuery(
    `UPDATE posts SET title = ?, content = ?, category = ?, is_secret = ?, updated_at = ? WHERE id = ?`,
    [newTitle, newContent, newCategory, newIsSecret, now, id]
  );

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ message: "게시글이 성공적으로 수정되었습니다." }));
}

export function handleDeletePost(req, res, id, body) {
  const admin = checkAdminAuth(req);
  const post = queryOne("SELECT * FROM posts WHERE id = ?", [id]);

  if (!post) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "게시글을 찾을 수 없습니다." }));
  }

  if (!admin) {
    const password = body?.password;
    if (!password) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "비밀번호를 입력해주세요." }));
    }
    const isMatch = verifyPassword(password, post.password_hash);
    if (!isMatch) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "비밀번호가 일치하지 않습니다." }));
    }
  }

  runQuery("DELETE FROM posts WHERE id = ?", [id]);

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ message: "게시글이 삭제되었습니다." }));
}

