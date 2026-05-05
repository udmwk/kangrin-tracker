import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// ✅ 기존 kangrin-tracker Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyC79DnSL_Ied2VmGoT5LUmgaBNFvkGWZNI",
  authDomain: "kangrin-tracker.firebaseapp.com",
  databaseURL: "https://kangrin-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kangrin-tracker",
  storageBucket: "kangrin-tracker.appspot.com",
  messagingSenderId: "678046641260",
  appId: "1:678046641260:web:a709f96a2d0eb08f1dfc49",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
