$ErrorActionPreference = 'Stop'

$appName = "dubfinder"
$installDir = "$env:LOCALAPPDATA\$appName"
# TODO: User must replace this URL with the actual direct link to their raw dubfinder.jar 
# For example, from a GitHub Release: "https://github.com/username/Duplicate-File-Finder/releases/latest/download/dubfinder.jar"
$jarUrl = "https://example.com/path/to/dubfinder.jar"
$jarPath = "$installDir\dubfinder.jar"
$batPath = "$installDir\$appName.bat"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Installing Duplicate File Finder...   " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check for Java (JRE 17+)
Write-Host "`n[1/3] Checking for Java..."
$javaInstalled = $false
try {
    $javaVersion = & java -version 2>&1
    if ($javaVersion -match "version `"1[7-9]\.|version `"[2-9]\d\.") {
        Write-Host "Java 17+ is already installed." -ForegroundColor Green
        $javaInstalled = $true
    } else {
        Write-Host "An older version of Java was found. We recommend Java 17+." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Java is not installed." -ForegroundColor Yellow
}

if (-not $javaInstalled) {
    Write-Host "Installing Microsoft OpenJDK 17..." -ForegroundColor Cyan
    try {
        # Using winget to silently install Java
        winget install --id Microsoft.OpenJDK.17 --silent --accept-package-agreements --accept-source-agreements
        Write-Host "Java 17 installed successfully!" -ForegroundColor Green
        # Refresh environment variables for the current session to detect java
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } catch {
        Write-Host "Failed to install Java automatically. Please install Java 17 manually from https://adoptium.net/" -ForegroundColor Red
        exit
    }
}

# 2. Download the App
Write-Host "`n[2/3] Downloading $appName..."
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
}

try {
    Invoke-WebRequest -Uri $jarUrl -OutFile $jarPath -UseBasicParsing
    Write-Host "Downloaded successfully to $installDir" -ForegroundColor Green
} catch {
    Write-Host "Failed to download $appName from $jarUrl" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit
}

# 3. Create CLI Wrapper and Add to PATH
Write-Host "`n[3/3] Configuring CLI command '$appName'..."
$batContent = "@echo off`njava -jar `"%~dp0dubfinder.jar`" %*"
Set-Content -Path $batPath -Value $batContent

# Add installDir to User PATH if it's not already there
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notmatch [regex]::Escape($installDir)) {
    $newPath = "$userPath;$installDir"
    [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
    $env:PATH = "$($env:PATH);$installDir" # Update current session
    Write-Host "Added $installDir to your PATH." -ForegroundColor Green
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!                 " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "You can now open a NEW terminal and simply type:"
Write-Host "  $appName" -ForegroundColor Yellow
Write-Host ""
