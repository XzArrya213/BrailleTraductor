#include <Arduino.h>
#include <AccelStepper.h>
#include <math.h>
#include "brailleMap.h"

// Códigos de control / protocolo
const uint8_t ACK = 0x06;  // Acknowledge
const uint8_t NAK = 0x15;  // Negative Acknowledge
const uint8_t EOT = 0x04;  // End of Transmission

#define SOL_PIN A3
#define CARRO_STEP 2 // X
#define CARRO_DIR  5
#define PAPEL_STEP 3 // Y
#define PAPEL_DIR  6
#define EN_PIN 8

// Ajusta a tu mecánica
const uint16_t DOT_ON_MS   = 30;  // tiempo del golpe (solenoide activado)
const uint16_t DOT_OFF_MS  = 70;  // descanso entre puntos

enum Axis { CARRO_AXIS, PAPEL_AXIS }; // X, Y

// Prototipos
void handleEndLine();
void handleEndPage();
void handleEndJob();
void processBin(const char* bin);

void move(Axis axis, float steps);
void setHome();
void firePunch(int isFiring);
void wait_all();

// Motores paso a paso
AccelStepper stepCarro(AccelStepper::DRIVER, CARRO_STEP, CARRO_DIR);
AccelStepper stepPapel(AccelStepper::DRIVER, PAPEL_STEP, PAPEL_DIR);

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  Serial.println(F("READY"));
  pinMode(SOL_PIN, OUTPUT);
  
  pinMode(EN_PIN, OUTPUT);
  digitalWrite(EN_PIN, LOW);

  stepCarro.setMaxSpeed(4000); stepCarro.setAcceleration(2000);
  stepPapel.setMaxSpeed(4000); stepPapel.setAcceleration(2000);
}

void loop() {
  if (!Serial.available()) return;

  char c = (char)Serial.read();

  // Normaliza controles de fin de línea / página
  if (c == '\r') {
    // CR: ignóralo para no duplicar cuando venga CRLF desde Windows
    return;
  }

  if (c == '\n') {
    handleEndLine();
    Serial.write(ACK);
    return;
  }

  if (c == '\f') { // Form Feed = salto de página
    handleEndPage();
    Serial.write(ACK);
    return;
  }

  if((uint8_t)c == EOT) {
    handleEndJob();
    Serial.write(ACK);
    return;
  }

  // Cualquier otro carácter: procesar Braille
  const char* bin = getBinary(c);

  if (bin) {
    // Si quieres ver qué llegó:
    // Serial.println(bin);

    processBin(bin);
    Serial.write(ACK);
  } else {
    // Caracter no mapeado (acentos/UTF-8, etc.)
    Serial.write(NAK);
  }
}

// Procesa los 6 bits "000000" de la celda braille
void processBin(const char* bin) {
  for (uint8_t i = 0; i < 6 && bin[i] != '\0'; ++i) {

    firePunch(bin[i]);

    //End of row
    if(i == 2) {
      Serial.println("End of row, moving to next row");
      move(CARRO_AXIS, 1000);
      move(PAPEL_AXIS, 1000);
    }

    if(i == 5) {
      Serial.println("End of char, moving to nxt char");
      move(CARRO_AXIS, 1000);
      move(PAPEL_AXIS, 1000);
    }

  }

  Serial.println(F("Ending processing char"));
}

void move(Axis axis, float steps){
  long s = lroundf(steps);  // a entero de pasos
  if (s == 0) return;

  if (axis == CARRO_AXIS) {
    stepCarro.move(s);      // objetivo relativo
  } else { // PAPEL_AXIS
    stepPapel.move(s);
  }

  // Ejecuta ambos a la vez hasta terminar
  waitAll();

}

void setHome(){
  
}

void firePunch(char bit) {
  if (bit == '1') {
    Serial.print('.');
    // tone(SOL_PIN, 1000, 50);
    digitalWrite(SOL_PIN, HIGH);
    delay(DOT_ON_MS);
    digitalWrite(SOL_PIN, LOW);
    delay(DOT_OFF_MS);
  } else { // '0'
    Serial.print('_');
    delay(DOT_ON_MS + DOT_OFF_MS);
  }
  Serial.print('\n');
}


void waitAll(){
  digitalWrite(EN_PIN, LOW);
  while (stepCarro.distanceToGo() != 0 || stepPapel.distanceToGo() != 0) {
    stepCarro.run();
    stepPapel.run();
  }
}

// Acción especial para fin de línea
void handleEndLine() {
  // Mueve el "carro" al inicio de la siguiente línea, avanza papel, etc.
  // moveToNextLine();
  Serial.println(F("[EOL]"));
}

// Acción especial para fin de página
void handleEndPage() {
  // Rutina de salto de página: resetea coordenadas, avanza varias líneas, etc.
  // newPage();
  Serial.println(F("[EOP]"));
}

void handleEndJob() {
  Serial.println(F("[EOJ]"));
}
