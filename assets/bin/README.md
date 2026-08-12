# Binarios embebidos del frontend

Esta carpeta documenta los binarios que la configuración de `electron-builder` espera copiar dentro de la aplicación empaquetada.

## Estado actual

El `package.json` del frontend contiene:

```json
"extraResources": [
  {
    "from": "assets/bin/win",
    "to": "bin",
    "filter": ["**/*"]
  },
  {
    "from": "ocr/ocr.exe",
    "to": "ocr/ocr.exe"
  }
]
```

Por tanto, para que `npm run build:win` sea reproducible deben existir, como mínimo:

```text
Frontend/assets/bin/win/
Frontend/ocr/ocr.exe
```

Además, el proceso principal de Electron tiene lógica para localizar:

```text
assets/bin/win/tesseract/tesseract.exe
assets/bin/win/tesseract/tessdata/
assets/bin/win/poppler/pdftoppm.exe
ocr/ocr.exe
```

## Importante

En el flujo principal actual, el análisis de documentos se realiza enviando el archivo al backend, que procesa visualmente con OpenAI. El OCR local (`ocr.exe`) queda como compatibilidad/histórico para flujos que llamen a `ocr-document`.

No asumas que el build funcionará desde un clon limpio si estos binarios no se descargan o versionan previamente.

## Estructura esperada si se mantiene OCR local

```text
assets/bin/win/
  tesseract/
    tesseract.exe
    tessdata/
      spa.traineddata
    *.dll
  poppler/
    pdftoppm.exe
    *.dll

ocr/
  ocr.exe
```

## Licencias

Antes de redistribuir binarios de terceros, revisar y conservar sus licencias:

- Tesseract OCR
- Leptonica y DLLs relacionadas
- Poppler y DLLs relacionadas
- Cualquier runtime necesario por `ocr.exe`

## Recomendación para CI/release

Elegir una estrategia clara:

1. Versionar los binarios permitidos si el tamaño/licencia lo permite.
2. Descargarlos desde un almacenamiento controlado durante el workflow.
3. Empaquetarlos como artefacto privado previo.
4. Eliminar `extraResources` y código de OCR local si ya no se usa.

El workflow `.github/workflows/release.yml` debe garantizar que estos recursos existen antes de ejecutar `npm run build:win`.