// Importar las funciones necesarias del SDK de Firebase
import { initializeApp } from "firebase/app";

// Configuración de Firebase para la aplicación web
const firebaseConfig = {
  apiKey: "AIzaSyB0Z4OF9OTiljpoW2sG5WR7L_WuKSxYaJA",
  authDomain: "login-react-firebase-5050b.firebaseapp.com",
  projectId: "login-react-firebase-5050b",
  storageBucket: "login-react-firebase-5050b.appspot.com", // Corregir el dominio del storage bucket
  messagingSenderId: "857005631588",
  appId: "1:857005631588:web:4d74264ba0b67f805cd771",
};

// Inicializar Firebase
const appFirebase = initializeApp(firebaseConfig);

export default appFirebase;
