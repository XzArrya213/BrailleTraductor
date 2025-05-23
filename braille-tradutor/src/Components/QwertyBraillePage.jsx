import React, { useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { QwertyBrailleInput, brailleATexto } from "./Translator";

export default function QwertyBraillePage() {
  // Estados para la sección de texto (solo Qwerty Braille)
  const [textoEntrada, setTextoEntrada] = useState("");
  const [textoTraducido, setTextoTraducido] = useState("");
  const navigate = useNavigate();

  // Siempre mostrar el QwertyBrailleInput como entrada
  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#333] w-full h-full">
      {/* Header */}
      <div className="w-full bg-[#E0E0E0] py-4 text-center text-3xl font-light tracking-wide">
        <span className="text-[#4C9FE2]">Qwerty </span>
        <span className="text-[#4C9FE2]">Traductor</span>
        <span className="text-black">Braille</span>
      </div>
      <div className="flex justify-center w-full mt-6">
        <div className="w-full max-w-[1200px] bg-white rounded-2xl shadow-md border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-8 justify-center items-start w-full p-8">
            {/* Contenedor de entrada Qwerty */}
            <div className="flex-1 flex flex-col items-center">
              <div
                className={`w-full max-w-[700px] h-48 p-4 rounded-lg bg-[#F5F5F5] shadow-md flex items-start transition-all duration-200`}
              >
                <QwertyBrailleInput
                  value={textoEntrada}
                  onChange={setTextoEntrada}
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                <button
                  className={`bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transition-transform duration-200 hover:scale-105 shadow-lg`}
                  onClick={() => setTextoTraducido(textoEntrada)}
                >
                  Braille (Qwerty)
                </button>
                <button
                  className={`bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transition-transform duration-200 hover:scale-105 shadow-lg`}
                  onClick={() => {
                    setTextoTraducido(brailleATexto(textoEntrada));
                  }}
                >
                  Traducir a Texto
                </button>
                <button
                  className="bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transition-transform duration-200 hover:scale-105 shadow-lg"
                  onClick={() => navigate("/")}
                >
                  Volver al Traductor
                </button>
              </div>
            </div>
            {/* Contenedor de resultado alineado */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full max-w-[700px] h-48 p-4 rounded-lg bg-[#F5F5F5] shadow-md flex items-start">
                <span className="break-all text-[#333]">{textoTraducido}</span>
              </div>
              {/* Botón Copiar solo si hay resultado */}
              {textoTraducido && (
                <button
                  className="mt-4 bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transition-transform duration-200 hover:scale-105 shadow-lg"
                  onClick={() => {
                    navigator.clipboard.writeText(textoTraducido);
                  }}
                >
                  Copiar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Botones Limpiar y Cerrar Sesión fuera del contenedor blanco */}
      <div className="flex flex-wrap gap-4 mt-8 justify-center w-full pb-8">
        <button
          className="bg-green-500 text-white py-2 px-5 rounded-full text-lg hover:bg-green-700 transition-transform duration-200 hover:scale-105 shadow-lg"
          onClick={() => {
            setTextoEntrada("");
            setTextoTraducido("");
          }}
        >
          Limpiar
        </button>
        <button
          className="bg-red-500 text-white py-2 px-5 rounded-full text-lg hover:bg-red-700 transition-transform duration-200 hover:scale-105 shadow-lg"
          onClick={async () => {
            const auth = getAuth();
            await signOut(auth);
            navigate("/");
          }}
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
