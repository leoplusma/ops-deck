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

> **Ein Hobbyprojekt, aus Spaß gemacht.** Nutze es so, wie es ist: keine Garantie, dass es überall funktioniert, und kein Support-Versprechen. Trotzdem beantworte ich gern jede freundliche Nachricht und bin immer offen dafür, Dinge zu ändern, zu ergänzen oder zu reparieren. [Öffne ein Issue](https://github.com/leoplusma/ops-deck/issues) und sag Hallo.

## Was es kann

- **Fünf animierte Hintergründe** (circuit, horizon, data room, code rain, signal). Eine Farbe zeigt, was Claude tut: **Violett** denkt, **Bernstein** Dateien, **Grün** Befehle, **Magenta** Web. Alles wird **rot**, wenn ein Werkzeug fehlschlägt.
- **Statusleiste** über dem Prompt: Kontext, Plan-Nutzung (5 Stunden und Woche), Zeit, Werkzeugaufrufe, Kostenschätzung.
- **Sitzungs-Dashboard**: was deinen PC verlassen hat, Datei-Graph, Werkzeuge, Subagenten, letzte Runden, Hilfe und ein Demo-Tab.
- **Zehn Sprachen.** Alles läuft lokal: ops-deck sendet nichts irgendwohin.

## Voraussetzungen

Eine aktuelle Claude-Desktop-App (getestet mit Claude Code 2.1.325 unter Windows 11). Die bewegten Hintergründe brauchen in Windows **Einstellungen › Barrierefreiheit › Visuelle Effekte › Animationseffekte**.

**Für den dunklen Modus gemacht.** Im hellen Modus der App sieht es noch nicht richtig aus; Unterstützung für den hellen Modus kommt vielleicht bald.

**Git** muss installiert sein (Claude lädt das Plugin damit herunter). Unter Windows: [Git for Windows](https://git-scm.com/download/win), mit den Standardoptionen.

**In einer virtuellen Maschine** (VMware, Hyper-V, VirtualBox…) wechseln die Hintergründe die Farbe, bleiben aber stehen, weil die App bei vielen virtuellen Grafiktreibern die Hardwarebeschleunigung abschaltet. Beenden Sie Claude vollständig (auch im Infobereich neben der Uhr) und starten Sie es mit `claude.exe --ignore-gpu-blocklist`.

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

## Ausschalten oder entfernen

Ausschalten: `/plugin disable ops-deck@ops-deck`

Entfernen: `/plugin uninstall ops-deck@ops-deck`, `/plugin marketplace remove ops-deck`

Alle Details und Bilder der Szenen und des Dashboards: [README auf Englisch](README.md).

## Lizenz

[MIT](LICENSE): frei nutzbar, änderbar und teilbar, ohne Gewähr.
