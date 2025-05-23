import React, { useState, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import { getAuth, signOut } from "firebase/auth";
import { Route, Routes, useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import mammoth from "mammoth";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
} from "docx";
import QwertyBraillePage from "./QwertyBraillePage";

// Mapa de Braille en español (ampliado y corregido para signos y puntuación)
const mapaBraille = {
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
  á: "⠷",
  é: "⠮",
  í: "⠌⠊", // Cambiado a dos celdas para evitar conflicto con barra
  ó: "⠬",
  ú: "⠾",
  ñ: "⠻",
  " ": " ",
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
  ",": "⠂",
  ";": "⠆",
  ":": "⠒",
  ".": "⠲",
  "!": "⠖",
  "?": "⠦",
  "¿": "⠢",
  "¡": "⠖",
  '"': "⠶",
  "'": "⠄",
  "(": "⠶",
  ")": "⠶",
  "-": "⠤",
  _: "⠸⠤",
  "/": "⠌",
  "\\": "⠡",
  "@": "⠈⠁",
  "#": "⠼",
  $: "⠈⠎",
  "%": "⠨⠴",
  "&": "⠯",
  "*": "⠔",
  "+": "⠖",
  "=": "⠶",
  "<": "⠦",
  ">": "⠴",
  "[": "⠪",
  "]": "⠻",
  "{": "⠸⠣",
  "}": "⠸⠜",
};

// Mapa de contracciones Braille Grado 2 (solo ejemplo: "en")
const contraccionesBraille = {
  en: "⠢", // Contracción estándar para "en" en español
};
const contraccionesBrailleInvertido = Object.entries(
  contraccionesBraille
).reduce((acc, [k, v]) => {
  acc[v] = k;
  return acc;
}, {});

// Invertir el mapa para decodificar
const mapaBrailleInvertido = Object.entries(mapaBraille).reduce(
  (acc, [k, v]) => {
    acc[v] = k;
    return acc;
  },
  {}
);

function textoABraille(texto) {
  // Primero, reemplazar contracciones de palabras completas
  let resultado = texto.replace(/\ben\b/gi, (match) => {
    return contraccionesBraille[match.toLowerCase()] || match;
  });
  // Luego, traducir el resto carácter por carácter, manejando mayúsculas solo en letras
  let braille = "";
  for (let i = 0; i < resultado.length; i++) {
    const caracter = resultado[i];
    // Solo letras (incluyendo acentuadas y ñ)
    if (caracter.match(/[A-ZÁÉÍÓÚÑ]/)) {
      const minuscula = caracter.toLowerCase();
      // Solo agregar prefijo si la letra existe en el mapa y NO está precedida por un signo de puntuación o espacio
      if (mapaBraille[minuscula]) {
        braille += "⠸" + mapaBraille[minuscula];
      } else {
        braille += caracter;
      }
    } else if (caracter === " ") {
      // Si es espacio, no agregar nada especial
      braille += " ";
    } else if (mapaBraille[caracter]) {
      braille += mapaBraille[caracter];
    } else {
      braille += caracter;
    }
  }
  // Eliminar cualquier prefijo de mayúscula que quede suelto antes de un espacio o signo de puntuación
  braille = braille.replace(/⠸([\s.,;:!?¿¡"'()[\]{}])/g, "$1");
  // También eliminar prefijos de mayúscula al final de línea
  braille = braille.replace(/⠸$/gm, "");
  // Eliminar cualquier prefijo de mayúscula ⠸ que no esté seguido de una letra Braille válida
  braille = braille.replace(/⠸(?=[^⠁-⠵⠷⠮⠬⠾⠻⠊])/g, "");
  // Formatear el resultado en estándar Braille
  return formatearBrailleEstandar(braille);
}

function brailleATexto(braille) {
  let resultado = "";
  let i = 0;
  while (i < braille.length) {
    // Contracción "en"
    if (braille[i] === "⠢") {
      resultado += contraccionesBrailleInvertido[braille[i]];
      i++;
      continue;
    }
    // Prefijo de mayúscula
    if (braille[i] === "⠸" && i + 1 < braille.length) {
      // Buscar la letra después del prefijo
      const letraBraille = braille[i + 1];
      const letra = mapaBrailleInvertido[letraBraille];
      if (letra) {
        resultado += letra.toUpperCase();
        i += 2;
        continue;
      }
    }
    // Números
    if (braille[i] === "⠼" && i + 1 < braille.length) {
      const num = mapaBrailleInvertido[braille[i] + braille[i + 1]];
      if (num) {
        resultado += num;
        i += 2;
        continue;
      }
    }
    // Buscar signos de puntuación o letras de dos caracteres (como í)
    let encontrado = false;
    if (i + 1 < braille.length) {
      const dos = braille[i] + braille[i + 1];
      if (mapaBrailleInvertido[dos]) {
        resultado += mapaBrailleInvertido[dos];
        i += 2;
        encontrado = true;
      }
    }
    if (!encontrado) {
      resultado += mapaBrailleInvertido[braille[i]] || braille[i];
      i++;
    }
  }
  return resultado;
}

// Detectar si el texto es Braille (al menos 60% de los caracteres son símbolos Braille)
function esBraille(texto) {
  const brailleRegex = /[⠁-⠿]/g;
  const total = texto.length;
  const brailleCount = (texto.match(brailleRegex) || []).length;
  return total > 0 && brailleCount / total > 0.6;
}

// **PanelPestañaPersonalizado Modificado**
function PanelPestañaPersonalizado(props) {
  const { children, valor, indice, ...otros } = props;
  return (
    <div
      role="tabpanel"
      hidden={valor !== indice}
      id={`simple-tabpanel-${indice}`} // Usar comillas invertidas
      aria-labelledby={`simple-tab-${indice}`} // Usar comillas invertidas
      {...otros}
    >
      {valor === indice && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

PanelPestañaPersonalizado.propTypes = {
  children: PropTypes.node,
  indice: PropTypes.number.isRequired,
  valor: PropTypes.number.isRequired,
};

function propsA11y(indice) {
  return {
    id: `simple-tab-${indice}`, // Usar comillas invertidas
    "aria-controls": `simple-tabpanel-${indice}`, // Usar comillas invertidas
  };
}

// Función para dividir texto en líneas Braille sin cortar palabras ni letras
function dividirEnLineasBrailleSeguro(braille, maxCeldasPorLinea = 40) {
  // 1. Separar en palabras
  const palabras = braille.split(" ");
  const lineas = [];
  let lineaActual = "";
  for (let i = 0; i < palabras.length; i++) {
    let palabra = palabras[i];
    // Si la palabra es más larga que la línea, dividirla en fragmentos
    while (palabra.length > maxCeldasPorLinea) {
      if (lineaActual.length > 0) {
        lineas.push(lineaActual);
        lineaActual = "";
      }
      lineas.push(palabra.slice(0, maxCeldasPorLinea));
      palabra = palabra.slice(maxCeldasPorLinea);
    }
    // Si la palabra cabe en la línea actual (con espacio doble si no es la primera)
    const espacio = lineaActual.length === 0 ? "" : "  ";
    if (
      lineaActual.length + espacio.length + palabra.length <=
      maxCeldasPorLinea
    ) {
      lineaActual += espacio + palabra;
    } else {
      // Si no cabe, guardar la línea actual y empezar una nueva
      if (lineaActual.length > 0) lineas.push(lineaActual);
      lineaActual = palabra;
    }
  }
  if (lineaActual.length > 0) lineas.push(lineaActual);
  return lineas;
}

// Función para formatear el Braille según estándar internacional
function formatearBrailleEstandar(braille) {
  const lineas = dividirEnLineasBrailleSeguro(braille, 40);
  // 4. Número de líneas por página: 25
  const paginas = [];
  for (let i = 0; i < lineas.length; i += 25) {
    paginas.push(lineas.slice(i, i + 25));
  }
  // 5. Márgenes: superior/inferior (2 líneas en blanco), izquierdo (3 celdas), derecho (relleno si falta)
  return paginas
    .map((pagina) => {
      const margenSup = ["", ""];
      const margenInf = ["", ""];
      const paginaConMargen = pagina.map((linea) => {
        let l = "   " + linea; // margen izquierdo
        // margen derecho: rellenar hasta 43 celdas (40 + 3 margen izq)
        while (l.length < 43) l += " ";
        return l;
      });
      return [...margenSup, ...paginaConMargen, ...margenInf].join("\n");
    })
    .join("\n\f\n"); // salto de página
}

// Función para formatear el Braille para Word (DOCX) con márgenes y formato estándar
function formatearBrailleParaWord(braille) {
  const lineas = dividirEnLineasBrailleSeguro(braille, 40);
  // 4. Número de líneas por página: 25
  const paginas = [];
  for (let i = 0; i < lineas.length; i += 25) {
    paginas.push(lineas.slice(i, i + 25));
  }
  // 5. Márgenes: superior/inferior (2 líneas en blanco), izquierdo (3 celdas), derecho (relleno si falta)
  return paginas
    .map((pagina) => {
      const margenSup = ["", ""];
      const margenInf = ["", ""];
      const paginaConMargen = pagina.map((linea) => {
        let l = "   " + linea; // margen izquierdo
        while (l.length < 43) l += " "; // margen derecho
        return l;
      });
      return [...margenSup, ...paginaConMargen, ...margenInf].join("\n");
    })
    .join("\n\f\n"); // salto de página
}

// QWERTY Braille: Componente para escribir Braille con teclado QWERTY (SDF JKL)
export function QwertyBrailleInput({ value, onChange }) {
  const [buffer, setBuffer] = useState("");
  const ref = useRef();
  const focused = useRef(false);
  // Nuevo: arreglo temporal para las teclas presionadas
  const comboActual = useRef([]);

  useEffect(() => {
    if (ref.current) ref.current.focus();
  }, [buffer]);

  useEffect(() => {
    const teclasBraille = ["s", "d", "f", "j", "k", "l"];
    const orden = ["s", "d", "f", "j", "k", "l"];
    let timeoutId = null;

    const handleKeyDown = (e) => {
      if (!focused.current) return;
      const key = e.key.toLowerCase();

      if (teclasBraille.includes(key)) {
        // Limpiar el timeout anterior si existe
        if (timeoutId) clearTimeout(timeoutId);

        // Agregar la tecla al combo si no está ya presente
        if (!comboActual.current.includes(key)) {
          comboActual.current.push(key);
        }

        // Configurar nuevo timeout para procesar el combo
        timeoutId = setTimeout(() => {
          if (comboActual.current.length > 0) {
            // Convertir combinación a bits
            const bits = orden
              .map((k) => (comboActual.current.includes(k) ? "1" : "0"))
              .join("");

            const brailleMap = {
              100000: "⠁",
              110000: "⠃",
              100100: "⠉",
              100110: "⠙",
              100010: "⠑",
              110100: "⠋",
              110110: "⠛",
              110010: "⠓",
              "010100": "⠊",
              "010110": "⠚",
              101000: "⠅",
              111000: "⠇",
              101100: "⠍",
              101110: "⠝",
              101010: "⠕",
              111100: "⠏",
              111110: "⠟",
              111010: "⠗",
              "011100": "⠎",
              "011110": "⠞",
              101001: "⠥",
              111001: "⠧",
              "010111": "⠺",
              101101: "⠭",
              101111: "⠽",
              101011: "⠵",
            };

            const brailleChar = brailleMap[bits] || "";
            if (brailleChar) {
              setBuffer((prevBuf) => {
                const nuevo = prevBuf + brailleChar;
                if (onChange) onChange(nuevo);
                return nuevo;
              });
            }
            // Limpiar el combo después de procesarlo
            comboActual.current = [];
          }
        }, 300); // Ajusta este valor según necesites

        e.preventDefault();
      } else if (key === " ") {
        setBuffer((prev) => {
          const nuevo = prev + " ";
          if (onChange) onChange(nuevo);
          return nuevo;
        });
        e.preventDefault();
      } else if (key === "backspace") {
        setBuffer((prev) => {
          const nuevo = prev.slice(0, -1);
          if (onChange) onChange(nuevo);
          return nuevo;
        });
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [onChange]);

  useEffect(() => {
    setBuffer(value || "");
  }, [value]);

  const handleFocus = () => {
    focused.current = true;
  };
  const handleBlur = () => {
    focused.current = false;
    comboActual.current = [];
  };

  return (
    <div>
      <label className="block mb-2 font-bold">QWERTY Braille (SDF JKL):</label>
      <textarea
        ref={ref}
        className="w-full h-24 p-2 border rounded font-mono text-2xl"
        value={buffer}
        readOnly
        style={{ background: "#f9f9f9" }}
        tabIndex={0}
        aria-label="Área de entrada Braille QWERTY"
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <div className="text-sm text-gray-500 mt-2">
        Mantén presionadas S, D, F, J, K, L para formar puntos Braille y
        suéltalas juntas para escribir el carácter. Espacio: barra espaciadora.
        Borrar: Backspace.
      </div>
    </div>
  );
}

export default function Traductor() {
  // Estados para la sección de texto
  const [textoEntrada, setTextoEntrada] = useState("");
  const [textoTraducido, setTextoTraducido] = useState("");
  const [modo, setModo] = useState("textoABraille");
  const [entradaEnfocada, setEntradaEnfocada] = useState(false);

  // Estado para la pestaña activa
  const [pestaña, setPestaña] = useState(0);

  // Estados para la sección de imágenes
  const [imagenSeleccionada, setImagenSeleccionada] = useState(null);
  const [urlPrevisualizacionImagen, setUrlPrevisualizacionImagen] =
    useState(null);

  // Estados para la sección de documentos
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState(null);
  const [documentoEstructurado, setDocumentoEstructurado] = useState([]);

  const navigate = useNavigate();

  const manejarCambioPestaña = (evento, nuevoValor) => {
    setPestaña(nuevoValor);
    // Limpiar estados al cambiar de pestaña
    setTextoEntrada("");
    setTextoTraducido("");
    setImagenSeleccionada(null);
    if (urlPrevisualizacionImagen) {
      URL.revokeObjectURL(urlPrevisualizacionImagen); // Limpiar URL de previsualización
    }
    setUrlPrevisualizacionImagen(null);
    setDocumentoSeleccionado(null);
    setDocumentoEstructurado([]);
  };

  // Manejador para seleccionar imagen
  const manejarSeleccionImagen = useCallback(
    (event) => {
      const file = event.target.files[0];
      if (file) {
        setImagenSeleccionada(file);
        if (urlPrevisualizacionImagen) {
          URL.revokeObjectURL(urlPrevisualizacionImagen); // Revocar URL anterior si existe
        }
        setUrlPrevisualizacionImagen(URL.createObjectURL(file));
      } else {
        setImagenSeleccionada(null);
        if (urlPrevisualizacionImagen) {
          URL.revokeObjectURL(urlPrevisualizacionImagen);
        }
        setUrlPrevisualizacionImagen(null);
      }
    },
    [urlPrevisualizacionImagen]
  );

  // Manejador para cargar imagen (simulado)
  const manejarCargaImagen = () => {
    if (imagenSeleccionada) {
      console.log("Cargando imagen:", imagenSeleccionada.name);
      // Aquí integrarías la lógica para subir la imagen a un servidor o Firebase
      alert(`Simulando carga de imagen: ${imagenSeleccionada.name}`); // Usar comillas invertidas
      // Después de la carga, podrías limpiar el estado:
      // setImagenSeleccionada(null);
      // URL.revokeObjectURL(urlPrevisualizacionImagen);
      // setUrlPrevisualizacionImagen(null);
    } else {
      alert("Por favor, seleccione una imagen para cargar.");
    }
  };

  // Manejador para seleccionar documento
  const manejarSeleccionDocumento = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      setDocumentoSeleccionado(file);
    } else {
      setDocumentoSeleccionado(null);
    }
  }, []);

  // Manejador para cargar documento
  const manejarCargaDocumento = async () => {
    if (!documentoSeleccionado) {
      alert("Por favor, seleccione un documento para cargar.");
      return;
    }
    const file = documentoSeleccionado;
    const extension = file.name.split(".").pop().toLowerCase();

    const procesarTextoDetectandoBraille = (textoPlano) => {
      if (esBraille(textoPlano)) {
        setTextoEntrada(textoPlano);
        setTextoTraducido(brailleATexto(textoPlano));
        setDocumentoEstructurado([{ tipo: "párrafo", texto: textoPlano }]);
      } else {
        setTextoEntrada(textoPlano);
        setTextoTraducido("");
        setDocumentoEstructurado([{ tipo: "párrafo", texto: textoPlano }]);
      }
    };

    if (extension === "pdf") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const typedarray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let secciones = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const texto = content.items.map((item) => item.str).join(" ");
          secciones.push({ tipo: "párrafo", texto });
        }
        const textoPlano = secciones.map((s) => s.texto).join("\n\n");
        procesarTextoDetectandoBraille(textoPlano);
        setDocumentoEstructurado(secciones);
        // Mostrar el resultado traducido automáticamente
        if (esBraille(textoPlano)) {
          setTextoTraducido(brailleATexto(textoPlano));
        } else {
          setTextoTraducido(textoABraille(textoPlano));
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (extension === "docx") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        // Validar si el archivo es realmente un ZIP (DOCX)
        const isZip = () => {
          const arr = new Uint8Array(arrayBuffer);
          // Los archivos ZIP empiezan con 0x50 0x4B (PK)
          return arr[0] === 0x50 && arr[1] === 0x4b;
        };
        if (!isZip()) {
          alert(
            "El archivo DOCX no es válido o está corrupto. Por favor, suba un archivo DOCX original de Word."
          );
          setDocumentoSeleccionado(null);
          return;
        }
        try {
          const result = await mammoth.extractRawText({ arrayBuffer });
          const textoPlano = result.value;
          procesarTextoDetectandoBraille(textoPlano);
          // Estructura simple para descarga
          setDocumentoEstructurado([{ tipo: "párrafo", texto: textoPlano }]);
        } catch (err) {
          alert(
            "Error al procesar el archivo DOCX. Asegúrese de que el archivo no esté dañado."
          );
          setDocumentoSeleccionado(null);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (extension === "txt") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const textoPlano = e.target.result;
        procesarTextoDetectandoBraille(textoPlano);
      };
      reader.readAsText(file);
    } else {
      alert("Formato de archivo no soportado.");
    }
  };

  // Función para traducir y descargar el documento
  const manejarDescargarDocumento = async () => {
    if (!documentoEstructurado.length) {
      alert("Primero cargue y traduzca un documento.");
      return;
    }
    const esDocBraille = esBraille(documentoEstructurado[0].texto);
    const seccionesTraducidas = documentoEstructurado.map((seccion) => {
      let textoTraducido = "";
      if (seccion.tipo === "título" || seccion.tipo === "párrafo") {
        textoTraducido = esDocBraille
          ? brailleATexto(seccion.texto)
          : textoABraille(seccion.texto);
        // Si el resultado es Braille, aplicar formato estándar para Word
        if (!esDocBraille) {
          textoTraducido = formatearBrailleParaWord(textoTraducido);
        }
        return { ...seccion, texto: textoTraducido };
      } else if (seccion.tipo === "tabla") {
        // Traducir cada celda de la tabla
        const filasTraducidas = seccion.filas.map((fila) =>
          fila.map((celda) => {
            let celdaTraducida = esDocBraille
              ? brailleATexto(celda)
              : textoABraille(celda);
            if (!esDocBraille) {
              celdaTraducida = formatearBrailleParaWord(celdaTraducida);
            }
            return celdaTraducida;
          })
        );
        return { ...seccion, filas: filasTraducidas };
      }
      return seccion;
    });
    const doc = new Document({
      sections: [
        {
          children: seccionesTraducidas.map((seccion) => {
            if (seccion.tipo === "título") {
              return new Paragraph({
                text: seccion.texto,
                heading:
                  HeadingLevel[seccion.nivel || "HEADING_1"] ||
                  HeadingLevel.HEADING_1,
                style: "BrailleStyle",
              });
            } else if (seccion.tipo === "párrafo") {
              return new Paragraph({
                text: seccion.texto,
                style: "BrailleStyle",
              });
            } else if (seccion.tipo === "tabla") {
              return new Table({
                rows: seccion.filas.map(
                  (fila) =>
                    new TableRow({
                      children: fila.map(
                        (celda) =>
                          new TableCell({
                            children: [
                              new Paragraph({
                                text: celda,
                                style: "BrailleStyle",
                              }),
                            ],
                          })
                      ),
                    })
                ),
              });
            } else {
              return new Paragraph({ text: "", style: "BrailleStyle" });
            }
          }),
        },
      ],
      styles: {
        paragraphStyles: [
          {
            id: "BrailleStyle",
            name: "BrailleStyle",
            run: {
              font: "Consolas",
              size: 28, // 14pt (tamaño grande y monoespaciado para Braille)
            },
            paragraph: {
              spacing: { after: 0, before: 0 },
            },
          },
        ],
      },
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = esDocBraille
      ? "documento_traducido_texto.docx"
      : "documento_traducido_braille.docx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // En el return principal, reemplaza el contenido por el enrutador:
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="min-h-screen bg-[#F5F5F5] text-[#333] w-full h-full">
            {/* Header */}
            <div className="w-full bg-[#E0E0E0] py-4 text-center text-3xl font-light tracking-wide">
              <span className="text-[#4C9FE2]">Traductor</span>Braille
            </div>

            {/* Tabs: ahora ocupan todo el ancho */}
            <div className="flex justify-center w-full mt-6">
              <Box
                sx={{
                  width: "100%",
                  maxWidth: "1200px",
                  bgcolor: "background.paper",
                  borderRadius: 2,
                  boxShadow: 2,
                  borderBottom: 1,
                  borderColor: "divider",
                }}
              >
                <Tabs
                  value={pestaña}
                  onChange={manejarCambioPestaña}
                  aria-label="pestañas de entrada"
                  textColor="primary"
                  indicatorColor="primary"
                  centered
                  variant="fullWidth"
                  sx={{
                    minHeight: "48px",
                    "& .MuiTab-root": {
                      fontSize: "1.1rem",
                      fontWeight: 500,
                      minHeight: "48px",
                      color: "#333",
                    },
                    "& .Mui-selected": {
                      color: "#4C9FE2",
                    },
                    "& .MuiTabs-indicator": {
                      backgroundColor: "#4C9FE2",
                      height: "4px",
                      borderRadius: "2px 2px 0 0",
                    },
                  }}
                >
                  <Tab label="Texto" {...propsA11y(0)} />
                  <Tab label="Imágenes" {...propsA11y(1)} />
                  <Tab label="Documentos" {...propsA11y(2)} />
                </Tabs>
              </Box>
            </div>

            {/* Paneles de contenido: ahora ocupan todo el ancho y alto */}
            <div className="flex justify-center w-full mt-6">
              <div className="w-full max-w-[1200px] bg-white rounded-2xl shadow-md border-b border-gray-200">
                <Box sx={{ width: "100%", p: 8 }}>
                  {/* Panel para Traductor de Texto */}
                  <PanelPestañaPersonalizado valor={pestaña} indice={0}>
                    <div className="flex flex-col md:flex-row gap-8 justify-center items-start w-full">
                      {/* Contenedor de entrada */}
                      <div className="flex-1 flex flex-col items-center">
                        <div
                          className={`w-full max-w-[800px] h-48 p-4 rounded-lg bg-[#F5F5F5] shadow-md flex items-start transition-all duration-200 ${
                            entradaEnfocada
                              ? "border-2 border-black"
                              : "border-0"
                          }`}
                        >
                          <textarea
                            className="w-full h-full bg-transparent text-[#333] resize-none placeholder-[#333] outline-none border-0 focus:outline-none rounded-lg text-xl"
                            style={{ boxShadow: "none" }}
                            placeholder="Ingrese el texto aquí"
                            value={textoEntrada}
                            onChange={(e) => setTextoEntrada(e.target.value)}
                            onFocus={() => setEntradaEnfocada(true)}
                            onBlur={() => setEntradaEnfocada(false)}
                          ></textarea>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-4 justify-center">
                          <button
                            className={`bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transition-transform duration-200 hover:scale-105 shadow-lg ${
                              modo === "textoABraille"
                                ? "ring-2 ring-[#007BFF]"
                                : ""
                            }`}
                            onClick={() => {
                              setModo("textoABraille");
                              setTextoTraducido(textoABraille(textoEntrada));
                            }}
                          >
                            Traducir a Braille
                          </button>
                          <button
                            className={`bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transition-transform duration-200 hover:scale-105 shadow-lg ${
                              modo === "brailleATexto"
                                ? "ring-2 ring-[#007BFF]"
                                : ""
                            }`}
                            onClick={() => {
                              setModo("brailleATexto");
                              setTextoTraducido(brailleATexto(textoEntrada));
                            }}
                          >
                            Traducir a Texto
                          </button>
                          <button
                            className="bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transition-transform duration-200 hover:scale-105 shadow-lg"
                            onClick={() => navigate("/qwerty")}
                          >
                            Qwerty
                          </button>
                        </div>
                      </div>
                      {/* Contenedor de resultado alineado */}
                      <div className="flex-1 flex flex-col items-center">
                        <div className="w-full max-w-[900px] h-48 p-4 rounded-lg bg-[#F5F5F5] shadow-md flex items-start">
                          <span className="break-all text-[#333]">
                            {textoTraducido}
                          </span>
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
                  </PanelPestañaPersonalizado>

                  {/* Panel para Entrada de Imágenes */}
                  <PanelPestañaPersonalizado valor={pestaña} indice={1}>
                    <div className="flex flex-col items-center justify-center w-full h-48 p-4 rounded-lg bg-[#F5F5F5] text-[#333] shadow-md">
                      <label
                        htmlFor="upload-image"
                        className="cursor-pointer text-blue-600 hover:underline"
                      >
                        Seleccionar Imagen
                      </label>
                      <input
                        id="upload-image"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={manejarSeleccionImagen}
                      />
                      {imagenSeleccionada ? (
                        <div className="mt-4 text-center w-full">
                          <p className="text-gray-700 mb-2">
                            Imagen seleccionada:{" "}
                            <strong>{imagenSeleccionada.name}</strong>
                          </p>
                          {urlPrevisualizacionImagen && (
                            <img
                              src={urlPrevisualizacionImagen}
                              alt="Previsualización de imagen"
                              className="max-w-xs max-h-32 mt-2 rounded-md shadow-md mx-auto"
                            />
                          )}
                          <button
                            onClick={manejarCargaImagen}
                            className="mt-4 bg-green-500 text-white py-2 px-5 rounded-full text-lg hover:bg-green-700 transition-transform duration-200 hover:scale-105 shadow-lg"
                          >
                            Cargar Imagen
                          </button>
                        </div>
                      ) : (
                        <p className="text-gray-500 mt-4">
                          Ninguna imagen seleccionada.
                        </p>
                      )}
                      <p className="text-sm text-gray-400 mt-2">
                        (Próximamente: funcionalidad de traducción de imagen a
                        Braille)
                      </p>
                    </div>
                  </PanelPestañaPersonalizado>

                  {/* Panel para Entrada de Documentos */}
                  <PanelPestañaPersonalizado valor={pestaña} indice={2}>
                    <div className="flex flex-col items-center justify-center w-full h-48 p-4 rounded-lg bg-[#F5F5F5] text-[#333] shadow-md">
                      <label
                        htmlFor="upload-document"
                        className="cursor-pointer text-blue-600 hover:underline"
                      >
                        Seleccionar Documento
                      </label>
                      <input
                        id="upload-document"
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        className="hidden"
                        onChange={manejarSeleccionDocumento}
                      />
                      {documentoSeleccionado ? (
                        <div className="mt-4 text-center w-full">
                          <p className="text-gray-700 mb-2">
                            Documento seleccionado:{" "}
                            <strong>{documentoSeleccionado.name}</strong>
                          </p>
                          <button
                            onClick={manejarCargaDocumento}
                            className="mt-4 bg-green-500 text-white py-2 px-5 rounded-full text-lg hover:bg-green-700 transition-transform duration-200 hover:scale-105 shadow-lg"
                          >
                            Cargar Documento
                          </button>
                          {documentoEstructurado.length > 0 && (
                            <button
                              onClick={manejarDescargarDocumento}
                              className="mt-4 bg-blue-500 text-white py-2 px-5 rounded-full text-lg hover:bg-blue-700 transition-transform duration-200 hover:scale-105 shadow-lg"
                            >
                              Descargar Documento Traducido
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500 mt-4">
                          Ningún documento seleccionado.
                        </p>
                      )}
                    </div>
                  </PanelPestañaPersonalizado>

                  {/* Panel para Qwerty Braille */}
                  <PanelPestañaPersonalizado valor={pestaña} indice={3}>
                    <div className="flex flex-col items-center justify-center w-full min-h-[200px] p-4 rounded-lg bg-[#F5F5F5] text-[#333] shadow-md">
                      <h2 className="text-2xl font-bold mb-4">
                        Qwerty BrailleTraductor
                      </h2>
                      <QwertyBrailleInput />
                    </div>
                  </PanelPestañaPersonalizado>
                </Box>
              </div>
            </div>
            {/* Botones Limpiar y Cerrar Sesión fuera del contenedor blanco */}
            <div className="flex flex-wrap gap-4 mt-8 justify-center w-full pb-8">
              <button
                className="bg-green-500 text-white py-2 px-5 rounded-full text-lg hover:bg-green-700 transition-transform duration-200 hover:scale-105 shadow-lg"
                onClick={() => {
                  setTextoEntrada("");
                  setTextoTraducido("");
                  setImagenSeleccionada(null);
                  setUrlPrevisualizacionImagen(null);
                  setDocumentoSeleccionado(null);
                  setDocumentoEstructurado([]);
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
        }
      />
      <Route path="/qwerty" element={<QwertyBraillePage />} />
    </Routes>
  );
}

export { textoABraille, brailleATexto };
