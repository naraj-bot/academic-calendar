/*
 * ค่าการเชื่อมต่อ Firebase ของโรงเรียน
 * วิธีหา: Firebase Console → ⚙ Project settings → General → Your apps → Web app → SDK setup and configuration → Config
 * คัดลอกค่ามาวางแทนที่ด้านล่างให้ครบทุกบรรทัด
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCuMlwv-P1nb6w7_V075tBx2zcyJBNNsHU",
  authDomain: "school-calendar-e1f01.firebaseapp.com",
  projectId: "school-calendar-e1f01",
  storageBucket: "school-calendar-e1f01.firebasestorage.app",
  messagingSenderId: "887664961858",
  appId: "1:887664961858:web:e576d5ac773dcf5f4c80db"
};

/*
 * โดเมนสำหรับแปลงชื่อผู้ใช้เป็นอีเมลภายในระบบ (ผู้ใช้ไม่เห็นค่านี้)
 * เช่น ชื่อผู้ใช้ "somjai" จะเข้าสู่ระบบด้วย somjai@school.local
 * ตั้งครั้งเดียวก่อนเริ่มใช้งาน ห้ามเปลี่ยนภายหลัง ไม่เช่นนั้นผู้ใช้เดิมจะเข้าสู่ระบบไม่ได้
 */
export const EMAIL_DOMAIN = "school.local";
