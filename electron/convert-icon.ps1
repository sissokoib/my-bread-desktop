param(
    [string]$SourcePath = "public/images/pain-3d.png",
    [string]$OutputPath = "electron/icon.ico"
)

Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir "..")

$fullSource = Join-Path $root $SourcePath
$fullOutput = Join-Path $root $OutputPath

if (-not (Test-Path $fullSource)) {
    Write-Error "Source image introuvable : $fullSource"
    exit 1
}

$img = [System.Drawing.Image]::FromFile($fullSource)
$bmp = New-Object System.Drawing.Bitmap $img, 256, 256
$hIcon = $bmp.GetHicon()
$ico = [System.Drawing.Icon]::FromHandle($hIcon)

$fs = New-Object System.IO.FileStream $fullOutput, ([System.IO.FileMode]::Create)
$ico.Save($fs)
$fs.Close()

$bmp.Dispose()
$img.Dispose()

Write-Output "Icône générée avec succès : $fullOutput"
