# Industrias Rockpeaks - sincronizador local para Windows 10/11
# Solo lee el archivo que el usuario elige; copia al Escritorio.
# Sin red, sin credenciales, sin privilegios de administrador.
$ErrorActionPreference = 'Stop'

$sourceName = 'RockpeaksBridge.lua'
$stateDir = Join-Path $env:LOCALAPPDATA 'IndustriasRockpeaks'
$stateFile = Join-Path $stateDir 'RockpeaksBridge-origen.txt'
$desktop = [Environment]::GetFolderPath('Desktop')
$destination = Join-Path $desktop $sourceName

function Elegir-Archivo {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = 'Selecciona RockpeaksBridge.lua en WTF\Account\...\SavedVariables'
    $dialog.Filter = 'RockpeaksBridge.lua|RockpeaksBridge.lua'
    $dialog.FileName = 'RockpeaksBridge.lua'
    $dialog.CheckFileExists = $true
    $dialog.Multiselect = $false
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        throw 'No se selecciono el archivo del juego.'
    }
    return $dialog.FileName
}

try {
    New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    $source = ''
    if (Test-Path -LiteralPath $stateFile -PathType Leaf) {
        $source = (Get-Content -LiteralPath $stateFile -Raw).Trim()
    }

    if (-not $source -or -not (Test-Path -LiteralPath $source -PathType Leaf)) {
        Write-Host 'Selecciona una vez el archivo dentro de la carpeta WTF del juego.' -ForegroundColor Cyan
        $source = Elegir-Archivo
    }
    if ([IO.Path]::GetFileName($source) -ine $sourceName) {
        throw 'El archivo seleccionado no es RockpeaksBridge.lua.'
    }
    if ([IO.Path]::GetFullPath($source) -ieq [IO.Path]::GetFullPath($destination)) {
        throw 'Selecciona el archivo ORIGINAL dentro de WTF\Account\...\SavedVariables, no la copia del Escritorio.'
    }
    Set-Content -LiteralPath $stateFile -Value $source -Encoding UTF8

    Write-Host ''
    Write-Host 'INDUSTRIAS ROCKPEAKS - Sincronizacion local activa' -ForegroundColor Green
    Write-Host "Archivo del juego: $source"
    Write-Host "Copia para Chrome: $destination"
    Write-Host 'Deja abierta esta ventana. Para detener: Ctrl+C o cerrar ventana.'
    Write-Host 'El juego guarda nuevas capturas al salir o usar /reload.'
    Write-Host ''

    $lastSignature = ''
    $lastError = ''
    while ($true) {
        try {
            $info = Get-Item -LiteralPath $source -ErrorAction Stop
            $signature = "$($info.Length):$($info.LastWriteTimeUtc.Ticks)"
            if ($signature -ne $lastSignature) {
                # Copia sobre el mismo nombre para conservar el vinculo del navegador.
                Copy-Item -LiteralPath $source -Destination $destination -Force -ErrorAction Stop
                $lastSignature = $signature
                Write-Host "Archivo actualizado: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
            }
            $lastError = ''
        }
        catch {
            $message = $_.Exception.Message
            if ($message -ne $lastError) {
                Write-Warning "No se ha podido copiar: $message"
                $lastError = $message
            }
        }
        Start-Sleep -Seconds 3
    }
}
catch {
    Write-Host ''
    Write-Host "No se pudo iniciar: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Abre de nuevo el iniciador para seleccionar el archivo correcto.'
    exit 1
}
