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
// null: hiện danh sách nhóm, "Tên nhóm": hiện từ trong nhóm
let activeCategory = null; 
// Khởi tạo từ localStorage để dùng được ngay cả khi chưa login
let favorites = JSON.parse(localStorage.getItem("local_favs")) || [];
let history = JSON.parse(localStorage.getItem("local_hist")) || [];

let searchText = "";
let sortType = "A-Z";
let selectedCategory = "All";
// Trạng thái kiểm tra xem đã nhấn nút Bắt đầu chưa
let quizStarted = false; 
let quizQuestion = null;
let quizOptions = [];
let debounceTimer;

// ================= KHỞI TẠO & ĐỒNG BỘ =================
// Trong file app.js
watchAuthState(async (safeUser) => {
  // 1. Cập nhật biến user trong app.js (Rất quan trọng)
  user = safeUser; 

  const guestZone = document.getElementById("auth-guest");
  const userZone = document.getElementById("auth-user");
  const headName = document.getElementById("head-username");
  const headAvatar = document.getElementById("head-avatar");

  if (user) {
    // 2. Hiển thị thông tin lên Header ngay lập tức
    if (guestZone) guestZone.style.display = "none";
    if (userZone) {
      userZone.style.display = "flex"; // Hoặc block
      if (headName) headName.textContent = user.name;
      if (headAvatar) headAvatar.src = user.avatar;
    }

    // 3. Lấy dữ liệu đồng bộ (Favorites/History)
    const data = await getUserData(user.uid);
    if (data) {
      if (data.favorites) favorites = data.favorites;
      if (data.history) history = data.history;
      syncToLocal();
    }
  } else {
    // 4. Xử lý khi Logout
    if (guestZone) guestZone.style.display = "block";
    if (userZone) userZone.style.display = "none";
  }

  // 5. Luôn render lại để cập nhật trang (Profile/Dictionary...)
  render();
});

function syncToLocal() {
  localStorage.setItem("local_favs", JSON.stringify(favorites));
  localStorage.setItem("local_hist", JSON.stringify(history));
}

// ================= GÁN BIẾN VÀO WINDOW =================
window.showTab = (tab) => { 
  currentTab = tab; 
  if (tab === 'quiz') quizStarted = false; // Reset trạng thái khi vào tab
  render(); 
};
window.updateSearch = (val) => { 
  searchText = val.toLowerCase(); 
  // Chỉ render lại danh sách card, không render lại toàn bộ tab
  renderDictionaryList(); 
};
window.updateCategory = (val) => { 
  selectedCategory = val; 
  renderDictionaryList(); 
};

window.updateSort = (val) => { 
  sortType = val; 
  renderDictionaryList(); 
};
window.toggleTheme = () => document.body.classList.toggle("dark");

