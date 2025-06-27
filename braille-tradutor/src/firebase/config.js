import { initializeApp, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB0Z4OF9OTiljpoW2sG5WR7L_WuKSxYaJA",
  authDomain: "login-react-firebase-5050b.firebaseapp.com",
  databaseURL: "https://login-react-firebase-5050b-default-rtdb.firebaseio.com",
  projectId: "login-react-firebase-5050b",
  storageBucket: "login-react-firebase-5050b.firebasestorage.app",
  messagingSenderId: "857005631588",
  appId: "1:857005631588:web:81f4457e3fadba245cd771",
};

let app;
try {
  app = getApp();
} catch {
  app = initializeApp(firebaseConfig);
}

const db = getDatabase(app);
const auth = getAuth(app);

export { db, auth, app };
