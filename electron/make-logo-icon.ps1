param(
    [string]$SourcePath = "electron/logo.jpg",
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

# Déterminer la couleur de fond depuis les coins de l'image
$srcBmp = New-Object System.Drawing.Bitmap $img
$cornerColor = $srcBmp.GetPixel(10, 10)

$targetSize = 256
$squareBmp = New-Object System.Drawing.Bitmap $targetSize, $targetSize
$gfx = [System.Drawing.Graphics]::FromImage($squareBmp)

$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gfx.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

# Remplir le fond avec la couleur assortie
$brush = New-Object System.Drawing.SolidBrush $cornerColor
$gfx.FillRectangle($brush, 0, 0, $targetSize, $targetSize)
$brush.Dispose()

# Calculer les dimensions pour centrer l'image sans déformation
$scale = [Math]::Min($targetSize / $img.Width, $targetSize / $img.Height)
$destW = [int]($img.Width * $scale)
$destH = [int]($img.Height * $scale)
$destX = [int](($targetSize - $destW) / 2)
$destY = [int](($targetSize - $destH) / 2)

$gfx.DrawImage($img, $destX, $destY, $destW, $destH)
$gfx.Dispose()

# Convertir en icône Windows
$hIcon = $squareBmp.GetHicon()
$ico = [System.Drawing.Icon]::FromHandle($hIcon)

$fs = New-Object System.IO.FileStream $fullOutput, ([System.IO.FileMode]::Create)
$ico.Save($fs)
$fs.Close()

$squareBmp.Dispose()
$srcBmp.Dispose()
$img.Dispose()

Write-Output "Icône Windows (.ico) générée avec succès depuis le logo officiel : $fullOutput"

