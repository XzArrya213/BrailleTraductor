#include <Arduino.h>
#include <AccelStepper.h>
#include <math.h>
#include <EEPROM.h>
#include "brailleMap.h"

// ---------------- Protocolo ----------------
const uint8_t ACK = 0x06;  // Acknowledge
const uint8_t NAK = 0x15;  // Negative Acknowledge
const uint8_t EOT = 0x04;  // End of Transmission
const uint8_t FEED_CHAR = 0x05; // ENQ -> petición de jalar papel (feed)

// ---------------- Pines ----------------
#define SOL_PIN    A3
#define CARRO_STEP 2 // X
#define CARRO_DIR  5
#define PAPEL_STEP 3 // Y
#define PAPEL_DIR  6
#define EN_PIN     8

// Golpe del punto
const uint16_t DOT_ON_MS   = 70; 
const uint16_t DOT_OFF_MS  = 70;

// Velocidades (pasos/seg)
const int CARRO_SPEED      = 900;   // impresión
const int PAPEL_SPEED      = 100;
const int CARRO_SPEED_CAL  = CARRO_SPEED / 2; // calibración
const int PAPEL_SPEED_CAL  = PAPEL_SPEED / 2;

// ---------------- Geometría braille (norma) ----------------
// a = 2,5 mm, b = 2,5 mm, c = 6 mm, d = 10 mm
const float BRAILLE_A_MM          = 2.5f;  // distancia horizontal entre columnas de puntos
const float BRAILLE_B_MM          = 2.5f;  // distancia vertical entre filas de puntos
const float BRAILLE_C_MM          = 6.0f;  // distancia entre centros de puntos idénticos de celdas contiguas
const float BRAILLE_D_MM          = 10.0f; // interlineado
const float BRAILLE_CELL_W_MM     = 4.0f;
const float BRAILLE_CELL_H_MM     = 6.5f;

// ---------------- Mecánica del papel ----------------
// Eje X: calibración de 0 (derecha) a tope izquierdo ≈ 18,5 cm
const float CARRO_TRAVEL_MM       = 185.0f;

// Eje Y: dato medido -> 100 pasos = 10,1 cm = 101 mm
const float PAPEL_TRAVEL_MM       = 101.0f;
const float PAPEL_TRAVEL_STEPS    = 100.0f;

// Distancia fija entre línea del punzón y línea de contacto del rodillo
const float ROLLER_TO_PUNCH_MM    = 77.5f; // 7,75 cm

// Calibración X
long  calibXDistance = 0;   // pasos desde 0 hasta el límite mecánico en X
float stepsPerMmX    = 0.0f;
float stepsPerMmY    = 0.0f;

// Estado de impresión
// Convención eje X:
//   X = 0   -> margen derecho de la página (inicio de línea)
//   X < 0   -> hacia la izquierda (dirección de impresión)
int currentColumn = 0;      // número de celdas impresas en la línea actual

enum Axis { CARRO_AXIS, PAPEL_AXIS };

// Prototipos
void handleEndLine();
void handleEndPage();
void handleEndJob();
void processBin(const char* bin);

void moveMm(Axis axis, float mm);
long mmToStepsX(float mm);
long mmToStepsY(float mm);
void firePunch(char bit);
void waitAll();

void runCalibrationX();
void feedPaperToRoller();

// Motores paso a paso
AccelStepper stepCarro(AccelStepper::DRIVER, CARRO_STEP, CARRO_DIR);
AccelStepper stepPapel(AccelStepper::DRIVER, PAPEL_STEP, PAPEL_DIR);


// ----------------- SETUP -----------------
void setup() {
  Serial.begin(115200);
  while (!Serial) {}

  pinMode(SOL_PIN, OUTPUT);
  pinMode(EN_PIN, OUTPUT);
  digitalWrite(EN_PIN, LOW);

  stepCarro.setMaxSpeed(CARRO_SPEED);
  stepCarro.setAcceleration(CARRO_SPEED);

  stepPapel.setMaxSpeed(PAPEL_SPEED);
  stepPapel.setAcceleration(PAPEL_SPEED);

  // Suponemos que físicamente arrancas en el margen derecho (home)
  stepCarro.setCurrentPosition(0);

  // Cargar calibración de X desde EEPROM
  EEPROM.get(0, calibXDistance);
  if (calibXDistance <= 0) {
    Serial.println(F("Calibración X no encontrada. Ejecuta 'calibration' antes de imprimir."));
    stepsPerMmX = 0.0f;
  } else {
    stepsPerMmX = (float)calibXDistance / CARRO_TRAVEL_MM;
    Serial.print(F("Calibración X: "));
    Serial.print(calibXDistance);
    Serial.print(F(" pasos / "));
    Serial.print(CARRO_TRAVEL_MM);
    Serial.print(F(" mm => "));
    Serial.print(stepsPerMmX);
    Serial.println(F(" pasos/mm"));
  }

  // Escala fija para Y con tu dato: 100 pasos = 10,1 cm
  stepsPerMmY = PAPEL_TRAVEL_STEPS / PAPEL_TRAVEL_MM;
  Serial.print(F("Escala eje Y: "));
  Serial.print(stepsPerMmY);
  Serial.println(F(" pasos/mm (a partir de 100 pasos = 10,1 cm)"));

  currentColumn = 0;

  Serial.println(F("READY"));
}


