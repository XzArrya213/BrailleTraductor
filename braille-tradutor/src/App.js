import React, { useState, useEffect } from "react";
import Traductor from "./Components/Translator";
import Form from "./Components/Form";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase/config";

export default function App() {
  const [usuarioAutenticado, setUsuarioAutenticado] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuarioAutenticado(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#232323] min-h-screen flex justify-center items-center" />
    );
  }

  return (
    <div className="bg-[#232323] min-h-screen flex justify-center items-center">
      {usuarioAutenticado ? <Traductor /> : <Form />}
    </div>
  );
}
