import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

const MAX_CHARS_PER_LINE = 25;
const MAX_LINES_PER_PAGE = 32;
const FONT_SIZE_REM = 1.75;
const LINE_HEIGHT_EM = 1.2;
const LETTER_SPACING_EM = 0.12;
const TEXTAREA_PADDING_X_REM = 1;
const TEXTAREA_PADDING_Y_REM = 0;
const LINE_STEP_REM = LINE_HEIGHT_EM * FONT_SIZE_REM;
const PAGE_HEIGHT_REM = LINE_STEP_REM * MAX_LINES_PER_PAGE;
const BRA_PAGE_SEPARATOR = "\f";

const createEmptyPage = () =>
  Array.from({ length: MAX_LINES_PER_PAGE }, () => "");

const splitLine = (line = "") => {
  if (!line) {
    return [""];
  }

  const segments = [];
  let remaining = line;

  while (remaining.length > MAX_CHARS_PER_LINE) {
    segments.push(remaining.slice(0, MAX_CHARS_PER_LINE));
    remaining = remaining.slice(MAX_CHARS_PER_LINE);
  }

  segments.push(remaining);
  return segments;
};

const sanitizePageValue = (input, { pad = true } = {}) => {
  const normalized = typeof input === "string" ? input.replace(/\r/g, "") : "";
  const rawLines = normalized.split("\n");
  const result = [];

  for (let i = 0; i < rawLines.length; i += 1) {
    const parts = splitLine(rawLines[i]);
    for (let j = 0; j < parts.length; j += 1) {
      if (result.length === MAX_LINES_PER_PAGE) {
        break;
      }
      result.push(parts[j]);
    }
    if (result.length === MAX_LINES_PER_PAGE) {
      break;
    }
  }

  if (pad) {
    while (result.length < MAX_LINES_PER_PAGE) {
      result.push("");
    }
  }

  return result.slice(0, MAX_LINES_PER_PAGE);
};

const sanitizePageLines = (linesOrText, options) => {
  if (Array.isArray(linesOrText)) {
    return sanitizePageValue(linesOrText.join("\n"), options);
  }
  return sanitizePageValue(linesOrText, options);
};

const sanitizePagesArray = (pages) => {
  if (!pages || !pages.length) {
    return [createEmptyPage()];
  }
  return pages.map((page) => sanitizePageLines(page, { pad: true }));
};

const serializePages = (pages) =>
  pages
    .map((lines) => lines.join("\n"))
    .join("\n");

const serializeBraContent = (pages) =>
  pages
    .map((lines) => lines.join("\n"))
    .join(`\n${BRA_PAGE_SEPARATOR}\n`);

const parseBraContent = (text) => {
  if (!text) {
    return [createEmptyPage()];
  }
  const normalized = text.replace(/\r/g, "");
  const rawPages = normalized.includes(BRA_PAGE_SEPARATOR)
    ? normalized.split(BRA_PAGE_SEPARATOR)
    : null;

  if (rawPages && rawPages.length > 1) {
    const parsed = rawPages
      .map((pageText) => pageText.replace(/^\n+/, "").replace(/\n+$/, ""))
      .map((pageText) => sanitizePageValue(pageText, { pad: true }));
    return parsed.length ? parsed : [createEmptyPage()];
  }

  const allLines = normalized.split("\n");
  const chunked = [];
  for (let i = 0; i < allLines.length; i += MAX_LINES_PER_PAGE) {
    const chunk = allLines.slice(i, i + MAX_LINES_PER_PAGE).join("\n");
    chunked.push(sanitizePageValue(chunk, { pad: true }));
  }
  return chunked.length ? chunked : [createEmptyPage()];
};

const deserializePages = (text) => {
  const normalized = typeof text === "string" ? text.replace(/\r/g, "") : "";
  const rawLines =
    normalized.length > 0 ? normalized.split("\n") : [""];
  const pages = [];
  let currentLines = [];

  rawLines.forEach((line) => {
    const segments = splitLine(line);
    segments.forEach((segment) => {
      if (currentLines.length === MAX_LINES_PER_PAGE) {
        pages.push(sanitizePageValue(currentLines.join("\n"), { pad: true }));
        currentLines = [];
      }
      currentLines.push(segment);
    });
  });

  if (!pages.length && currentLines.length === 0) {
    return [createEmptyPage()];
  }

  if (currentLines.length > 0 || !pages.length) {
    pages.push(sanitizePageValue(currentLines.join("\n"), { pad: true }));
  }

  return pages.length ? pages : [createEmptyPage()];
};

