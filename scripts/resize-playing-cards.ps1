[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$SourceDirectory,
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '../public/assets/cards-game')
)

$ErrorActionPreference = 'Stop'
$sourceDirectory = (Resolve-Path -LiteralPath $SourceDirectory).ProviderPath
$outputDirectory = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
if ($sourceDirectory.TrimEnd('\', '/') -eq $outputDirectory.TrimEnd('\', '/')) {
  throw 'Source and output directories must be different; source images are never overwritten.'
}
if (-not (Test-Path -LiteralPath $sourceDirectory -PathType Container)) {
  throw 'SourceDirectory must be a directory.'
}
$rankNames = @{ ace = 'A'; jack = 'J'; queen = 'Q'; king = 'K' }
$cards = @{}
foreach ($file in Get-ChildItem -LiteralPath $sourceDirectory -Filter '*.png' -File) {
  if ($file.BaseName -notmatch '^(A|[2-9]|10|J|Q|K|ace|jack|queen|king)(?:-|_of_)(clubs|diamonds|hearts|spades)$') {
    continue
  }
  $rank = $Matches[1].ToLowerInvariant()
  if ($rankNames.ContainsKey($rank)) { $rank = $rankNames[$rank] }
  $name = '{0}-{1}.png' -f $rank.ToUpperInvariant(), $Matches[2].ToLowerInvariant()
  if ($cards.ContainsKey($name)) { throw "Duplicate card in source: $name" }
  $cards[$name] = $file.FullName
}
if ($cards.Count -eq 0) { throw 'No recognized card PNGs found in SourceDirectory.' }

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
# Process one image at a time, releasing native memory even when conversion fails.
foreach ($name in ($cards.Keys | Sort-Object)) {
  $sourceImage = $null
  $targetImage = $null
  $graphics = $null
  try {
    $sourceImage = [System.Drawing.Image]::FromFile($cards[$name])
    $targetImage = New-Object System.Drawing.Bitmap 500, 700
    $graphics = [System.Drawing.Graphics]::FromImage($targetImage)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($sourceImage, 0, 0, 500, 700)
    $targetImage.Save((Join-Path $outputDirectory $name), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    if ($null -ne $graphics) { $graphics.Dispose() }
    if ($null -ne $targetImage) { $targetImage.Dispose() }
    if ($null -ne $sourceImage) { $sourceImage.Dispose() }
  }
}
Write-Output "Generated $($cards.Count) game assets (500 x 700); external sources unchanged."
