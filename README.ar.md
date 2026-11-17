<p align="center">
  <img src="assets/logo.svg" alt="ops-deck" width="420">
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.el.md">Ελληνικά</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.it.md">Italiano</a> · <a href="README.pt.md">Português</a> · <a href="README.zh.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <b>العربية</b>
</p>

<div dir="rtl">

<p align="center">
  واجهة عرض بأسلوب الخيال العلمي لتطبيق Claude على الحاسوب.<br>خلفيات متحركة تُظهر ما يفعله Claude، وشريط حالة فوق مربع الكتابة،<br>ولوحة معلومات للجلسة تخبرك بما غادر حاسوبك.
</p>

![ops-deck](assets/hero-code-rain.webp)
![ops-deck](assets/hero-horizon-alert.webp)
![ops-deck](assets/hero-digital-cream.webp)

> **مشروع هواية صُنع للمتعة.** استخدمه كما هو: لا يوجد ضمان أنه يعمل في كل مكان ولا وعد بالدعم. ومع ذلك، سأرد بكل سرور على كل رسالة ودية، وأنا منفتح دائمًا على تغيير الأشياء أو إضافتها أو إصلاحها. [افتح issue](https://github.com/leoplusma/ops-deck/issues) لتلقي التحية.

## ماذا يفعل

- **تسع خلفيات متحركة**: خمس داكنة (circuit, horizon, data room, code rain, signal) وأربع فاتحة (ink plotter, halftone tide, digital cream, heartline). المشهد الفاتح يحوّل أيضًا التطبيق والشريط واللوحة إلى ألوان فاتحة. لون واحد يخبرك بما يفعله Claude: **بنفسجي** يفكر، **كهرماني** ملفات، **أخضر** أوامر، **أرجواني** الويب. يتحول كل شيء إلى **الأحمر** عند فشل أداة.
- **شريط حالة** فوق مربع الكتابة: السياق، واستخدام الخطة (5 ساعات وأسبوعيًا)، والوقت، واستدعاءات الأدوات، والتكلفة التقديرية.
- **لوحة معلومات الجلسة**: ما غادر حاسوبك، ورسم الملفات، والأدوات، والوكلاء المساعدون، والجولات الأخيرة، والمساعدة، وتبويب عرض تجريبي.
- **عشر لغات.** كل شيء يعمل على حاسوبك: لا يرسل ops-deck أي شيء إلى أي مكان.

## المتطلبات

إصدار حديث من تطبيق Claude للحاسوب (تمت التجربة مع Claude Code 2.1.325 على Windows 11).

يجب أن يكون **Git** مثبتًا (يستخدمه Claude لتنزيل الإضافة). على Windows: [Git for Windows](https://git-scm.com/download/win)، بالخيارات الافتراضية.

## التثبيت

**أسهل طريقة:** اطلب ذلك من Claude في جلسة داخل التطبيق، وسيقوم بكل الخطوات بنفسه:

```
Install the plugin ops-deck from the GitHub marketplace leoplusma/ops-deck for my user, using the claude CLI the desktop app bundles
```

**في التطبيق:** **+** بجانب مربع الكتابة ← **Plugins** ← **Add marketplace** ← `leoplusma/ops-deck` ← **Add plugin**.

**أو في جلسة طرفية** (`claude`):

```
/plugin install ops-deck --marketplace leoplusma/ops-deck
```

افتح جلسة جديدة أو اكتب `/reload-plugins`. في البداية: الخلفية مفعّلة، والمشهد **horizon**، واللغة الإنجليزية (يمكن تغييرها من اللوحة وتُحفظ).

## إذا لم تتحرك الخلفيات

تتغيّر ألوان الخلفيات حسب عمل Claude، لكن يجب أيضًا أن تتحرك وتظهر وتختفي تدريجيًا. إذا بقيت ثابتة، فتحقّق بالترتيب:

1. **حركات Windows مفعّلة:** **الإعدادات › إمكانية الوصول › التأثيرات المرئية › تأثيرات الحركة**. وفي **إعدادات النظام المتقدمة › الأداء** يجب تحديد «تحريك عناصر التحكم والعناصر داخل النوافذ».
2. **في جهاز افتراضي** (VMware وHyper-V وVirtualBox…): فعّل الرسوميات ثلاثية الأبعاد (VMware: **VM › Settings › Display › Accelerate 3D graphics**) وثبّت أدوات الضيف (VMware Tools).
3. **ما زالت ثابتة؟** كثيرًا ما لا يثق التطبيق ببرنامج تشغيل الشاشة في الجهاز الافتراضي فيرسم دون تسريع الرسوميات. أغلق Claude تمامًا (ومن الأيقونة بجانب الساعة أيضًا) ثم شغّله من PowerShell مع الخيار `--ignore-gpu-blocklist`:

```powershell
& (Join-Path (Get-AppxPackage -Name Claude).InstallLocation 'app\Claude.exe') --ignore-gpu-blocklist
```

أو أنشئ اختصارًا **Claude (VM)** على سطح المكتب يشغّله دائمًا بهذه الطريقة (يبقى صالحًا بعد التحديثات):

```powershell
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Claude (VM).lnk"); $s.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"; $s.Arguments = '-NoProfile -WindowStyle Hidden -Command "& (Join-Path (Get-AppxPackage -Name Claude).InstallLocation ''app\Claude.exe'') --ignore-gpu-blocklist"'; $s.WindowStyle = 7; $s.IconLocation = (Join-Path (Get-AppxPackage -Name Claude).InstallLocation 'app\Claude.exe'); $s.Save()
```

## هل هناك ما لا يعمل؟

اكتب `/hud-debug` في جلسة، أو اطلب من Claude *"ops-deck debug"*. ستحصل على تقرير قصير: ما حفظه ops-deck (الخلفية والمشهد واللوحة)، وآخر ما رسمه، وكيف جرى بدء التشغيل. يُكتب التقرير نفسه أيضًا في `debug.txt` داخل مجلد الإضافة.

للإبلاغ عن مشكلة، [افتح issue](https://github.com/leoplusma/ops-deck/issues) والصق التقرير. راجعه أولًا: فهو يتضمن نموذج الجلسة واستخدامها، وربما مجلدها.

## الإيقاف أو الإزالة

الإيقاف: `/plugin disable ops-deck@ops-deck`

الإزالة: `/plugin uninstall ops-deck@ops-deck`, `/plugin marketplace remove ops-deck`

كل التفاصيل وصور المشاهد واللوحة: [README بالإنجليزية](README.md).

## الترخيص

[MIT](LICENSE): حر الاستخدام والتعديل والمشاركة، كما هو، دون أي ضمان.

</div>
