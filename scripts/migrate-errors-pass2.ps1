<#
  migrate-errors-pass2.ps1
  Second pass: covers entity names and 400 messages not in the first pass.
#>

$routesDir = Resolve-Path "$PSScriptRoot\..\apps\api\src\routes"

# -------------------------------------------------------------------
# Helper map: literal message string → helper call
# -------------------------------------------------------------------
$replacements = [ordered]@{

  # ---- 404 -- remaining entities (with period) --------------------
  'reply\.code\(404\)\.send\(\{ message: "Household not found\." \}\)'                         = 'notFound(reply, "Household")'
  'reply\.code\(404\)\.send\(\{ message: "Phase supply not found\." \}\)'                      = 'notFound(reply, "Phase supply")'
  'reply\.code\(404\)\.send\(\{ message: "Practice goal not found\." \}\)'                     = 'notFound(reply, "Practice goal")'
  'reply\.code\(404\)\.send\(\{ message: "Project note not found\." \}\)'                      = 'notFound(reply, "Project note")'
  'reply\.code\(404\)\.send\(\{ message: "Project inventory link not found\." \}\)'            = 'notFound(reply, "Project inventory link")'
  'reply\.code\(404\)\.send\(\{ message: "Hobby log not found\." \}\)'                         = 'notFound(reply, "Hobby log")'
  'reply\.code\(404\)\.send\(\{ message: "Timeline entry not found\." \}\)'                    = 'notFound(reply, "Timeline entry")'
  'reply\.code\(404\)\.send\(\{ message: "Collection item not found\." \}\)'                   = 'notFound(reply, "Collection item")'
  'reply\.code\(404\)\.send\(\{ message: "Preset not found\." \}\)'                            = 'notFound(reply, "Preset")'
  'reply\.code\(404\)\.send\(\{ message: "Part not found\." \}\)'                              = 'notFound(reply, "Part")'
  'reply\.code\(404\)\.send\(\{ message: "Phase checklist item not found\." \}\)'              = 'notFound(reply, "Phase checklist item")'
  'reply\.code\(404\)\.send\(\{ message: "Project asset link not found\." \}\)'                = 'notFound(reply, "Project asset link")'
  'reply\.code\(404\)\.send\(\{ message: "Project expense not found\." \}\)'                   = 'notFound(reply, "Project expense")'
  'reply\.code\(404\)\.send\(\{ message: "Task checklist item not found\." \}\)'               = 'notFound(reply, "Task checklist item")'
  'reply\.code\(404\)\.send\(\{ message: "Webhook endpoint not found\." \}\)'                  = 'notFound(reply, "Webhook endpoint")'
  'reply\.code\(404\)\.send\(\{ message: "Schedule inventory link not found\." \}\)'           = 'notFound(reply, "Schedule inventory link")'
  'reply\.code\(404\)\.send\(\{ message: "Work log not found\." \}\)'                          = 'notFound(reply, "Work log")'
  'reply\.code\(404\)\.send\(\{ message: "Current user not found\." \}\)'                      = 'notFound(reply, "Current user")'
  'reply\.code\(404\)\.send\(\{ message: "Hobby session not found\." \}\)'                     = 'notFound(reply, "Hobby session")'
  'reply\.code\(404\)\.send\(\{ message: "Household member not found\." \}\)'                  = 'notFound(reply, "Household member")'
  'reply\.code\(404\)\.send\(\{ message: "Hobby project inventory link not found\." \}\)'      = 'notFound(reply, "Hobby project inventory link")'
  'reply\.code\(404\)\.send\(\{ message: "Entry target not found\." \}\)'                      = 'notFound(reply, "Entry target")'
  'reply\.code\(404\)\.send\(\{ message: "General item not found\." \}\)'                      = 'notFound(reply, "General item")'
  'reply\.code\(404\)\.send\(\{ message: "Hobby collection item not found\." \}\)'             = 'notFound(reply, "Hobby collection item")'
  'reply\.code\(404\)\.send\(\{ message: "Milestone not found\." \}\)'                         = 'notFound(reply, "Milestone")'
  'reply\.code\(404\)\.send\(\{ message: "Budget category not found\." \}\)'                   = 'notFound(reply, "Budget category")'
  'reply\.code\(404\)\.send\(\{ message: "Target entity not found\." \}\)'                     = 'notFound(reply, "Target entity")'
  'reply\.code\(404\)\.send\(\{ message: "Inventory link not found\." \}\)'                    = 'notFound(reply, "Inventory link")'
  'reply\.code\(404\)\.send\(\{ message: "Invitation not found\." \}\)'                        = 'notFound(reply, "Invitation")'
  'reply\.code\(404\)\.send\(\{ message: "Pending invitation not found\." \}\)'                = 'notFound(reply, "Pending invitation")'
  'reply\.code\(404\)\.send\(\{ message: "Inventory item assignment not found\." \}\)'         = 'notFound(reply, "Inventory item assignment")'
  'reply\.code\(404\)\.send\(\{ message: "Purchase line not found\." \}\)'                     = 'notFound(reply, "Purchase line")'
  'reply\.code\(404\)\.send\(\{ message: "Project template not found\." \}\)'                  = 'notFound(reply, "Project template")'
  'reply\.code\(404\)\.send\(\{ message: "Source project not found\." \}\)'                    = 'notFound(reply, "Source project")'

  # ---- 404 -- remaining entities (without period) -----------------
  'reply\.code\(404\)\.send\(\{ message: "Household not found" \}\)'                           = 'notFound(reply, "Household")'
  'reply\.code\(404\)\.send\(\{ message: "Phase supply not found" \}\)'                        = 'notFound(reply, "Phase supply")'
  'reply\.code\(404\)\.send\(\{ message: "Step not found" \}\)'                                = 'notFound(reply, "Step")'
  'reply\.code\(404\)\.send\(\{ message: "Practice goal not found" \}\)'                       = 'notFound(reply, "Practice goal")'
  'reply\.code\(404\)\.send\(\{ message: "Project note not found" \}\)'                        = 'notFound(reply, "Project note")'
  'reply\.code\(404\)\.send\(\{ message: "Project inventory link not found" \}\)'              = 'notFound(reply, "Project inventory link")'
  'reply\.code\(404\)\.send\(\{ message: "Hobby log not found" \}\)'                           = 'notFound(reply, "Hobby log")'
  'reply\.code\(404\)\.send\(\{ message: "Timeline entry not found" \}\)'                      = 'notFound(reply, "Timeline entry")'
  'reply\.code\(404\)\.send\(\{ message: "Collection item not found" \}\)'                     = 'notFound(reply, "Collection item")'
  'reply\.code\(404\)\.send\(\{ message: "Preset not found" \}\)'                              = 'notFound(reply, "Preset")'
  'reply\.code\(404\)\.send\(\{ message: "Parent folder not found" \}\)'                       = 'notFound(reply, "Parent folder")'
  'reply\.code\(404\)\.send\(\{ message: "Part not found" \}\)'                                = 'notFound(reply, "Part")'
  'reply\.code\(404\)\.send\(\{ message: "Phase checklist item not found" \}\)'                = 'notFound(reply, "Phase checklist item")'
  'reply\.code\(404\)\.send\(\{ message: "Project asset link not found" \}\)'                  = 'notFound(reply, "Project asset link")'
  'reply\.code\(404\)\.send\(\{ message: "Project expense not found" \}\)'                     = 'notFound(reply, "Project expense")'
  'reply\.code\(404\)\.send\(\{ message: "Task checklist item not found" \}\)'                 = 'notFound(reply, "Task checklist item")'
  'reply\.code\(404\)\.send\(\{ message: "Stage checklist item not found" \}\)'                = 'notFound(reply, "Stage checklist item")'
  'reply\.code\(404\)\.send\(\{ message: "Webhook endpoint not found" \}\)'                    = 'notFound(reply, "Webhook endpoint")'
  'reply\.code\(404\)\.send\(\{ message: "Schedule inventory link not found" \}\)'             = 'notFound(reply, "Schedule inventory link")'
  'reply\.code\(404\)\.send\(\{ message: "Work log not found" \}\)'                            = 'notFound(reply, "Work log")'
  'reply\.code\(404\)\.send\(\{ message: "Session stage not found" \}\)'                       = 'notFound(reply, "Session stage")'
  'reply\.code\(404\)\.send\(\{ message: "Session not found in this series\." \}\)'            = 'notFound(reply, "Session not found in this series.")'   # full message passthrough
  'reply\.code\(404\)\.send\(\{ message: "Current user not found" \}\)'                        = 'notFound(reply, "Current user")'
  'reply\.code\(404\)\.send\(\{ message: "Hobby session not found" \}\)'                       = 'notFound(reply, "Hobby session")'
  'reply\.code\(404\)\.send\(\{ message: "Household member not found" \}\)'                    = 'notFound(reply, "Household member")'
  'reply\.code\(404\)\.send\(\{ message: "Hobby project inventory link not found" \}\)'        = 'notFound(reply, "Hobby project inventory link")'
  'reply\.code\(404\)\.send\(\{ message: "Entry target not found" \}\)'                        = 'notFound(reply, "Entry target")'
  'reply\.code\(404\)\.send\(\{ message: "General item not found" \}\)'                        = 'notFound(reply, "General item")'
  'reply\.code\(404\)\.send\(\{ message: "Hobby collection item not found" \}\)'               = 'notFound(reply, "Hobby collection item")'
  'reply\.code\(404\)\.send\(\{ message: "Milestone not found" \}\)'                           = 'notFound(reply, "Milestone")'
  'reply\.code\(404\)\.send\(\{ message: "Budget category not found" \}\)'                     = 'notFound(reply, "Budget category")'
  'reply\.code\(404\)\.send\(\{ message: "Node not found" \}\)'                                = 'notFound(reply, "Node")'
  'reply\.code\(404\)\.send\(\{ message: "Edge not found" \}\)'                                = 'notFound(reply, "Edge")'
  'reply\.code\(404\)\.send\(\{ message: "Inventory link not found" \}\)'                      = 'notFound(reply, "Inventory link")'
  'reply\.code\(404\)\.send\(\{ message: "Invitation not found" \}\)'                          = 'notFound(reply, "Invitation")'
  'reply\.code\(404\)\.send\(\{ message: "Pending invitation not found" \}\)'                  = 'notFound(reply, "Pending invitation")'
  'reply\.code\(404\)\.send\(\{ message: "Inventory item assignment not found" \}\)'           = 'notFound(reply, "Inventory item assignment")'
  'reply\.code\(404\)\.send\(\{ message: "Reading not found" \}\)'                             = 'notFound(reply, "Reading")'
  'reply\.code\(404\)\.send\(\{ message: "Source asset not found" \}\)'                        = 'notFound(reply, "Source asset")'
  'reply\.code\(404\)\.send\(\{ message: "Purchase line not found" \}\)'                       = 'notFound(reply, "Purchase line")'
  'reply\.code\(404\)\.send\(\{ message: "Project link not found" \}\)'                        = 'notFound(reply, "Project link")'
  'reply\.code\(404\)\.send\(\{ message: "Project template not found" \}\)'                    = 'notFound(reply, "Project template")'
  'reply\.code\(404\)\.send\(\{ message: "Source project not found" \}\)'                      = 'notFound(reply, "Source project")'
  'reply\.code\(404\)\.send\(\{ message: "Source hobby not found" \}\)'                        = 'notFound(reply, "Source hobby")'
  'reply\.code\(404\)\.send\(\{ message: "Category not found" \}\)'                            = 'notFound(reply, "Category")'
  'reply\.code\(404\)\.send\(\{ message: "Asset link not found" \}\)'                          = 'notFound(reply, "Asset link")'

  # ---- 400 -- multi-occurrence business messages ------------------
  'reply\.code\(400\)\.send\(\{ message: "Phase not found in this project\." \}\)'                       = 'badRequest(reply, "Phase not found in this project.")'
  'reply\.code\(400\)\.send\(\{ message: "parentItemId must belong to this hobby\." \}\)'                = 'badRequest(reply, "parentItemId must belong to this hobby.")'
  'reply\.code\(400\)\.send\(\{ message: "Referenced budget category not found in this project\." \}\)'  = 'badRequest(reply, "Referenced budget category not found in this project.")'
  'reply\.code\(400\)\.send\(\{ message: "Referenced metric does not belong to this asset\." \}\)'       = 'badRequest(reply, "Referenced metric does not belong to this asset.")'
  'reply\.code\(400\)\.send\(\{ message: "Collection item must belong to this hobby\." \}\)'             = 'badRequest(reply, "Collection item must belong to this hobby.")'
  'reply\.code\(400\)\.send\(\{ message: "Insufficient stock for this allocation\." \}\)'                = 'badRequest(reply, "Insufficient stock for this allocation.")'
  'reply\.code\(400\)\.send\(\{ message: "Parent asset not found or belongs to a different household\." \}\)' = 'badRequest(reply, "Parent asset not found or belongs to a different household.")'
  'reply\.code\(400\)\.send\(\{ message: "Asset not found or belongs to a different household\." \}\)'   = 'badRequest(reply, "Asset not found or belongs to a different household.")'
}

