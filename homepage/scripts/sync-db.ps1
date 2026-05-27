# Get environment variables or default values
$LocalContainer = if ($env:LOCAL_CONTAINER) { $env:LOCAL_CONTAINER } else { "mongodb" }
$LocalDb = if ($env:LOCAL_DB) { $env:LOCAL_DB } else { "goplantatree" }
$LocalAuth = if ($env:LOCAL_AUTH) { $env:LOCAL_AUTH } else { "--username admin --password password --authenticationDatabase admin" }
$RemoteHost = if ($env:REMOTE_HOST) { $env:REMOTE_HOST } else { "" }
$RemoteContainer = if ($env:REMOTE_CONTAINER) { $env:REMOTE_CONTAINER } else { "goplantatree-mongo" }
$RemoteDb = if ($env:REMOTE_DB) { $env:REMOTE_DB } else { "goplantatree" }
$RemoteAuth = if ($env:REMOTE_AUTH) { $env:REMOTE_AUTH } else { "" }
$DumpDir = "/tmp/mongodump-goplantatree"

# Collections to sync passed as arguments
$Collections = @()
if ($args.Count -gt 0) {
    # If the first argument contains '@' or looks like an IP/domain, treat it as RemoteHost
    if ($args[0] -like "*@*" -or $args[0] -like "*.*") {
        $RemoteHost = $args[0]
        if ($args.Count -gt 1) {
            $Collections = $args[1..($args.Count - 1)]
        } else {
            $Collections = @()
        }
    } else {
        $Collections = $args
    }
}

if ([string]::IsNullOrEmpty($RemoteHost)) {
    Write-Error "[ERROR] REMOTE_HOST is not set. Usage:"
    Write-Host "   Option A: `$env:REMOTE_HOST='user@server'; .\scripts\sync-db.ps1 [collection...]"
    Write-Host "   Option B: .\scripts\sync-db.ps1 user@server [collection...]"
    exit 1
}

Write-Host "[SYNC] MongoDB Sync: remote ($RemoteHost/$RemoteContainer/$RemoteDb) → local ($LocalContainer/$LocalDb)"

# --- Step 1: Dump remote database ---
Write-Host ""
Write-Host "[DUMP] Step 1: Dumping remote database..."

# Clean up previous dump inside remote container
$rmCmd = 'docker exec ' + $RemoteContainer + ' rm -rf ' + $DumpDir + ' 2>/dev/null || true'
ssh $RemoteHost $rmCmd

if ($Collections.Count -gt 0) {
    Write-Host "   Collections: $($Collections -join ' ')"
    $DumpArgs = ""
    foreach ($col in $Collections) {
        $DumpArgs += " --collection $col"
    }
    $dumpCmd = 'docker exec ' + $RemoteContainer + ' mongodump ' + $RemoteAuth + ' --db ' + $RemoteDb + $DumpArgs + ' --out ' + $DumpDir
    ssh $RemoteHost $dumpCmd
} else {
    Write-Host "   All collections"
    $dumpCmd = 'docker exec ' + $RemoteContainer + ' mongodump ' + $RemoteAuth + ' --db ' + $RemoteDb + ' --out ' + $DumpDir
    ssh $RemoteHost $dumpCmd
}

Write-Host "   [OK] Remote dump complete"

# --- Step 2: Stream dump from remote container to local container ---
Write-Host ""
Write-Host "[STREAM] Step 2: Streaming dump to local container..."

# Clean up and recreate temp restore directory inside local container
docker exec $LocalContainer rm -rf /tmp/mongorestore-data 2>$null
docker exec $LocalContainer mkdir -p /tmp/mongorestore-data

# Stream over SSH and extract directly inside the local container
# We use cmd /c here because standard Windows PowerShell 5.1 pipeline corrupts binary tar streams.
$streamCmd = 'ssh ' + $RemoteHost + ' "docker exec ' + $RemoteContainer + ' tar -czf - -C ' + $DumpDir + ' ' + $RemoteDb + '" | docker exec -i ' + $LocalContainer + ' tar -xzf - -C /tmp/mongorestore-data'
cmd /c $streamCmd

Write-Host "   [OK] Transferred and unpacked in local container"

# --- Step 3: Restore locally ---
Write-Host ""
Write-Host "[RESTORE] Step 3: Restoring to local database..."

$restoreCmd = 'docker exec ' + $LocalContainer + ' mongorestore ' + $LocalAuth + ' --db ' + $LocalDb + ' --drop /tmp/mongorestore-data/' + $RemoteDb
cmd /c $restoreCmd

Write-Host "   [OK] Local restore complete"

# --- Step 4: Cleanup ---
Write-Host ""
Write-Host "[CLEANUP] Step 4: Cleaning up temp files..."
$rmCmd2 = 'docker exec ' + $RemoteContainer + ' rm -rf ' + $DumpDir + ' 2>/dev/null || true'
ssh $RemoteHost $rmCmd2
docker exec $LocalContainer rm -rf /tmp/mongorestore-data 2>$null

Write-Host ""
Write-Host "[OK] Sync complete!"
if ($Collections.Count -gt 0) {
    Write-Host "   Collections synced: $($Collections -join ' ')"
} else {
    Write-Host "   All collections synced"
}
