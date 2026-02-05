# PowerShell script to export OpenSCAD file to STL
# Requires OpenSCAD to be installed

param(
    [string]$InputFile = "raspberry-pi-touchscreen-case.scad",
    [string]$OutputFile = "raspberry-pi-touchscreen-case.stl"
)

# Try to find OpenSCAD in common locations
$openscadPaths = @(
    "C:\Program Files\OpenSCAD\openscad.exe",
    "$env:LOCALAPPDATA\Programs\OpenSCAD\openscad.exe",
    "$env:ProgramFiles\OpenSCAD\openscad.exe",
    "openscad.exe"  # Try if in PATH
)

$openscad = $null
foreach ($path in $openscadPaths) {
    if (Test-Path $path) {
        $openscad = $path
        break
    }
    # Also try if it's in PATH
    if ($path -eq "openscad.exe") {
        $found = Get-Command openscad.exe -ErrorAction SilentlyContinue
        if ($found) {
            $openscad = $found.Path
            break
        }
    }
}

if (-not $openscad) {
    Write-Host "ERROR: OpenSCAD not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install OpenSCAD from: https://openscad.org/downloads.html" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or manually export:" -ForegroundColor Yellow
    Write-Host "1. Open raspberry-pi-touchscreen-case.scad in OpenSCAD" -ForegroundColor Cyan
    Write-Host "2. Press F6 to render" -ForegroundColor Cyan
    Write-Host "3. Go to File > Export > Export as STL" -ForegroundColor Cyan
    exit 1
}

if (-not (Test-Path $InputFile)) {
    Write-Host "ERROR: Input file not found: $InputFile" -ForegroundColor Red
    exit 1
}

Write-Host "Found OpenSCAD at: $openscad" -ForegroundColor Green
Write-Host "Exporting $InputFile to $OutputFile..." -ForegroundColor Yellow

# Export to STL using OpenSCAD command line
& $openscad -o $OutputFile $InputFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: STL file created: $OutputFile" -ForegroundColor Green
} else {
    Write-Host "ERROR: Export failed. Exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