# -------------------------------------------------------------------
# Import-path helper
# -------------------------------------------------------------------
function Get-ImportPath {
  param([string]$filePath, [string]$helperFile)
  $fileDir   = Split-Path $filePath -Parent
  $routeRoot = $routesDir.Path
  $rel   = $fileDir.Substring($routeRoot.Length).TrimStart('\').TrimStart('/')
  $depth = if ($rel -eq '') { 0 } else { ($rel -split '[/\\]').Count }
  $prefix = '../' * ($depth + 1)
  return "${prefix}lib/${helperFile}.js"
}

function Find-ImportSectionEnd {
  param([string[]]$lines)
  $inImport = $false
  $lastImportLine = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($inImport) {
      if ($line -match ';') { $lastImportLine = $i; $inImport = $false }
      continue
    }
    if ($line -match '^\s*$')      { continue }
    if ($line -match '^\s*//')     { continue }
    if ($line -match '^\s*/\*')    { continue }
    if ($line -match '^\s*\*')     { continue }
    if ($line -match '^import ') {
      if ($line -match ';') { $lastImportLine = $i } else { $inImport = $true }
      continue
    }
    break
  }
  return $lastImportLine
}

# -------------------------------------------------------------------
# Process files
# -------------------------------------------------------------------
$files = Get-ChildItem -Path $routesDir -Recurse -Filter '*.ts'
$totalFiles = 0

