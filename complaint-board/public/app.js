// 상태 변수
let currentPage = 1;
let currentCategory = "전체";
let currentStatus = "ALL";
let searchQuery = "";
let searchType = "title";

let selectedPostId = null;
let currentLoadedPost = null;

const STATUS_TEXT_MAP = {
  WAITING: { label: "접수대기", class: "status-text-WAITING" },
  PROCESSING: { label: "검토중", class: "status-text-PROCESSING" },
  COMPLETED: { label: "답변완료", class: "status-text-COMPLETED" },
  REJECTED: { label: "보류", class: "status-text-REJECTED" },
};

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadPosts();
});

function setupEventListeners() {
  // 카테고리 탭 클릭
  const categoryItems = document.querySelectorAll("#categoryFilter .category-tab-item");
  categoryItems.forEach((item) => {
    item.addEventListener("click", () => {
      categoryItems.forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      currentCategory = item.dataset.category;
      currentPage = 1;
      loadPosts();
    });
  });

  // 검색 엔터키 감지
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        triggerSearch();
      }
    });
  }
}

function triggerSearch() {
  const input = document.getElementById("searchInput");
  const typeSelect = document.getElementById("searchTypeSelect");
  if (input) {
    searchQuery = input.value.trim();
  }
  if (typeSelect) {
    searchType = typeSelect.value;
  }
  currentPage = 1;
  loadPosts();
}

async function loadPosts() {
  const tbody = document.getElementById("postsTableBody");
  const resultTextEl = document.getElementById("searchResultText");

  // 검색 결과 문구 업데이트 (사진 속: '투액션'(으)로 찾은 검색 결과에 대한 리스트입니다.)
  if (resultTextEl) {
    if (searchQuery) {
      resultTextEl.textContent = `'${searchQuery}'(으)로 찾은 검색 결과에 대한 리스트입니다.`;
    } else if (currentCategory !== "전체") {
      resultTextEl.textContent = `'${currentCategory}' 분류에 대한 게시글 리스트입니다.`;
    } else {
      resultTextEl.textContent = "";
    }
  }

  try {
    const url = new URL("/api/posts", window.location.origin);
    url.searchParams.set("page", currentPage);
    url.searchParams.set("limit", 15); // 화면을 넉넉히 채우도록 15개로 설정
    if (currentCategory !== "전체") url.searchParams.set("category", currentCategory);
    if (currentStatus !== "ALL") url.searchParams.set("status", currentStatus);
    if (searchQuery) url.searchParams.set("search", searchQuery);

    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "목록 조회 실패");

    if (data.posts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px 10px; color: #888888;">
            등록된 게시글이 없습니다.
          </td>
        </tr>
      `;
      document.getElementById("pagination").innerHTML = "";
      return;
    }

    const totalCount = data.pagination.totalCount;
    const startIndex = totalCount - (currentPage - 1) * data.pagination.limit;

    let rowsHtml = "";

    data.posts.forEach((post, index) => {
      const postNumber = startIndex - index;
      const statusInfo = STATUS_TEXT_MAP[post.status] || { label: post.status, class: "" };
      const secretIcon = post.isSecret ? "🔒 " : "";

      // 1. 원글 행
      rowsHtml += `
        <tr>
          <td class="td-no">${postNumber}</td>
          <td class="td-title">
            <span class="category-prefix">[${escapeHtml(post.category)}]</span>
            <a class="post-title-link" onclick="handleClickPost('${post.id}', ${post.isSecret})">
              ${secretIcon}${escapeHtml(post.title)}
            </a>
          </td>
          <td class="td-author">${escapeHtml(post.authorName)}</td>
          <td class="td-date">${formatDate(post.createdAt)}</td>
          <td class="td-status">
            <span class="${statusInfo.class}">${statusInfo.label}</span>
          </td>
        </tr>
      `;

      // 2. 답변이 있는 경우: 사진과 동일하게 바로 아래에 ↳ [RE] 답변 행 표시
      if (post.hasAnswer) {
        rowsHtml += `
          <tr class="reply-row">
            <td class="td-no"></td>
            <td class="td-title">
              <span class="reply-indent-icon">↳</span>
              <span class="badge-re">RE</span>
              <span class="category-prefix">[${escapeHtml(post.category)}]</span>
              <a class="post-title-link" onclick="handleClickPost('${post.id}', ${post.isSecret})">
                ${escapeHtml(post.title)}
              </a>
            </td>
            <td class="td-author" style="color: #6688aa;">운영팀</td>
            <td class="td-date">${formatDate(post.createdAt)}</td>
            <td class="td-status">
              <span class="status-text-COMPLETED">답변완료</span>
            </td>
          </tr>
        `;
      }
    });

    tbody.innerHTML = rowsHtml;
    renderClassicPagination(data.pagination);
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 30px; color: #c9302c;">
          ${err.message}
        </td>
      </tr>
    `;
  }
}

function handleClickPost(id, isSecret) {
  selectedPostId = id;
  if (isSecret) {
    document.getElementById("secretPasswordInput").value = "";
    document.getElementById("passwordError").style.display = "none";
    document.getElementById("passwordModal").style.display = "flex";
  } else {
    fetchAndShowDetail(id);
  }
}

