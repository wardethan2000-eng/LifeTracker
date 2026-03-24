<#
  migrate-activity-log.ps1

  For each route file: replaces the 6-line logActivity call with a one-liner
  using createActivityLogger, and replaces logActivity+emitDomainEvent pairs
  with logAndEmit.

  Strategy:
    1. For each file, scan for the pattern blocks using regex.
    2. Two types of transforms:
       a. isolated logActivity blocks  →  logger.log(...)
       b. Promise.all([logActivity, emitDomainEvent])  →  logAndEmit(...)
    3. If any transform was applied, add createActivityLogger/logAndEmit to
       imports and insert  `const logger = createActivityLogger(...)`  at the
       top of each route handler function.

  NOTE: This script does NOT do the route-level factory insertion (that requires
  AST-level awareness of route handler scope boundaries). Instead it:
    - Replaces standalone `await logActivity(app.prisma, { ... })` blocks
      with `await createActivityLogger(app.prisma, userId).log(...)` calls.
    - Replaces Promise.all([logActivity(...), emitDomainEvent(...)]) pairs
      with `await logAndEmit(...)`.

  The factory pattern (binding userId once) is left as a follow-on refactor
  for each individual file since it requires knowing where to insert `const logger`.
#>

$routesDir = Resolve-Path "$PSScriptRoot\..\apps\api\src\routes"

function Get-ImportPath {
  param([string]$filePath, [string]$helperModule)
  $fileDir   = Split-Path $filePath -Parent
  $routeRoot = $routesDir.Path
  $rel   = $fileDir.Substring($routeRoot.Length).TrimStart('\').TrimStart('/')
  $depth = if ($rel -eq '') { 0 } else { ($rel -split '[/\\]').Count }
  $prefix = '../' * ($depth + 1)
  return "${prefix}lib/${helperModule}.js"
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
    if ($line -match '^\s*$')   { continue }
    if ($line -match '^\s*//')  { continue }
    if ($line -match '^\s*/\*') { continue }
    if ($line -match '^\s*\*')  { continue }
    if ($line -match '^import ') {
      if ($line -match ';') { $lastImportLine = $i } else { $inImport = $true }
      continue
    }
    break
  }
  return $lastImportLine
}

$files   = Get-ChildItem -Path $routesDir -Recurse -Filter '*.ts'
$updated = 0