window.handleLogin = async () => { 
  try { 
    await login(); 
  } catch (e) { 
    console.error("Login Error:", e);
    alert("Đăng nhập thất bại: " + e.message); 
  } 
};
window.handleLogout = async () => { 
  await logout(); 
  localStorage.removeItem("local_favs");
  localStorage.removeItem("local_hist");
  location.reload(); 
};

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

  if (!history.includes(item.EN)) {
    history.unshift(item.EN);
    if (history.length > 30) history.pop();
    syncToLocal();
    if (user) saveHistory(user.uid, history);
  }

  document.getElementById("content").innerHTML = `
    <div class="detail-view">
      <button class="btn-back" onclick="showTab('${currentTab === 'home' ? 'home' : 'dictionary'}')">⬅ Quay lại</button>
      <div class="detail-card">
        <h2>${item.EN}</h2>
        <img src="${item["hinh-anh"]}" onerror="this.src='https://via.placeholder.com/300?text=Semiconductor'">
        <div class="info-box">
          <p><strong>Thuật ngữ:</strong> ${item.VN}</p>
          <p><strong>Khái niệm:</strong> ${item["khai-niem"]}</p>
          <p><strong>Tác dụng:</strong> ${item["tac-dung"]}</p>
          <p><strong>Phân loại:</strong> <span class="tag">${item["phan-loai"]}</span></p>
        </div>
        <button class="btn-fav ${favorites.includes(item.EN) ? 'active' : ''}" onclick="toggleFavorite('${item.EN}')">
          ${favorites.includes(item.EN) ? "❤️ Đã thích" : "🤍 Thêm vào yêu thích"}
        </button>
      </div>
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
  
  if (currentTab === 'favorites') render(); else showDetail(en);
};

// ================= CÁC TRANG (TAB RENDERERS) =================

function renderHome() {
  return `
    <div class="home-container">
      <div class="hero">
        <h1>🔬 Semiconductor Dictionary</h1>
        <p>Hệ thống tra cứu thuật ngữ vi mạch chuyên nghiệp</p>
      </div>
      <div class="search-wrapper">
        <input id="homeSearch" class="search-box-pro" placeholder="Tìm kiếm nhanh thuật ngữ...">
        <div id="suggestions" class="suggestions"></div>
      </div>
      <div id="searchResult" class="grid"></div>
    </div>
  `;
}

// Hàm này chỉ chạy 1 lần khi chuyển Tab để vẽ cái khung
function renderDictionary() {
  return `
    <div class="container">
        <input id="dictSearch" class="search-box" placeholder="🔍 Lọc theo từ khóa..." value="${searchText}" oninput="updateSearch(this.value)">
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
        <div id="dictionaryList" class="grid">
          ${renderDictionaryList(true)} 
        </div>
    </div>
  `;
}

// Hàm này dùng để vẽ riêng danh sách các Card từ vựng
function renderDictionaryList(onlyReturnHtml = false) {
  const data = getFilteredData();
  const html = data.map(item => `
    <div class="card" onclick="showDetail('${item.EN}')">
      <h3>${highlight(item.EN, searchText)}</h3>
      <p>${highlight(item.VN, searchText)}</p>
      <small>${item["phan-loai"]}</small>
    </div>
  `).join("");

  if (onlyReturnHtml) return html;

  const listContainer = document.getElementById("dictionaryList");
  if (listContainer) {
    listContainer.innerHTML = html;
  }
}

// Hàm xử lý khi click vào một nhóm
window.selectCategory = (catName) => {
  activeCategory = catName;
  render();
};

// Hàm quay lại danh sách các nhóm
window.backToCategories = () => {
  activeCategory = null;
  render();
};

function renderCategory() {
  // Lấy danh sách các loại duy nhất
  const categories = [...new Set(dictionary.map(i => i["phan-loai"]))];

  // TRƯỜNG HỢP 1: Đang xem chi tiết một nhóm
  if (activeCategory) {
    const filteredItems = dictionary.filter(i => i["phan-loai"] === activeCategory);
    return `
      <div class="container">
        <button class="btn-back" onclick="backToCategories()">⬅ Quay lại danh sách phân loại</button>
        <h2 class="cat-title">📂 Phân loại: ${activeCategory}</h2>
        <div class="grid">
          ${filteredItems.map(i => `
            <div class="card" onclick="showDetail('${i.EN}')">
              <h4>${i.EN}</h4>
              <p>${i.VN}</p>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // TRƯỜNG HỢP 2: Hiển thị danh sách các "List" phân loại
  return `
    <div class="container">
      <h2 class="cat-title">📂 Danh mục thuật ngữ</h2>
      <div class="category-list">
        ${categories.map(cat => {
          const count = dictionary.filter(i => i["phan-loai"] === cat).length;
          return `
            <div class="category-item" onclick="selectCategory('${cat}')">
              <div class="cat-icon">📁</div>
              <div class="cat-info">
                <span class="cat-name">${cat}</span>
                <span class="cat-count">${count} thuật ngữ</span>
              </div>
              <div class="cat-arrow">➜</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderFavorites() {
  // Lọc danh sách từ điển dựa trên mảng favorites (chứa các mã EN)
  const list = dictionary.filter(i => favorites.includes(i.EN));

  return `
    <div class="container">
      <h2>⭐ Yêu thích</h2>
      <div class="grid">
        ${list.length ? 
          list.map(item => `
            <div class="card" onclick="showDetail('${item.EN}')">
              <h3>${item.EN}</h3>
              <p>${item.VN}</p>
            </div>
          `).join("") 
          : `<p class="empty-msg">Chưa có mục nào trong danh sách yêu thích.</p>`
        }
      </div>
    </div>`;
}

function renderHistory() {
  const list = history.map(en => dictionary.find(i => i.EN === en)).filter(Boolean);
  return `<div class="container"><h2>🕒 Lịch sử tra cứu</h2><div class="grid">${list.length ? list.map(i => `<div class="card" onclick="showDetail('${i.EN}')"><h3>${i.EN}</h3><p>${i.VN}</p></div>`).join("") : "<p>Bạn chưa tra cứu từ nào.</p>"}</div></div>`;
}

// ================= TRẮC NGHIỆM =================
// Hàm này CHỈ chuẩn bị dữ liệu câu hỏi, KHÔNG gọi render()
function prepareNextQuestion() {
  const random = dictionary[Math.floor(Math.random() * dictionary.length)];
  quizQuestion = random;
  const opts = [random.VN];
  while (opts.length < 4) {
    const r = dictionary[Math.floor(Math.random() * dictionary.length)].VN;
    if (!opts.includes(r)) opts.push(r);
  }
  quizOptions = opts.sort(() => Math.random() - 0.5);
}

// Hàm xử lý khi nhấn nút Bắt đầu hoặc Câu tiếp theo
window.startQuiz = () => {
  quizStarted = true;
  prepareNextQuestion();
  render(); // Gọi render 1 lần duy nhất sau khi dữ liệu đã sẵn sàng
};

window.checkAnswer = (selectedBtn, answer) => {
    // Ngăn chặn việc nhấn nhiều lần khi đang hiện kết quả
    const allButtons = document.querySelectorAll('.btn-quiz-option');
    allButtons.forEach(btn => btn.style.pointerEvents = 'none');

    const isCorrect = answer === quizQuestion.VN;

    if (isCorrect) {
        selectedBtn.classList.add('correct');
    } else {
        selectedBtn.classList.add('wrong');
        // Tìm và làm nổi bật đáp án đúng để người dùng học tập
        allButtons.forEach(btn => {
            if (btn.textContent === quizQuestion.VN) {
                btn.classList.add('correct');
            }
        });
    }

    // Đợi 1.5 giây để người dùng nhìn kết quả rồi mới qua câu mới
    setTimeout(() => {
        prepareNextQuestion();
        render();
    }, 1500);
};

function renderQuiz() {
  if (!quizStarted) {
    return `
      <div class="quiz-container">
        <div class="quiz-intro-card">
          <div class="quiz-icon">🎓</div>
          <h2>Thử thách thuật ngữ</h2>
          <p>Luyện tập phản xạ ghi nhớ thuật ngữ bán dẫn.</p>
          <button class="btn-start-quiz" onclick="startQuiz()">Bắt đầu</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="quiz-container">
      <div class="quiz-card active">
        <div class="quiz-progress">Chọn đáp án đúng nhất</div>
        <h3 class="quiz-question">
            Thuật ngữ <span class="highlight">"${quizQuestion.EN}"</span> là gì?
        </h3>
        <div class="quiz-grid">
          ${quizOptions.map(o => `
            <button class="btn-quiz-option" onclick="checkAnswer(this, '${o}')">${o}</button>
          `).join("")}
        </div>
        <div id="quiz-feedback" style="margin-top: 15px; font-weight: 600;"></div>
      </div>
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
 // Trong hàm render()
    case "contribute": 
     html = renderContribute(); 
    break;   case "contribute": html = `<div class="container"><h2>✍️ Đóng góp</h2><p>Gửi thuật ngữ mới để cùng xây dựng cộng đồng.</p><textarea class="input-pro" placeholder="Nhập thuật ngữ, khái niệm..."></textarea><br><button class="btn-fav active">Gửi đóng góp</button></div>`; break;
  }
  content.innerHTML = html;
  
  // Thêm dòng này: Nếu vào tab từ điển, tự focus vào ô search
  if (currentTab === "dictionary") {
    const input = document.getElementById("dictSearch");
    if (input) input.focus();
  }
  
  // Cập nhật trạng thái Active trên Navbar
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('onclick')?.includes(`'${currentTab}'`));
  });

  if (currentTab === "home") attachHomeSearch();
}

