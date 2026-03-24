<#
  migrate-soft-delete.ps1
  Replaces inline soft-delete patterns with helpers from lib/soft-delete.ts.

  Targets:
    1.  `data: { deletedAt: new Date() }`  →  `data: softDeleteData()`
    2.  `data: { deletedAt: new Date(), ` (merged data object)  →  `data: { ...softDeleteData(), `
    3.  `...(xxx.includeDeleted ? {} : { deletedAt: null })`
            → `...optionallyIncludeDeleted(xxx.includeDeleted)`
    4.  `...(options.includeDeleted ? {} : { deletedAt: null })`
            → `...optionallyIncludeDeleted(options.includeDeleted)`
#>

$routesDir = Resolve-Path "$PSScriptRoot\..\apps\api\src\routes"

function Get-ImportPath {
  param([string]$filePath, [string]$helperFile)
  $fileDir   = Split-Path $filePath -Parent
  $routeRoot = $routesDir.Path

  $rel   = $fileDir.Substring($routeRoot.Length).TrimStart('\').TrimStart('/')
  $depth = if ($rel -eq '') { 0 } else { ($rel -split '[/\\]').Count }
  $prefix = '../' * ($depth + 1)
  return "${prefix}lib/${helperFile}.js"
}

$files = Get-ChildItem -Path $routesDir -Recurse -Filter '*.ts'
$totalFiles = 0

foreach ($file in $files) {
  $content  = [System.IO.File]::ReadAllText($file.FullName)
  $modified = $content

  $usesSoftDeleteData            = $false
  $usesOptionallyIncludeDeleted  = $false

  # ----------------------------------------------------------------
  # 1.  Standalone soft-delete data: the entire data object is just
  #     { deletedAt: new Date() }  (nothing else in the object).
  # ----------------------------------------------------------------
  $standalone = 'data:\s*\{\s*deletedAt:\s*new Date\(\)\s*\}'
  if ($modified -match $standalone) {
    $modified = [regex]::Replace($modified, $standalone, 'data: softDeleteData()')
    $usesSoftDeleteData = $true
  }

  # ----------------------------------------------------------------
  # 2.  Merged soft-delete data: other fields follow the deletedAt.
  #     e.g.  data: { deletedAt: new Date(), name: "x" }
  #     →     data: { ...softDeleteData(), name: "x" }
  # ----------------------------------------------------------------
  $merged = 'data:\s*\{\s*deletedAt:\s*new Date\(\),\s*'
  if ($modified -match $merged) {
    $modified = [regex]::Replace($modified, $merged, 'data: { ...softDeleteData(), ')
    $usesSoftDeleteData = $true
  }

  # ----------------------------------------------------------------
  # 3.  Conditional includeDeleted ternary spread pattern.
  #     Handles the two common variable names: `query` and `options`.
  #     e.g.  ...(query.includeDeleted ? {} : { deletedAt: null })
  #     →     ...optionallyIncludeDeleted(query.includeDeleted)
  # ----------------------------------------------------------------
  $ternaryPattern = '\.\.\.\(\s*(\w+(?:\.\w+)*)\.includeDeleted\s*\?\s*\{\}\s*:\s*\{\s*deletedAt:\s*null\s*\}\s*\)'
  if ($modified -match $ternaryPattern) {
    $modified = [regex]::Replace(
      $modified,
      $ternaryPattern,
      '...optionallyIncludeDeleted($1.includeDeleted)'
    )
    $usesOptionallyIncludeDeleted = $true
  }

  if ($modified -eq $content) { continue }

  # ----------------------------------------------------------------
  # 4.  Inject import (after last "from " line)
  # ----------------------------------------------------------------
  $importPath = Get-ImportPath -filePath $file.FullName -helperFile 'soft-delete'

  $helperNames = @()
  if ($usesSoftDeleteData)           { $helperNames += 'softDeleteData' }
  if ($usesOptionallyIncludeDeleted) { $helperNames += 'optionallyIncludeDeleted' }

  $importLine = "import { $($helperNames -join ', ') } from `"$importPath`";"

  if ($modified -notmatch 'from ".*lib/soft-delete\.js"') {
    $lines = $modified -split "`n"
    $lastImportIdx = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
      if ($lines[$i] -match '^\s*(}?\s*from\s+["\x27]|import\s+)') {
        $lastImportIdx = $i
      }
    }
    if ($lastImportIdx -ge 0) {
      $before  = $lines[0..$lastImportIdx]
      $after   = if ($lastImportIdx + 1 -lt $lines.Count) { $lines[($lastImportIdx + 1)..($lines.Count - 1)] } else { @() }
      $modified = ($before + $importLine + $after) -join "`n"
    } else {
      $modified = $importLine + "`n" + $modified
    }
  }

  [System.IO.File]::WriteAllText($file.FullName, $modified, [System.Text.Encoding]::UTF8)
  $totalFiles++
  Write-Host "Updated: $($file.FullName.Replace($routesDir.Path + '\', ''))"
}

Write-Host ""
Write-Host "Done. Modified $totalFiles file(s)."
