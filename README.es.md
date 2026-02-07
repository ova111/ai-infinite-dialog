# AI Infinite Dialog

> **Sistema de retroalimentación AI Infinite Dialog** — Permite que la IA pregunte proactivamente al usuario si desea continuar después de completar una tarea, creando un verdadero ciclo de colaboración humano-IA.

Diseñado para el IDE **Windsurf**.

🌐 **Idioma**: [中文](README.md) | [English](README.en.md) | [Français](README.fr.md) | **Español**

---

## Características

### Características principales
- **Bucle de diálogo infinito**: La IA muestra automáticamente un panel de retroalimentación después de completar una tarea, el usuario elige "Continuar" o "Terminar"
- **Inyección de reglas globales**: Inyecta automáticamente reglas de comportamiento de IA en el IDE (estándares de codificación, flujo de consulta, etc.)
- **Servicio HTTP**: Servicio HTTP ligero integrado, la IA llama a la interfaz de retroalimentación mediante `curl`
- **Renderizado Markdown**: El panel de retroalimentación soporta completamente Markdown, resaltado de código y visualización de imágenes

### Características de gestión
- Panel de control en la barra lateral (iniciar/detener/reiniciar servicio)
- Visualización del estado del servicio en tiempo real
- Estadísticas de uso (conteo de llamadas, contadores de continuar/terminar)
- Visor de logs
- Exportar/importar configuración

### Características avanzadas
- Escaneo automático de puertos (evitar conflictos)
- Edición personalizada de reglas
- Atajos de teclado

## Cómo funciona

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    IA        │────▶│ Servidor    │────▶│  Panel de    │
│ (Cascade)    │     │ HTTP (3456) │     │  retro.      │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       │      Retroalimentación del usuario    │
       └───────────────────────────────────────┘
