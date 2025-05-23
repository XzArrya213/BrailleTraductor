// DEPRECATED: Este componente no se usa. El control de autenticación y renderizado está en App.js.

import appFirebase from "../credenciales";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useState } from "react";
import Traductor from "./Translator";
import Form from "./Form";

const auth = getAuth(appFirebase);

function Login() {
  const [user, setUser] = useState(null);

  onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      setUser(firebaseUser); // Detectar usuario autenticado
      console.log("Usuario autenticado:", firebaseUser);
    } else {
      setUser(null); // Usuario no autenticado
    }
  });

  return (
    <div className="bg-[#232323] min-h-screen flex justify-center items-center">
      {user ? <Traductor /> : <Form />}
    </div>
  );
}

export default Login;
