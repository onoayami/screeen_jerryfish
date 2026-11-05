[CmdletBinding()]
param(
  [string]$ResultPath = ''
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExpectedPaths = @(
  'docs/01_最短で動かす.md',
  'docs/02_画像と動きの設定.md',
  'docs/03_Macアプリの作成と配布.md',
  'docs/04_利用者向け説明書.md',
  'docs/05_配布前チェックリスト.md',
  'docs/06_A3実機検証.md'
)
$TextExtensions = @('.bat', '.command', '.css', '.html', '.js', '.json', '.md', '.mjs', '.ps1', '.py', '.txt')
$Utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$Errors = New-Object System.Collections.Generic.List[string]
$NormalizedPaths = New-Object System.Collections.Generic.HashSet[string]
$RootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$RootUri = New-Object System.Uri($RootFull)

function Get-PortableRelativePath([string]$FullName) {
  $FileUri = New-Object System.Uri([System.IO.Path]::GetFullPath($FullName))
  $Relative = [System.Uri]::UnescapeDataString($RootUri.MakeRelativeUri($FileUri).ToString())
  return $Relative.Replace('\', '/')
}

$Files = Get-ChildItem -LiteralPath $Root -Recurse -File | Where-Object {
  $_.FullName -notmatch '[\\/](node_modules|dist|\.git)[\\/]'
}
foreach ($File in $Files) {
  if ($File.Name -eq '.DS_Store') { continue }
  $Relative = Get-PortableRelativePath $File.FullName
  $Normalized = $Relative.Normalize([System.Text.NormalizationForm]::FormC)
  if ($Relative.Contains([char]0xFFFD)) {
    $Errors.Add("$Relative : ファイル名に置換文字U+FFFDがあります。")
  }
  if ($Relative -ne $Normalized) {
    $Errors.Add("$Relative : ファイル名がUnicode NFCではありません。")
  }
  if (-not $NormalizedPaths.Add($Normalized)) {
    $Errors.Add("$Normalized : NFC正規化後に同名になるファイルがあります。")
  }
  if ($TextExtensions -contains $File.Extension.ToLowerInvariant()) {
    try {
      $Text = $Utf8Strict.GetString([System.IO.File]::ReadAllBytes($File.FullName))
      if ($Text.Contains([char]0xFFFD)) {
        $Errors.Add("$Normalized : 本文に置換文字U+FFFDがあります。")
      }
      if ($Text -ne $Text.Normalize([System.Text.NormalizationForm]::FormC)) {
        $Errors.Add("$Normalized : 本文がUnicode NFCではありません。")
      }
    }
    catch {
      $Errors.Add("$Normalized : UTF-8として読めません。")
    }
  }
}

foreach ($Expected in $ExpectedPaths) {
  if (-not $NormalizedPaths.Contains($Expected)) {
    $Errors.Add("$Expected : Windows標準展開後に日本語説明書が見つかりません。")
  }
}

if ([string]::IsNullOrWhiteSpace($ResultPath)) {
  $Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $Desktop = [Environment]::GetFolderPath('Desktop')
  $ResultPath = Join-Path $Desktop "A3-Windows解凍結果-$Timestamp.txt"
}
else {
  $ResultPath = [System.IO.Path]::GetFullPath($ResultPath)
  $ResultDirectory = Split-Path -Parent $ResultPath
  if (-not [string]::IsNullOrWhiteSpace($ResultDirectory)) {
    New-Item -ItemType Directory -Force -Path $ResultDirectory | Out-Null
  }
}
$Lines = New-Object System.Collections.Generic.List[string]
$Lines.Add("実行日時: $((Get-Date).ToString('o'))")
$Lines.Add("Windows: $([Environment]::OSVersion.VersionString)")
$Lines.Add("CPU: $([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)")
$Lines.Add("検査ファイル数: $($Files.Count)")
$Lines.Add("期待する日本語説明書: $($ExpectedPaths.Count)件")
if ($Errors.Count -eq 0) {
  $Lines.Add('結果: 成功')
  $Lines.Add('注意: これはWindows標準展開後の名前と本文だけの確認です。Mac実機確認の代わりにはなりません。')
}
else {
  $Lines.Add('結果: 失敗')
  $Lines.Add('')
  foreach ($Item in $Errors) { $Lines.Add("- $Item") }
}
$Lines | Set-Content -LiteralPath $ResultPath -Encoding UTF8
Write-Host ""
Write-Host "結果を保存しました: $ResultPath"
if ($Errors.Count -eq 0) {
  Write-Host 'Windows解凍確認は成功しました。'
  exit 0
}
Write-Host '問題があります。結果テキストを共有してください。'
exit 1