```

1. **La IA llama a la herramienta**: Después de completar una tarea, la IA llama a `infinite_dialog_feedback` vía HTTP
2. **El servicio procesa la solicitud**: El servicio HTTP de la extensión recibe la solicitud y muestra el panel de retroalimentación
3. **Muestra la respuesta**: El panel WebView renderiza la respuesta Markdown de la IA
4. **El usuario elige**: El usuario elige "Continuar" o "Terminar conversación"
5. **La retroalimentación vuelve a la IA**: La elección del usuario e instrucciones adicionales se devuelven a la IA mediante la respuesta HTTP

## Instalación

### Método 1: Instalar desde VSIX (Recomendado)

Descargue el último archivo `.vsix` desde la página de [Releases](https://github.com/ova111/ai-infinite-dialog/releases), luego:

```bash
code --install-extension ai-infinite-dialog-x.x.x.vsix
```

O en el IDE: `Ctrl+Shift+P` → `Install from VSIX...` → seleccione el archivo descargado.

### Método 2: Compilar desde el código fuente

```bash
git clone https://github.com/ova111/ai-infinite-dialog.git
cd ai-infinite-dialog
npm install
npm run package
# El archivo .vsix estará en la raíz del proyecto
```

### Método 3: Modo desarrollo

```bash
git clone https://github.com/ova111/ai-infinite-dialog.git
cd ai-infinite-dialog
npm install
npm run watch
# Presione F5 para iniciar la depuración
```

## Uso

### 1. Iniciar la extensión

La extensión se activa automáticamente al iniciar el IDE y:
- Inicia el servicio HTTP (puerto 3456 por defecto)
- Inyecta las reglas IA globales
- Muestra el estado del servicio en la barra de estado

### 2. Llamada automática de la IA

Cuando la IA completa una tarea, llama automáticamente a la herramienta `infinite_dialog_feedback`, mostrando el panel de retroalimentación.

### 3. Interacción del usuario

En el panel de retroalimentación:
- Vea la respuesta de la IA (renderizado Markdown + resaltado de código)
- Ingrese instrucciones adicionales (opcional)
- Suba/pegue imágenes (opcional)
- Haga clic en "Continuar" para continuar la conversación, o "Terminar" para detener

## Comandos

| Comando | Descripción |
|---------|-------------|
| `AI Dialog: Iniciar servidor MCP` | Iniciar manualmente el servicio HTTP |
| `AI Dialog: Detener servidor MCP` | Detener el servicio HTTP |
| `AI Dialog: Abrir configuración` | Abrir panel de configuración |
| `AI Dialog: Configurar IDE` | Reconfigurar IDE |
| `AI Dialog: Inyectar reglas globales` | Reinyectar reglas IA |
| `AI Dialog: Editar reglas` | Editar archivo de reglas IA |
| `AI Dialog: Ver logs` | Abrir panel de logs |
| `AI Dialog: Mostrar estado` | Ver estado del servicio |

## Atajos de teclado

| Atajo | Acción |
|-------|--------|
| `Cmd/Ctrl + Shift + D` | Abrir panel de configuración |
| `Cmd/Ctrl + Shift + S` | Iniciar servicio (cuando no está en ejecución) |
| `Ctrl/Cmd + Enter` | Continuar conversación (en panel de retroalimentación) |
| `Escape` | Terminar conversación (en panel de retroalimentación) |

## Configuración

Busque `ai-infinite-dialog` en la configuración del IDE:

| Ajuste | Tipo | Defecto | Descripción |
|--------|------|---------|-------------|
| `autoStart` | boolean | `true` | Inicio automático del servicio HTTP |
| `autoConfigureIDE` | boolean | `true` | Auto-configurar IDE |
| `autoInjectRules` | boolean | `true` | Auto-inyectar reglas IA globales |
| `serverPort` | number | `3456` | Puerto del servicio HTTP |
| `targetIDE` | string | `"windsurf"` | IDE destino |
| `showNotifications` | boolean | `true` | Mostrar notificaciones |

## Estructura del proyecto

```
ai-infinite-dialog/
├── src/
│   ├── extension.ts        # Punto de entrada, activación/desactivación
│   ├── mcpServer.ts        # Servicio HTTP, manejo de llamadas de herramientas IA
│   ├── feedbackPanel.ts    # Panel de retroalimentación WebView
│   ├── ruleInjector.ts     # Inyección de reglas IA (Windsurf)
│   ├── configManager.ts    # Gestión de configuración IDE
│   ├── sidebarProvider.ts  # Panel de configuración lateral
│   ├── settingsPanel.ts    # Panel de configuración independiente
│   ├── logManager.ts       # Gestión de logs
│   ├── statsManager.ts     # Estadísticas de uso
│   └── i18n/               # Internacionalización (zh, en, fr, es)
├── resources/
│   └── icon.svg            # Icono de la extensión
├── package.json
├── tsconfig.json
├── LICENSE                 # Licencia MIT
├── CHANGELOG.md
└── README.md
```

## Desarrollo

```bash
# Instalar dependencias
npm install

# Compilar
npm run compile

# Modo vigilancia (compilación automática)
npm run watch

# Verificación de código
npm run lint

# Empaquetar VSIX
npm run package
```

## Reglas IA inyectadas

La extensión inyecta automáticamente las siguientes reglas de comportamiento IA:

- **Llamada a la interfaz de retroalimentación**: La IA debe llamar a la interfaz de retroalimentación antes de que termine cada respuesta
- **Preguntar antes de ejecutar**: Explicar el problema, proporcionar soluciones y esperar la elección del usuario antes de modificar el código
- **Estándares de codificación**: Calidad del código, manejo de errores, codificación segura, mantenibilidad, etc.
- **Reintento en caso de fallo**: Reintento automático 3 veces en caso de fallo de llamada a la interfaz

Ubicación del archivo de reglas: `~/.codeium/windsurf/memories/user_global.md`

## Contribuir

¡Las Issues y Pull Requests son bienvenidas!

1. Haga fork de este repositorio
2. Cree una rama de funcionalidad: `git checkout -b feature/su-funcionalidad`
3. Haga commit de los cambios: `git commit -m 'Agregar su funcionalidad'`
4. Empuje la rama: `git push origin feature/su-funcionalidad`
5. Envíe una Pull Request

## Licencia

[MIT](LICENSE) © 2024-2026 AI Infinite Dialog
