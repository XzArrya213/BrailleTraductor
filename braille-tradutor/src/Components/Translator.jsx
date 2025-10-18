import React, { useState, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import { signOut } from "firebase/auth";
import { ref, push } from "firebase/database";
import { Route, Routes, useNavigate, Navigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import mammoth from "mammoth";
import { Document, Packer, Paragraph } from "docx";
import QwertyBraillePage from "./QwertyBraillePage";
import SavedTranslations from "./SavedTranslations";
import PrinterPanel from "./PrinterPanel";
import { auth, db } from "../firebase/config";
const ACK = 0x06;
const NAK = 0x15;

async function openSerialPort() {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });

  const reader = port.readable.getReader();
  const writer = port.writable.getWriter();
  const textEncoder = new TextEncoder();

  return { port, reader, writer, textEncoder };
}

async function waitForREADY(reader, timeoutMs = 5000, onLog) {
  const decoder = new TextDecoder();
  const start = performance.now();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      throw new Error("El lector serie se cerró durante la espera de READY");
    }
    if (value) {
      const chunk = decoder.decode(value);
      buffer += chunk;
      if (chunk.trim() && onLog) {
        onLog(chunk.trim());
      }
      if (buffer.includes("READY")) {
        if (onLog) {
          onLog("Dispositivo indicó READY");
        }
        return true;
      }
    }
    if (performance.now() - start > timeoutMs) {
      if (onLog) {
        onLog("Timeout esperando READY");
      }
      return false;
    }
  }
}

async function sendCharAndWaitAck(
  writer,
  reader,
  encoder,
  ch,
  ackTimeoutMs = 3000,
  onLog
) {
  const encodeLabel = (value) => {
    if (value === "\n") return "[EOL]\\n";
    if (value === FORM_FEED) return "[EOP]\\f";
    if (value === EOT) return "[EOJ]0x04";
    const code = value.charCodeAt(0);
    return `${value}`.replace(/\s/g, (match) =>
      match === " " ? "[espacio]" : `0x${code.toString(16).padStart(2, "0")}`
    );
  };

  await writer.write(encoder.encode(ch));

  if (onLog) {
    onLog(`Enviado carácter: ${encodeLabel(ch)}`);
  }

  const start = performance.now();
  const decoder = new TextDecoder();
  let pending = [];

  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      throw new Error("El lector serie se cerró esperando ACK");
    }
    if (value && value.length) {
      for (let i = 0; i < value.length; i += 1) {
        const byte = value[i];
        if (byte === ACK) {
          if (pending.length && onLog) {
            onLog(decoder.decode(new Uint8Array(pending)).trim());
            pending = [];
          }
          if (onLog) {
            onLog(`ACK recibido para ${encodeLabel(ch)}`);
          }
          return true;
        }
        if (byte === NAK) {
          if (pending.length && onLog) {
            onLog(decoder.decode(new Uint8Array(pending)).trim());
            pending = [];
          }
          if (onLog) {
            onLog(`NAK recibido para ${encodeLabel(ch)}`);
          }
          return false;
        }
        pending.push(byte);
      }
      if (pending.length && onLog) {
        onLog(decoder.decode(new Uint8Array(pending)).trim());
        pending = [];
      }
    }
    if (performance.now() - start > ackTimeoutMs) {
      throw new Error("Tiempo de espera agotado esperando ACK");
    }
  }
}

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
// const arduinoFilters = [
//   { usbVendorId: 0x2341, usbProductId: 0x0043 }, // Arduino UNO
//   { usbVendorId: 0x2341, usbProductId: 0x0001 }, // Arduino Mega
//   { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI clones
// ];
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

const MAX_LINE_CHARS = 25;
const MAX_PAGE_LINES = 32;
const FORM_FEED = "\f";
const EOT = String.fromCharCode(0x04);

const splitLineIntoChunks = (line = "") => {
  if (!line) return [""];
  const chunks = [];
  let remaining = line;
  while (remaining.length > MAX_LINE_CHARS) {
    chunks.push(remaining.slice(0, MAX_LINE_CHARS));
    remaining = remaining.slice(MAX_LINE_CHARS);
  }
  chunks.push(remaining);
  return chunks;
};

