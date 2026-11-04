import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { initDb } from "./src/db.js";
import {
  handleGetPosts,
  handleCreatePost,
  handleGetPostDetail,
  handleUpdatePost,
  handleDeletePost,
} from "./src/routes/posts.js";
import {
  handleAdminLogin,
  handleAdminLogout,
  handleAdminMe,
  handleAdminGetPosts,
  handleAdminAnswer,
  handleAdminUpdateStatus,
} from "./src/routes/admin.js";

// DB 초기화
initDb();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(process.cwd(), "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        // 1MB 이상 방어
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS & Security Headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  try {
    // API 라우팅
    if (pathname.startsWith("/api/")) {
      // POST /api/posts
      if (pathname === "/api/posts") {
        if (method === "GET") {
          return handleGetPosts(req, res, url);
        }
        if (method === "POST") {
          const body = await parseJsonBody(req);
          return handleCreatePost(req, res, body);
        }
      }

      // /api/posts/:id
      const postMatch = pathname.match(/^\/api\/posts\/([a-zA-Z0-9_-]+)$/);
      if (postMatch) {
        const id = postMatch[1];
        if (method === "GET") {
          return handleGetPostDetail(req, res, id, url);
        }
        if (method === "PATCH") {
          const body = await parseJsonBody(req);
          return handleUpdatePost(req, res, id, body);
        }
        if (method === "DELETE") {
          const body = await parseJsonBody(req);
          return handleDeletePost(req, res, id, body);
        }
      }

      // /api/admin/login
      if (pathname === "/api/admin/login" && method === "POST") {
        const body = await parseJsonBody(req);
        return handleAdminLogin(req, res, body);
      }

      // /api/admin/logout
      if (pathname === "/api/admin/logout" && method === "POST") {
        return handleAdminLogout(req, res);
      }

      // /api/admin/me
      if (pathname === "/api/admin/me" && method === "GET") {
        return handleAdminMe(req, res);
      }

      // /api/admin/posts
      if (pathname === "/api/admin/posts" && method === "GET") {
        return handleAdminGetPosts(req, res, url);
      }

      // /api/admin/posts/:id/answer
      const answerMatch = pathname.match(/^\/api\/admin\/posts\/([a-zA-Z0-9_-]+)\/answer$/);
      if (answerMatch && method === "POST") {
        const id = answerMatch[1];
        const body = await parseJsonBody(req);
        return handleAdminAnswer(req, res, id, body);
      }

      // /api/admin/posts/:id/status
      const statusMatch = pathname.match(/^\/api\/admin\/posts\/([a-zA-Z0-9_-]+)\/status$/);
      if (statusMatch && method === "PATCH") {
        const id = statusMatch[1];
        const body = await parseJsonBody(req);
        return handleAdminUpdateStatus(req, res, id, body);
      }

      // 매칭되지 않는 API
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "API 엔드포인트를 찾을 수 없습니다." }));
    }

    // 정적 파일 서빙
    let filePath;
    if (pathname === "/" || pathname === "/index.html") {
      filePath = path.join(PUBLIC_DIR, "index.html");
    } else if (pathname === "/write") {
      filePath = path.join(PUBLIC_DIR, "write.html");
    } else if (pathname === "/admin") {
      filePath = path.join(PUBLIC_DIR, "admin.html");
    } else {
      filePath = path.join(PUBLIC_DIR, pathname);
    }

    // 파일 존재 검사
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return serveStaticFile(res, filePath);
    }

    // 기본 index.html fallback (SPA 라우팅 대비)
    return serveStaticFile(res, path.join(PUBLIC_DIR, "index.html"));
  } catch (err) {
    console.error("Server error:", err);
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "서버 내부 오류가 발생했습니다." }));
  }
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`[익명 불만 게시판] 서버가 성공적으로 시작되었습니다.`);
  console.log(`- 서비스 URL: http://localhost:${PORT}`);
  console.log(`- 관리자 페이지: http://localhost:${PORT}/admin`);
  console.log(`===============================================`);
});

