# 문제지가 인쇄 시 한 장당 A4 한 장에 들어가는지 Edge 헤드리스 PDF 인쇄로 확인한다.
param(
  [string[]]$Seqs = @('square', 'triangle', 'pow2', 'fact', 'pi', 'e', 'fib', 'prime'),
  [switch]$Answers,
  [switch]$Screenshot
)

$root = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$out = Join-Path $env:TEMP 'maze-a4-check'
New-Item -ItemType Directory -Force $out | Out-Null
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Error 'Microsoft Edge를 찾지 못했습니다.'; exit 2 }

$shapeCount = (Select-String -Path "$root\maze.js" -Pattern 'build: shape').Count
$expected = $shapeCount * ($(if ($Answers) { 2 } else { 1 }))
$base = 'file:///' + ($root -replace '\\', '/') + '/'
$html = Get-Content "$root\index.html" -Raw -Encoding utf8
$failed = 0

foreach ($seq in $Seqs) {
  $check = if ($Answers) { "document.getElementById('answerCheck').checked=true;" } else { '' }
  $inject = "<script src=`"app.js`"></script><script>document.getElementById('shapeSelect').value='all';" +
    "document.getElementById('seqSelect').value='$seq';${check}generate();</script>"
  $page = $html.Replace('<head>', "<head><base href=`"$base`">").Replace('<script src="app.js"></script>', $inject)
  $file = Join-Path $out "t_$seq.html"
  Set-Content -Path $file -Value $page -Encoding utf8
  $url = 'file:///' + ($file -replace '\\', '/')
  $pdf = Join-Path $out "$seq.pdf"
  Remove-Item $pdf -ErrorAction SilentlyContinue
  $common = @('--headless=new', '--disable-gpu', "--user-data-dir=$out\edge-profile", '--virtual-time-budget=60000')
  Start-Process -FilePath $edge -ArgumentList ($common + @('--no-pdf-header-footer', "--print-to-pdf=$pdf", $url)) -Wait
  if ($Screenshot) {
    Start-Process -FilePath $edge -ArgumentList ($common + @('--window-size=1400,1300', '--hide-scrollbars', "--screenshot=$out\$seq.png", $url)) -Wait
  }
  if (-not (Test-Path $pdf)) { Write-Output "FAIL  $seq : PDF가 만들어지지 않음"; $failed++; continue }

  # PDF 페이지 트리에서 가장 큰 /Count 가 전체 쪽 수
  $text = [System.Text.Encoding]::Latin1.GetString([System.IO.File]::ReadAllBytes($pdf))
  $pages = ([regex]::Matches($text, '/Count (\d+)') | ForEach-Object { [int]$_.Groups[1].Value } | Measure-Object -Maximum).Maximum
  if ($pages -eq $expected) { Write-Output "OK    $seq : ${pages}/${expected}쪽" }
  else { Write-Output "FAIL  $seq : PDF ${pages}쪽, 문제지 ${expected}장 ($pdf)"; $failed++ }
}

Write-Output "결과 파일: $out"
if ($failed) { exit 1 }
