<p align="center">
  <img src="assets/logo.svg" alt="ops-deck" width="420">
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.el.md">Ελληνικά</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.it.md">Italiano</a> · <a href="README.pt.md">Português</a> · <a href="README.zh.md">简体中文</a> · <b>日本語</b> · <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  Claude デスクトップアプリのための SF 風 HUD。<br>Claude の動きを表すアニメーション背景、プロンプト上部のステータスバンド、<br>そして PC の外に出たものを教えてくれるセッションダッシュボード。
</p>

![ops-deck](assets/hero-code-rain.webp)
![ops-deck](assets/hero-horizon-alert.webp)

> **趣味で楽しく作ったプロジェクトです。** そのままの状態でお使いください。どこでも動く保証はなく、サポートのお約束もできません。とはいえ、友好的なメッセージには喜んですべてお返事しますし、変更・追加・修正にはいつでも前向きです。 [issue を開いて](https://github.com/leoplusma/ops-deck/issues) 気軽に声をかけてください。

## できること

- **9 つのアニメーション背景**：ダーク 5 つ (circuit, horizon, data room, code rain, signal) とライト 4 つ (ink plotter, halftone tide, digital cream, heartline)。ライトのシーンを選ぶと、アプリ、ステータスバー、ダッシュボードも明るい色になります。色で Claude の状態がわかります：**紫** は思考中、**琥珀色** はファイル、**緑** はコマンド、**マゼンタ** は Web。ツールが失敗するとすべて **赤** になります。
- プロンプト上部の **ステータスバンド**：コンテキスト、5 時間枠と週間のプラン使用量、作業時間、ツール呼び出し、推定コスト。
- **セッションダッシュボード**：PC の外に出たもの、ファイルグラフ、ツール、サブエージェント、最近のターン、ヘルプ、デモタブ。
- **10 言語に対応。** すべて PC 内で動作し、ops-deck はどこにも何も送信しません。

## 必要なもの

最新の Claude デスクトップアプリ（Windows 11 上の Claude Code 2.1.325 で確認済み）。

**Git** がインストールされている必要があります（Claude がプラグインのダウンロードに使います）。Windows では [Git for Windows](https://git-scm.com/download/win) を既定の設定でインストールしてください。

## インストール

**いちばん簡単な方法：**アプリのセッションで Claude に頼むと、すべての手順を自分で行います：

```
Install the plugin ops-deck from the GitHub marketplace leoplusma/ops-deck for my user, using the claude CLI the desktop app bundles
```

**デスクトップアプリで：** 入力欄の横の **+** → **Plugins** → **Add marketplace** → `leoplusma/ops-deck` → **Add plugin**。

**またはターミナルのセッションで**（`claude`）：

```
/plugin install ops-deck --marketplace leoplusma/ops-deck
```

新しいセッションを開くか、`/reload-plugins` と入力します。初期設定：背景オン、シーン **horizon**、言語は英語（ダッシュボードで変更でき、記憶されます）。

## 背景が動かないとき

背景は Claude の作業に合わせて色が変わり、さらに動いたりフェードしたりするはずです。止まったままなら、順に確認してください：

1. **Windows のアニメーションがオン：** **設定 › アクセシビリティ › 視覚効果 › アニメーション効果**。また **システムの詳細設定 › パフォーマンス** で「ウィンドウ内のコントロールと要素をアニメーション化する」にチェック。
2. **仮想マシンでは**（VMware、Hyper-V、VirtualBox…）：3D グラフィックスをオンにし（VMware：**VM › Settings › Display › Accelerate 3D graphics**）、ゲストツール（VMware Tools）をインストールします。
3. **まだ動かない？** アプリは仮想マシンのグラフィックドライバーを信頼せず、ハードウェアアクセラレーションなしで描画することがよくあります。Claude を完全に終了し（時計の横のトレイアイコンも）、PowerShell から `--ignore-gpu-blocklist` スイッチ付きで起動してください：

```powershell
& (Join-Path (Get-AppxPackage -Name Claude).InstallLocation 'app\Claude.exe') --ignore-gpu-blocklist
```

または、いつもこの方法で起動するデスクトップのショートカット **Claude (VM)** を作成します（更新後も使えます）：

```powershell
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Claude (VM).lnk"); $s.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"; $s.Arguments = '-NoProfile -WindowStyle Hidden -Command "& (Join-Path (Get-AppxPackage -Name Claude).InstallLocation ''app\Claude.exe'') --ignore-gpu-blocklist"'; $s.WindowStyle = 7; $s.IconLocation = (Join-Path (Get-AppxPackage -Name Claude).InstallLocation 'app\Claude.exe'); $s.Save()
```

## うまく動かないときは

セッションで `/hud-debug` と入力するか、Claude に *"ops-deck debug"* と頼みます。短いレポートが出ます：ops-deck が保存した内容（背景、シーン、ダッシュボード）、最後に描いたもの、起動の様子。同じレポートはプラグインのフォルダーの `debug.txt` にも書き込まれます。

問題を報告するには、[issue を作成](https://github.com/leoplusma/ops-deck/issues)してレポートを貼り付けてください。先に内容を確認してください：セッションのモデルと使用量、場合によってはフォルダーが含まれます。

## オフにする・削除する

オフにする： `/plugin disable ops-deck@ops-deck`

削除する： `/plugin uninstall ops-deck@ops-deck`, `/plugin marketplace remove ops-deck`

詳細とシーン・ダッシュボードの画像はこちら：[英語の README](README.md)。

## ライセンス

[MIT](LICENSE)：自由に使用・変更・共有できます。現状のまま提供され、保証はありません。
