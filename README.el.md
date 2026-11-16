<p align="center">
  <img src="assets/logo.svg" alt="ops-deck" width="420">
</p>

<p align="center">
  <a href="README.md">English</a> · <b>Ελληνικά</b> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.it.md">Italiano</a> · <a href="README.pt.md">Português</a> · <a href="README.zh.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  Ένα sci-fi HUD για την εφαρμογή Claude για υπολογιστή.<br>Κινούμενα φόντα που δείχνουν τι κάνει ο Claude, μια μπάρα κατάστασης πάνω από το prompt<br>και ένας πίνακας συνεδρίας που δείχνει τι βγήκε από τον υπολογιστή σας.
</p>

![ops-deck](assets/hero-code-rain.webp)
![ops-deck](assets/hero-horizon-alert.webp)

> **Ένα χομπι-project, φτιαγμένο για πλάκα.** Χρησιμοποιήστε το όπως είναι: δεν υπάρχει εγγύηση ότι δουλεύει παντού ούτε δέσμευση για υποστήριξη. Παρ' όλα αυτά, θα απαντήσω με χαρά σε κάθε φιλικό μήνυμα και είμαι πάντα ανοιχτός να αλλάξω, να προσθέσω ή να διορθώσω πράγματα. [Ανοίξτε ένα issue](https://github.com/leoplusma/ops-deck/issues) για να πείτε ένα γεια.

## Τι κάνει

- **Πέντε κινούμενα φόντα** (circuit, horizon, data room, code rain, signal). Ένα χρώμα δείχνει τι κάνει ο Claude: **μωβ** σκέφτεται, **πορτοκαλί** αρχεία, **πράσινο** εντολές, **ματζέντα** web. Όλα γίνονται **κόκκινα** όταν αποτύχει ένα εργαλείο.
- **Μπάρα κατάστασης** πάνω από το prompt: context, χρήση πλάνου 5 ωρών και εβδομάδας, χρόνος, κλήσεις εργαλείων, εκτίμηση κόστους.
- **Πίνακας συνεδρίας**: τι βγήκε από τον υπολογιστή σας, γράφημα αρχείων, εργαλεία, βοηθοί (subagents), πρόσφατοι γύροι, βοήθεια και καρτέλα demo.
- **Δέκα γλώσσες.** Όλα τρέχουν τοπικά: το ops-deck δεν στέλνει τίποτα πουθενά.

## Απαιτήσεις

Πρόσφατη εφαρμογή Claude για υπολογιστή (δοκιμασμένο με Claude Code 2.1.325 σε Windows 11). Τα κινούμενα φόντα θέλουν τα Windows **Ρυθμίσεις › Προσβασιμότητα › Οπτικά εφέ › Εφέ κίνησης** ενεργά.

Πρέπει να υπάρχει εγκατεστημένο το **Git** (το Claude το χρησιμοποιεί για να κατεβάσει το plugin). Σε Windows: [Git for Windows](https://git-scm.com/download/win), με τις προεπιλεγμένες ρυθμίσεις.

**Σε εικονική μηχανή** (VMware, Hyper-V, VirtualBox…) τα φόντα αλλάζουν χρώμα αλλά μένουν ακίνητα, γιατί η εφαρμογή απενεργοποιεί την επιτάχυνση γραφικών για πολλούς εικονικούς οδηγούς οθόνης. Κλείστε εντελώς το Claude (και από το εικονίδιο δίπλα στο ρολόι) και ανοίξτε το με `claude.exe --ignore-gpu-blocklist`.

## Εγκατάσταση

**Ο πιο εύκολος τρόπος:** ζητήστε το από το Claude, σε μια συνεδρία της εφαρμογής, και θα κάνει όλα τα βήματα μόνο του:

```
Install the plugin ops-deck from the GitHub marketplace leoplusma/ops-deck for my user, using the claude CLI the desktop app bundles
```

**Στην εφαρμογή:** **+** δίπλα στο πεδίο του prompt → **Plugins** → **Add marketplace** → `leoplusma/ops-deck` → **Add plugin**.

**Ή σε τερματικό** (`claude`):

```
/plugin install ops-deck --marketplace leoplusma/ops-deck
```

Ανοίξτε νέα συνεδρία ή γράψτε `/reload-plugins`. Αρχικά: φόντο ενεργό, σκηνή **horizon**, γλώσσα αγγλικά (αλλάζει στον πίνακα και τη θυμάται).

## Απενεργοποίηση ή αφαίρεση

Απενεργοποίηση: `/plugin disable ops-deck@ops-deck`

Αφαίρεση: `/plugin uninstall ops-deck@ops-deck`, `/plugin marketplace remove ops-deck`

Όλες οι λεπτομέρειες, οι εικόνες των σκηνών και του πίνακα: [README στα αγγλικά](README.md).

## Άδεια

[MIT](LICENSE): ελεύθερο για χρήση, αλλαγή και διανομή, όπως είναι, χωρίς εγγύηση.
