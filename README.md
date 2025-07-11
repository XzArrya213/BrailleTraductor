# Traductor Braille - Documentación del Proyecto

## Descripción General

Este sistema es una aplicación web desarrollada en React que permite traducir texto a Braille y viceversa, guardar traducciones, descargar documentos traducidos y utilizar entrada QWERTY para personas ciegas. Incluye autenticación de usuarios y almacenamiento de traducciones usando Firebase.

## Funcionalidades principales

- Traducción de texto a Braille y de Braille a texto.
- Traducción de documentos PDF, DOCX y TXT.
- Descarga de documentos traducidos en formato DOCX.
- Entrada de texto Braille mediante teclado QWERTY (combinaciones SDF JKL).
- Guardado y consulta de historial de traducciones por usuario.
- Autenticación de usuarios con Firebase.
- Interfaz accesible y responsiva.

## Estructura del Proyecto

- **src/Components/**: Componentes principales de la interfaz (Translator, Login, QwertyBraillePage, etc).
- **src/firebase/**: Configuración de Firebase (autenticación y base de datos).
- **backend/**: Lógica de servidor (si aplica, Node.js/Express).
- **public/**: Archivos estáticos e imágenes.

## Endpoints y funcionalidades clave

Actualmente la lógica principal de traducción y autenticación se maneja en el frontend con React y Firebase. Si se usa backend, los endpoints típicos serían:

- `POST /api/login` - Iniciar sesión de usuario.
- `POST /api/translate` - Traducir texto a Braille o viceversa.
- `GET /api/translations` - Obtener historial de traducciones del usuario.

## Actualizaciones y mejoras implementadas

- Integración de Firebase para autenticación y almacenamiento de traducciones.
- Traducción de documentos PDF, DOCX y TXT.
- Descarga de documentos traducidos en formato DOCX.
- Entrada QWERTY para Braille (personas ciegas).
- Panel de historial de traducciones guardadas.
- Mejoras en la detección automática de texto Braille.
- Interfaz mejorada y responsiva con Material UI y Tailwind CSS.
- Manejo de errores y validaciones en carga de archivos y autenticación.
- Separación de componentes y lógica para facilitar el mantenimiento.
- Actualizaciones frecuentes y control de versiones en GitHub.

## Instalación y uso

1. Clona el repositorio.
2. Ejecuta `npm install` para instalar dependencias.
3. Ejecuta `npm start` para iniciar la aplicación en modo desarrollo.
4. Accede a [http://localhost:3000](http://localhost:3000) en tu navegador.

## Pruebas

Puedes ejecutar pruebas básicas con:

```
npm test
```

## Créditos y agradecimientos

Desarrollado por XzArrya213 y colaboradores. Basado en Create React App y usando Firebase, Material UI, Tailwind CSS y docx.