foreach ($file in $files) {
  $content  = [System.IO.File]::ReadAllText($file.FullName)
  $modified = $content

  $usesLogAndEmit        = $false
  $usesLogActivity       = $false

  # ----------------------------------------------------------------
  # 1. Replace Promise.all([logActivity(...), emitDomainEvent(...)])
  #    with logAndEmit(prisma, userId, { ... })
  #
  #    Pattern (simplified): two sibling calls inside Promise.all
  #    sharing householdId/entityType/entityId with matching action=eventType
  #    and metadata=payload.
  #
  #    We match the exact structure used throughout the codebase:
  #
  #    await Promise.all([
  #      logActivity(app.prisma, {
  #        householdId: <hid>,
  #        userId: <uid>,
  #        action: "<action>",
  #        entityType: "<et>",
  #        entityId: <eid>,
  #        metadata: <meta>
  #      }),
  #      emitDomainEvent(app.prisma, {
  #        householdId: <hid>,
  #        eventType: "<action>",
  #        entityType: "<et>",
  #        entityId: <eid>,
  #        payload: <meta>
  #      })
  #    ]);
  # ----------------------------------------------------------------

  $pairPattern = '(?s)await Promise\.all\(\[\s*' +
    'logActivity\((\w+(?:\.\w+)*),\s*\{' +
      '\s*householdId:\s*([^,\n]+),\s*' +
      'userId:\s*([^,\n]+),\s*' +
      'action:\s*("[\w.]+"|\S+),\s*' +
      'entityType:\s*("[\w.]+"|\S+),\s*' +
      'entityId:\s*([^,\n]+),\s*' +
      '(?:metadata:\s*([\s\S]*?))?\s*\}\s*\),\s*' +
    'emitDomainEvent\(\1,\s*\{' +
      '\s*householdId:\s*\2,\s*' +
      'eventType:\s*\4,\s*' +
      'entityType:\s*\5,\s*' +
      'entityId:\s*\6,\s*' +
      '(?:payload:\s*([\s\S]*?))?\s*\}\s*\)\s*' +
    '\]\s*\);'

  $matches = [regex]::Matches($modified, $pairPattern)
  foreach ($m in $matches) {
    $prismaArg  = $m.Groups[1].Value
    $hid        = $m.Groups[2].Value.Trim()
    $uid        = $m.Groups[3].Value.Trim()
    $action     = $m.Groups[4].Value.Trim()
    $entityType = $m.Groups[5].Value.Trim()
    $entityId   = $m.Groups[6].Value.Trim()
    $metadata   = $m.Groups[7].Value.Trim()

    $replacement = "await logAndEmit($prismaArg, $uid, {`n" +
      "      householdId: $hid,`n" +
      "      entityType: $entityType,`n" +
      "      entityId: $entityId,`n" +
      "      action: $action," +
      $(if ($metadata) { "`n      metadata: $metadata," }) +
      "`n    });"

    $modified = $modified.Replace($m.Value, $replacement)
    $usesLogAndEmit = $true
  }

  # ----------------------------------------------------------------
  # 2. Replace standalone  await logActivity(app.prisma, { ... })
  #    with a single-liner using createActivityLogger
  #
  #    We target the specific 6-field block structure.
  # ----------------------------------------------------------------

  $soloPattern = '(?s)(await |return )?logActivity\((\w+(?:\.\w+)*),\s*\{' +
    '\s*householdId:\s*([^,\n]+),\s*' +
    'userId:\s*([^,\n]+),\s*' +
    'action:\s*("[\w.]+"),\s*' +
    'entityType:\s*("[\w.]+"),\s*' +
    'entityId:\s*([^,\n]+),\s*' +
    '(?:metadata:\s*([\s\S]*?))?\s*' +
    '\}\s*\)'

  $soloMatches = [regex]::Matches($modified, $soloPattern)
  foreach ($m in $soloMatches) {
    $prefix     = $m.Groups[1].Value
    $prismaArg  = $m.Groups[2].Value
    $hid        = $m.Groups[3].Value.Trim()
    $uid        = $m.Groups[4].Value.Trim()
    $action     = $m.Groups[5].Value.Trim()
    $entityType = $m.Groups[6].Value.Trim()
    $entityId   = $m.Groups[7].Value.Trim()
    $meta       = $m.Groups[8].Value.Trim()

    if ($meta) {
      $replacement = "${prefix}createActivityLogger($prismaArg, $uid).log($entityType, $entityId, $action, $hid, $meta)"
    } else {
      $replacement = "${prefix}createActivityLogger($prismaArg, $uid).log($entityType, $entityId, $action, $hid)"
    }

    $modified = $modified.Replace($m.Value, $replacement)
    $usesLogActivity = $true
  }

  if ($modified -eq $content) { continue }

  # ----------------------------------------------------------------
  # 3. Update imports
  # ----------------------------------------------------------------
  $activityImportPath = Get-ImportPath -filePath $file.FullName -helperModule 'activity-log'

  # Helpers to add
  $newHelpers = @()
  if ($usesLogAndEmit)  { $newHelpers += 'logAndEmit' }
  if ($usesLogActivity) { $newHelpers += 'createActivityLogger' }

  # Find the existing logActivity import line and extend it, or add fresh
  if ($modified -match 'from ".*lib/activity-log\.js"') {
    # Extract currently imported names
    $existingMatch = [regex]::Match($modified, 'import \{([^}]+)\} from "([^"]*/lib/activity-log\.js)";')
    if ($existingMatch.Success) {
      $existingNames = ($existingMatch.Groups[1].Value -split ',\s*') | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '\S' }

      # Remove helpers that are no longer needed after the transform
      $existingNames = $existingNames | Where-Object { $_ -ne 'logActivity' -or $modified -match '\blogActivity\(' }

      $allNames = ($existingNames + $newHelpers) | Sort-Object -Unique
      $newImportLine = "import { $($allNames -join ', ') } from `"$($existingMatch.Groups[2].Value)`";"
      $modified = [regex]::Replace($modified, 'import \{[^}]+\} from "[^"]*lib/activity-log\.js";', $newImportLine)
    }
  } else {
    # Add fresh import
    $importLine = "import { $($newHelpers -join ', ') } from `"$activityImportPath`";"
    $helperLines = @($importLine)
    $lines = $modified -split "`n"
    $remainingLines = $lines
    $insertAfter = Find-ImportSectionEnd -lines $remainingLines
    if ($insertAfter -ge 0) {
      $before   = $remainingLines[0..$insertAfter]
      $after    = if ($insertAfter + 1 -lt $remainingLines.Count) { $remainingLines[($insertAfter + 1)..($remainingLines.Count - 1)] } else { @() }
      $modified = ($before + $helperLines + $after) -join "`n"
    } else {
      $modified = ($helperLines + $remainingLines) -join "`n"
    }
  }

  # Also ensure emitDomainEvent import is removed from files that no longer use it
  # (only if logAndEmit replaced all emitDomainEvent calls)
  # Actually - don't remove emitDomainEvent; may still be needed elsewhere.

  [System.IO.File]::WriteAllText($file.FullName, $modified, [System.Text.Encoding]::UTF8)
  $updated++
  Write-Host "Updated: $($file.FullName.Replace($routesDir.Path + '\', ''))"
}

Write-Host ""
Write-Host "Done. Updated $updated file(s)."
