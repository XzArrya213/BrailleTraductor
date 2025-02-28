//----- Selección de Elementos -----//
const entradaTexto = document.querySelector(".entrada-texto");
const btnTextoBra = document.querySelector(".btn-tbraille");
const brailleResult = document.querySelector(".braille-result");
const contenido = document.querySelector(".tarjeta-contenedor");
const btnBrailleText = document.querySelector(".btn-btexto");
const btnCopiar = document.querySelector(".btn-copiar");

function traductorTextoBra(texto) {
    const brailleNumeros = {
        '0': '⠼⠚', '1': '⠼⠁', '2': '⠼⠃', '3': '⠼⠉', '4': '⠼⠙', '5': '⠼⠑',
        '6': '⠼⠋', '7': '⠼⠛', '8': '⠼⠓', '9': '⠼⠊'
    };

    const brailleMap = {
        'a': '⠁', 'b': '⠃', 'c': '⠉', 'd': '⠙', 'e': '⠑', 'f': '⠋',
        'g': '⠛', 'h': '⠓', 'i': '⠊', 'j': '⠚', 'k': '⠅', 'l': '⠇',
        'm': '⠍', 'n': '⠝', 'o': '⠕', 'p': '⠏', 'q': '⠟', 'r': '⠗',
        's': '⠎', 't': '⠞', 'u': '⠥', 'v': '⠧', 'w': '⠺', 'x': '⠭',
        'y': '⠽', 'z': '⠵',
        'á': '⠷', 'é': '⠮', 'í': '⠌', 'ó': '⠬', 'ú': '⠾',
        'ü': '⠳', 'ñ': '⠻',
        '@': '⠩', '!': '⠖', '¡': '⠖', '?': '⠢', '¿': '⠢', ':': '⠒', '``': '⠦', '(': '⠣',
        ')': '⠜', '-': '⠤', ',': '⠂', ';': '⠰', '.': '⠲', '#': '⠼',
        ' ': ' ',
    };
    
    let enNumero = false;
    const resultadoBraille = Array.from(texto).map(caracter => {
        if(caracter === '\n') {
            return '<br>';
        } else if (brailleNumeros.hasOwnProperty(caracter)) {
            if(!enNumero) {
                enNumero = true;
                return brailleNumeros[caracter]; // '⠼'
            } else {
                enNumero = false;
                return brailleNumeros[caracter].replace('⠼', '');
            }
        } else if (brailleMap.hasOwnProperty(caracter.toLowerCase())) {
            return brailleMap[caracter.toLowerCase()];
        } else {
            return caracter;
        }
    })
    .join('');

    return resultadoBraille;
}

btnTextoBra.addEventListener('click', e => {
    e.preventDefault();
    let texto = entradaTexto.value;
    
    if (texto == '') {
        brailleResult.value = 'El campo de texto no debe estar vacío';
        contenido.remove();
    } else {
        const resultado = traductorTextoBra(texto);
        const resultadoConSaltosDeLinea = resultado.replace(/<br>/g, '\n');
        brailleResult.value = resultadoConSaltosDeLinea;
        btnCopiar.style.visibility = 'inherit';
        contenido.remove();
    }
});

function traductorBrailleText(texto) {
    const brailleNumeros = {
        '⠼⠚': '0', '⠼⠁': '1', '⠼⠃': '2', '⠼⠉': '3', '⠼⠙': '4', '⠼⠑': '5',
        '⠼⠋': '6', '⠼⠛': '7', '⠼⠓': '8', '⠼⠊': '9'
    };
    
    const brailleMap = {
        '⠁': 'a', '⠃': 'b', '⠉': 'c', '⠙': 'd', '⠑': 'e', '⠋': 'f',
        '⠛': 'g', '⠓': 'h', '⠊': 'i', '⠚': 'j', '⠅': 'k', '⠇': 'l',
        '⠍': 'm', '⠝': 'n', '⠕': 'o', '⠏': 'p', '⠟': 'q', '⠗': 'r',
        '⠎': 's', '⠞': 't', '⠥': 'u', '⠧': 'v', '⠺': 'w', '⠭': 'x',
        '⠽': 'y', '⠵': 'z',
        '⠷': 'á', '⠮': 'é', '⠌': 'í', '⠬': 'ó', '⠾': 'ú',
        '⠳': 'ü', '⠻': 'ñ',
        '⠩': '@', '⠖': '!', '⠢': '?', '⠒': ':', '⠦': '``', '⠣': '(',
        '⠜': ')', '⠤': '-', '⠂': ',', '⠰': ';', '⠲': '.', '⠼': '#',
        ' ': ' '
    };

    let enNumero = false;
    const resultadoBraille = Array.from(texto).map(caracter => {
        if(caracter === '\n') {
            return '<br>';
        } else if (brailleNumeros.hasOwnProperty(caracter)) {
            if(!enNumero) {
                enNumero = true;
                return brailleNumeros[caracter]; // '⠼'
            } else {
                enNumero = false;
                return brailleNumeros[caracter].replace('⠼', '');
            }
        } else if (brailleMap.hasOwnProperty(caracter.toLowerCase())) {
            return brailleMap[caracter.toLowerCase()];
        } else {
            return caracter;
        }
    })
    .join('');

    return resultadoBraille;
}

btnBrailleText.addEventListener('click', e => {
    e.preventDefault();
    let texto = entradaTexto.value;
    
    if (texto == '') {
        brailleResult.value = 'El campo de texto no debe estar vacío';
        contenido.remove();
    } else {
        const resultado = traductorBrailleText(texto);
        const resultadoConSaltosDeLinea = resultado.replace(/<br>/g, '\n');
        brailleResult.value = resultadoConSaltosDeLinea;
        btnCopiar.style.visibility = 'inherit';
        contenido.remove();
    }
});

btnCopiar.addEventListener('click', e => {
    e.preventDefault();
    let copiar = brailleResult;
    copiar.select();
    document.execCommand('copy');
});