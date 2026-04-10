import { dictionary } from "./data.js";
import {
  login,
  logout,
  watchAuthState,
  getUserData,
  saveFavorites,
  saveHistory
} from "./firebase.js";

// ================= STATE (QUẢN LÝ TRẠNG THÁI) =================
let currentTab = "home";
let user = null;

// Khởi tạo từ localStorage để dùng được ngay cả khi chưa login
let favorites = JSON.parse(localStorage.getItem("local_favs")) || [];
let history = JSON.parse(localStorage.getItem("local_hist")) || [];

let searchText = "";
let sortType = "A-Z";
let selectedCategory = "All";

let quizQuestion = null;
let quizOptions = [];
let debounceTimer;

// ================= KHỞI TẠO & ĐỒNG BỘ =================
watchAuthState(async (u) => {
  user = u;
  if (user) {
    const data = await getUserData(user.uid);
    // Đồng bộ: Ưu tiên dữ liệu từ Cloud, nếu Cloud trống thì giữ Local
    if (data?.favorites) favorites = data.favorites;
    if (data?.history) history = data.history;
    syncToLocal();
  }
  render();
});

function syncToLocal() {
  localStorage.setItem("local_favs", JSON.stringify(favorites));
  localStorage.setItem("local_hist", JSON.stringify(history));
}

// ================= GÁN BIẾN VÀO WINDOW (SỬA LỖI MODULE) =================
window.showTab = (tab) => { currentTab = tab; render(); };
window.updateSearch = (val) => { searchText = val.toLowerCase(); render(); };
window.updateCategory = (val) => { selectedCategory = val; render(); };
window.updateSort = (val) => { sortType = val; render(); };
window.toggleTheme = () => document.body.classList.toggle("dark");

window.handleLogin = async () => { try { await login(); } catch (e) { alert(e.message); } };
window.handleLogout = async () => { await logout(); location.reload(); };

// ================= TIỆN ÍCH & LỌC DỮ LIỆU =================
function highlight(text, keyword) {
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.replace(regex, `<span class="highlight">$1</span>`);
}

function getFilteredData() {
  let data = [...dictionary];
  if (searchText) {
    data = data.filter(i => i.EN.toLowerCase().includes(searchText) || i.VN.toLowerCase().includes(searchText));
  }
  if (selectedCategory !== "All") {
    data = data.filter(i => i["phan-loai"] === selectedCategory);
  }
  data.sort((a, b) => sortType === "A-Z" ? a.EN.localeCompare(b.EN) : b.EN.localeCompare(a.EN));
  return data;
}

// ================= CHI TIẾT TỪ VỰNG =================
window.showDetail = (en) => {
  const item = dictionary.find(i => i.EN === en);
  if (!item) return;

  // Lưu lịch sử (Local & Cloud)
  if (!history.includes(item.EN)) {
    history.unshift(item.EN);
    if (history.length > 30) history.pop();
    syncToLocal();
    if (user) saveHistory(user.uid, history);
  }

  document.getElementById("content").innerHTML = `
    <div class="detail-view">
      <button class="btn-back" onclick="showTab('dictionary')">⬅ Quay lại</button>
      <h2>${item.EN}</h2>
      <img src="${item["hinh-anh"]}" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
      <div class="info-box">
        <p><b>Thuật ngữ VN:</b> ${item.VN}</p>
        <p><b>Khái niệm:</b> ${item["khai-niem"]}</p>
        <p><b>Tác dụng:</b> ${item["tac-dung"]}</p>
        <p><b>Phân loại:</b> <span class="tag">${item["phan-loai"]}</span></p>
      </div>
      <button class="btn-fav ${favorites.includes(item.EN) ? 'active' : ''}" onclick="toggleFavorite('${item.EN}')">
        ${favorites.includes(item.EN) ? "❤️ Đã thích" : "🤍 Thêm vào yêu thích"}
      </button>
    </div>
  `;
};

window.toggleFavorite = (en) => {
  if (favorites.includes(en)) {
    favorites = favorites.filter(i => i !== en);
  } else {
    favorites.push(en);
  }
  syncToLocal();
  if (user) saveFavorites(user.uid, favorites);
  
  // Kiểm tra nếu đang ở trang Yêu thích thì render lại danh sách, nếu ở Detail thì render lại nút bấm
  if (currentTab === 'favorites') render(); else showDetail(en);
};

// ================= CÁC TRANG (TAB RENDERERS) =================

// 1. TRANG CHỦ (HOME)
function renderHome() {
  return `
    <div class="home-container">
      <h1>🔬 Semiconductor Dictionary</h1>
      <p>Hệ thống tra cứu thuật ngữ vi mạch chuyên nghiệp</p>
      <div class="search-wrapper">
        <input id="homeSearch" class="search-box-pro" placeholder="Tìm kiếm nhanh...">
        <div id="suggestions" class="suggestions"></div>
      </div>
      <div id="searchResult" class="grid"></div>
    </div>
  `;
}

// 2. TỪ ĐIỂN (DICTIONARY)
function renderDictionary() {
  return `
    <input class="search-box" placeholder="🔍 Lọc theo từ khóa..." value="${searchText}" oninput="updateSearch(this.value)">
    <div class="filter-bar">
      <select onchange="updateCategory(this.value)">
        <option value="All">Tất cả danh mục</option>
        ${[...new Set(dictionary.map(i => i["phan-loai"]))].map(c => `<option value="${c}" ${selectedCategory === c ? 'selected' : ''}>${c}</option>`).join("")}
      </select>
      <select onchange="updateSort(this.value)">
        <option value="A-Z" ${sortType === 'A-Z' ? 'selected' : ''}>Sắp xếp A-Z</option>
        <option value="Z-A" ${sortType === 'Z-A' ? 'selected' : ''}>Sắp xếp Z-A</option>
      </select>
    </div>
    <div class="grid">${getFilteredData().map(item => `<div class="card" onclick="showDetail('${item.EN}')"><h3>${item.EN}</h3><p>${item.VN}</p><small>${item["phan-loai"]}</small></div>`).join("")}</div>
  `;
}

