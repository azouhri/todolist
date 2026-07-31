# Registers a Windows scheduled task that starts the Follow-up Manager at logon
# and restarts it if it ever stops. Run once, from a normal (non-admin) shell:
#
#   powershell -ExecutionPolicy Bypass -File C:\Devops\todo\scripts\install-autostart.ps1
#
# Remove it again with:
#   Unregister-ScheduledTask -TaskName "FollowUpManager" -Confirm:$false

$ErrorActionPreference = "Stop"

$taskName = "FollowUpManager"
$script   = Join-Path $PSScriptRoot "start-server.cmd"

if (-not (Test-Path $script)) { throw "Missing $script" }

# Hidden window so it does not steal focus at logon.
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$script`"" `
    -WorkingDirectory (Split-Path $PSScriptRoot -Parent)

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# RestartCount/Interval bring it back if node exits; ExecutionTimeLimit 0 = never
# kill a long-running server.
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -DontStopOnIdleEnd `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description "Follow-up & Execution Manager on http://localhost:3000" `
    -Force | Out-Null

Write-Host "Registered scheduled task '$taskName' (starts at logon)."
Write-Host "Start it now with:  Start-ScheduledTask -TaskName $taskName"
Write-Host "Check it with:      Get-ScheduledTask -TaskName $taskName | Get-ScheduledTaskInfo"
