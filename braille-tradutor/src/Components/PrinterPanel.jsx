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

const debug = false

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
  onBlink,
}) => {
  const [pages, setPages] = useState(() => deserializePages(value || ""));
  const [activePage, setActivePage] = useState(0);
  const textareaRefs = useRef({});
  const lastSerializedRef = useRef(serializePages(pages));

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
      if(debug) console.log("[PrinterPanel] applySanitizedUpdate:start", {
        pageIndex,
        rawValueLength: rawValue.length,
        selectionStart,
        selectionEnd,
        scrollTop,
        windowScroll,
      });
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
          if(debug) console.log("[PrinterPanel] applySanitizedUpdate:commit", {
            pageIndex,
            sanitizedValueLength: sanitizedValue.length,
          });
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
        if(debug) console.log("[PrinterPanel] applySanitizedUpdate:restore", {
          pageIndex,
          nextStart,
          nextEnd,
          sanitizedValueLength: sanitizedValue.length,
          finalScrollTop: textarea.scrollTop,
          windowScrollRestored: windowScroll,
        });
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
      if(debug) console.log("[PrinterPanel] handlePageChange", {
        pageIndex,
        valueLength: target.value.length,
        selectionStart: target.selectionStart,
        selectionEnd: target.selectionEnd,
        scrollTop: target.scrollTop,
        windowScroll,
      });
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

  useEffect(() => {
    const textarea = textareaRefs.current[activePage];
    if (textarea) {
      textarea.focus({ preventScroll: true });
    }
  }, [activePage, pages.length]);

  const currentLines = pages[activePage] || createEmptyPage();
  const pageValue = currentLines.join("\n");
  const canRemovePage = pages.length > 1;

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddPage}
            className="px-4 py-2 rounded-full bg-green-500 text-white text-sm md:text-base hover:bg-green-600 transition-transform duration-200 hover:scale-105 shadow"
          >
            Agregar hoja
          </button>
          <button
            type="button"
            onClick={canRemovePage ? handleRemovePageSafe : noop}
            disabled={!canRemovePage}
            className="px-4 py-2 rounded-full bg-red-500 text-white text-sm md:text-base hover:bg-red-600 transition-transform duration-200 hover:scale-105 shadow disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Eliminar hoja
          </button>
        </div>
      </div>

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
                if(debug) console.log("[PrinterPanel] keyDown:Enter", {
                  selectionStart,
                  selectionEnd,
                  previousScrollTop,
                  windowScroll,
                });
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
      <div className="w-full max-w-[900px] flex flex-col gap-4">
        <button
          className={`${
            arduinoPort
              ? "bg-yellow-500 hover:bg-yellow-600"
              : "bg-purple-500 hover:bg-purple-700"
          } text-white py-2 px-5 rounded-full text-lg transition-transform duration-200 hover:scale-105 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed`}
          onClick={arduinoPort ? onDisconnectDevice : onDetectDevice}
          disabled={detectButtonDisabled}
        >
          {arduinoPort
            ? "Desconectar dispositivo"
            : arduinoStatus === "buscando"
            ? "Buscando..."
            : "Detectar dispositivo"}
        </button>
        {arduinoPort && onBlink && (
          <button
            className="bg-gray-500 text-white py-2 px-5 rounded-full text-lg hover:bg-gray-700 transition-transform duration-200 hover:scale-105 shadow-lg"
            onClick={onBlink}
          >
            Parpadear LED
          </button>
        )}
        <div className="text-sm text-gray-600">
          <p>{statusLabel}</p>
          {arduinoError && <p className="text-red-500 mt-1">{arduinoError}</p>}
        </div>
      </div>
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
  onBlink: PropTypes.func,
};

export default PrinterPanel;
