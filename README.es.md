<p align="center">
  <img src="assets/logo.svg" alt="ops-deck" width="420">
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.el.md">Ελληνικά</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <b>Español</b> · <a href="README.it.md">Italiano</a> · <a href="README.pt.md">Português</a> · <a href="README.zh.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  Un HUD de ciencia ficción para la app de escritorio de Claude.<br>Fondos animados que muestran lo que hace Claude, una banda de estado sobre el prompt<br>y un panel de sesión que te dice qué salió de tu PC.
</p>

![ops-deck](assets/hero-code-rain.webp)
![ops-deck](assets/hero-horizon-alert.webp)
![ops-deck](assets/hero-digital-cream.webp)

> **Un proyecto personal hecho por diversión.** Úsalo tal cual: no hay garantía de que funcione en todas partes ni promesa de soporte. Dicho esto, responderé con gusto a cada mensaje amable y siempre estoy abierto a cambiar, añadir o arreglar cosas. [Abre un issue](https://github.com/leoplusma/ops-deck/issues) para saludar.

## Qué hace

- **Nueve fondos animados**: cinco oscuros (circuit, horizon, data room, code rain, signal) y cuatro claros (ink plotter, halftone tide, digital cream, heartline). Una escena clara también pasa la app, la banda y el panel a colores claros. Un color indica lo que hace Claude: **violeta** pensando, **ámbar** archivos, **verde** comandos, **magenta** web. Todo se vuelve **rojo** cuando falla una herramienta.
- **Dos opciones quietas** que siguen el modo claro u oscuro de la app: **spotlight**, un fondo de estudio sereno (azul negro o marfil), y **None**, un color liso (azul noche o crema). En la lista de escenas: ☾ oscura, ☀ clara, ◐ sigue a la app.
- **Banda de estado** sobre el prompt: contexto, uso del plan (5 horas y semanal), tiempo, llamadas a herramientas, coste estimado.
- **Panel de sesión**: qué salió de tu PC, gráfico de archivos, herramientas, subagentes, turnos recientes, ayuda y una pestaña de demo.
- **Diez idiomas.** Todo se queda en tu PC: ops-deck no envía nada a ninguna parte.

## Requisitos

Una versión reciente de la app de escritorio de Claude (probado con Claude Code 2.1.325 en Windows 11).

Debe estar instalado **Git** (Claude lo usa para descargar el plugin). En Windows: [Git for Windows](https://git-scm.com/download/win), con las opciones predeterminadas.

## Instalación

**Lo más fácil:** pídeselo a Claude en una sesión de la app y él hará todos los pasos:

```
Install the plugin ops-deck from the GitHub marketplace leoplusma/ops-deck for my user, using the claude CLI the desktop app bundles
```

**En la app:** **+** junto al cuadro de texto → **Plugins** → **Add marketplace** → `leoplusma/ops-deck` → **Add plugin**.

**O en una sesión de terminal** (`claude`):

```
/plugin install ops-deck --marketplace leoplusma/ops-deck
```

Abre una sesión nueva o escribe `/reload-plugins`. Al empezar: fondo activado, escena **horizon**, idioma inglés (se cambia en el panel y se recuerda).

## Si los fondos no se mueven

Los fondos cambian de color según el trabajo de Claude, pero también deben moverse y aparecer y desaparecer. Si se quedan quietos, comprueba en orden:

1. **Animaciones de Windows activadas:** **Configuración › Accesibilidad › Efectos visuales › Efectos de animación**. Y en **Configuración avanzada del sistema › Rendimiento**, «Animar controles y elementos en ventanas» marcado.
2. **En una máquina virtual** (VMware, Hyper-V, VirtualBox…): activa los gráficos 3D (VMware: **VM › Settings › Display › Accelerate 3D graphics**) e instala las herramientas del invitado (VMware Tools).
3. **¿Siguen quietos?** La app suele desconfiar del controlador gráfico de una VM y dibuja sin aceleración por hardware. Cierra Claude por completo (también el icono junto al reloj) y ábrelo desde PowerShell con la opción `--ignore-gpu-blocklist`:

```powershell
& (Join-Path (Get-AppxPackage -Name Claude).InstallLocation 'app\Claude.exe') --ignore-gpu-blocklist
```

O crea un acceso directo **Claude (VM)** en el escritorio que siempre lo abra así (sigue funcionando tras las actualizaciones):

```powershell
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Claude (VM).lnk"); $s.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"; $s.Arguments = '-NoProfile -WindowStyle Hidden -Command "& (Join-Path (Get-AppxPackage -Name Claude).InstallLocation ''app\Claude.exe'') --ignore-gpu-blocklist"'; $s.WindowStyle = 7; $s.IconLocation = (Join-Path (Get-AppxPackage -Name Claude).InstallLocation 'app\Claude.exe'); $s.Save()
```

## ¿Algo no funciona?

Escribe `/hud-debug` en una sesión o pídele a Claude *"ops-deck debug"*. Obtendrás un informe breve: lo que ops-deck ha guardado (fondo, escena, panel), lo último que dibujó y cómo fue su arranque. El mismo informe se escribe también en `debug.txt`, en la carpeta del plugin.

Para informar de un problema, [abre un issue](https://github.com/leoplusma/ops-deck/issues) y pega el informe. Revísalo antes: incluye el modelo y el uso de la sesión, y quizá su carpeta.

## Desactivar o quitar

Desactivar: `/plugin disable ops-deck@ops-deck`

Quitar: `/plugin uninstall ops-deck@ops-deck`, `/plugin marketplace remove ops-deck`

Todos los detalles y las imágenes de las escenas y del panel: [README en inglés](README.md).

## Licencia

[MIT](LICENSE): libre para usar, cambiar y compartir, tal cual, sin garantía.
