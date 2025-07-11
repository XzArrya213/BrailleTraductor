# Traductor Braille - Documentación del Proyecto

## ▫️Descripción General

Este sistema es una aplicación web desarrollada en React que permite traducir texto a Braille y viceversa, guardar traducciones, descargar documentos traducidos y utilizar entrada QWERTY para personas ciegas. Incluye autenticación de usuarios y almacenamiento de traducciones usando Firebase.

## ▫️Fuentes y tipos de datos

El sistema maneja diferentes tipos de datos:

- **Datos estructurados:** Usuarios y traducciones almacenados en Firebase.
- **Datos semiestructurados/no estructurados:** Archivos de texto cargados por el usuario en formatos PDF, DOCX y TXT.

Esto permite gestionar tanto la información de los usuarios como los documentos a traducir de manera eficiente y segura.

## ▫️Funcionalidades principales

- Traducción de texto a Braille y de Braille a texto.
- Traducción de documentos PDF, DOCX y TXT.
- Descarga de documentos traducidos en formato DOCX.
- Entrada de texto Braille mediante teclado QWERTY (combinaciones SDF JKL).
- Guardado y consulta de historial de traducciones por usuario.
- Autenticación de usuarios con Firebase.
- Interfaz accesible y responsiva.

## ▫️Estructura del Proyecto

- **src/Components/**: Componentes principales de la interfaz (Translator, Login, QwertyBraillePage, etc).
- **src/firebase/**: Configuración de Firebase (autenticación y base de datos).
- **backend/**: Lógica de servidor (si aplica, Node.js/Express).
- **public/**: Archivos estáticos e imágenes.

## ▫️Justificación de herramientas y bibliotecas para la interfaz

Para la construcción de la interfaz de usuario se eligieron **Material UI** y **Tailwind CSS** debido a las siguientes razones:

- **Material UI:** Permite crear componentes accesibles, modernos y consistentes, facilitando el desarrollo de una interfaz intuitiva y profesional.
- **Tailwind CSS:** Ofrece gran flexibilidad y rapidez en el diseño responsivo, permitiendo personalizar estilos de manera eficiente y mantener un código limpio.

Estas herramientas contribuyen a mejorar la experiencia del usuario, la accesibilidad y la mantenibilidad

## ▫️Endpoints y funcionalidades clave

Actualmente la lógica principal de traducción y autenticación se maneja en el frontend con React y Firebase. Si se usa backend, los endpoints típicos serían:

- `POST /api/login` - Iniciar sesión de usuario.
- `POST /api/translate` - Traducir texto a Braille o viceversa.
- `GET /api/translations` - Obtener historial de traducciones del usuario.

## ▫️Seguridad y autenticación

El sistema aplica principios de codificación segura mediante la validación de entradas en los formularios y en la carga de archivos, evitando así datos inválidos o potencialmente peligrosos. Todas las comunicaciones entre la aplicación y Firebase se realizan a través de HTTPS, lo que garantiza la confidencialidad e integridad de los datos transmitidos. Además, Firebase gestiona de forma segura las sesiones de usuario y el acceso a la base de datos, siguiendo buenas prácticas de seguridad.

Para la autenticación y el almacenamiento de datos, se utiliza Firebase, que implementa autenticación segura basada en tokens JWT y protocolos modernos. Esto asegura que solo los usuarios autenticados puedan acceder a sus traducciones y datos personales, cumpliendo con los estándares actuales de protección de

## ▫️Actualizaciones y mejoras implementadas

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

## ▫️Instalación y uso

1. Clona el repositorio.
2. Ejecuta `npm install` para instalar dependencias.
3. Ejecuta `npm start` para iniciar la aplicación en modo desarrollo.
4. Accede a [http://localhost:3000](http://localhost:3000) en tu navegador.

## ▫️Pruebas

Puedes ejecutar pruebas básicas con:

- **Pruebas unitarias:** Se recomienda implementar pruebas unitarias para funciones clave de traducción y manejo de archivos utilizando frameworks como Jest.
- **Pruebas de integración:** Verificación del flujo completo de traducción, autenticación y almacenamiento en Firebase.
- **Pruebas manuales:** Se han realizado pruebas manuales para validar la carga y traducción de archivos PDF, DOCX y TXT, así como la autenticación y el historial de traducciones.
- **Validación de interfaz:** Pruebas de usabilidad y accesibilidad en diferentes dispositivos y navegadores.

```
npm start
```

## ▫️Créditos y agradecimientos

Desarrollado por RENE DE JESUS RANGEL BUITRON Alumno de la Universidad Tecnologica de Salamanca Guanajuato y colaboradores. Basado en Create React App y usando Firebase, Material UI, Tailwind CSS y docx.