foreach ($file in $files) {
  $content  = [System.IO.File]::ReadAllText($file.FullName)
  $modified = $content

  $usesNotFound   = $false
  $usesBadRequest = $false

  foreach ($pattern in $replacements.Keys) {
    $replacement = $replacements[$pattern]
    if ($modified -match $pattern) {
      $modified = [regex]::Replace($modified, $pattern, $replacement)
      if ($replacement -match '^notFound')   { $usesNotFound   = $true }
      if ($replacement -match '^badRequest') { $usesBadRequest = $true }
    }
  }

  if ($modified -eq $content) { continue }

  # --- Determine which helpers are already imported ----------------
  $alreadyHasErrors = $modified -match 'from ".*lib/errors\.js"'
  $existingImport   = if ($alreadyHasErrors) {
    [regex]::Match($modified, 'import \{([^}]+)\} from "[^"]*lib/errors\.js";').Groups[1].Value
  } else { '' }

  $existingNames = $existingImport -split ',\s*' | Where-Object { $_ -match '\S' } | ForEach-Object { $_.Trim() }
  $newNeedsNotFound   = $usesNotFound   -and ($existingNames -notcontains 'notFound')
  $newNeedsBadRequest = $usesBadRequest -and ($existingNames -notcontains 'badRequest')

  if ($alreadyHasErrors) {
    # Update the existing import to add missing names
    if ($newNeedsNotFound -or $newNeedsBadRequest) {
      $allNames = $existingNames
      if ($newNeedsNotFound)   { $allNames += 'notFound' }
      if ($newNeedsBadRequest) { $allNames += 'badRequest' }
      $newImportLine = "import { $($allNames -join ', ') } from `"$(([regex]::Match($modified, 'from "([^"]*lib/errors\.js)"')).Groups[1].Value)`";"
      $modified = [regex]::Replace(
        $modified,
        'import \{[^}]+\} from "[^"]*lib/errors\.js";',
        $newImportLine
      )
    }
  } else {
    # Need to add a fresh import
    $importPath = Get-ImportPath -filePath $file.FullName -helperFile 'errors'
    $helperNames = @()
    if ($usesNotFound)   { $helperNames += 'notFound' }
    if ($usesBadRequest) { $helperNames += 'badRequest' }
    $importLine = "import { $($helperNames -join ', ') } from `"$importPath`";"

    # Remove any existing helper imports, then re-add at the right place
    $lines = $modified -split "`n"
    $helperLines   = @($importLine)
    $remainingLines = $lines | Where-Object { $_ -notmatch "^import \{[^}]+\} from `"[^`"]*lib/(errors|soft-delete)\.js`";" }
    $insertAfter = Find-ImportSectionEnd -lines $remainingLines

    if ($insertAfter -ge 0) {
      $before   = $remainingLines[0..$insertAfter]
      $after    = if ($insertAfter + 1 -lt $remainingLines.Count) { $remainingLines[($insertAfter + 1)..($remainingLines.Count - 1)] } else { @() }
      $modified = ($before + $helperLines + $after) -join "`n"
    } else {
      $modified = ($helperLines + $remainingLines) -join "`n"
    }
  }

  [System.IO.File]::WriteAllText($file.FullName, $modified, [System.Text.Encoding]::UTF8)
  $totalFiles++
  Write-Host "Updated: $($file.FullName.Replace($routesDir.Path + '\', ''))"
}

Write-Host ""
Write-Host "Done. Modified $totalFiles file(s)."
