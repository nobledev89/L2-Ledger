param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("doctor", "init", "release-android", "patch-android", "release-ios", "patch-ios")]
    [string]$Command
)

$ErrorActionPreference = "Stop"

$shorebird = Get-Command shorebird -ErrorAction SilentlyContinue
if (-not $shorebird) {
    $localShorebird = Join-Path $env:USERPROFILE ".shorebird\bin\shorebird.bat"
    if (Test-Path $localShorebird) {
        $shorebirdPath = $localShorebird
    } else {
        throw "Shorebird CLI was not found. Install it from https://docs.shorebird.dev/code-push/installation/"
    }
} else {
    $shorebirdPath = $shorebird.Source
}

switch ($Command) {
    "doctor" {
        & $shorebirdPath doctor
    }
    "init" {
        & $shorebirdPath init
    }
    "release-android" {
        & $shorebirdPath release android
    }
    "patch-android" {
        & $shorebirdPath patch android
    }
    "release-ios" {
        & $shorebirdPath release ios
    }
    "patch-ios" {
        & $shorebirdPath patch ios
    }
}
