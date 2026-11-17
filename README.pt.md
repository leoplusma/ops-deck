<p align="center">
  <img src="assets/logo.svg" alt="ops-deck" width="420">
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.el.md">Ελληνικά</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.it.md">Italiano</a> · <b>Português</b> · <a href="README.zh.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  Um HUD de ficção científica para o app de desktop do Claude.<br>Fundos animados que mostram o que o Claude está fazendo, uma faixa de status acima do prompt<br>e um painel de sessão que mostra o que saiu do seu PC.
</p>

![ops-deck](assets/hero-code-rain.webp)
![ops-deck](assets/hero-horizon-alert.webp)
![ops-deck](assets/hero-digital-cream.webp)

> **Um projeto pessoal feito por diversão.** Use como está: não há garantia de que funcione em todo lugar nem promessa de suporte. Dito isso, vou responder com prazer a toda mensagem amigável e estou sempre aberto a mudar, acrescentar ou consertar coisas. [Abra uma issue](https://github.com/leoplusma/ops-deck/issues) para dizer olá.

## O que faz

- **Nove fundos animados**: cinco escuros (circuit, horizon, data room, code rain, signal) e quatro claros (ink plotter, halftone tide, digital cream, heartline). Uma cena clara também deixa o app, a faixa e o painel em cores claras. Uma cor mostra o que o Claude faz: **violeta** pensando, **âmbar** arquivos, **verde** comandos, **magenta** web. Tudo fica **vermelho** quando uma ferramenta falha.
- **Duas opções paradas** que seguem o modo claro ou escuro do app: **spotlight**, um fundo de estúdio tranquilo (azul-escuro ou marfim), e **None**, uma cor lisa (azul-noite ou creme). Na lista de cenas: ☾ escura, ☀ clara, ◐ segue o app.
- **Faixa de status** acima do prompt: contexto, uso do plano (5 horas e semana), tempo, chamadas de ferramentas, custo estimado.
- **Painel de sessão**: o que saiu do seu PC, gráfico de arquivos, ferramentas, subagentes, rodadas recentes, ajuda e uma aba de demonstração.
- **Dez idiomas.** Tudo fica no seu PC: o ops-deck não envia nada para lugar nenhum.

## Requisitos

Uma versão recente do app de desktop do Claude (testado com Claude Code 2.1.325 no Windows 11).

É preciso ter o **Git** instalado (o Claude usa para baixar o plugin). No Windows: [Git for Windows](https://git-scm.com/download/win), com as opções padrão.

## Instalação

**O jeito mais fácil:** peça ao Claude numa sessão do app, e ele faz todos os passos sozinho:

```
Install the plugin ops-deck from the GitHub marketplace leoplusma/ops-deck for my user, using the claude CLI the desktop app bundles
```

**No app:** **+** ao lado da caixa do prompt → **Plugins** → **Add marketplace** → `leoplusma/ops-deck` → **Add plugin**.

**Ou numa sessão de terminal** (`claude`):

```
/plugin install ops-deck --marketplace leoplusma/ops-deck
```

Abra uma nova sessão ou digite `/reload-plugins`. No início: fundo ativo, cena **horizon**, idioma inglês (muda no painel e fica salvo).

## Se os fundos não se movem

Os fundos mudam de cor conforme o trabalho do Claude, mas também devem se mover e aparecer e sumir aos poucos. Se ficarem parados, confira nesta ordem:

1. **Animações do Windows ligadas:** **Configurações › Acessibilidade › Efeitos visuais › Efeitos de animação**. E em **Configurações avançadas do sistema › Desempenho**, «Animar controles e elementos dentro das janelas» marcado.
2. **Em uma máquina virtual** (VMware, Hyper-V, VirtualBox…): ligue os gráficos 3D (VMware: **VM › Settings › Display › Accelerate 3D graphics**) e instale as ferramentas do convidado (VMware Tools).
3. **Ainda parados?** O app muitas vezes não confia no driver gráfico de uma VM e desenha sem aceleração por hardware. Feche o Claude por completo (inclusive o ícone ao lado do relógio) e abra-o pelo PowerShell com a opção `--ignore-gpu-blocklist`:

```powershell
& (Join-Path (Get-AppxPackage -Name Claude).InstallLocation 'app\Claude.exe') --ignore-gpu-blocklist
```

Ou crie um atalho **Claude (VM)** na área de trabalho que sempre o abra assim (continua funcionando após atualizações):

```powershell
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Claude (VM).lnk"); $s.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"; $s.Arguments = '-NoProfile -WindowStyle Hidden -Command "& (Join-Path (Get-AppxPackage -Name Claude).InstallLocation ''app\Claude.exe'') --ignore-gpu-blocklist"'; $s.WindowStyle = 7; $s.IconLocation = (Join-Path (Get-AppxPackage -Name Claude).InstallLocation 'app\Claude.exe'); $s.Save()
```

## Algo não funciona?

Digite `/hud-debug` numa sessão ou peça ao Claude *"ops-deck debug"*. Você recebe um relatório curto: o que o ops-deck salvou (fundo, cena, painel), o que desenhou por último e como foi a inicialização. O mesmo relatório também é gravado em `debug.txt`, na pasta do plugin.

Para relatar um problema, [abra uma issue](https://github.com/leoplusma/ops-deck/issues) e cole o relatório. Confira antes: ele inclui o modelo e o uso da sessão, e talvez a pasta dela.

## Desativar ou remover

Desativar: `/plugin disable ops-deck@ops-deck`

Remover: `/plugin uninstall ops-deck@ops-deck`, `/plugin marketplace remove ops-deck`

Todos os detalhes e as imagens das cenas e do painel: [README em inglês](README.md).

## Licença

[MIT](LICENSE): livre para usar, alterar e compartilhar, como está, sem garantia.
