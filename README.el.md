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
![ops-deck](assets/hero-digital-cream.webp)

> **Ένα χομπι-project, φτιαγμένο για πλάκα.** Χρησιμοποιήστε το όπως είναι: δεν υπάρχει εγγύηση ότι δουλεύει παντού ούτε δέσμευση για υποστήριξη. Παρ' όλα αυτά, θα απαντήσω με χαρά σε κάθε φιλικό μήνυμα και είμαι πάντα ανοιχτός να αλλάξω, να προσθέσω ή να διορθώσω πράγματα. [Ανοίξτε ένα issue](https://github.com/leoplusma/ops-deck/issues) για να πείτε ένα γεια.

## Τι κάνει

- **Εννέα κινούμενα φόντα**: πέντε σκούρα (circuit, horizon, data room, code rain, signal) και τέσσερα ανοιχτά (ink plotter, halftone tide, digital cream, heartline). Μια ανοιχτή σκηνή κάνει ανοιχτόχρωμα και την εφαρμογή, την μπάρα και τον πίνακα. Ένα χρώμα δείχνει τι κάνει ο Claude: **μωβ** σκέφτεται, **πορτοκαλί** αρχεία, **πράσινο** εντολές, **ματζέντα** web. Όλα γίνονται **κόκκινα** όταν αποτύχει ένα εργαλείο.
- **Δύο ακίνητες επιλογές** που ακολουθούν το ανοιχτό ή σκούρο θέμα της εφαρμογής: **spotlight**, ένα ήσυχο φόντο στούντιο (μπλε-μαύρο ή ιβουάρ), και **None**, ένα απλό χρώμα (νυχτερινό μπλε ή κρεμ). Στη λίστα σκηνών, ☾ = σκούρα, ☀ = ανοιχτή, ◐ = ακολουθεί την εφαρμογή.
- **Μπάρα κατάστασης** πάνω από το prompt: context, χρήση πλάνου 5 ωρών και εβδομάδας, χρόνος, κλήσεις εργαλείων, εκτίμηση κόστους.
- **Πίνακας συνεδρίας**: τι βγήκε από τον υπολογιστή σας, γράφημα αρχείων, εργαλεία, βοηθοί (subagents), πρόσφατοι γύροι, βοήθεια και καρτέλα demo.
- **Δέκα γλώσσες.** Όλα τρέχουν τοπικά: το ops-deck δεν στέλνει τίποτα πουθενά.

## Απαιτήσεις

Πρόσφατη εφαρμογή Claude για υπολογιστή (δοκιμασμένο με Claude Code 2.1.325 σε Windows 11).

Πρέπει να υπάρχει εγκατεστημένο το **Git** (το Claude το χρησιμοποιεί για να κατεβάσει το plugin). Σε Windows: [Git for Windows](https://git-scm.com/download/win), με τις προεπιλεγμένες ρυθμίσεις.

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

## Αν τα φόντα δεν κινούνται

Τα φόντα αλλάζουν χρώμα ανάλογα με τη δουλειά του Claude, αλλά πρέπει επίσης να κινούνται και να σβήνουν. Αν μένουν ακίνητα, ελέγξτε με τη σειρά:

1. **Κινήσεις των Windows ενεργές:** **Ρυθμίσεις › Προσβασιμότητα › Οπτικά εφέ › Εφέ κίνησης**. Επίσης, στις **Ρυθμίσεις συστήματος για προχωρημένους › Επιδόσεις**, να είναι τσεκαρισμένο το «Κίνηση στοιχείων ελέγχου και στοιχείων μέσα σε παράθυρα».
2. **Σε εικονική μηχανή** (VMware, Hyper-V, VirtualBox…): ενεργοποιήστε τα τρισδιάστατα γραφικά της (VMware: **VM › Settings › Display › Accelerate 3D graphics**) και εγκαταστήστε τα εργαλεία της (VMware Tools).
3. **Ακόμη ακίνητα;** Η εφαρμογή συχνά δεν εμπιστεύεται τον οδηγό οθόνης μιας εικονικής μηχανής και σχεδιάζει χωρίς επιτάχυνση γραφικών. Κλείστε εντελώς το Claude (και από το εικονίδιο δίπλα στο ρολόι) και ανοίξτε το από το PowerShell με τον διακόπτη `--ignore-gpu-blocklist`:

```powershell
& (Join-Path (Get-AppxPackage -Name Claude).InstallLocation 'app\Claude.exe') --ignore-gpu-blocklist
```

Ή φτιάξτε μια συντόμευση **Claude (VM)** στην επιφάνεια εργασίας που το ανοίγει πάντα έτσι (ισχύει και μετά από ενημερώσεις):

```powershell
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Claude (VM).lnk"); $s.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"; $s.Arguments = '-NoProfile -WindowStyle Hidden -Command "& (Join-Path (Get-AppxPackage -Name Claude).InstallLocation ''app\Claude.exe'') --ignore-gpu-blocklist"'; $s.WindowStyle = 7; $s.IconLocation = (Join-Path (Get-AppxPackage -Name Claude).InstallLocation 'app\Claude.exe'); $s.Save()
```

## Κάτι δεν δουλεύει;

Γράψτε `/hud-debug` σε μια συνεδρία ή ζητήστε από το Claude *"ops-deck debug"*. Θα πάρετε μια σύντομη αναφορά: τι έχει αποθηκεύσει το ops-deck (φόντο, σκηνή, πίνακας), τι σχεδίασε τελευταίο και πώς πήγε η εκκίνηση. Η ίδια αναφορά γράφεται και στο `debug.txt` στον φάκελο του plugin.

Για να αναφέρετε ένα πρόβλημα, [ανοίξτε ένα issue](https://github.com/leoplusma/ops-deck/issues) και επικολλήστε την αναφορά. Ρίξτε της πρώτα μια ματιά: περιέχει το μοντέλο και τη χρήση της συνεδρίας και ίσως τον φάκελό της.

## Απενεργοποίηση ή αφαίρεση

Απενεργοποίηση: `/plugin disable ops-deck@ops-deck`

Αφαίρεση: `/plugin uninstall ops-deck@ops-deck`, `/plugin marketplace remove ops-deck`

Όλες οι λεπτομέρειες, οι εικόνες των σκηνών και του πίνακα: [README στα αγγλικά](README.md).

## Άδεια

[MIT](LICENSE): ελεύθερο για χρήση, αλλαγή και διανομή, όπως είναι, χωρίς εγγύηση.