// ----------------- LOOP -----------------
//
// Línea por serie:
//  - "calibration" -> modo calibración X
//  - "feed"        -> jalar papel 7,75 cm (punzón -> rodillo)
//  - cualquier otra línea = texto a imprimir en una línea braille
//
void loop() {
  // Procesamiento por bytes: soporta un carácter especial para "feed" y
  // el carácter '#' para terminar el trabajo. Los caracteres imprimibles
  // se procesan inmediatamente (para permitir que la app envíe carácter
  // por carácter y espere ACK por cada uno).
  if (!Serial.available()) return;

  while (Serial.available()) {
    int b = Serial.read();
    if (b < 0) continue;

    if ((uint8_t)b == FEED_CHAR) {
      feedPaperToRoller();
      Serial.write(ACK);
      continue;
    }

    if ((uint8_t)b == '#') {
      handleEndJob();
      Serial.write(ACK);
      continue;
    }

    if ((uint8_t)b == EOT) {
      handleEndJob();
      Serial.write(ACK);
      continue;
    }

    char c = (char)b;
    if (c == '\r') {
      // ignorar CR
      continue;
    }

    if (c == '\n') {
      // fin de línea lógico
      handleEndLine();
      Serial.write(ACK);
      continue;
    }

    if (c == '\f') {
      handleEndPage();
      Serial.write(ACK);
      continue;
    }

    const char* bin = getBinary(c);
    if (bin) {
      processBin(bin);
      Serial.write(ACK);
    } else {
      Serial.write(NAK);
    }
  }
}


// ============== MODO CALIBRACIÓN X ==============
//
// Carro en 0 (derecha), se mueve hacia la izquierda (negativo) hasta que el
// usuario escribe 'fin' por serie. Luego vuelve a 0 y guarda distancia.
//
void runCalibrationX() {
  Serial.println(F("[CALIBRATION MODE X]"));

  stepCarro.setMaxSpeed(CARRO_SPEED_CAL);
  stepCarro.setAcceleration(CARRO_SPEED_CAL);
  stepPapel.setMaxSpeed(PAPEL_SPEED_CAL);
  stepPapel.setAcceleration(PAPEL_SPEED_CAL);

  stepCarro.setCurrentPosition(0);

  Serial.println(F("Moviendo carro hacia la izquierda..."));
  Serial.println(F("Escribe 'fin' cuando llegue al tope mecánico."));

  stepCarro.moveTo(-1000000L); // muy negativo: hacia la izquierda

  while (true) {
    stepCarro.run();

    if (Serial.available()) {
      String cmd = Serial.readStringUntil('\n');
      cmd.trim();
      if (cmd.equalsIgnoreCase("fin")) {
        break;
      }
    }
  }

  calibXDistance = labs(stepCarro.currentPosition());
  Serial.print(F("Distancia X registrada: "));
  Serial.print(calibXDistance);
  Serial.println(F(" pasos"));

  EEPROM.put(0, calibXDistance);
  Serial.println(F("Guardado en EEPROM."));

  stepsPerMmX = (float)calibXDistance / CARRO_TRAVEL_MM;
  Serial.print(F("Nueva escala X: "));
  Serial.print(stepsPerMmX);
  Serial.println(F(" pasos/mm"));

  stepCarro.moveTo(0);
  while (stepCarro.distanceToGo() != 0) {
    stepCarro.run();
  }

  stepCarro.setMaxSpeed(CARRO_SPEED);
  stepCarro.setAcceleration(CARRO_SPEED);
  stepPapel.setMaxSpeed(PAPEL_SPEED);
  stepPapel.setAcceleration(PAPEL_SPEED);

  Serial.println(F("[CALIBRATION DONE]"));
}


// ============== FUNCIÓN DE JALAR PAPEL ==============
//
// Recorremos la distancia fija punzón–rodillo para que el papel
// quede sujeto por el rodillo.
//
void feedPaperToRoller() {
  moveMm(PAPEL_AXIS, ROLLER_TO_PUNCH_MM);
  Serial.println(F("[FEED] Papel jalado hasta el rodillo"));
}


