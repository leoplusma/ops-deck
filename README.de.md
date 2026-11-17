<p align="center">
  <img src="assets/logo.svg" alt="ops-deck" width="420">
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.el.md">Ελληνικά</a> · <b>Deutsch</b> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.it.md">Italiano</a> · <a href="README.pt.md">Português</a> · <a href="README.zh.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  Ein Sci-Fi-HUD für die Claude-Desktop-App.<br>Animierte Hintergründe, die zeigen, was Claude gerade tut, eine Statusleiste über dem Prompt<br>und ein Sitzungs-Dashboard, das zeigt, was deinen PC verlassen hat.
</p>

![ops-deck](assets/hero-code-rain.webp)
![ops-deck](assets/hero-horizon-alert.webp)
![ops-deck](assets/hero-digital-cream.webp)

> **Ein Hobbyprojekt, aus Spaß gemacht.** Nutze es so, wie es ist: keine Garantie, dass es überall funktioniert, und kein Support-Versprechen. Trotzdem beantworte ich gern jede freundliche Nachricht und bin immer offen dafür, Dinge zu ändern, zu ergänzen oder zu reparieren. [Öffne ein Issue](https://github.com/leoplusma/ops-deck/issues) und sag Hallo.

## Was es kann

- **Neun animierte Hintergründe**: fünf dunkle (circuit, horizon, data room, code rain, signal) und vier helle (ink plotter, halftone tide, digital cream, heartline). Eine helle Szene schaltet auch die App, die Leiste und das Dashboard auf helle Farben. Eine Farbe zeigt, was Claude tut: **Violett** denkt, **Bernstein** Dateien, **Grün** Befehle, **Magenta** Web. Alles wird **rot**, wenn ein Werkzeug fehlschlägt.
- **Statusleiste** über dem Prompt: Kontext, Plan-Nutzung (5 Stunden und Woche), Zeit, Werkzeugaufrufe, Kostenschätzung.
- **Sitzungs-Dashboard**: was deinen PC verlassen hat, Datei-Graph, Werkzeuge, Subagenten, letzte Runden, Hilfe und ein Demo-Tab.
- **Zehn Sprachen.** Alles läuft lokal: ops-deck sendet nichts irgendwohin.

## Voraussetzungen

Eine aktuelle Claude-Desktop-App (getestet mit Claude Code 2.1.325 unter Windows 11).

**Git** muss installiert sein (Claude lädt das Plugin damit herunter). Unter Windows: [Git for Windows](https://git-scm.com/download/win), mit den Standardoptionen.

## Installation

**Am einfachsten:** Bitten Sie Claude in einer Sitzung der App darum, es erledigt alle Schritte selbst:

```
Install the plugin ops-deck from the GitHub marketplace leoplusma/ops-deck for my user, using the claude CLI the desktop app bundles
```

**In der Desktop-App:** **+** neben dem Eingabefeld → **Plugins** → **Add marketplace** → `leoplusma/ops-deck` → **Add plugin**.

**Oder in einer Terminal-Sitzung** (`claude`):

```
/plugin install ops-deck --marketplace leoplusma/ops-deck
```

Neue Sitzung öffnen oder `/reload-plugins` eingeben. Start: Hintergrund an, Szene **horizon**, Sprache Englisch (im Dashboard änderbar, wird gemerkt).

## Wenn die Hintergründe sich nicht bewegen

Die Hintergründe wechseln die Farbe je nach Claudes Arbeit, sollen sich aber auch bewegen und ein- und ausblenden. Wenn sie stillstehen, prüfen Sie der Reihe nach:

1. **Windows-Animationen an:** **Einstellungen › Barrierefreiheit › Visuelle Effekte › Animationseffekte**. Außerdem unter **Erweiterte Systemeinstellungen › Leistung** „Steuerelemente und Elemente innerhalb von Fenstern animieren“ angehakt.
2. **In einer virtuellen Maschine** (VMware, Hyper-V, VirtualBox…): 3D-Grafik einschalten (VMware: **VM › Settings › Display › Accelerate 3D graphics**) und die Gastwerkzeuge installieren (VMware Tools).
3. **Immer noch still?** Die App misstraut oft dem Grafiktreiber einer VM und zeichnet ohne Hardwarebeschleunigung. Beenden Sie Claude vollständig (auch im Infobereich neben der Uhr) und starten Sie es in PowerShell mit dem Schalter `--ignore-gpu-blocklist`:

```powershell
& (Join-Path (Get-AppxPackage -Name Claude).InstallLocation 'app\Claude.exe') --ignore-gpu-blocklist
```

Oder legen Sie eine Desktop-Verknüpfung **Claude (VM)** an, die es immer so startet (funktioniert auch nach Updates):

```powershell
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Claude (VM).lnk"); $s.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"; $s.Arguments = '-NoProfile -WindowStyle Hidden -Command "& (Join-Path (Get-AppxPackage -Name Claude).InstallLocation ''app\Claude.exe'') --ignore-gpu-blocklist"'; $s.WindowStyle = 7; $s.IconLocation = (Join-Path (Get-AppxPackage -Name Claude).InstallLocation 'app\Claude.exe'); $s.Save()
```

## Funktioniert etwas nicht?

Geben Sie `/hud-debug` in einer Sitzung ein oder bitten Sie Claude um *"ops-deck debug"*. Sie erhalten einen kurzen Bericht: was ops-deck gespeichert hat (Hintergrund, Szene, Dashboard), was es zuletzt gezeichnet hat und wie der Start lief. Derselbe Bericht steht auch in `debug.txt` im Ordner des Plugins.

Um ein Problem zu melden, [öffnen Sie ein Issue](https://github.com/leoplusma/ops-deck/issues) und fügen Sie den Bericht ein. Sehen Sie ihn vorher durch: Er enthält Modell und Nutzung der Sitzung und eventuell ihren Ordner.

## Ausschalten oder entfernen

Ausschalten: `/plugin disable ops-deck@ops-deck`

Entfernen: `/plugin uninstall ops-deck@ops-deck`, `/plugin marketplace remove ops-deck`

Alle Details und Bilder der Szenen und des Dashboards: [README auf Englisch](README.md).

## Lizenz

[MIT](LICENSE): frei nutzbar, änderbar und teilbar, ohne Gewähr.
