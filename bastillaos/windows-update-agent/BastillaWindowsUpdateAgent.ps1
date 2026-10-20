param(
  [Parameter()]
  [string]$AllowedOrigin = 'http://localhost:3000',

  [Parameter()]
  [ValidateRange(1024, 65535)]
  [int]$Port = 8765,

  [Parameter()]
  [string]$Token = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($env:OS -ne 'Windows_NT') {
  throw 'Ten pomocnik działa wyłącznie w systemie Windows.'
}
if ($PSVersionTable.PSVersion.Major -lt 5) {
  throw 'Wymagany jest Windows PowerShell 5.1 lub nowszy.'
}
if ([string]::IsNullOrWhiteSpace($AllowedOrigin) -or $AllowedOrigin -eq '*') {
  throw 'Podaj dokładny adres aplikacji w -AllowedOrigin; wildcard jest niedozwolony.'
}

if ([string]::IsNullOrWhiteSpace($Token)) {
  $randomBytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($randomBytes)
  $Token = ([BitConverter]::ToString($randomBytes) -replace '-', '').ToLowerInvariant()
}
if ($Token.Length -lt 32) {
  throw 'Token musi mieć co najmniej 32 znaki.'
}

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$computerSystem = Get-CimInstance -ClassName Win32_OperatingSystem
$sourceDescription = if (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' -Name WUServer -ErrorAction SilentlyContinue) {
  'Windows Update for Business / WSUS (zasady komputera)'
} else {
  'Źródło Windows Update skonfigurowane w systemie'
}

function Send-JsonResponse {
  param(
    [Parameter(Mandatory = $true)]$Context,
    [Parameter(Mandatory = $true)][int]$StatusCode,
    [Parameter(Mandatory = $true)]$Body
  )

  $json = ConvertTo-Json -InputObject $Body -Depth 8 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = 'application/json; charset=utf-8'
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.Close()
}

function Get-SystemSummary {
  return @{
    computerName = $env:COMPUTERNAME
    osName = [string]$computerSystem.Caption
    osVersion = [string]$computerSystem.Version
    isAdministrator = $isAdministrator
    updateSource = $sourceDescription
  }
}

function Get-AvailableUpdates {
  $session = New-Object -ComObject Microsoft.Update.Session
  $searcher = $session.CreateUpdateSearcher()
  $searchResult = $searcher.Search('IsInstalled=0 and IsHidden=0')
  if ($searchResult.ResultCode -ne 2) {
    throw "Windows Update Search zakończył się kodem $($searchResult.ResultCode)."
  }

  $updates = @()
  for ($index = 0; $index -lt $searchResult.Updates.Count; $index++) {
    $update = $searchResult.Updates.Item($index)
    $categories = @()
    for ($categoryIndex = 0; $categoryIndex -lt $update.Categories.Count; $categoryIndex++) {
      $categories += [string]$update.Categories.Item($categoryIndex).Name
    }

    $updates += @{
      id = [string]$update.Identity.UpdateID
      revision = [int]$update.Identity.RevisionNumber
      title = [string]$update.Title
      kbArticles = @($update.KBArticleIDs | ForEach-Object { [string]$_ })
      severity = [string]$update.MsrcSeverity
      categories = $categories
      downloaded = [bool]$update.IsDownloaded
      eulaAccepted = [bool]$update.EulaAccepted
      maxDownloadBytes = [double]$update.MaxDownloadSize
    }
  }

  return @{
    updates = $updates
    system = Get-SystemSummary
    source = $sourceDescription
    scannedAt = [DateTime]::UtcNow.ToString('o')
  }
}

function Invoke-UpdateInstall {
  param([Parameter(Mandatory = $true)]$RequestBody)

  if (-not $isAdministrator) {
    throw 'Instalowanie aktualizacji wymaga uruchomienia pomocnika jako administrator.'
  }
  if (-not $RequestBody.ids -or $RequestBody.ids.Count -lt 1 -or $RequestBody.ids.Count -gt 100) {
    throw 'Wybierz od 1 do 100 aktualizacji z wyników skanowania.'
  }

  $requestedIds = @($RequestBody.ids | ForEach-Object { [string]$_ } | Select-Object -Unique)
  foreach ($id in $requestedIds) {
    if ($id -notmatch '^[0-9a-fA-F-]{36}$') {
      throw 'Lista zawiera nieprawidłowy identyfikator aktualizacji.'
    }
  }

  # Re-search immediately before downloading; never install IDs that are no
  # longer offered by the configured Windows Update source.
  $session = New-Object -ComObject Microsoft.Update.Session
  $searcher = $session.CreateUpdateSearcher()
  $searchResult = $searcher.Search('IsInstalled=0 and IsHidden=0')
  if ($searchResult.ResultCode -ne 2) {
    throw "Ponowne sprawdzenie Windows Update zakończyło się kodem $($searchResult.ResultCode)."
  }

  $updatesToInstall = New-Object -ComObject Microsoft.Update.UpdateColl
  foreach ($id in $requestedIds) {
    $matchedUpdate = $null
    for ($index = 0; $index -lt $searchResult.Updates.Count; $index++) {
      $candidate = $searchResult.Updates.Item($index)
      if ([string]$candidate.Identity.UpdateID -eq $id) {
        $matchedUpdate = $candidate
        break
      }
    }
    if ($null -eq $matchedUpdate) {
      throw "Aktualizacja $id nie jest już oferowana przez źródło systemu. Wykonaj nowy skan."
    }
    if (-not $matchedUpdate.EulaAccepted) {
      $matchedUpdate.AcceptEula()
    }
    [void]$updatesToInstall.Add($matchedUpdate)
  }

  $downloader = $session.CreateUpdateDownloader()
  $downloader.Updates = $updatesToInstall
  $downloadResult = $downloader.Download()
  if ($downloadResult.ResultCode -ne 2) {
    throw "Pobieranie aktualizacji nie zakończyło się sukcesem (kod $($downloadResult.ResultCode))."
  }

  $installer = $session.CreateUpdateInstaller()
  $installer.Updates = $updatesToInstall
  $installResult = $installer.Install()
  $results = @()
  for ($index = 0; $index -lt $updatesToInstall.Count; $index++) {
    $results += @{
      title = [string]$updatesToInstall.Item($index).Title
      resultCode = [int]$installResult.GetUpdateResult($index).ResultCode
    }
  }

  if ($installResult.ResultCode -notin 2, 3) {
    throw "Instalacja zakończyła się kodem WUA $($installResult.ResultCode). Sprawdź historię Windows Update."
  }

  return @{
    message = 'Proces Windows Update został zakończony. Sprawdź kody wyników poszczególnych pakietów.'
    rebootRequired = [bool]$installResult.RebootRequired
    results = $results
  }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

Write-Host 'BastillaOS Windows Update Agent'
Write-Host "Nasłuch: http://127.0.0.1:$Port/ (loopback only)"
Write-Host "Dozwolony panel: $AllowedOrigin"
Write-Host "Administrator: $isAdministrator"
Write-Host "Token sesji (wklej do panelu BastillaOS): $Token"
Write-Host 'Zatrzymaj pomocnika przez Ctrl+C.'

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $request = $context.Request
      $origin = $request.Headers['Origin']
      if ($origin -ne $AllowedOrigin) {
        Send-JsonResponse -Context $context -StatusCode 403 -Body @{ error = 'Origin nie jest dozwolony. Uruchom pomocnika z dokładnym adresem panelu.' }
        continue
      }

      $context.Response.Headers.Add('Access-Control-Allow-Origin', $AllowedOrigin)
      $context.Response.Headers.Add('Vary', 'Origin')
      if ($request.Headers['Access-Control-Request-Private-Network'] -eq 'true') {
        $context.Response.Headers.Add('Access-Control-Allow-Private-Network', 'true')
      }
      if ($request.HttpMethod -eq 'OPTIONS') {
        $context.Response.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        $context.Response.Headers.Add('Access-Control-Allow-Headers', 'Content-Type, X-Bastilla-Token')
        $context.Response.StatusCode = 204
        $context.Response.Close()
        continue
      }

      $providedToken = [System.Text.Encoding]::UTF8.GetBytes([string]$request.Headers['X-Bastilla-Token'])
      $expectedToken = [System.Text.Encoding]::UTF8.GetBytes($Token)
      $tokenMatches = $providedToken.Length -eq $expectedToken.Length
      if ($tokenMatches) {
        $difference = 0
        for ($index = 0; $index -lt $expectedToken.Length; $index++) {
          $difference = $difference -bor ($providedToken[$index] -bxor $expectedToken[$index])
        }
        $tokenMatches = $difference -eq 0
      }
      if (-not $tokenMatches) {
        Send-JsonResponse -Context $context -StatusCode 401 -Body @{ error = 'Nieprawidłowy token pomocnika.' }
        continue
      }

      switch ("$($request.HttpMethod) $($request.Url.AbsolutePath)") {
        'GET /health' {
          Send-JsonResponse -Context $context -StatusCode 200 -Body @{ system = Get-SystemSummary }
        }
        'GET /updates' {
          Send-JsonResponse -Context $context -StatusCode 200 -Body (Get-AvailableUpdates)
        }
        'POST /install' {
          if ($request.ContentLength64 -gt 1048576) {
            Send-JsonResponse -Context $context -StatusCode 413 -Body @{ error = 'Żądanie przekracza limit 1 MB.' }
            continue
          }
          $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
          try {
            $bodyText = $reader.ReadToEnd()
          } finally {
            $reader.Dispose()
          }
          $body = ConvertFrom-Json -InputObject $bodyText
          Send-JsonResponse -Context $context -StatusCode 200 -Body (Invoke-UpdateInstall -RequestBody $body)
        }
        default {
          Send-JsonResponse -Context $context -StatusCode 404 -Body @{ error = 'Nieznany endpoint pomocnika Windows Update.' }
        }
      }
    } catch {
      if ($context.Response.OutputStream.CanWrite) {
        try {
          Send-JsonResponse -Context $context -StatusCode 500 -Body @{ error = $_.Exception.Message }
        } catch {
          Write-Warning "Nie udało się wysłać błędu HTTP: $($_.Exception.Message)"
        }
      }
      Write-Warning "Żądanie $($context.Request.HttpMethod) $($context.Request.Url.AbsolutePath) nie powiodło się: $($_.Exception.Message)"
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
