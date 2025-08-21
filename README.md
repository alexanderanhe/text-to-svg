# Text-to-SVG (React + Vite)

Convierte texto a **paths SVG** con previsualización en `<canvas>`, búsqueda de fuentes (Google Fonts) y exportación sin “aire” (bounding box tight).

## 🚀 Stack
- React + Vite (TypeScript)
- OpenType.js (trazado de texto a paths)
- Tailwind CSS (estilos utilitarios)
- Google Fonts Web API (búsqueda/carga de fuentes)

## 📦 Requisitos
- Node.js 18+ (recomendado 18 LTS o 20 LTS)
- Una **API key** para Google Fonts (Google Cloud Console → habilita *Web Fonts Developer API* y crea una API key)

## 🔐 Variables de entorno

Crea un archivo **`.env`** en la raíz del proyecto:

```bash
# .env
VITE_GOOGLE_FONTS_KEY=tu_api_key_aqui
```

> Importante:
> - En Vite, las variables que empiezan con `VITE_` se exponen al cliente.
> - Esta API key accede a un API público de meta-datos de fuentes; trátala como *pública* (no sensible).

Incluye un **`.env.example`** para el repo:

```bash
# .env.example
VITE_GOOGLE_FONTS_KEY=
```

## 🛠️ Instalación

```bash
# 1) Instalar dependencias
npm install

# 2) Levantar entorno de desarrollo
npm run dev

# 3) Compilar para producción
npm run build

# 4) Previsualizar build
npm run preview
```

## ✨ Funcionalidades principales
- **Búsqueda de fuentes** (Google Fonts) con atajo **⌘/Ctrl + K** para abrir el modal.
- **Previsualización** en `<canvas>` con auto-escalado:
  - Ajusta el texto al ancho/alto del canvas (ignora fontSize/padding fijos).
  - Opción de color de texto (`fill`) y fondo (`bg`) con **fondo transparente** opcional.
- **Exportación a SVG**:
  - Genera un único `<path>` con el texto (opentype.js).
  - *Bounding box* **“tight”** (sin márgenes).
  - Mantiene el color de texto y, si se elige, **rectángulo de fondo**.
- (Opcional) **Trazos a mano alzada** sobre el canvas y exportación conjunta en el SVG.

## 🧭 Uso

1. **Arranca el dev server**: `npm run dev`.
2. **Abre el modal de fuentes** con **⌘/Ctrl + K**.
   - Escribe para filtrar (case-insensitive).
   - Navega con **↑/↓, Home/End, PageUp/PageDown** y confirma con **Enter**.
3. Ajusta el **texto**, **lineHeight**, **fill**, **bg** o **transparencia**.
4. **Exporta** a SVG (bounding box tight y sin padding).

## ⌨️ Atajos de teclado
- **⌘/Ctrl + K**: abrir buscador de fuentes.
- **Esc**: cerrar modal.
- Dentro del modal:
  - **↓** desde el input salta a la lista.
  - **↑/↓** mueve la selección.
  - **Home/End** va al inicio/fin.
  - **PageUp/PageDown** desplaza por página.
  - **Enter** selecciona y cierra.

## 🧱 Estructura (sugerida)
```
src/
  components/
    KCmdKModal.tsx        # Modal/Command Palette (⌘/Ctrl+K)
  App.tsx
  main.tsx
```
> Los nombres/rutas pueden variar según tu organización; este es un ejemplo.

## 🐞 Solución de problemas

- **No aparecen todas las fuentes**  
  Verifica que `VITE_GOOGLE_FONTS_KEY` esté en `.env` y reinicia `npm run dev` tras crear/editar el archivo.


## 📄 Licencia
MIT.

## 🙌 Agradecimientos
- [OpenType.js] por el trazado a paths SVG.
- Google Fonts Web API por el catálogo de fuentes.
