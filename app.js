<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Semiconductor Dictionary</title>

  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>

<body>

<header>
  <div class="header-top">
    <h1>🔬 Semiconductor Dictionary</h1>
    <div class="header-controls">
      <button class="btn-icon" onclick="toggleTheme()" title="Đổi màu nền">🌓</button>
      
      <div class="auth-zone">
        <div id="auth-guest">
          <button class="btn-login-head" onclick="handleLogin()">Login</button>
        </div>

        <div id="auth-user" style="display: none;">
          <div class="user-info-head">
            <img id="head-avatar" src="" alt="avatar">
            <span id="head-username"></span>
            <button class="btn-logout-head" onclick="handleLogout()">Logout</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <nav>
    <button class="nav-item" onclick="showTab('home')">Trang chủ</button>
    <button class="nav-item" onclick="showTab('dictionary')">Từ điển</button>
    <button class="nav-item" onclick="showTab('category')">Phân loại</button>
    <button class="nav-item" onclick="showTab('favorites')">Yêu thích</button>
    <button class="nav-item" onclick="showTab('history')">Lịch sử</button>
    <button class="nav-item" onclick="showTab('quiz')">Quiz</button>
    <button class="nav-item" onclick="showTab('contribute')">Đóng góp</button>
    <button class="nav-item" onclick="showTab('profile')">Hồ sơ</button>
  </nav>
</header>

<div id="loading" style="display:none; text-align:center; padding: 20px;">
  <div class="spinner"></div> ⏳ Đang tải dữ liệu...
</div>

<main id="content"></main>

<script type="module" src="app.js"></script>

</body>
</html>
