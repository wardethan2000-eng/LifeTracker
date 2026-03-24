<#
  migrate-errors.ps1
  Replaces inline reply.code(4xx).send({message:...}) calls with helpers from lib/errors.ts.
  Adds the necessary import to each modified file.
#>

$routesDir = Resolve-Path "$PSScriptRoot\..\apps\api\src\routes"

# -------------------------------------------------------------------
# 1.  Build the list of (pattern → replacement) pairs.
#     Order matters: longer/more-specific patterns first.
# -------------------------------------------------------------------

$replacements = [ordered]@{
  # ---- 403 -------------------------------------------------------
  'reply\.code\(403\)\.send\(\{ message: "You do not have access to this household\." \}\)' =
    'forbidden(reply)'

  # ---- 404  (with trailing period) --------------------------------
  'reply\.code\(404\)\.send\(\{ message: "Asset not found\." \}\)'              = 'notFound(reply, "Asset")'
  'reply\.code\(404\)\.send\(\{ message: "Project not found\." \}\)'            = 'notFound(reply, "Project")'
  'reply\.code\(404\)\.send\(\{ message: "Hobby not found\." \}\)'              = 'notFound(reply, "Hobby")'
  'reply\.code\(404\)\.send\(\{ message: "Hobby project not found\." \}\)'      = 'notFound(reply, "Hobby project")'
  'reply\.code\(404\)\.send\(\{ message: "Inventory item not found\." \}\)'     = 'notFound(reply, "Inventory item")'
  'reply\.code\(404\)\.send\(\{ message: "Space not found\." \}\)'              = 'notFound(reply, "Space")'
  'reply\.code\(404\)\.send\(\{ message: "Maintenance schedule not found\." \}\)' = 'notFound(reply, "Maintenance schedule")'
  'reply\.code\(404\)\.send\(\{ message: "Schedule not found\." \}\)'           = 'notFound(reply, "Schedule")'
  'reply\.code\(404\)\.send\(\{ message: "Project phase not found\." \}\)'      = 'notFound(reply, "Project phase")'
  'reply\.code\(404\)\.send\(\{ message: "Project task not found\." \}\)'       = 'notFound(reply, "Project task")'
  'reply\.code\(404\)\.send\(\{ message: "Usage metric not found\." \}\)'       = 'notFound(reply, "Usage metric")'
  'reply\.code\(404\)\.send\(\{ message: "Maintenance log not found\." \}\)'    = 'notFound(reply, "Maintenance log")'
  'reply\.code\(404\)\.send\(\{ message: "Preset profile not found\." \}\)'     = 'notFound(reply, "Preset profile")'
  'reply\.code\(404\)\.send\(\{ message: "Practice routine not found\." \}\)'   = 'notFound(reply, "Practice routine")'
  'reply\.code\(404\)\.send\(\{ message: "Notification not found\." \}\)'       = 'notFound(reply, "Notification")'
  'reply\.code\(404\)\.send\(\{ message: "Webhook not found\." \}\)'            = 'notFound(reply, "Webhook")'
  'reply\.code\(404\)\.send\(\{ message: "Note not found\." \}\)'               = 'notFound(reply, "Note")'
  'reply\.code\(404\)\.send\(\{ message: "Attachment not found\." \}\)'         = 'notFound(reply, "Attachment")'
  'reply\.code\(404\)\.send\(\{ message: "Comment not found\." \}\)'            = 'notFound(reply, "Comment")'
  'reply\.code\(404\)\.send\(\{ message: "Log not found\." \}\)'                = 'notFound(reply, "Log")'
  'reply\.code\(404\)\.send\(\{ message: "Share link not found\." \}\)'         = 'notFound(reply, "Share link")'
  'reply\.code\(404\)\.send\(\{ message: "Dashboard pin not found\." \}\)'      = 'notFound(reply, "Dashboard pin")'
  'reply\.code\(404\)\.send\(\{ message: "Canvas not found\." \}\)'             = 'notFound(reply, "Canvas")'
  'reply\.code\(404\)\.send\(\{ message: "Entry not found\." \}\)'              = 'notFound(reply, "Entry")'
  'reply\.code\(404\)\.send\(\{ message: "Scan not found\." \}\)'               = 'notFound(reply, "Scan")'
  'reply\.code\(404\)\.send\(\{ message: "Idea not found\." \}\)'               = 'notFound(reply, "Idea")'
  'reply\.code\(404\)\.send\(\{ message: "Service provider not found\." \}\)'   = 'notFound(reply, "Service provider")'
  'reply\.code\(404\)\.send\(\{ message: "Custom field not found\." \}\)'       = 'notFound(reply, "Custom field")'
  'reply\.code\(404\)\.send\(\{ message: "Metric definition not found\." \}\)'  = 'notFound(reply, "Metric definition")'
  'reply\.code\(404\)\.send\(\{ message: "Project milestone not found\." \}\)'  = 'notFound(reply, "Project milestone")'
  'reply\.code\(404\)\.send\(\{ message: "Supply not found\." \}\)'             = 'notFound(reply, "Supply")'
  'reply\.code\(404\)\.send\(\{ message: "Template not found\." \}\)'           = 'notFound(reply, "Template")'
  'reply\.code\(404\)\.send\(\{ message: "Transfer not found\." \}\)'           = 'notFound(reply, "Transfer")'
  'reply\.code\(404\)\.send\(\{ message: "User not found\." \}\)'               = 'notFound(reply, "User")'
  'reply\.code\(404\)\.send\(\{ message: "Folder not found\." \}\)'             = 'notFound(reply, "Folder")'
  'reply\.code\(404\)\.send\(\{ message: "Tag not found\." \}\)'                = 'notFound(reply, "Tag")'

  # ---- 404  (without trailing period – normalise to helper) -------
  'reply\.code\(404\)\.send\(\{ message: "Asset not found" \}\)'              = 'notFound(reply, "Asset")'
  'reply\.code\(404\)\.send\(\{ message: "Project not found" \}\)'            = 'notFound(reply, "Project")'
  'reply\.code\(404\)\.send\(\{ message: "Hobby not found" \}\)'              = 'notFound(reply, "Hobby")'
  'reply\.code\(404\)\.send\(\{ message: "Hobby project not found" \}\)'      = 'notFound(reply, "Hobby project")'
  'reply\.code\(404\)\.send\(\{ message: "Inventory item not found" \}\)'     = 'notFound(reply, "Inventory item")'
  'reply\.code\(404\)\.send\(\{ message: "Space not found" \}\)'              = 'notFound(reply, "Space")'
  'reply\.code\(404\)\.send\(\{ message: "Schedule not found" \}\)'           = 'notFound(reply, "Schedule")'
  'reply\.code\(404\)\.send\(\{ message: "Project phase not found" \}\)'      = 'notFound(reply, "Project phase")'
  'reply\.code\(404\)\.send\(\{ message: "Project task not found" \}\)'       = 'notFound(reply, "Project task")'
  'reply\.code\(404\)\.send\(\{ message: "Session not found" \}\)'            = 'notFound(reply, "Session")'
  'reply\.code\(404\)\.send\(\{ message: "Recipe not found" \}\)'             = 'notFound(reply, "Recipe")'
  'reply\.code\(404\)\.send\(\{ message: "Idea not found" \}\)'               = 'notFound(reply, "Idea")'
  'reply\.code\(404\)\.send\(\{ message: "Canvas not found" \}\)'             = 'notFound(reply, "Canvas")'
  'reply\.code\(404\)\.send\(\{ message: "Series not found" \}\)'             = 'notFound(reply, "Series")'
  'reply\.code\(404\)\.send\(\{ message: "Ingredient not found" \}\)'         = 'notFound(reply, "Ingredient")'
  'reply\.code\(404\)\.send\(\{ message: "Metric not found" \}\)'             = 'notFound(reply, "Metric")'
  'reply\.code\(404\)\.send\(\{ message: "Goal not found" \}\)'               = 'notFound(reply, "Goal")'
  'reply\.code\(404\)\.send\(\{ message: "Milestone not found" \}\)'          = 'notFound(reply, "Milestone")'
  'reply\.code\(404\)\.send\(\{ message: "Checklist item not found" \}\)'     = 'notFound(reply, "Checklist item")'
  'reply\.code\(404\)\.send\(\{ message: "Phase not found" \}\)'              = 'notFound(reply, "Phase")'
  'reply\.code\(404\)\.send\(\{ message: "Practice not found" \}\)'           = 'notFound(reply, "Practice")'
  'reply\.code\(404\)\.send\(\{ message: "Routine not found" \}\)'            = 'notFound(reply, "Routine")'
  'reply\.code\(404\)\.send\(\{ message: "Note not found" \}\)'               = 'notFound(reply, "Note")'
  'reply\.code\(404\)\.send\(\{ message: "Folder not found" \}\)'             = 'notFound(reply, "Folder")'
  'reply\.code\(404\)\.send\(\{ message: "Tag not found" \}\)'                = 'notFound(reply, "Tag")'
  'reply\.code\(404\)\.send\(\{ message: "Log not found" \}\)'                = 'notFound(reply, "Log")'
  'reply\.code\(404\)\.send\(\{ message: "Notification not found" \}\)'       = 'notFound(reply, "Notification")'
  'reply\.code\(404\)\.send\(\{ message: "Webhook not found" \}\)'            = 'notFound(reply, "Webhook")'
  'reply\.code\(404\)\.send\(\{ message: "Entry not found" \}\)'              = 'notFound(reply, "Entry")'
  'reply\.code\(404\)\.send\(\{ message: "Attachment not found" \}\)'         = 'notFound(reply, "Attachment")'
  'reply\.code\(404\)\.send\(\{ message: "Comment not found" \}\)'            = 'notFound(reply, "Comment")'
  'reply\.code\(404\)\.send\(\{ message: "Template not found" \}\)'           = 'notFound(reply, "Template")'
  'reply\.code\(404\)\.send\(\{ message: "Transfer not found" \}\)'           = 'notFound(reply, "Transfer")'
  'reply\.code\(404\)\.send\(\{ message: "User not found" \}\)'               = 'notFound(reply, "User")'
  'reply\.code\(404\)\.send\(\{ message: "Supply not found" \}\)'             = 'notFound(reply, "Supply")'
  'reply\.code\(404\)\.send\(\{ message: "Dashboard pin not found" \}\)'      = 'notFound(reply, "Dashboard pin")'
  'reply\.code\(404\)\.send\(\{ message: "Share link not found" \}\)'         = 'notFound(reply, "Share link")'
  'reply\.code\(404\)\.send\(\{ message: "Custom field not found" \}\)'       = 'notFound(reply, "Custom field")'
  'reply\.code\(404\)\.send\(\{ message: "Metric definition not found" \}\)'  = 'notFound(reply, "Metric definition")'
  'reply\.code\(404\)\.send\(\{ message: "Service provider not found" \}\)'   = 'notFound(reply, "Service provider")'
  'reply\.code\(404\)\.send\(\{ message: "Scan not found" \}\)'               = 'notFound(reply, "Scan")'

  # ---- 400  (high-frequency specific messages) --------------------
  'reply\.code\(400\)\.send\(\{ message: "Inventory item not found or belongs to a different household\." \}\)' =
    'badRequest(reply, "Inventory item not found or belongs to a different household.")'
  'reply\.code\(400\)\.send\(\{ message: "Assigned user is not a member of this household\." \}\)' =
    'badRequest(reply, "Assigned user is not a member of this household.")'
  'reply\.code\(400\)\.send\(\{ message: "Service provider not found or belongs to a different household\." \}\)' =
    'badRequest(reply, "Service provider not found or belongs to a different household.")'
  'reply\.code\(400\)\.send\(\{ message: "entityType\/entityId cannot conflict with the route target\." \}\)' =
    'badRequest(reply, "entityType/entityId cannot conflict with the route target.")'
  'reply\.code\(400\)\.send\(\{ message: "Invalid entry cursor\." \}\)' =
    'badRequest(reply, "Invalid entry cursor.")'
  'reply\.code\(400\)\.send\(\{ message: "Referenced phase not found in this project\." \}\)' =
    'badRequest(reply, "Referenced phase not found in this project.")'
  'reply\.code\(400\)\.send\(\{ message: "Referenced task not found in this project\." \}\)' =
    'badRequest(reply, "Referenced task not found in this project.")'
  'reply\.code\(400\)\.send\(\{ message: "Linked schedule not found or belongs to a different household\." \}\)' =
    'badRequest(reply, "Linked schedule not found or belongs to a different household.")'
  'reply\.code\(400\)\.send\(\{ message: "metricDefinitionId is required for metric_target goals\." \}\)' =
    'badRequest(reply, "metricDefinitionId is required for metric_target goals.")'
  'reply\.code\(400\)\.send\(\{ message: "Milestone not found for this hobby project\." \}\)' =
    'badRequest(reply, "Milestone not found for this hobby project.")'
  'reply\.code\(400\)\.send\(\{ message: "Metric definition must belong to this hobby\." \}\)' =
    'badRequest(reply, "Metric definition must belong to this hobby.")'
  'reply\.code\(400\)\.send\(\{ message: "Session not found in this hobby\." \}\)' =
    'badRequest(reply, "Session not found in this hobby.")'
  'reply\.code\(400\)\.send\(\{ message: "Routine must belong to this hobby\." \}\)' =
    'badRequest(reply, "Routine must belong to this hobby.")'
  'reply\.code\(400\)\.send\(\{ message: "Series must belong to the same hobby\." \}\)' =
    'badRequest(reply, "Series must belong to the same hobby.")'
}

