<#
  index.html(23MB 번들) 402번째 줄의 템플릿을 뽑고/되넣는다.
  Windows PowerShell 5.1 / PowerShell 7 양쪽에서 동작한다.

    powershell -ExecutionPolicy Bypass -File tools\bundle.ps1 extract
    powershell -ExecutionPolicy Bypass -File tools\bundle.ps1 rebuild
    powershell -ExecutionPolicy Bypass -File tools\bundle.ps1 check
#>
param([Parameter(Position=0)][string]$Cmd = '')

$ErrorActionPreference = 'Stop'
$Root  = Split-Path -Parent $PSScriptRoot
$Src   = Join-Path $Root 'index.html'
$Tpl   = Join-Path $Root 'build\template.html'
$Idx   = 401   # 0-based -> 파일상 402번째 줄
$Utf8  = New-Object System.Text.UTF8Encoding($false)   # BOM 없음
$SLASH = [string][char]92                              # 역슬래시 한 글자
$CRLF  = [string[]]@([string][char]13 + [string][char]10)
$LF    = [string[]]@([string][char]10)

function Die([string]$m) { Write-Host $m -ForegroundColor Red; exit 1 }

# JSON 문자열 인코딩 (Python json.dumps(ensure_ascii=False) 와 동일 규칙)
function Enc-Json([string]$s) {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append('"')
  foreach ($ch in $s.ToCharArray()) {
    $c = [int]$ch
    if     ($c -eq 34)  { [void]$sb.Append($SLASH + '"') }
    elseif ($c -eq 92)  { [void]$sb.Append($SLASH + $SLASH) }
    elseif ($c -eq 8)   { [void]$sb.Append($SLASH + 'b') }
    elseif ($c -eq 9)   { [void]$sb.Append($SLASH + 't') }
    elseif ($c -eq 10)  { [void]$sb.Append($SLASH + 'n') }
    elseif ($c -eq 12)  { [void]$sb.Append($SLASH + 'f') }
    elseif ($c -eq 13)  { [void]$sb.Append($SLASH + 'r') }
    elseif ($c -lt 32)  { [void]$sb.Append($SLASH + 'u' + $c.ToString('x4')) }
    else                { [void]$sb.Append($ch) }
  }
  [void]$sb.Append('"')
  # '</' 는 전부 이스케이프. 안 하면 문자열 속 </script> 가 바깥 <script> 태그를 조기 종료시킨다.
  return $sb.ToString().Replace('</', '<' + $SLASH + 'u002F')
}

# JSON 문자열 디코딩
function Dec-Json([string]$j) {
  if ($j.Length -lt 2 -or $j[0] -ne '"' -or $j[$j.Length-1] -ne '"') { Die '[중단] 402줄이 JSON 문자열이 아닙니다.' }
  $body = $j.Substring(1, $j.Length - 2)
  $sb = New-Object System.Text.StringBuilder
  $i = 0
  while ($i -lt $body.Length) {
    $ch = $body[$i]
    if ([int]$ch -ne 92) { [void]$sb.Append($ch); $i++; continue }
    $n = [int]$body[$i+1]
    if     ($n -eq 34)  { [void]$sb.Append([char]34); $i += 2 }
    elseif ($n -eq 92)  { [void]$sb.Append([char]92); $i += 2 }
    elseif ($n -eq 47)  { [void]$sb.Append([char]47); $i += 2 }
    elseif ($n -eq 98)  { [void]$sb.Append([char]8);  $i += 2 }
    elseif ($n -eq 102) { [void]$sb.Append([char]12); $i += 2 }
    elseif ($n -eq 110) { [void]$sb.Append([char]10); $i += 2 }
    elseif ($n -eq 114) { [void]$sb.Append([char]13); $i += 2 }
    elseif ($n -eq 116) { [void]$sb.Append([char]9);  $i += 2 }
    elseif ($n -eq 117) {
      $hex = $body.Substring($i+2, 4)
      [void]$sb.Append([char][Convert]::ToInt32($hex, 16))
      $i += 6
    }
    else { Die ('[중단] 알 수 없는 이스케이프 문자 코드: ' + $n) }
  }
  return $sb.ToString()
}

function Read-Bundle {
  if (-not (Test-Path $Src)) { Die ('[중단] index.html 이 없습니다: ' + $Src) }
  $raw = [System.IO.File]::ReadAllText($Src, $Utf8)
  $lines = $raw.Split($CRLF, [System.StringSplitOptions]::None)
  if ($lines.Count -ne 405) { Die ('[중단] 줄 수가 405가 아닙니다: ' + $lines.Count + ' (CRLF 개행이 아닐 수 있음)') }
  if ((Enc-Json (Dec-Json $lines[$Idx])) -cne $lines[$Idx]) { Die '[중단] 인코딩 규칙 자체검증 실패.' }
  return @{ raw = $raw; lines = $lines }
}

function Do-Extract {
  $b = Read-Bundle
  $t = Dec-Json $b.lines[$Idx]
  $d = Split-Path -Parent $Tpl
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
  [System.IO.File]::WriteAllText($Tpl, $t, $Utf8)
  $n = $t.Split($LF, [System.StringSplitOptions]::None).Count
  Write-Host ('OK extract -> build/template.html ({0}자 / {1}줄)' -f $t.Length, $n)
}

function Do-Rebuild([bool]$Check) {
  $b = Read-Bundle
  if (-not (Test-Path $Tpl)) { Die '[중단] build/template.html 이 없습니다. 먼저 extract 하세요.' }
  $t = [System.IO.File]::ReadAllText($Tpl, $Utf8)
  foreach ($m in @('<!DOCTYPE html>', 'class Component extends DCLogic', '</script>')) {
    if (-not $t.Contains($m)) { Die ('[중단] template.html 손상: ' + $m + ' 없음') }
  }
  $lines = $b.lines
  $lines[$Idx] = Enc-Json $t
  $out = [string]::Join($CRLF[0], $lines)
  if ($Check) {
    if ($out -ceq $b.raw) { Write-Host 'CHECK: 변경 없음 (바이트 동일)' } else { Write-Host 'CHECK: 변경 있음' }
    return
  }
  [System.IO.File]::WriteAllText($Src, $out, $Utf8)
  Write-Host ('OK rebuild -> index.html ({0}바이트)' -f $Utf8.GetByteCount($out))
}

switch ($Cmd) {
  'extract' { Do-Extract }
  'rebuild' { Do-Rebuild $false }
  'check'   { Do-Rebuild $true }
  default   { Die '사용법: bundle.ps1 extract|rebuild|check' }
}
