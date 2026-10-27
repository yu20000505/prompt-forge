# 代码签名

Prompt Forge 的发布产物默认是**未签名**的，Windows 第一次运行时会提示「未知发布者」。
这不是代码问题，而是需要一张受信任的 Windows 代码签名证书。本文说明怎么把它签上。

## 先说结论

- **只有受信任的 Authenticode 证书**（OV 或 EV）才能消除「未知发布者」。
  自己用 `New-SelfSignedCertificate` 生成的自签名证书不行，系统仍然不信任。
- SmartScreen 的「已保护你的电脑」还额外看下载量和证书信誉，签名后可能仍要积累一段时间。
- 证书和密码**不要**提交到仓库。泄漏后联系 CA 吊销并重新签发。

## 你需要什么

1. 一张 Windows 代码签名证书（PFX 文件 + 密码；或硬件令牌 / 云签名服务）；
2. Windows SDK 里的 `signtool.exe`（GitHub `windows-latest` 自带，本机需自行安装）；
3. 一个时间戳服务（脚本默认用 DigiCert 的 RFC3161 服务）。

## 本地签名

```powershell
npm run build:all          # 先产出两个 exe
$env:PF_SIGN_PFX = 'C:\certs\prompt-forge.pfx'
$env:PF_SIGN_PASSWORD = '你的密码'
npm run sign
```

`npm run sign` 等价于：

```powershell
node build/sign.mjs --pfx C:\certs\prompt-forge.pfx --password 你的密码
```

默认会签 `release/PromptForge.exe` 和 `release-desktop/PromptForge-Desktop.exe`，
签完自动执行 `signtool verify /pa`。也可以只签一个文件：

```powershell
node build/sign.mjs --pfx cert.pfx --password *** release/PromptForge.exe
```

常用参数：

| 参数 | 说明 |
| --- | --- |
| `--pfx <路径>` | 证书路径，也可用 `PF_SIGN_PFX` |
| `--password <密码>` | PFX 密码，也可用 `PF_SIGN_PASSWORD` |
| `--timestamp <URL>` | 时间戳服务，默认 `http://timestamp.digicert.com` |
| `--no-timestamp` | 不打时间戳（证书过期后签名会失效，不推荐） |
| `--no-verify` | 签完不执行验证 |
| `--help` | 打印帮助 |

如果 `signtool.exe` 不在 `PATH` 里，脚本会自动搜索
`C:\Program Files (x86)\Windows Kits\10\bin\<版本>\x64`；也可以用
`$env:SIGNTOOL = 'C:\...\signtool.exe'` 指定。

手动验证签名：

```powershell
signtool verify /pa /v release\PromptForge.exe
```

## 在 CI 里自动签名

`.github/workflows/release.yml` 已经留好了步骤，只要配置两个仓库 Secret：

| Secret | 内容 |
| --- | --- |
| `WINDOWS_PFX_BASE64` | PFX 文件的 Base64（单行） |
| `WINDOWS_PFX_PASSWORD` | PFX 密码 |

生成 Base64：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\certs\prompt-forge.pfx')) | Set-Clipboard
```

配置后，推 `v*` 标签时 workflow 会先打包、再把两个 exe 签上，然后才上传和发 Release。
没有配置 Secret 时这一步自动跳过，产物仍是未签名的，不影响发版。

> 证书密码会以环境变量传给 `signtool`；GitHub Actions 会对 Secret 做打码，
> 但仍建议只在私有仓库或受控仓库里配置。

## 使用硬件令牌 / 云签名

脚本只处理 PFX 文件。如果证书在 USB 令牌或云 HSM 里，需要手动调用 `signtool`，例如：

```powershell
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 `
  /csp "eSigner KSP" /k "你的证书名" release\PromptForge.exe
```

具体 `/csp` / `/k` 参数以证书厂商文档为准。

## 没有证书时

不用做任何事。按 README 的「更多信息 → 仍要运行」操作即可，
数据、功能和签名版完全一样；签名只影响系统的信任提示。
