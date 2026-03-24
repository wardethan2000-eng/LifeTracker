<#
  fix-imports.ps1
  Relocates any lib/errors.js and lib/soft-delete.js imports that got placed
  inside the file body (due to SQL 'from "..."' strings being mistaken as
  import endings) back to the top of the import block.

  Strategy:
    - Find the end of the "real" import section by scanning from the file top
      and stopping at the first non-import, non-blank, non-comment line.
    - Remove all existing helper-lib import lines from wherever they are.
    - Re-insert them at the true import-section boundary.
#>

$routesDir = Resolve-Path "$PSScriptRoot\..\apps\api\src\routes"

function Find-ImportSectionEnd {
  param([string[]]$lines)

  $inImport = $false
  $lastImportLine = -1

  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]

    if ($inImport) {
      # Waiting for the closing of a multi-line import  (must contain ';')
      if ($line -match ';') {
        $lastImportLine = $i
        $inImport = $false
      }
      continue
    }

    # Blank or single/block comment lines are allowed anywhere in the preamble
    if ($line -match '^\s*$')         { continue }
    if ($line -match '^\s*//')        { continue }
    if ($line -match '^\s*/\*')       { continue }
    if ($line -match '^\s*\*')        { continue }

    # An import statement
    if ($line -match '^import ') {
      if ($line -match ';') {
        $lastImportLine = $i           # single-line import ends here
      } else {
        $inImport = $true              # multi-line import starts
      }
      continue
    }

    # First actual code line – stop here
    break
  }

  return $lastImportLine
}

$helperPattern = 'lib/(errors|soft-delete)\.js"'

$files   = Get-ChildItem -Path $routesDir -Recurse -Filter '*.ts'
$fixed   = 0

foreach ($file in $files) {
  $content = [System.IO.File]::ReadAllText($file.FullName)

  # Only touch files that have helper imports
  if ($content -notmatch $helperPattern) { continue }

  $lines = $content -split "`n"

  # ----------------------------------------------------------------
  # 1. Collect all helper-import lines (may be anywhere in the file)
  # ----------------------------------------------------------------
  $helperLines   = @()
  $remainingLines = @()

  foreach ($line in $lines) {
    if ($line -match "^import \{[^}]+\} from `"[^`"]*lib/(errors|soft-delete)\.js`";") {
      $helperLines += $line
    } else {
      $remainingLines += $line
    }
  }

  if ($helperLines.Count -eq 0) { continue }

  # ----------------------------------------------------------------
  # 2. Find the true end of the import section in the (now pruned) file
  # ----------------------------------------------------------------
  $insertAfter = Find-ImportSectionEnd -lines $remainingLines

  # ----------------------------------------------------------------
  # 3. Re-insert helper imports right after the last real import
  # ----------------------------------------------------------------
  if ($insertAfter -ge 0) {
    $before  = $remainingLines[0..$insertAfter]
    $after   = if ($insertAfter + 1 -lt $remainingLines.Count) {
                 $remainingLines[($insertAfter + 1)..($remainingLines.Count - 1)]
               } else { @() }
    $newLines = $before + $helperLines + $after
  } else {
    $newLines = $helperLines + $remainingLines
  }

  $newContent = $newLines -join "`n"

  if ($newContent -ne $content) {
    [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.Encoding]::UTF8)
    $fixed++
    Write-Host "Relocated imports: $($file.FullName.Replace($routesDir.Path + '\', ''))"
  }
}

Write-Host ""
Write-Host "Done. Fixed $fixed file(s)."