# -------------------------------------------------------------------
# 2.  Helper: determine the correct relative import path
# -------------------------------------------------------------------
function Get-ImportPath {
  param([string]$filePath, [string]$helperFile)
  $fileDir   = Split-Path $filePath -Parent
  $routeRoot = (Resolve-Path "$PSScriptRoot\..\apps\api\src\routes").Path

  # Depth relative to routes root
  $rel = $fileDir.Substring($routeRoot.Length).TrimStart('\').TrimStart('/')
  $depth = if ($rel -eq '') { 0 } else { ($rel -split '[/\\]').Count }

  $prefix = '../' * ($depth + 2)          # up from routes/sub/ to src/, then into lib/
  return "${prefix}lib/${helperFile}.js"
}

# -------------------------------------------------------------------
# 3.  Process every .ts file under routes/
# -------------------------------------------------------------------
$files = Get-ChildItem -Path $routesDir -Recurse -Filter '*.ts'
$totalFiles  = 0
$totalChanges = 0

foreach ($file in $files) {
  $content  = [System.IO.File]::ReadAllText($file.FullName)
  $modified = $content

  $usesForbidden  = $false
  $usesNotFound   = $false
  $usesBadRequest = $false

  foreach ($pattern in $replacements.Keys) {
    $replacement = $replacements[$pattern]
    if ($modified -match $pattern) {
      $modified = [regex]::Replace($modified, $pattern, $replacement)

      if ($replacement -match '^forbidden') { $usesForbidden  = $true }
      if ($replacement -match '^notFound')  { $usesNotFound   = $true }
      if ($replacement -match '^badRequest') { $usesBadRequest = $true }
    }
  }

  if ($modified -eq $content) { continue }

  # ----------------------------------------------------------------
  # 4.  Build import statement and inject it after last "from" line
  # ----------------------------------------------------------------
  $importPath = Get-ImportPath -filePath $file.FullName -helperFile 'errors'

  $helperNames = @()
  if ($usesForbidden)  { $helperNames += 'forbidden'  }
  if ($usesNotFound)   { $helperNames += 'notFound'   }
  if ($usesBadRequest) { $helperNames += 'badRequest' }

  $importLine = "import { $($helperNames -join ', ') } from `"$importPath`";"

  # Only add if not already imported (idempotent)
  if ($modified -notmatch 'from ".*lib/errors\.js"') {
    # Find the last line that contains "from " in an import context
    $lines = $modified -split "`n"
    $lastImportIdx = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
      # Match both ' from "' and  "} from '" endings
      if ($lines[$i] -match '^\s*(}?\s*from\s+["\x27]|import\s+)') {
        $lastImportIdx = $i
      }
    }
    if ($lastImportIdx -ge 0) {
      $linesBefore = $lines[0..$lastImportIdx]
      $linesAfter  = if ($lastImportIdx + 1 -lt $lines.Count) { $lines[($lastImportIdx + 1)..($lines.Count - 1)] } else { @() }
      $modified    = ($linesBefore + $importLine + $linesAfter) -join "`n"
    } else {
      $modified = $importLine + "`n" + $modified
    }
  }

  [System.IO.File]::WriteAllText($file.FullName, $modified, [System.Text.Encoding]::UTF8)
  $totalFiles++
  $totalChanges++
  Write-Host "Updated: $($file.FullName.Replace($routesDir.Path + '\', ''))"
}

Write-Host ""
Write-Host "Done. Modified $totalFiles file(s)."
