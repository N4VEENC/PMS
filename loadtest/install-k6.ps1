$ErrorActionPreference = 'Stop'

$toolsDirectory = Join-Path $PSScriptRoot '.tools\k6'
$workingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("k6-portable-" + [guid]::NewGuid().ToString('N'))
$installerPath = Join-Path $workingDirectory 'k6-latest-amd64.msi'
$extractDirectory = Join-Path $workingDirectory 'extracted'
$installerUri = 'https://dl.k6.io/msi/k6-latest-amd64.msi'

try {
    New-Item -ItemType Directory -Path $workingDirectory | Out-Null

    Write-Host 'Downloading the official k6 Windows installer...'
    & curl.exe --fail --location --retry 3 --retry-all-errors --retry-delay 2 `
        --connect-timeout 20 --output $installerPath $installerUri
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "The download failed TLS certificate revocation checking (curl exit code $LASTEXITCODE). Retrying with revocation checking disabled; the MSI signature will still be verified."
        & curl.exe --fail --location --retry 3 --retry-all-errors --retry-delay 2 `
            --connect-timeout 20 --ssl-no-revoke --output $installerPath $installerUri
        if ($LASTEXITCODE -ne 0) {
            throw "Could not download the official k6 installer (curl exit code $LASTEXITCODE). Check access to dl.k6.io and try again."
        }
    }

    $signature = Get-AuthenticodeSignature -LiteralPath $installerPath
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Grafana Labs') {
        throw "The downloaded MSI does not have a valid Grafana Labs Authenticode signature (status: $($signature.Status))."
    }

    New-Item -ItemType Directory -Path $extractDirectory | Out-Null
    $extractProcess = Start-Process -FilePath 'msiexec.exe' `
        -ArgumentList @('/a', "`"$installerPath`"", '/qn', "TARGETDIR=`"$extractDirectory`"") `
        -Wait `
        -PassThru
    if ($extractProcess.ExitCode -ne 0) {
        throw "Could not extract the signed k6 MSI (msiexec exit code $($extractProcess.ExitCode))."
    }

    $binary = Get-ChildItem -LiteralPath $extractDirectory -Filter 'k6.exe' -File -Recurse |
        Select-Object -First 1
    if ($null -eq $binary) {
        throw 'The signed k6 MSI did not contain k6.exe.'
    }

    New-Item -ItemType Directory -Path $toolsDirectory -Force | Out-Null
    $installedBinary = Join-Path $toolsDirectory 'k6.exe'
    Copy-Item -LiteralPath $binary.FullName -Destination $installedBinary -Force
    & $installedBinary version
    if ($LASTEXITCODE -ne 0) {
        throw "The extracted k6 binary failed its version check (exit code $LASTEXITCODE)."
    }

    Write-Host "Installed k6 locally to $toolsDirectory. No administrator privileges, Grafana app, or system PATH changes were required."
} finally {
    if (Test-Path -LiteralPath $workingDirectory) {
        Remove-Item -LiteralPath $workingDirectory -Recurse -Force
    }
}