function renderProfile() {
  if (!user) {
    return `
      <div class="profile-container">
        <div class="auth-card">
          <div class="auth-icon">🔒</div>
          <h2>Yêu cầu đăng nhập</h2>
          <p>Hãy đăng nhập để đồng bộ hóa danh sách yêu thích và lịch sử tra cứu của bạn trên mọi thiết bị.</p>
          <button class="btn-primary-large" onclick="handleLogin()">
             Kết nối với Google
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="profile-container">
      <div class="profile-header-card">
        <div class="profile-cover"></div>
        <div class="profile-avatar-wrapper">
          <img src="${user.avatar}" alt="User Avatar" class="profile-main-avatar">
        </div>
        <div class="profile-user-info">
          <h2>${user.name}</h2>
          <p>${user.email}</p>
        </div>
        
        <div class="profile-stats">
          <div class="stat-box" onclick="showTab('favorites')">
            <span class="stat-num">${favorites.length}</span>
            <span class="stat-label">⭐ Yêu thích</span>
          </div>
          <div class="stat-box" onclick="showTab('history')">
            <span class="stat-num">${history.length}</span>
            <span class="stat-label">🕒 Đã xem</span>
          </div>
        </div>

        <div class="profile-actions">
          <button class="btn-outline" onclick="location.reload()">🔄 Làm mới dữ liệu</button>
          <button class="btn-danger" onclick="handleLogout()">🚪 Đăng xuất</button>
        </div>
      </div>
    </div>
  `;
}
// Hàm cho phép người dùng đóng góp thuật ngữ mới
function renderContribute() {
  return `
    <div class="container">
      <div class="contribute-wrapper">
        <div class="contribute-header">
          <h2>✍️ Đóng góp thuật ngữ mới</h2>
          <p>Sự đóng góp của bạn giúp cộng đồng vi mạch Việt Nam ngày càng phát triển.</p>
        </div>
        
        <form id="contributeForm" class="contribute-form" onsubmit="handleContribute(event)">
          <div class="form-group">
            <label>Tên thuật ngữ (English) *</label>
            <input type="text" id="contrib-en" placeholder="Ví dụ: Photolithography" required>
          </div>

          <div class="form-group">
            <label>Nghĩa tiếng Việt *</label>
            <input type="text" id="contrib-vn" placeholder="Ví dụ: Quang khắc" required>
          </div>

          <div class="form-group">
            <label>Phân loại</label>
            <select id="contrib-cat">
              <option value="General">Chung</option>
              <option value="Manufacturing">Sản xuất</option>
              <option value="Design">Thiết kế</option>
              <option value="Material">Vật liệu</option>
            </select>
          </div>

          <div class="form-group">
            <label>Mô tả chi tiết / Tác dụng</label>
            <textarea id="contrib-desc" rows="4" placeholder="Nhập định nghĩa hoặc ghi chú thêm..."></textarea>
          </div>

          <button type="submit" class="btn-submit-contribute">Gửi đóng góp</button>
        </form>
      </div>
    </div>
  `;
}

window.handleContribute = async (event) => {
  event.preventDefault(); // Ngăn trang web tải lại

  // KIỂM TRA ĐĂNG NHẬP
  if (!user) {
    alert("⚠️ Vui lòng đăng nhập để thực hiện chức năng đóng góp!");
    showTab('profile'); // Chuyển sang tab hồ sơ để họ đăng nhập
    return;
  }

  // Lấy dữ liệu từ form
  const contribData = {
    en: document.getElementById("contrib-en").value,
    vn: document.getElementById("contrib-vn").value,
    category: document.getElementById("contrib-cat").value,
    desc: document.getElementById("contrib-desc").value,
    contributor: user.uid,
    status: "pending", // Trạng thái chờ duyệt
    timestamp: Date.now()
  };

  try {
    // Giả sử bạn có hàm saveContribution trong firebase.js
    // await saveContribution(contribData); 
    
    console.log("Dữ liệu đóng góp:", contribData);
    alert("🎉 Cảm ơn bạn! Đóng góp đã được gửi và đang chờ kiểm duyệt.");
    event.target.reset(); // Xóa trắng form sau khi gửi thành công
  } catch (error) {
    alert("Có lỗi xảy ra khi gửi dữ liệu.");
  }
};

// ================= XỬ LÝ TÌM KIẾM TRANG CHỦ =================
function attachHomeSearch() {
  const input = document.getElementById("homeSearch");
  const suggestBox = document.getElementById("suggestions");
  const resultBox = document.getElementById("searchResult");

  if (!input) return;

  // Sự kiện khi bắt đầu nhấn vào ô tìm kiếm
  input.addEventListener("focus", () => {
    if (input.value.trim() !== "") {
      suggestBox.style.display = "block";
    }
  });

  // Sự kiện khi click ra ngoài (Dùng setTimeout để kịp nhận sự kiện click vào gợi ý)
  input.addEventListener("blur", () => {
    setTimeout(() => {
      suggestBox.style.display = "none";
    }, 200); 
  });

  input.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase().trim();
    clearTimeout(debounceTimer);
    
    debounceTimer = setTimeout(() => {
      if (!val) { 
        suggestBox.innerHTML = ""; 
        suggestBox.style.display = "none";
        resultBox.innerHTML = ""; 
        return; 
      }

      const results = dictionary.filter(i => 
        i.EN.toLowerCase().includes(val) || i.VN.toLowerCase().includes(val)
      );

      if (results.length > 0) {
        suggestBox.style.display = "block";
        suggestBox.innerHTML = results.slice(0, 5).map(i => `
          <div class="suggest-item" onclick="showDetail('${i.EN}')">
            <span>🔹 ${highlight(i.EN, val)}</span>
            <small>${i.VN}</small>
          </div>
        `).join("");
        
        resultBox.innerHTML = results.map(i => `
          <div class="card" onclick="showDetail('${i.EN}')">
            <h3>${highlight(i.EN, val)}</h3>
            <p>${highlight(i.VN, val)}</p>
          </div>
        `).join("");
      } else {
        suggestBox.style.display = "none";
        resultBox.innerHTML = "<p>Không tìm thấy kết quả phù hợp.</p>";
      }
    }, 250);
  });
}
// Khởi chạy
render();
