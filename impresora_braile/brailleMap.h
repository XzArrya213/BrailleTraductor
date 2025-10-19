#pragma once
#include <Arduino.h>
#include <avr/pgmspace.h>
#include <ctype.h>

struct BrailleBin {
  char letter;
  char bits[7]; // "xxxxxx" + '\0'
};

const BrailleBin BRAILLE_BIN_MAP[] PROGMEM = {
  {'a',"100000"}, {'b',"110000"}, {'c',"100100"}, {'d',"100110"}, {'e',"100010"},
  {'f',"110100"}, {'g',"110110"}, {'h',"110010"}, {'i',"010100"}, {'j',"010110"},
  {'k',"101000"}, {'l',"111000"}, {'m',"101100"}, {'n',"101110"}, {'o',"101010"},
  {'p',"111100"}, {'q',"111110"}, {'r',"111010"}, {'s',"011100"}, {'t',"011110"},
  {'u',"101001"}, {'v',"111001"}, {'w',"010111"}, {'x',"101101"}, {'y',"101111"},
  {'z',"101011"}, {' ',"000000"},
};

const uint8_t BRAILLE_BIN_MAP_LEN = sizeof(BRAILLE_BIN_MAP) / sizeof(BrailleBin);

inline const char* getBinary(char ch) {
  static char buf[7];  // "xxxxxx" + '\0'
  ch = tolower(static_cast<unsigned char>(ch));
  for (uint8_t i = 0; i < BRAILLE_BIN_MAP_LEN; ++i) {
    BrailleBin e;
    memcpy_P(&e, &BRAILLE_BIN_MAP[i], sizeof(BrailleBin));
    if (e.letter == ch) {
      memcpy(buf, e.bits, sizeof(e.bits));
      return buf;
    }
  }
  return nullptr;
}