const PrinterPanel = ({
  value,
  onChange,
  arduinoPort,
  arduinoStatus,
  arduinoError,
  onDetectDevice,
  onDisconnectDevice,
  detectButtonDisabled,
  statusLabel,
  onPrint,
  printDisabled,
  logs,
  onClearLogs,
}) => {
  const [pages, setPages] = useState(() => deserializePages(value || ""));
  const [activePage, setActivePage] = useState(0);
  const textareaRefs = useRef({});
  const [showLogs, setShowLogs] = useState(false);
  const lastSerializedRef = useRef(serializePages(pages));
  const importInputRef = useRef(null);

  useEffect(() => {
    const incomingPages = deserializePages(value || "");
    const incomingSerialized = serializePages(incomingPages);
    if (incomingSerialized !== lastSerializedRef.current) {
      lastSerializedRef.current = incomingSerialized;
      setPages(incomingPages);
      setActivePage((prev) =>
        Math.min(prev, Math.max(incomingPages.length - 1, 0))
      );
    }
  }, [value]);

  const toggleLogs = useCallback(() => {
    setShowLogs((prev) => !prev);
  }, []);

  const commitPages = useCallback(
    (updater, options = {}) => {
      setPages((prevPages) => {
        const draft =
          typeof updater === "function" ? updater(prevPages) : updater;
        const normalized = sanitizePagesArray(draft);
        const serialized = serializePages(normalized);
        if (serialized !== lastSerializedRef.current) {
          lastSerializedRef.current = serialized;
          if (onChange) {
            onChange(serialized);
          }
        }

        const desiredActive =
          typeof options.nextActivePage === "function"
            ? options.nextActivePage(prevPages, normalized)
            : typeof options.nextActivePage === "number"
            ? options.nextActivePage
            : null;

        setActivePage((prevActive) => {
          const unclamped =
            desiredActive !== null
              ? desiredActive
              : Math.min(prevActive, normalized.length - 1);
          return Math.min(
            Math.max(unclamped, 0),
            Math.max(normalized.length - 1, 0)
          );
        });

        return normalized;
      });
    },
    [onChange]
  );

  const applySanitizedUpdate = useCallback(
    (
      pageIndex,
      { rawValue, selectionStart, selectionEnd, scrollTop, windowScroll }
    ) => {
      const sanitizedLines = sanitizePageValue(rawValue, { pad: true });
      const sanitizedValue = sanitizedLines.join("\n");
      const prefixStart = sanitizePageValue(rawValue.slice(0, selectionStart), {
        pad: false,
      }).join("\n");
      const prefixEnd = sanitizePageValue(rawValue.slice(0, selectionEnd), {
        pad: false,
      }).join("\n");

      commitPages(
        (prevPages) => {
          const next = [...prevPages];
          next[pageIndex] = sanitizedLines;
          return next;
        },
        { nextActivePage: pageIndex }
      );

      requestAnimationFrame(() => {
        const textarea = textareaRefs.current[pageIndex];
        if (!textarea) {
          console.warn(
            "[PrinterPanel] applySanitizedUpdate:textarea-missing",
            pageIndex
          );
          return;
        }
        if (typeof scrollTop === "number") {
          textarea.scrollTop = scrollTop;
        }
        const nextStart = Math.min(prefixStart.length, sanitizedValue.length);
        const nextEnd = Math.min(prefixEnd.length, sanitizedValue.length);
        textarea.setSelectionRange(nextStart, nextEnd);
        if (windowScroll) {
          window.scrollTo(windowScroll.x, windowScroll.y);
        }
      });
    },
    [commitPages]
  );

  const handlePageChange = useCallback(
    (pageIndex, event) => {
      const target = event.target;
      const windowScroll = {
        x: window.scrollX,
        y: window.scrollY,
      };
      applySanitizedUpdate(pageIndex, {
        rawValue: target.value,
        selectionStart: target.selectionStart,
        selectionEnd: target.selectionEnd,
        scrollTop:
          typeof target.scrollTop === "number" ? target.scrollTop : undefined,
        windowScroll,
      });
    },
    [applySanitizedUpdate]
  );

  const handleAddPage = useCallback(() => {
    commitPages(
      (prevPages) => [...prevPages, createEmptyPage()],
      {
        nextActivePage: (prevPages) => prevPages.length,
      }
    );
  }, [commitPages]);

  const handleRemovePageSafe = useCallback(() => {
    if (pages.length <= 1) {
      return;
    }
    commitPages(
      (prevPages) => {
        if (prevPages.length <= 1) {
          return prevPages;
        }
        const next = prevPages.slice();
        next.splice(activePage, 1);
        return next.length ? next : [createEmptyPage()];
      },
      {
        nextActivePage: (_prev, nextPages) =>
          Math.min(activePage, nextPages.length - 1),
      }
    );
  }, [activePage, commitPages, pages.length]);

  const goToPreviousPage = useCallback(() => {
    setActivePage((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToNextPage = useCallback(() => {
    setActivePage((prev) => Math.min(prev + 1, pages.length - 1));
  }, [pages.length]);

  const noop = useCallback(() => {}, []);

  const handleExportBra = useCallback(() => {
    const braContent = serializeBraContent(pages);
    const blob = new Blob([braContent], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "documento.bra";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [pages]);

  const handleImportBraClick = useCallback(() => {
    if (importInputRef.current) {
      importInputRef.current.click();
    }
  }, []);

  const handleImportBraFile = useCallback(
    (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        const importedPages = parseBraContent(text);
        commitPages(() => importedPages, { nextActivePage: 0 });
        if (importInputRef.current) {
          importInputRef.current.value = "";
        }
      };
      reader.readAsText(file, "utf-8");
    },
    [commitPages]
  );

  useEffect(() => {
    const textarea = textareaRefs.current[activePage];
    if (textarea) {
      textarea.focus({ preventScroll: true });
    }
  }, [activePage, pages.length]);

  const currentLines = pages[activePage] || createEmptyPage();
  const pageValue = currentLines.join("\n");
  const canRemovePage = pages.length > 1;
  const actionButtonBase =
    "min-w-[150px] px-4 py-2 rounded-full text-sm md:text-base font-medium transition-transform duration-200 hover:scale-105 shadow text-center";

  const setTextareaRef = useCallback(
    (pageIndex, element) => {
      if (!textareaRefs.current) {
        textareaRefs.current = {};
      }
      if (element) {
        textareaRefs.current[pageIndex] = element;
      } else if (textareaRefs.current[pageIndex]) {
        delete textareaRefs.current[pageIndex];
      }
    },
    []
  );

  return (
    <div className="flex flex-col items-center gap-10 w-full">
      <div className="w-full max-w-[900px] bg-white border border-gray-200 rounded-2xl shadow-md px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPreviousPage}
            disabled={activePage === 0}
            className="px-4 py-2 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-slate-600 text-sm md:text-base font-medium">
            Hoja {activePage + 1} de {pages.length}
          </span>
          <button
            type="button"
            onClick={goToNextPage}
            disabled={activePage === pages.length - 1}
            className="px-4 py-2 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
        <div className="flex flex-wrap gap-2 justify-end flex-1">
          <button
            type="button"
            onClick={handleAddPage}
            className={`${actionButtonBase} bg-green-500 text-white hover:bg-green-600`}
          >
            Agregar hoja
          </button>
          <button
            type="button"
            onClick={canRemovePage ? handleRemovePageSafe : noop}
            disabled={!canRemovePage}
            className={`${actionButtonBase} bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            Eliminar hoja
          </button>
          <button
            type="button"
            onClick={handleExportBra}
            className={`${actionButtonBase} bg-blue-500 text-white hover:bg-blue-600`}
          >
            Exportar .bra
          </button>
          <button
            type="button"
            onClick={handleImportBraClick}
            className={`${actionButtonBase} bg-indigo-500 text-white hover:bg-indigo-600`}
          >
            Importar .bra
          </button>
          <button
            className={`${actionButtonBase} ${
              arduinoPort
                ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                : "bg-purple-500 hover:bg-purple-700 text-white"
            } disabled:opacity-60 disabled:cursor-not-allowed`}
            onClick={arduinoPort ? onDisconnectDevice : onDetectDevice}
            disabled={detectButtonDisabled}
          >
            {arduinoPort
              ? "Desconectar dispositivo"
              : arduinoStatus === "buscando"
              ? "Buscando..."
              : "Detectar dispositivo"}
          </button>
          <button
            type="button"
            onClick={onPrint}
            disabled={printDisabled}
            className={`${actionButtonBase} bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            Imprimir
          </button>
          <button
            type="button"
            onClick={toggleLogs}
            className={`${actionButtonBase} bg-slate-100 text-slate-700 hover:bg-slate-200`}
          >
            {showLogs ? "Ocultar consola" : "Mostrar consola"}
          </button>
          {showLogs && (
            <button
              type="button"
              onClick={onClearLogs}
              className={`${actionButtonBase} bg-slate-100 text-slate-700 hover:bg-slate-200`}
            >
              Limpiar consola
            </button>
          )}
        </div>
      </div>
      <div className="text-sm text-gray-600">
        <p>{statusLabel}</p>
        {arduinoError && <p className="text-red-500 mt-1">{arduinoError}</p>}
      </div>
      {showLogs && (
        <div className="w-full max-w-[900px] bg-white border border-gray-200 rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-semibold text-slate-700">Consola Arduino</h3>
            <span className="text-xs text-slate-400">
              Últimos {logs ? logs.length : 0} eventos
            </span>
          </div>
          <div className="h-48 overflow-y-auto bg-slate-900 text-slate-100 rounded-md p-3 font-mono text-xs space-y-2">
            {logs && logs.length ? (
              logs.map((log) => (
                <div key={log.id} className="whitespace-pre-wrap">
                  <span className="text-slate-500 mr-2">
                    {log.timestamp
                      ? new Date(log.timestamp).toLocaleTimeString()
                      : ""}
                  </span>
                  <span
                    className={
                      log.type === "error"
                        ? "text-red-300"
                        : log.type === "warning"
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-slate-500">Sin eventos registrados.</div>
            )}
          </div>
        </div>
      )}
      <div className="bg-white shadow-2xl border border-gray-200 rounded-lg w-full max-w-[900px] p-10">
        <div
          className="flex gap-4 h-full"
          style={{
            height: `${PAGE_HEIGHT_REM}rem`,
            fontSize: `${FONT_SIZE_REM}rem`,
            backgroundImage: `repeating-linear-gradient(to bottom, #e5e7eb, #e5e7eb 1px, transparent 1px, transparent ${LINE_STEP_REM}rem)`,
            backgroundSize: `100% ${LINE_STEP_REM}rem`,
            backgroundPosition: "top left",
          }}
        >
          <div
            className="grid font-mono text-lg tabular-nums select-none h-full"
            style={{
              gridTemplateRows: `repeat(${MAX_LINES_PER_PAGE}, 1fr)`,
              paddingTop: `${TEXTAREA_PADDING_Y_REM}rem`,
              paddingBottom: `${TEXTAREA_PADDING_Y_REM}rem`,
              paddingRight: "0.75rem",
              fontSize: `${FONT_SIZE_REM * 0.65}rem`,
            }}
            aria-hidden="true"
          >
            {currentLines.map((line, lineIndex) => {
              const isUsed = line.trim().length > 0;
              return (
                <span
                  key={`line-number-${activePage}-${lineIndex}`}
                  className={`flex items-center justify-end ${
                    isUsed ? "text-slate-600 font-semibold" : "text-slate-300"
                  }`}
                  style={{
                    lineHeight: `${LINE_HEIGHT_EM}em`,
                  }}
                >
                  {String(lineIndex + 1).padStart(2, "0")}
                </span>
              );
            })}
          </div>
          <textarea
            className="flex-1 h-full resize-none bg-transparent outline-none text-slate-800"
            ref={(element) => setTextareaRef(activePage, element)}
            value={pageValue}
            spellCheck={false}
            wrap="off"
            onChange={(event) => handlePageChange(activePage, event)}
            style={{
              fontFamily:
                '"Fira Code", "Source Code Pro", "Courier New", monospace',
              fontSize: `${FONT_SIZE_REM}rem`,
              lineHeight: LINE_HEIGHT_EM,
              letterSpacing: `${LETTER_SPACING_EM}em`,
              padding: `${TEXTAREA_PADDING_Y_REM}rem ${TEXTAREA_PADDING_X_REM}rem`,
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const { selectionStart, selectionEnd, value: currentValue } =
                  event.target;
                const previousScrollTop =
                  typeof event.target.scrollTop === "number"
                    ? event.target.scrollTop
                    : undefined;
                const windowScroll = {
                  x: window.scrollX,
                  y: window.scrollY,
                };
                const prefix = currentValue.slice(0, selectionStart);
                const suffix = currentValue.slice(selectionEnd);
                const updatedValue = `${prefix}\n${suffix}`;

                applySanitizedUpdate(activePage, {
                  rawValue: updatedValue,
                  selectionStart: selectionStart + 1,
                  selectionEnd: selectionStart + 1,
                  scrollTop: previousScrollTop,
                  windowScroll,
                });
              }
            }}
          />
        </div>
        <div className="mt-4 text-right text-sm text-gray-500">
          Página {activePage + 1}
        </div>
      </div>
      <input
        ref={importInputRef}
        type="file"
        accept=".bra,text/plain"
        className="hidden"
        onChange={handleImportBraFile}
      />
    </div>
  );
};

PrinterPanel.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  arduinoPort: PropTypes.object,
  arduinoStatus: PropTypes.string,
  arduinoError: PropTypes.string,
  onDetectDevice: PropTypes.func,
  onDisconnectDevice: PropTypes.func,
  detectButtonDisabled: PropTypes.bool,
  statusLabel: PropTypes.string,
  onPrint: PropTypes.func,
  printDisabled: PropTypes.bool,
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      message: PropTypes.string.isRequired,
      type: PropTypes.string,
      timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    })
  ),
  onClearLogs: PropTypes.func,
};

export default PrinterPanel;
