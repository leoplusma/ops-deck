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

> **Un proyecto personal hecho por diversión.** Úsalo tal cual: no hay garantía de que funcione en todas partes ni promesa de soporte. Dicho esto, responderé con gusto a cada mensaje amable y siempre estoy abierto a cambiar, añadir o arreglar cosas. [Abre un issue](https://github.com/leoplusma/ops-deck/issues) para saludar.

## Qué hace

- **Cinco fondos animados** (circuit, horizon, data room, code rain, signal). Un color indica lo que hace Claude: **violeta** pensando, **ámbar** archivos, **verde** comandos, **magenta** web. Todo se vuelve **rojo** cuando falla una herramienta.
- **Banda de estado** sobre el prompt: contexto, uso del plan (5 horas y semanal), tiempo, llamadas a herramientas, coste estimado.
- **Panel de sesión**: qué salió de tu PC, gráfico de archivos, herramientas, subagentes, turnos recientes, ayuda y una pestaña de demo.
- **Diez idiomas.** Todo se queda en tu PC: ops-deck no envía nada a ninguna parte.

## Requisitos

Una versión reciente de la app de escritorio de Claude (probado con Claude Code 2.1.325 en Windows 11). Los fondos animados necesitan **Configuración › Accesibilidad › Efectos visuales › Efectos de animación** activado en Windows.

**Hecho para el modo oscuro.** En el modo claro de la app todavía no se ve bien; el soporte para modo claro puede llegar pronto.

Debe estar instalado **Git** (Claude lo usa para descargar el plugin). En Windows: [Git for Windows](https://git-scm.com/download/win), con las opciones predeterminadas.

**En una máquina virtual** (VMware, Hyper-V, VirtualBox…) los fondos cambian de color pero se quedan quietos, porque la app desactiva la aceleración gráfica con muchos controladores virtuales. Cierra Claude por completo (también el icono junto al reloj) y ábrelo con `claude.exe --ignore-gpu-blocklist`.

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

## Desactivar o quitar

Desactivar: `/plugin disable ops-deck@ops-deck`

Quitar: `/plugin uninstall ops-deck@ops-deck`, `/plugin marketplace remove ops-deck`

Todos los detalles y las imágenes de las escenas y del panel: [README en inglés](README.md).

## Licencia

[MIT](LICENSE): libre para usar, cambiar y compartir, tal cual, sin garantía.
