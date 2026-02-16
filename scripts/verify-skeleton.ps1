$required = @(
  'E:\mcp\packages\core\src\index.ts',
  'E:\mcp\packages\cli\src\index.ts',
  'E:\mcp\packages\backend\src\main.ts',
  'E:\mcp\packages\shared\src\index.ts'
)

$missing = $required | Where-Object { -not (Test-Path $_) }
if ($missing.Count -gt 0) {
  throw "Missing skeleton files: $($missing -join ', ')"
}

Write-Host 'Skeleton verification passed'