// ============== IMPRESIÓN BRAILLE ==============
//
// Convención local dentro de la celda:
// Tomamos el origen (0,0) en el PUNTO 4 (columna derecha, fila superior).
// Coordenadas (mm) de cada punto respecto a ese origen:
//  P4: (  0,   0)
//  P5: (  0,   b)
//  P6: (  0,  2b)
//  P1: ( -a,   0)
//  P2: ( -a,   b)
//  P3: ( -a,  2b)
//
// De esta forma la celda vive "hacia la izquierda" (X negativo) tal y como
// imprimimos de derecha a izquierda.
//
void processBin(const char* bin) {

  static const float DOT_X_MM[6] = {
    0.0f,          // bin[0] -> columna DERECHA, fila superior  (P4)
    0.0f,          // bin[1] -> columna DERECHA, fila media    (P5)
    0.0f,          // bin[2] -> columna DERECHA, fila inferior (P6)
    -BRAILLE_A_MM, // bin[3] -> columna IZQUIERDA, fila sup.   (P1)
    -BRAILLE_A_MM, // bin[4] -> columna IZQUIERDA, fila media  (P2)
    -BRAILLE_A_MM  // bin[5] -> columna IZQUIERDA, fila inf.   (P3)
  };

  static const float DOT_Y_MM[6] = {
    0.0f,                 // punto 1 / 4
    BRAILLE_B_MM,         // punto 2 / 5
    2.0f * BRAILLE_B_MM,  // punto 3 / 6
    0.0f,
    BRAILLE_B_MM,
    2.0f * BRAILLE_B_MM
  };

  // Posición absoluta de la celda actual en la línea
  float cellBaseXMm = -currentColumn * BRAILLE_C_MM;
  
  // Guardamos la posición Y al inicio de la celda
  long startYSteps = stepPapel.currentPosition();

  for (uint8_t i = 0; i < 6 && bin[i] != '\0'; ++i) {
    // Calculamos posición absoluta del punto
    float absoluteX = cellBaseXMm + DOT_X_MM[i];
    float absoluteY = DOT_Y_MM[i]; // relativo al inicio de la celda
    
    // Convertimos a pasos absolutos
    long targetXSteps = mmToStepsX(absoluteX);
    long targetYSteps = startYSteps + mmToStepsY(absoluteY);
    
    // Movemos a posición absoluta
    stepCarro.moveTo(targetXSteps);
    stepPapel.moveTo(targetYSteps);
    waitAll();

    firePunch(bin[i]);
  }

  // Volvemos al origen Y de la celda
  stepPapel.moveTo(startYSteps);
  waitAll();

  currentColumn++;

  Serial.println(F("Ending processing char"));
}


// ============== Conversión mm ↔ pasos ==============

long mmToStepsX(float mm) {
  if (stepsPerMmX <= 0.0f) return 0;
  return lroundf(mm * stepsPerMmX);   // mm>0 -> derecha, mm<0 -> izquierda
}

long mmToStepsY(float mm) {
  if (stepsPerMmY <= 0.0f) return 0;
  return lroundf(mm * stepsPerMmY);
}

void moveMm(Axis axis, float mm) {
  long steps = 0;
  if (axis == CARRO_AXIS) {
    steps = mmToStepsX(mm);
    if (steps == 0) return;
    stepCarro.move(steps);    // relativo
  } else { // PAPEL_AXIS
    steps = mmToStepsY(mm);
    if (steps == 0) return;
    stepPapel.move(steps);    // relativo
  }
  waitAll();
}


// ============== Golpe del punto ==============

void firePunch(char bit) {
  if (bit == '1') {
    Serial.print('.');
    digitalWrite(SOL_PIN, HIGH);
    delay(DOT_ON_MS);
    digitalWrite(SOL_PIN, LOW);
    delay(DOT_OFF_MS);
  } else {
    Serial.print('_');
    delay(DOT_ON_MS + DOT_OFF_MS);
  }
  Serial.print('\n');
}


// ============== Sincronización motores ==============

void waitAll() {
  digitalWrite(EN_PIN, LOW);
  while (stepCarro.distanceToGo() != 0 || stepPapel.distanceToGo() != 0) {
    stepCarro.run();
    stepPapel.run();
  }
}


// ============== Fin de línea / página / trabajo ==============

// Fin de línea: volver al margen derecho (X=0) y bajar una línea.
void handleEndLine() {
  // Después de imprimir 'currentColumn' celdas, estamos aproximadamente en
  // X = -currentColumn * BRAILLE_C_MM. Para volver a 0 hay que mover
  // +currentColumn * BRAILLE_C_MM (derecha).
  float backX = currentColumn * BRAILLE_C_MM;
    Serial.print(F("Interline move mm="));
  Serial.print(BRAILLE_D_MM);
  Serial.print(F("  stepsY="));
  Serial.println(mmToStepsY(BRAILLE_D_MM));

  if (fabs(backX) > 0.0001f) {
    moveMm(CARRO_AXIS, backX);
  }

  // Bajar a la siguiente línea (interlineado d)
  moveMm(PAPEL_AXIS, BRAILLE_D_MM);

  currentColumn = 0;

  Serial.println(F("[EOL]"));
}

void handleEndPage() {
  // Aquí podrías implementar expulsión total de la hoja si conoces la altura útil.
  currentColumn = 0;
  Serial.println(F("[EOP]"));
}

void handleEndJob() {
  currentColumn = 0;
  Serial.println(F("[EOJ]"));

  digitalWrite(EN_PIN, LOW);

  stepPapel.setSpeed(CARRO_SPEED);

  unsigned long start = millis();
  while (millis() - start < 2500UL){
    stepPapel.runSpeed();
  }

  stepPapel.setSpeed(0);
}