const buildPrintablePages = (text) => {
  const normalized = (text || "").replace(/\r/g, "");
  const rawLines = normalized.split("\n");
  const pages = [];
  let currentLines = [];

  rawLines.forEach((line) => {
    splitLineIntoChunks(line).forEach((chunk) => {
      if (currentLines.length === MAX_PAGE_LINES) {
        pages.push(currentLines.slice());
        currentLines = [];
      }
      currentLines.push(chunk);
    });
  });

  if (currentLines.length || !pages.length) {
    while (currentLines.length < MAX_PAGE_LINES) {
      currentLines.push("");
    }
    pages.push(currentLines.slice(0, MAX_PAGE_LINES));
  }

  return pages;
};

export { textoABraille, brailleATexto };

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

// QWERTY Braille: Componente para escribir Braille con teclado QWERTY (SDF JKL)
export function QwertyBrailleInput({ value, onChange }) {
  const [buffer, setBuffer] = useState("");
  const ref = useRef();
  const comboActual = useRef([]);

  useEffect(() => {
    if (ref.current) ref.current.focus();
  }, []);

  useEffect(() => {
    const teclasBraille = ["f", "d", "s", "j", "k", "l"]; // 1-2-3-4-5-6
    const orden = ["f", "d", "s", "j", "k", "l"];
    let timeoutId = null;

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();

      if (teclasBraille.includes(key)) {
        if (timeoutId) clearTimeout(timeoutId);
        if (!comboActual.current.includes(key)) {
          comboActual.current.push(key);
        }

        timeoutId = setTimeout(() => {
          if (comboActual.current.length > 0) {
            const bits = orden
              .map((k) => (comboActual.current.includes(k) ? "1" : "0"))
              .join("");

            // Mapeo actualizado según el abecedario Perkins
            const brailleMap = {
              100000: "⠁", // A (punto 1)
              110000: "⠃", // B (puntos 1-2)
              100100: "⠉", // C (puntos 1-4)
              100110: "⠙", // D (puntos 1-4-5)
              100010: "⠑", // E (puntos 1-5)
              110100: "⠋", // F (puntos 1-2-4)
              110110: "⠛", // G (puntos 1-2-4-5)
              110010: "⠓", // H (puntos 1-2-5)
              "010100": "⠊", // I (puntos 2-4)
              "010110": "⠚", // J (puntos 2-4-5)
              101000: "⠅", // K (puntos 1-3)
              111000: "⠇", // L (puntos 1-2-3)
              101100: "⠍", // M (puntos 1-3-4)
              101110: "⠝", // N (puntos 1-3-4-5)
              101010: "⠕", // O (puntos 1-3-5)
              111100: "⠏", // P (puntos 1-2-3-4)
              111110: "⠟", // Q (puntos 1-2-3-4-5)
              111010: "⠗", // R (puntos 1-2-3-5)
              "011100": "⠎", // S (puntos 2-3-4)
              "011110": "⠞", // T (puntos 2-3-4-5)
              101001: "⠥", // U (puntos 1-3-6)
              111001: "⠧", // V (puntos 1-2-3-6)
              "010111": "⠺", // W (puntos 2-4-5-6)
              101101: "⠭", // X (puntos 1-3-4-6)
              101111: "⠽", // Y (puntos 1-3-4-5-6)
              101011: "⠵", // Z (puntos 1-3-5-6)
              "000000": " ", // Espacio
            };

            const brailleChar = brailleMap[bits] || "";
            if (brailleChar) {
              setBuffer((prevBuf) => {
                const nuevo = prevBuf + brailleChar;
                if (onChange) onChange(nuevo);
                return nuevo;
              });
            }
            comboActual.current = [];
          }
        }, 300);

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

  return (
    <div className="w-full h-full">
      <textarea
        ref={ref}
        className="w-full h-full bg-transparent text-[#333] resize-none outline-none text-xl placeholder-gray-400"
        value={buffer}
        placeholder="Qwerty Braille (SDF JKL)"
        readOnly
        aria-label="Área de entrada Braille QWERTY"
      />
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

  // Nuevo estado para mostrar/ocultar traducciones guardadas
  const [showSaved, setShowSaved] = useState(false);
  const [printerText, setPrinterText] = useState("");

  // Estado de conexion con Arduino
  const [arduinoPort, setArduinoPort] = useState(null);
  const [arduinoReader, setArduinoReader] = useState(null);
  const [arduinoWriter, setArduinoWriter] = useState(null);
  const [arduinoStatus, setArduinoStatus] = useState("desconectado");
  const [arduinoError, setArduinoError] = useState(null);
  const [arduinoReady, setArduinoReady] = useState(false);
  const [arduinoBusy, setArduinoBusy] = useState(false);
  const [arduinoLogs, setArduinoLogs] = useState([]);
  const textEncoderRef = useRef(null);

  const appendArduinoLog = useCallback((message, { type = "info" } = {}) => {
    setArduinoLogs((prev) => {
      const next = [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          message,
          type,
          timestamp: new Date(),
        },
      ];
      return next.slice(-200);
    });
  }, []);

  const clearArduinoLogs = useCallback(() => {
    setArduinoLogs([]);
  }, []);

  // STT y TTS
  const recognitionRef = useRef(null);
  const [escuchando, setEscuchando] = useState(false);

  const navigate = useNavigate();

  // Agregar verificación de autenticación con useEffect
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate("/login");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Inicializar SpeechRecognition solo si está disponible
  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = "es-ES";
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onresult = (event) => {
        const texto = event.results[0][0].transcript;
        setTextoEntrada((prev) => prev + (prev ? " " : "") + texto);
        setEscuchando(false);
      };
      recognitionRef.current.onend = () => setEscuchando(false);
      recognitionRef.current.onerror = () => setEscuchando(false);
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serial" in navigator)) {
      setArduinoStatus("no soportado");
    }
  }, []);

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
    setPrinterText("");
  };

  const manejarDesconectarArduino = useCallback(async () => {
    if (!arduinoPort) {
      return;
    }
    try {
      if (arduinoReader) {
        try {
          await arduinoReader.cancel();
        } catch (cancelError) {
          console.warn("Cancelación del lector serie:", cancelError);
        }
        arduinoReader.releaseLock();
      }
      if (arduinoWriter) {
        arduinoWriter.releaseLock();
      }
      await arduinoPort.close();
      setArduinoError(null);
      setArduinoStatus("desconectado");
    } catch (error) {
      console.error("Error al cerrar el puerto de Arduino:", error);
      setArduinoError(error && error.message ? error.message : String(error));
      setArduinoStatus("error");
    } finally {
      setArduinoPort(null);
      setArduinoReader(null);
      setArduinoWriter(null);
      setArduinoReady(false);
      textEncoderRef.current = null;
    }
  }, [arduinoPort, arduinoReader, arduinoWriter]);

  const enviarComandoArduino = useCallback(
    async (mensaje, { esperarAck = true } = {}) => {
      if (!arduinoPort || !arduinoReader || !arduinoWriter) {
        setArduinoError("Puerto serie no disponible");
        appendArduinoLog("Puerto serie no disponible", { type: "error" });
        return false;
      }
      if (!textEncoderRef.current) {
        textEncoderRef.current = new TextEncoder();
      }
      if (arduinoBusy) {
        setArduinoError("El dispositivo está procesando otra operación");
        appendArduinoLog(
          "El dispositivo está procesando otra operación",
          { type: "warning" }
        );
        return false;
      }

      setArduinoBusy(true);
      try {
        if (!esperarAck) {
          await arduinoWriter.write(
            textEncoderRef.current.encode(mensaje)
          );
          appendArduinoLog(`Comando enviado sin ACK: ${mensaje}`);
          return true;
        }

        for (const ch of mensaje) {
          const ok = await sendCharAndWaitAck(
            arduinoWriter,
            arduinoReader,
            textEncoderRef.current,
            ch,
            3000,
            appendArduinoLog
          );

          if (!ok) {
            setArduinoError(`Carácter no reconocido por el dispositivo: "${ch}"`);
            appendArduinoLog(
              `Carácter no reconocido por el dispositivo: "${ch}"`,
              { type: "error" }
            );
            return false;
          }
        }
        setArduinoError(null);
        appendArduinoLog("Mensaje enviado correctamente");
        return true;
      } catch (error) {
        console.error("Error al enviar comando al dispositivo serie:", error);
        setArduinoStatus("error");
        setArduinoError(error && error.message ? error.message : String(error));
        appendArduinoLog(
          `Error al enviar comando: ${
            error && error.message ? error.message : String(error)
          }`,
          { type: "error" }
        );
        return false;
      } finally {
        setArduinoBusy(false);
      }
    },
    [
      arduinoPort,
      arduinoReader,
      arduinoWriter,
      arduinoBusy,
      appendArduinoLog,
    ]
  );

  const manejarDetectarArduino = useCallback(async () => {
    if (typeof navigator === "undefined" || !("serial" in navigator)) {
      alert("Este navegador no soporta Web Serial.");
      return;
    }

    try {
      setArduinoStatus("buscando");
      setArduinoError(null);
      setArduinoReady(false);

      if (arduinoPort) {
        await manejarDesconectarArduino();
      }

      const { port, reader, writer, textEncoder } = await openSerialPort();
      textEncoderRef.current = textEncoder;
      setArduinoPort(port);
      setArduinoReader(reader);
      setArduinoWriter(writer);

      let listo = false;
      try {
        listo = await waitForREADY(reader, 5000, appendArduinoLog);
      } catch (readyError) {
        console.warn("No se pudo confirmar READY:", readyError);
        appendArduinoLog(
          `No se pudo confirmar READY: ${
            readyError && readyError.message ? readyError.message : readyError
          }`,
          { type: "warning" }
        );
      }

      setArduinoReady(listo);
      if (listo) {
        appendArduinoLog("Arduino listo para recibir datos");
      } else {
        appendArduinoLog(
          "Arduino conectado pero no respondió READY. Continúa con precaución.",
          { type: "warning" }
        );
      }
      setArduinoStatus("conectado");
    } catch (error) {
      console.error("Fallo al conectar con un dispositivo serie:", error);
      appendArduinoLog(
        `Error al conectar: ${
          error && error.message ? error.message : String(error)
        }`,
        { type: "error" }
      );
      await manejarDesconectarArduino();
      setArduinoStatus("error");
      setArduinoError(error && error.message ? error.message : String(error));
    }
  }, [arduinoPort, manejarDesconectarArduino, appendArduinoLog]);

  const handlePrintDocument = useCallback(async () => {
    const trimmed = printerText.replace(/\r/g, "").trimEnd();
    if (!trimmed) {
      appendArduinoLog("No hay contenido para imprimir.", { type: "warning" });
      return;
    }
    if (!arduinoPort || !arduinoReader || !arduinoWriter) {
      const msg = "Conecta el dispositivo antes de imprimir.";
      setArduinoError(msg);
      appendArduinoLog(msg, { type: "error" });
      return;
    }
    if (!arduinoReady) {
      appendArduinoLog(
        "El dispositivo no reportó READY. Intenta reconectar si la impresión falla.",
        { type: "warning" }
      );
    }

    if (!textEncoderRef.current) {
      textEncoderRef.current = new TextEncoder();
    }

    const pages = buildPrintablePages(printerText);
    appendArduinoLog(`Iniciando impresión (${pages.length} hoja(s))`);

    setArduinoBusy(true);
    try {
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const pageLines = pages[pageIndex];
        const isLastPage = pageIndex === pages.length - 1;

        let lastContentLine = -1;
        for (let i = pageLines.length - 1; i >= 0; i -= 1) {
          if ((pageLines[i] || "").trim().length > 0) {
            lastContentLine = i;
            break;
          }
        }

        if (lastContentLine === -1) {
          appendArduinoLog(`Hoja ${pageIndex + 1}: sin contenido`);
        } else {
          for (let lineIndex = 0; lineIndex <= lastContentLine; lineIndex += 1) {
            const lineContent = pageLines[lineIndex] || "";
            appendArduinoLog(
              `Hoja ${pageIndex + 1}, línea ${lineIndex + 1}: ${
                lineContent ? lineContent : "[blanco]"
              }`
            );

            for (const ch of lineContent) {
              const ok = await sendCharAndWaitAck(
                arduinoWriter,
                arduinoReader,
                textEncoderRef.current,
                ch,
                3000,
                appendArduinoLog
              );
              if (!ok) {
                appendArduinoLog(`NAK recibido al enviar "${ch}"`, {
                  type: "error",
                });
                throw new Error(`NAK recibido en carácter "${ch}"`);
              }
            }

            const eolOk = await sendCharAndWaitAck(
              arduinoWriter,
              arduinoReader,
              textEncoderRef.current,
              "\n",
              3000,
              appendArduinoLog
            );
            if (!eolOk) {
              appendArduinoLog("NAK recibido al enviar fin de línea", {
                type: "error",
              });
              throw new Error("NAK en fin de línea");
            }
          }
        }

        if (!isLastPage) {
          const eopOk = await sendCharAndWaitAck(
            arduinoWriter,
            arduinoReader,
            textEncoderRef.current,
            FORM_FEED,
            3000,
            appendArduinoLog
          );
          if (!eopOk) {
            appendArduinoLog("NAK recibido al enviar fin de página", {
              type: "error",
            });
            throw new Error("NAK en fin de página");
          }
          appendArduinoLog(`Fin de página ${pageIndex + 1}`);
        }
      }

      const eojOk = await sendCharAndWaitAck(
        arduinoWriter,
        arduinoReader,
        textEncoderRef.current,
        EOT,
        3000,
        appendArduinoLog
      );
      if (!eojOk) {
        appendArduinoLog("NAK recibido al enviar fin de trabajo", {
          type: "error",
        });
        throw new Error("NAK en fin de trabajo");
      }

      appendArduinoLog("Impresión finalizada correctamente.");
    } catch (error) {
      const message =
        error && error.message ? error.message : "Error al imprimir";
      appendArduinoLog(message, { type: "error" });
      setArduinoError(message);
      setArduinoStatus("error");
    } finally {
      setArduinoBusy(false);
    }
  }, [
    printerText,
    arduinoPort,
    arduinoReader,
    arduinoWriter,
    arduinoReady,
    appendArduinoLog,
    setArduinoError,
    setArduinoStatus,
  ]);

  // useEffect(() => {
  //   if (typeof navigator === "undefined" || !("serial" in navigator)) {
  //     return;
  //   }
  //   if (arduinoPort) {
  //     return;
  //   }

  //   let cancelado = false;

  //   const intentarReconectar = async () => {
  //     try {
  //       const ports = await navigator.serial.getPorts();
  //       if (!ports.length) {
  //         return;
  //       }

  //       // Tomar el primer dispositivo disponible; filtros comentados para permitir todos los puertos.
  //       const candidato = ports[0];

  //       if (!candidato) {
  //         return;
  //       }

  //       if (!candidato.readable) {
  //         await candidato.open({ baudRate: 9600 });
  //       }

  //       if (!cancelado) {
  //         setArduinoPort(candidato);
  //         setArduinoStatus("conectado");
  //         setArduinoError(null);
  //       } else if (typeof candidato.close === "function") {
  //         await candidato.close();
  //       }
  //     } catch (error) {
  //       if (!cancelado) {
  //         console.error("Error al reconectar un dispositivo serie:", error);
  //         setArduinoStatus("desconectado");
  //         setArduinoError(error && error.message ? error.message : String(error));
  //       }
  //     }
  //   };

  //   intentarReconectar();

  //   return () => {
  //     cancelado = true;
  //   };
  // }, [arduinoPort]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serial" in navigator)) {
      return;
    }

    const handleConnectEvent = () => {
      if (!arduinoPort) {
        setArduinoStatus("disponible");
        setArduinoError(null);
      }
    };

    const handleDisconnectEvent = (event) => {
      if (arduinoPort && event.target === arduinoPort) {
        manejarDesconectarArduino().catch((error) => {
          console.error("Error al desconectar el dispositivo serie:", error);
        });
      } else {
        setArduinoPort(null);
        setArduinoStatus("desconectado");
        setArduinoError(null);
      }
    };

    navigator.serial.addEventListener("connect", handleConnectEvent);
    navigator.serial.addEventListener("disconnect", handleDisconnectEvent);

    return () => {
      navigator.serial.removeEventListener("connect", handleConnectEvent);
      navigator.serial.removeEventListener("disconnect", handleDisconnectEvent);
    };
  }, [arduinoPort, manejarDesconectarArduino]);

  useEffect(() => {
    return () => {
      manejarDesconectarArduino().catch((error) => {
        console.error("Error al desconectar el dispositivo al limpiar:", error);
        appendArduinoLog(
          `Error al desconectar al limpiar: ${
            error && error.message ? error.message : String(error)
          }`,
          { type: "error" }
        );
      });
    };
  }, [manejarDesconectarArduino, appendArduinoLog]);

  const etiquetasEstadoArduino = {
    conectado: "Arduino conectado",
    buscando: "Buscando dispositivo...",
    error: "Error al conectar con un dispositivo serie",
    "no soportado": "Web Serial no soportado en este navegador",
    disponible: "Dispositivo serie detectado. Puedes conectarlo.",
    desconectado: "Sin dispositivo detectado",
  };
  let etiquetaEstadoArduino =
    etiquetasEstadoArduino[arduinoStatus] || "Sin dispositivo detectado";

  if (arduinoStatus === "conectado") {
    if (arduinoBusy) {
      etiquetaEstadoArduino = "Enviando datos al dispositivo...";
    } else if (arduinoReady) {
      etiquetaEstadoArduino = "Arduino listo para recibir datos";
    } else {
      etiquetaEstadoArduino = "Arduino conectado (esperando READY)";
    }
  }

  const botonArduinoDeshabilitado =
    arduinoStatus === "no soportado" ||
    arduinoStatus === "buscando" ||
    arduinoBusy;
  const printDisabled =
    arduinoBusy ||
    !printerText.trim() ||
    !arduinoPort ||
    !arduinoReader ||
    !arduinoWriter ||
    !arduinoReady;

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
      // Mejorar la detección de texto Braille
      const esBrailleTexto = esBraille(textoPlano);
      setDocumentoEstructurado([{ tipo: "párrafo", texto: textoPlano }]);

      if (esBrailleTexto) {
        // Si es Braille, convertir a texto
        setTextoEntrada(textoPlano);
        const textoConvertido = brailleATexto(textoPlano);
        setTextoTraducido(textoConvertido);
      } else {
        // Si es texto normal, convertir a Braille
        setTextoEntrada(textoPlano);
        const brailleConvertido = textoABraille(textoPlano);
        setTextoTraducido(brailleConvertido);
      }
    };

    try {
      switch (extension) {
        case "pdf":
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const typedarray = new Uint8Array(e.target.result);
              const pdf = await pdfjsLib.getDocument({ data: typedarray })
                .promise;
              let textoCompleto = "";

              for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const textoPage = content.items
                  .map((item) => item.str)
                  .join(" ")
                  .replace(/\s+/g, " ");
                textoCompleto += textoPage + "\n\n";
              }

              procesarTextoDetectandoBraille(textoCompleto.trim());
            } catch (error) {
              alert("Error al procesar el PDF. Verifique que no esté dañado.");
            }
          };
          reader.readAsArrayBuffer(file);
          break;

        case "docx":
          const docxReader = new FileReader();
          docxReader.onload = async (e) => {
            try {
              const arrayBuffer = e.target.result;
              const result = await mammoth.extractRawText({ arrayBuffer });
              procesarTextoDetectandoBraille(result.value.trim());
            } catch (error) {
              alert(
                "Error al procesar el archivo DOCX. Verifique que no esté dañado."
              );
            }
          };
          docxReader.readAsArrayBuffer(file);
          break;

        case "txt":
          const txtReader = new FileReader();
          txtReader.onload = (e) => {
            try {
              const texto = e.target.result;
              procesarTextoDetectandoBraille(texto.trim());
            } catch (error) {
              alert(
                "Error al procesar el archivo TXT. Verifique la codificación del archivo."
              );
            }
          };
          txtReader.readAsText(file);
          break;

        default:
          alert(
            "Formato de archivo no soportado. Por favor, use PDF, DOCX o TXT."
          );
      }
    } catch (error) {
      console.error("Error al procesar el documento:", error);
      alert("Error al procesar el documento. Intente con otro archivo.");
    }
  };

  // Modificar la función de descarga
  const manejarDescargarDocumento = async () => {
    if (!documentoEstructurado.length) {
      alert("Primero cargue y traduzca un documento.");
      return;
    }

    try {
      const esDocBraille = esBraille(documentoEstructurado[0].texto);
      // Unir todos los textos en un solo string y dividir por líneas
      const textoCompleto = documentoEstructurado
        .map((s) =>
          esDocBraille ? brailleATexto(s.texto) : textoABraille(s.texto)
        )
        .join("\n");
      // Eliminar saltos de página y márgenes manuales
      const lineas = textoCompleto
        .replace(/\f/g, "")
        .split(/\r?\n/)
        .map((l) => l.trimEnd());
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: lineas.map(
              (linea) =>
                new Paragraph({
                  text: linea,
                  style: "BrailleStyle",
                  spacing: { after: 300, before: 300 },
                  alignment: "left",
                })
            ),
          },
        ],
        styles: {
          paragraphStyles: [
            {
              id: "BrailleStyle",
              name: "BrailleStyle",
              run: {
                font: "Consolas",
                size: 28,
              },
              paragraph: {
                spacing: { after: 240, before: 240 },
                indent: { left: 720 },
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
    } catch (error) {
      console.error("Error al generar el documento:", error);
      alert("Error al generar el documento traducido. Intente nuevamente.");
    }
  };

  // Modificar la función saveTranslation
  const saveTranslation = async () => {
    try {
      const user = auth.currentUser;
      console.log("Estado de autenticación:", !!user); // Debug

      if (!user) {
        console.log("No hay usuario autenticado"); // Debug
        alert("Por favor, inicie sesión nuevamente");
        navigate("/");
        return;
      }

      if (!textoEntrada || !textoTraducido) {
        alert("Por favor realice una traducción antes de guardar");
        return;
      }

      const translationData = {
        original: textoEntrada,
        translated: textoTraducido,
        type: modo,
        timestamp: Date.now(),
        userId: user.uid,
      };

      const newTranslationRef = await push(
        ref(db, `users/${user.uid}/translations`),
        translationData
      );

      if (newTranslationRef) {
        alert("¡Traducción guardada exitosamente!");
      }
    } catch (error) {
      console.error("Error detallado:", error); // Debug
      if (error.code === "PERMISSION_DENIED") {
        alert("Error de permisos. Por favor, inicie sesión nuevamente.");
        navigate("/");
      } else {
        alert(`Error al guardar: ${error.message}`);
      }
    }
  };

  // Cargar traducción guardada en los campos de texto
  const loadSavedTranslation = (item) => {
    setTextoEntrada(item.original);
    setTextoTraducido(item.translated);
    setModo(item.type);
    setShowSaved(false);
  };

  // Modificar la función para navegar a Qwerty
  const handleQwertyNavigation = (e) => {
    e.preventDefault();
    navigate("/qwerty", { replace: false });
  };

  // Modificar la función handleSignOut
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setTextoEntrada("");
      setTextoTraducido("");
      setShowSaved(false);
      navigate("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert("Error al cerrar sesión. Por favor intente nuevamente.");
    }
  };

  // --- STT y TTS handlers ---
  const handleSTT = () => {
    if (recognitionRef.current) {
      setEscuchando(true);
      recognitionRef.current.start();
    } else {
      alert("El reconocimiento de voz no es compatible con este navegador.");
    }
  };

  const handleTTS = () => {
    if ("speechSynthesis" in window) {
      let textoParaLeer = textoTraducido;
      if (modo === "textoABraille") {
        // Si el resultado es Braille, conviértelo a texto antes de leer
        textoParaLeer = brailleATexto(textoTraducido);
      }
      const utter = new window.SpeechSynthesisUtterance(textoParaLeer);
      utter.lang = "es-ES";
      window.speechSynthesis.speak(utter);
    } else {
      alert("La síntesis de voz no es compatible con este navegador.");
    }
  };

  // En el return principal, reemplaza el contenido por el enrutador:
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="relative min-h-screen bg-[#F5F5F5] text-[#333] w-full h-full">
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
                  <Tab label="Impresora" {...propsA11y(3)} />
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
                          className={`w-full max-w-[800px] h-48 p-4 rounded-lg bg-[#F5F5F5] shadow-md flex items-start transition-all duration-200 relative ${
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
                            onChange={(e) => setTextoEntrada(e.target.value) }
                            onFocus={() => setEntradaEnfocada(true)}
                            onBlur={() => setEntradaEnfocada(false)}
                          ></textarea>
                          {/* Botón STT */}
                          <button
                            type="button"
                            onClick={handleSTT}
                            className={`p-2 rounded-full border bg-white absolute left-2 bottom-2 ${
                              escuchando ? "bg-red-200 animate-pulse" : ""
                            }`}
                            title="Dictar texto"
                            tabIndex={0}
                            style={{ cursor: "pointer" }}
                          >
                            🎤
                          </button>
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
                            onClick={handleQwertyNavigation}
                          >
                            Qwerty
                          </button>
                        </div>
                      </div>
                      {/* Contenedor de resultado alineado */}
                      <div className="flex-1 flex flex-col items-center">
                        <div className="w-full max-w-[900px] h-48 p-4 rounded-lg bg-[#F5F5F5] shadow-md flex items-start overflow-auto relative">
                          <textarea
                            className="w-full h-full bg-transparent text-[#333] resize-none placeholder-[#333] outline-none border-0 focus:outline-none rounded-lg text-xl"
                            style={{ boxShadow: "none" }}
                            value={textoTraducido}
                            readOnly
                            tabIndex={0} // Permite enfocar el área de texto
                          />
                          {/* Botón TTS */}
                          <button
                            type="button"
                            onClick={handleTTS}
                            className="p-2 rounded-full border bg-white absolute left-2 bottom-2"
                            title="Escuchar traducción"
                            disabled={!textoTraducido}
                            tabIndex={0} // Permite enfocar el botón con teclado
                            style={{
                              cursor: textoTraducido
                                ? "pointer"
                                : "not-allowed",
                            }}
                          >
                            🔊
                          </button>
                        </div>
                        {/* Botón Copiar solo si hay resultado */}
                        {textoTraducido && (
                          <div className="flex gap-4">
                            <button
                              className="mt-4 bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transition-transform duration-200 hover:scale-105 shadow-lg"
                              onClick={() => {
                                navigator.clipboard.writeText(textoTraducido);
                              }}
                            >
                              Copiar
                            </button>
                            <button
                              className="mt-4 bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transition-transform duration-200 hover:scale-105 shadow-lg"
                              onClick={saveTranslation}
                            >
                              Guardar
                            </button>
                          </div>
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
                          <div className="flex flex-wrap gap-4 justify-center">
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
                        </div>
                      ) : (
                        <p className="text-gray-500 mt-4">
                          Ningún documento seleccionado.
                        </p>
                      )}
                    </div>
                  </PanelPestañaPersonalizado>

                  {/* Panel para Impresora */}
                  <PanelPestañaPersonalizado valor={pestaña} indice={3}>
                    <PrinterPanel
                      value={printerText}
                      onChange={setPrinterText}
                      arduinoPort={arduinoPort}
                      arduinoStatus={arduinoStatus}
                      arduinoError={arduinoError}
                      onDetectDevice={manejarDetectarArduino}
                      onDisconnectDevice={manejarDesconectarArduino}
                      detectButtonDisabled={botonArduinoDeshabilitado}
                      statusLabel={etiquetaEstadoArduino}
                      onPrint={handlePrintDocument}
                      printDisabled={printDisabled}
                      logs={arduinoLogs}
                      onClearLogs={clearArduinoLogs}
                    />
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
                  setPrinterText("");
                }}
              >
                Limpiar
              </button>
              {pestaña === 0 && ( // Solo mostrar el boton Historial en la pestana de texto
                <button
                  className="bg-[#4C9FE2] text-white py-2 px-5 rounded-full text-lg hover:bg-[#0056b3] transition-transform duration-200 hover:scale-105 shadow-lg"
                  onClick={() => setShowSaved(!showSaved)}
                >
                  Historial
                </button>
              )}
              <button
                className="bg-red-500 text-white py-2 px-5 rounded-full text-lg hover:bg-red-700 transition-transform duration-200 hover:scale-105 shadow-lg"
                onClick={handleSignOut}
              >
                Cerrar Sesion
              </button>
            </div>
            {/* Componente de traducciones guardadas */}
            {showSaved && (
              <SavedTranslations
                onSelect={loadSavedTranslation}
                onClose={() => setShowSaved(false)}
              />
            )}
          </div>
        }
      />
      <Route path="/qwerty" element={<QwertyBraillePage />} />
      <Route path="/login" element={<Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
