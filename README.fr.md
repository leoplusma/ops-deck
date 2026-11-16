<p align="center">
  <img src="assets/logo.svg" alt="ops-deck" width="420">
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.el.md">Ελληνικά</a> · <a href="README.de.md">Deutsch</a> · <b>Français</b> · <a href="README.es.md">Español</a> · <a href="README.it.md">Italiano</a> · <a href="README.pt.md">Português</a> · <a href="README.zh.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  Un HUD de science-fiction pour l’application Claude sur ordinateur.<br>Des fonds animés qui montrent ce que fait Claude, une bande d’état au-dessus du prompt<br>et un tableau de bord qui dit ce qui a quitté votre PC.
</p>

![ops-deck](assets/hero-code-rain.webp)
![ops-deck](assets/hero-horizon-alert.webp)

> **Un projet perso, fait pour le plaisir.** Utilisez-le tel quel : aucune garantie qu’il fonctionne partout et aucune promesse de support. Cela dit, je répondrai volontiers à chaque message sympathique, et je suis toujours prêt à changer, ajouter ou corriger des choses. [Ouvrez une issue](https://github.com/leoplusma/ops-deck/issues) pour dire bonjour.

## Ce qu’il fait

- **Cinq fonds animés** (circuit, horizon, data room, code rain, signal). Une couleur indique ce que fait Claude : **violet** réflexion, **ambre** fichiers, **vert** commandes, **magenta** web. Tout passe au **rouge** quand un outil échoue.
- **Bande d’état** au-dessus du prompt : contexte, utilisation du forfait (5 heures et semaine), temps, appels d’outils, estimation du coût.
- **Tableau de bord** : ce qui a quitté votre PC, graphe des fichiers, outils, sous-agents, tours récents, aide et un onglet de démo.
- **Dix langues.** Tout reste sur votre PC : ops-deck n’envoie rien nulle part.

## Prérequis

Une version récente de l’application Claude (testé avec Claude Code 2.1.325 sous Windows 11). Les fonds animés demandent **Paramètres › Accessibilité › Effets visuels › Effets d’animation** activés dans Windows.

**Git** doit être installé (Claude s’en sert pour télécharger le plugin). Sous Windows : [Git for Windows](https://git-scm.com/download/win), avec les options par défaut.

## Installation

**Dans l’application :** **+** à côté de la zone de saisie → **Plugins** → **Add marketplace** → `leoplusma/ops-deck` → **Add plugin**.

**Ou dans un terminal** (`claude`) :

```
/plugin install ops-deck --marketplace leoplusma/ops-deck
```

Ouvrez une nouvelle session ou tapez `/reload-plugins`. Au départ : fond activé, scène **horizon**, langue anglaise (modifiable dans le tableau de bord, mémorisée).

## Désactiver ou supprimer

Désactiver : `/plugin disable ops-deck@ops-deck`

Supprimer : `/plugin uninstall ops-deck@ops-deck`, `/plugin marketplace remove ops-deck`

Tous les détails et les images des scènes et du tableau de bord : [README en anglais](README.md).

## Licence

[MIT](LICENSE) : libre d’utiliser, modifier et partager, fourni tel quel, sans garantie.
