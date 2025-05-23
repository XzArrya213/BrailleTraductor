import React, { useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import appFirebase from "../credenciales";

const auth = getAuth(appFirebase);

function Traductor() {
  const [textoEntrada, setTextoEntrada] = useState("");
  const [resultadoTraduccion, setResultadoTraduccion] = useState("");
  const [copiarVisible, setCopiarVisible] = useState(false);
  const [modoBraille, setModoBraille] = useState(true);

  // Mapa de Braille actualizado con números
  const brailleMap = {
    a: "⠁",
    b: "⠃",
    c: "⠉",
    d: "⠙",
    e: "⠑",
    f: "⠋",
    g: "⠛",
    h: "⠓",
    i: "⠊",
    j: "⠚",
    k: "⠅",
    l: "⠇",
    m: "⠍",
    n: "⠝",
    o: "⠕",
    p: "⠏",
    q: "⠟",
    r: "⠗",
    s: "⠎",
    t: "⠞",
    u: "⠥",
    v: "⠧",
    w: "⠺",
    x: "⠭",
    y: "⠽",
    z: "⠵",
    á: "⠁⠈",
    é: "⠑⠈",
    í: "⠊⠈",
    ó: "⠕⠈",
    ú: "⠥⠈",
    ñ: "⠝⠐",
    " ": " ",
    // Números en Braille (prefijo ⠼ para indicar números)
    1: "⠼⠁",
    2: "⠼⠃",
    3: "⠼⠉",
    4: "⠼⠙",
    5: "⠼⠑",
    6: "⠼⠋",
    7: "⠼⠛",
    8: "⠼⠓",
    9: "⠼⠊",
    0: "⠼⠚",
  };

  // Traducir texto a Braille
  const traductorTextoBraille = (texto) => {
    return Array.from(texto)
      .map((caracter) => brailleMap[caracter.toLowerCase()] || caracter)
      .join("");
  };

  // Traducir Braille a texto
  const traductorBrailleTexto = (braille) => {
    const reversedMap = Object.entries(brailleMap).reduce(
      (acc, [key, value]) => {
        acc[value] = key;
        return acc;
      },
      {}
    );

    let resultado = "";
    let esNumero = false;

    for (let i = 0; i < braille.length; i++) {
      const caracter = braille[i];
      if (caracter === "⠼") {
        esNumero = true; // Activar modo número
        continue;
      }

      if (esNumero) {
        const numero = Object.keys(brailleMap).find(
          (key) => brailleMap[key] === `⠼${caracter}`
        );
        if (numero) {
          resultado += numero;
          esNumero = false; // Desactivar modo número después de un dígito
        } else {
          resultado += caracter; // Si no es un número válido, agregar el carácter tal cual
        }
      } else {
        // Manejar caracteres con tildes y combinaciones
        const siguienteCaracter = braille[i + 1];
        const combinado = caracter + siguienteCaracter;

        if (reversedMap[combinado]) {
          resultado += reversedMap[combinado];
          i++; // Saltar el siguiente carácter porque ya fue procesado
        } else if (reversedMap[caracter]) {
          resultado += reversedMap[caracter];
        } else {
          resultado += caracter; // Si no se encuentra en el mapa, agregar el carácter tal cual
        }
      }
    }

    return resultado;
  };

  const handleTraducir = (modo) => {
    setModoBraille(modo); // Actualiza el estado de modoBraille antes de traducir
    if (textoEntrada.trim() === "") {
      setResultadoTraduccion("El campo de texto no debe estar vacío");
      setCopiarVisible(false);
    } else {
      const resultado = modo
        ? traductorTextoBraille(textoEntrada)
        : traductorBrailleTexto(textoEntrada);
      setResultadoTraduccion(resultado);
      setCopiarVisible(true);
    }
  };

  const handleSignOut = () => {
    signOut(auth).then(() => {
      console.log("Sesión cerrada");
    });
  };

  const handleCopiar = () => {
    navigator.clipboard.writeText(resultadoTraduccion);
  };

  const handleLimpiar = () => {
    setTextoEntrada("");
    setResultadoTraduccion("");
    setCopiarVisible(false);
  };

  return (
    <div className="h-screen w-screen bg-[#E8EAEB] flex flex-col items-center justify-center">
      <header className="w-full bg-[#E0E0E0] p-4 text-center shadow-md fixed top-0 z-10">
        <a href="#" className="text-4xl text-[#333333] font-light">
          <span className="text-[#4C9FE2]">Traductor</span>Braille
        </a>
      </header>

      <main className="flex flex-col md:flex-row justify-center items-center w-full p-10 gap-10 mt-16">
        <section className="w-full md:w-1/2 flex flex-col items-center">
          <textarea
            className="w-full h-72 p-5 text-2xl border border-[#E0E0E0] rounded-lg shadow-md bg-transparent resize-none placeholder-[#333333] focus:ring-2 focus:ring-[#007BFF]"
            placeholder="Ingrese el texto aquí"
            value={textoEntrada}
            onChange={(e) => setTextoEntrada(e.target.value)}
          />
          <div className="flex gap-2 mt-4">
            <button
              className="bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transform transition-transform duration-200 hover:scale-105 shadow-lg"
              onClick={() => handleTraducir(true)} // Traducir a Braille
            >
              Traducir a Braille
            </button>
            <button
              className="bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transform transition-transform duration-200 hover:scale-105 shadow-lg"
              onClick={() => handleTraducir(false)} // Traducir a Texto
            >
              Traducir a Texto
            </button>
          </div>
        </section>

        <section className="w-full md:w-1/2 flex flex-col items-center">
          <textarea
            className="w-full h-72 p-5 text-2xl border border-[#E0E0E0] rounded-lg shadow-md bg-transparent resize-none text-[#333333]"
            value={resultadoTraduccion}
            readOnly
            style={{ minHeight: "18rem" }} // Altura fija para evitar cambios en el diseño
          />
          <div className="mt-4">
            <button
              className={`bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transform transition-transform duration-200 hover:scale-105 shadow-lg ${
                copiarVisible ? "block" : "invisible"
              }`}
              onClick={handleCopiar}
            >
              Copiar
            </button>
          </div>
        </section>
      </main>

      <div className="flex gap-4 mt-5">
        <button
          className="bg-[#2ECC71] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transform transition-transform duration-200 hover:scale-105 shadow-lg"
          onClick={handleLimpiar}
        >
          Limpiar
        </button>
        <button
          className="bg-[#E74C3C] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transform transition-transform duration-200 hover:scale-105 shadow-lg"
          onClick={handleSignOut}
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

export default Traductor;