// 3. PHÂN LOẠI (CATEGORY)
function renderCategory() {
  const groups = dictionary.reduce((acc, item) => {
    acc[item["phan-loai"]] = [...(acc[item["phan-loai"]] || []), item];
    return acc;
  }, {});
  return Object.keys(groups).map(key => `
    <h3>📂 ${key}</h3>
    <div class="grid">${groups[key].map(i => `<div class="card" onclick="showDetail('${i.EN}')"><h4>${i.EN}</h4><p>${i.VN}</p></div>`).join("")}</div>
  `).join("");
}

// 4. YÊU THÍCH (FAVORITES)
function renderFavorites() {
  const list = dictionary.filter(i => favorites.includes(i.EN));
  return `<h2>⭐ Yêu thích</h2><div class="grid">${list.length ? list.map(i => `<div class="card" onclick="showDetail('${i.EN}')"><h3>${i.EN}</h3><p>${i.VN}</p></div>`).join("") : "<p>Chưa có mục nào.</p>"}</div>`;
}

// 5. LỊCH SỬ (HISTORY)
function renderHistory() {
  const list = history.map(en => dictionary.find(i => i.EN === en)).filter(Boolean);
  return `<h2>🕒 Lịch sử tra cứu</h2><div class="grid">${list.map(i => `<div class="card" onclick="showDetail('${i.getEN ? i.getEN : i.EN}')"><h3>${i.EN}</h3><p>${i.VN}</p></div>`).join("")}</div>`;
}

// 6. TRẮC NGHIỆM (QUIZ)
window.checkAnswer = (answer) => {
  const isCorrect = answer === quizQuestion.VN;
  alert(isCorrect ? "✅ Chính xác!" : `❌ Sai rồi! Đáp án là: ${quizQuestion.VN}`);
  nextQuiz();
};

window.nextQuiz = () => {
  const random = dictionary[Math.floor(Math.random() * dictionary.length)];
  quizQuestion = random;
  const opts = [random.VN];
  while (opts.length < 4) {
    const r = dictionary[Math.floor(Math.random() * dictionary.length)].VN;
    if (!opts.includes(r)) opts.push(r);
  }
  quizOptions = opts.sort(() => Math.random() - 0.5);
  render();
};

function renderQuiz() {
  if (!quizQuestion) { nextQuiz(); return ""; }
  return `
    <div class="quiz-container">
      <h2>🧠 Thử thách trí nhớ</h2>
      <p>Thuật ngữ <b>"${quizQuestion.EN}"</b> có nghĩa là gì?</p>
      <div class="quiz-grid">${quizOptions.map(o => `<button class="btn-quiz" onclick="checkAnswer('${o}')">${o}</button>`).join("")}</div>
      <button class="btn-next" onclick="nextQuiz()">Đổi câu hỏi</button>
    </div>
  `;
}

// ================= HÀM RENDER CHÍNH =================
function render() {
  const content = document.getElementById("content");
  let html = "";
  switch (currentTab) {
    case "home": html = renderHome(); break;
    case "dictionary": html = renderDictionary(); break;
    case "category": html = renderCategory(); break;
    case "favorites": html = renderFavorites(); break;
    case "history": html = renderHistory(); break;
    case "quiz": html = renderQuiz(); break;
    case "profile": html = renderProfile(); break;
    case "contribute": html = `<h2>✍️ Đóng góp</h2><textarea placeholder="Nhập thuật ngữ mới..."></textarea><br><button>Gửi</button>`; break;
  }
  content.innerHTML = html;
  if (currentTab === "home") attachHomeSearch();
}

function renderProfile() {
  return user ? `
    <div class="profile-card">
      <img src="${user.avatar}" width="100" style="border-radius:50%">
      <h2>${user.name}</h2>
      <p>${user.email}</p>
      <div class="stats">
        <span>⭐ ${favorites.length} Yêu thích</span> | <span>🕒 ${history.length} Lịch sử</span>
      </div>
      <button onclick="handleLogout()">Đăng xuất</button>
    </div>
  ` : `<p>Vui lòng <a href="#" onclick="handleLogin()">Đăng nhập</a> để xem hồ sơ.</p>`;
}

// ================= XỬ LÝ TÌM KIẾM TRANG CHỦ =================
function attachHomeSearch() {
  const input = document.getElementById("homeSearch");
  if (!input) return;
  input.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase().trim();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const suggestBox = document.getElementById("suggestions");
      const resultBox = document.getElementById("searchResult");
      if (!val) { suggestBox.innerHTML = ""; resultBox.innerHTML = ""; return; }

      const results = dictionary.filter(i => i.EN.toLowerCase().includes(val) || i.VN.toLowerCase().includes(val));
      suggestBox.innerHTML = results.slice(0, 5).map(i => `<div onclick="showDetail('${i.EN}')">🔹 ${i.EN}</div>`).join("");
      resultBox.innerHTML = results.map(i => `<div class="card" onclick="showDetail('${i.EN}')"><h3>${highlight(i.EN, val)}</h3><p>${highlight(i.VN, val)}</p></div>`).join("");
    }, 250);
  });
}

// Khởi chạy lần đầu
render();