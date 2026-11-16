<p align="center">
  <img src="assets/logo.svg" alt="ops-deck" width="420">
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.el.md">Ελληνικά</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <b>Italiano</b> · <a href="README.pt.md">Português</a> · <a href="README.zh.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  Un HUD fantascientifico per l’app desktop di Claude.<br>Sfondi animati che mostrano cosa sta facendo Claude, una barra di stato sopra il prompt<br>e un pannello di sessione che ti dice cosa è uscito dal tuo PC.
</p>

![ops-deck](assets/hero-code-rain.webp)
![ops-deck](assets/hero-horizon-alert.webp)

> **Un progetto amatoriale, fatto per divertimento.** Usalo così com’è: nessuna garanzia che funzioni ovunque e nessuna promessa di supporto. Detto questo, risponderò volentieri a ogni messaggio gentile e sono sempre aperto a cambiare, aggiungere o sistemare cose. [Apri una issue](https://github.com/leoplusma/ops-deck/issues) per salutare.

## Cosa fa

- **Cinque sfondi animati** (circuit, horizon, data room, code rain, signal). Un colore indica cosa fa Claude: **viola** pensa, **ambra** file, **verde** comandi, **magenta** web. Tutto diventa **rosso** quando uno strumento fallisce.
- **Barra di stato** sopra il prompt: contesto, uso del piano (5 ore e settimana), tempo, chiamate agli strumenti, costo stimato.
- **Pannello di sessione**: cosa è uscito dal tuo PC, grafico dei file, strumenti, sottoagenti, turni recenti, aiuto e una scheda demo.
- **Dieci lingue.** Tutto resta sul tuo PC: ops-deck non invia nulla da nessuna parte.

## Requisiti

Una versione recente dell’app desktop di Claude (provato con Claude Code 2.1.325 su Windows 11). Gli sfondi animati richiedono **Impostazioni › Accessibilità › Effetti visivi › Effetti di animazione** attivi in Windows.

**Pensato per la modalità scura.** Nella modalità chiara dell’app non si vede ancora bene; il supporto per la modalità chiara potrebbe arrivare presto.

Deve essere installato **Git** (Claude lo usa per scaricare il plugin). Su Windows: [Git for Windows](https://git-scm.com/download/win), con le opzioni predefinite.

**In una macchina virtuale** (VMware, Hyper-V, VirtualBox…) gli sfondi cambiano colore ma restano fermi, perché l’app disattiva l’accelerazione grafica con molti driver virtuali. Chiudi Claude del tutto (anche dall’icona vicino all’orologio) e avvialo con `claude.exe --ignore-gpu-blocklist`.

## Installazione

**Il modo più semplice:** chiedilo a Claude in una sessione dell’app e farà tutti i passaggi da solo:

```
Install the plugin ops-deck from the GitHub marketplace leoplusma/ops-deck for my user, using the claude CLI the desktop app bundles
```

**Nell’app:** **+** accanto alla casella del prompt → **Plugins** → **Add marketplace** → `leoplusma/ops-deck` → **Add plugin**.

**Oppure in un terminale** (`claude`):

```
/plugin install ops-deck --marketplace leoplusma/ops-deck
```

Apri una nuova sessione o scrivi `/reload-plugins`. All’inizio: sfondo attivo, scena **horizon**, lingua inglese (si cambia nel pannello e viene ricordata).

## Disattivare o rimuovere

Disattivare: `/plugin disable ops-deck@ops-deck`

Rimuovere: `/plugin uninstall ops-deck@ops-deck`, `/plugin marketplace remove ops-deck`

Tutti i dettagli e le immagini delle scene e del pannello: [README in inglese](README.md).

## Licenza

[MIT](LICENSE): libero da usare, modificare e condividere, così com’è, senza garanzia.