async function handleSecretPasswordSubmit(e) {
  e.preventDefault();
  const password = document.getElementById("secretPasswordInput").value;
  const passwordError = document.getElementById("passwordError");
  passwordError.style.display = "none";

  try {
    const res = await fetch(`/api/posts/${selectedPostId}?password=${encodeURIComponent(password)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "비밀번호가 올바르지 않습니다.");
    }

    closeModal("passwordModal");
    showDetailModal(data.post, password);
  } catch (err) {
    passwordError.textContent = err.message;
    passwordError.style.display = "block";
  }
}

async function fetchAndShowDetail(id, password = "") {
  try {
    const url = password ? `/api/posts/${id}?password=${encodeURIComponent(password)}` : `/api/posts/${id}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "상세 정보를 불러올 수 없습니다.");

    if (data.requiresPassword) {
      selectedPostId = id;
      document.getElementById("passwordModal").style.display = "flex";
      return;
    }

    showDetailModal(data.post, password);
  } catch (err) {
    alert(err.message);
  }
}

function showDetailModal(post, password = "") {
  currentLoadedPost = { ...post, verifiedPassword: password };

  document.getElementById("detailTitle").textContent = (post.isSecret ? "🔒 " : "") + `[${post.category}] ${post.title}`;
  document.getElementById("detailAuthor").textContent = post.authorName;
  document.getElementById("detailCategory").textContent = post.category;
  document.getElementById("detailDate").textContent = formatDate(post.createdAt, true);

  const statusInfo = STATUS_TEXT_MAP[post.status] || { label: post.status, class: "" };
  const statusEl = document.getElementById("detailStatus");
  statusEl.className = statusInfo.class;
  statusEl.textContent = statusInfo.label;

  document.getElementById("detailContent").textContent = post.content;

  // 관리자 답변 표시
  const answerSection = document.getElementById("answerSection");
  if (post.answers && post.answers.length > 0) {
    const ans = post.answers[0];
    document.getElementById("answerAuthor").textContent = `${ans.authorName} 공식 답변`;
    document.getElementById("answerDate").textContent = formatDate(ans.createdAt, true);
    document.getElementById("answerContent").textContent = ans.content;
    answerSection.style.display = "block";
  } else {
    answerSection.style.display = "none";
  }

  document.getElementById("detailModal").style.display = "flex";
}

function openEditModal() {
  if (!currentLoadedPost) return;
  document.getElementById("editTitle").value = currentLoadedPost.title;
  document.getElementById("editContent").value = currentLoadedPost.content;
  document.getElementById("editCategory").value = currentLoadedPost.category;
  document.getElementById("editPasswordInput").value = currentLoadedPost.verifiedPassword || "";
  document.getElementById("editError").style.display = "none";
  document.getElementById("editModal").style.display = "flex";
}

async function handleEditSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById("editError");
  errorEl.style.display = "none";

  const password = document.getElementById("editPasswordInput").value;
  const title = document.getElementById("editTitle").value.trim();
  const content = document.getElementById("editContent").value.trim();
  const category = document.getElementById("editCategory").value;

  try {
    const res = await fetch(`/api/posts/${currentLoadedPost.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, title, content, category }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "수정 실패");

    alert("게시글이 성공적으로 수정되었습니다.");
    closeModal("editModal");
    closeModal("detailModal");
    loadPosts();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
  }
}

function openDeleteModal() {
  if (!currentLoadedPost) return;
  document.getElementById("deletePasswordInput").value = currentLoadedPost.verifiedPassword || "";
  document.getElementById("deleteError").style.display = "none";
  document.getElementById("deleteModal").style.display = "flex";
}

async function handleDeleteSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById("deleteError");
  errorEl.style.display = "none";

  const password = document.getElementById("deletePasswordInput").value;

  try {
    const res = await fetch(`/api/posts/${currentLoadedPost.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "삭제 실패");

    alert("게시글이 삭제되었습니다.");
    closeModal("deleteModal");
    closeModal("detailModal");
    loadPosts();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
  }
}

// "1 | 2 | 3 | 4 ... next" 형태의 페이징 렌더링
function renderClassicPagination(pagination) {
  const container = document.getElementById("pagination");
  if (!container) return;

  const totalPages = pagination.totalPages;
  const current = pagination.page;

  if (totalPages <= 1) {
    container.innerHTML = `<span class="current-page">1</span>`;
    return;
  }

  let html = "";
  for (let i = 1; i <= totalPages; i++) {
    if (i > 1) {
      html += `<span class="pipe">|</span>`;
    }
    if (i === current) {
      html += `<span class="current-page">${i}</span>`;
    } else {
      html += `<a onclick="goToPage(${i})">${i}</a>`;
    }
  }

  if (current < totalPages) {
    html += `<a class="next-link" onclick="goToPage(${current + 1})">next ▷</a>`;
  }

  container.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  loadPosts();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function formatDate(dateStr, includeTime = false) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  if (!includeTime) {
    return `${year}-${month}-${day}`;
  }
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
