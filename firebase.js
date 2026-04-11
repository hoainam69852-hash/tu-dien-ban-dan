// ================= IMPORT =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
 import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ================= CONFIG =================
const firebaseConfig = {
  apiKey : "AIzaSyAC5ipHAmWy2yF-wyJoDOW4O1iQkFu_DIs" , 
  authDomain : "tu-dien-vi-mach-ban-dan.firebaseapp.com" , 
  projectId : "tu-dien-vi-mach-ban-dan" , 
  storageBucket : "tu-dien-vi-mach-ban-dan.firebasestorage.app" , 
  messagingSenderId : "210075819588" , 
  appId : "1:210075819588:web:e4607b9a0e00a9e1ac6611"
  measurementId: "G-SPSXV8FQ0T"
};

// ================= INIT =================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const analytics = getAnalytics(app);
// ================= STATE =================
let isLoggingIn = false;

// ================= ERROR HANDLER =================
function getErrorMessage(error) {
  switch (error.code) {
    case "auth/popup-closed-by-user":
      return "Bạn đã đóng cửa sổ đăng nhập";
    case "auth/network-request-failed":
      return "Lỗi mạng, kiểm tra kết nối";
    case "auth/cancelled-popup-request":
      return "Đang xử lý đăng nhập...";
    default:
      return "Đăng nhập thất bại";
  }
}

// ================= AUTH =================

// 🔐 Login Google
export const login = async () => {
  if (isLoggingIn) return;
  isLoggingIn = true;

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Login error:", error);
    throw new Error(getErrorMessage(error));
  } finally {
    isLoggingIn = false;
  }
};

// 🚪 Logout
export const logout = async () => {
  await signOut(auth);
  localStorage.removeItem("user");
};

// 👀 Watch Auth State (QUAN TRỌNG NHẤT)
export const watchAuthState = (callback) => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const safeUser = {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        avatar: user.photoURL
      };

      localStorage.setItem("user", JSON.stringify(safeUser));

      // 👉 tạo user trong Firestore nếu chưa có
      const userRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(userRef);

      if (!snapshot.exists()) {
        await setDoc(userRef, {
          favorites: [],
          history: [],
          createdAt: Date.now()
        });
      }

      callback(safeUser);
    } else {
      localStorage.removeItem("user");
      callback(null);
    }
  });
};

// 📌 Get current user (local)
export const getCurrentUser = () => {
  return JSON.parse(localStorage.getItem("user"));
};

// ================= FIRESTORE =================

// ⭐ Lấy dữ liệu user
export const getUserData = async (uid) => {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

// ⭐ Lưu favorites
export const saveFavorites = async (uid, favorites) => {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { favorites });
};

// ⭐ Lưu history
export const saveHistory = async (uid, history) => {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { history });
};
