#Requires -Version 5.1
param(
    [Parameter(Position=0)]
    [string]$Command,
    [Parameter(Position=1)]
    [string]$Service,
    [switch]$Deploy
)

$ErrorActionPreference = "Stop"

# Configuration
$PID_DIR = Join-Path $PSScriptRoot ".pids"
$BACKEND_PID_FILE = Join-Path $PID_DIR "backend.pid"
$FRONTEND_PID_FILE = Join-Path $PID_DIR "frontend.pid"

# Create PID directory if it doesn't exist
if (-not (Test-Path $PID_DIR)) {
    New-Item -ItemType Directory -Path $PID_DIR -Force | Out-Null
}

# Load environment variables
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line -match '=') {
            $parts = $line -split '=', 2
            [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
        }
    }
}

# Helper function to check if a process is running
function Test-ProcessRunning {
    param([string]$PidFile)
    if (Test-Path $PidFile) {
        $procId = Get-Content $PidFile -ErrorAction SilentlyContinue
        if ($procId) {
            try {
                $proc = Get-Process -Id $procId -ErrorAction Stop
                return $true
            } catch {
                return $false
            }
        }
    }
    return $false
}

# Function to get process status
function Get-ServiceStatus {
    param([string]$Name, [string]$PidFile)
    if (Test-ProcessRunning $PidFile) {
        $procId = Get-Content $PidFile
        Write-Host "${Name}: RUNNING (PID: $procId)"
    } else {
        Write-Host "${Name}: STOPPED"
        if (Test-Path $PidFile) { Remove-Item $PidFile -Force }
    }
}

# Function to install backend dependencies
function Install-BackendDeps {
    Write-Host "Installing backend dependencies..."

    $venvActivate = Join-Path $PSScriptRoot "venv\Scripts\Activate.ps1"
    if (-not (Test-Path $venvActivate)) {
        Write-Host "Error: Root venv not found. Create it with: python -m venv venv"
        return
    }

    & $venvActivate

    $reqFile = Join-Path $PSScriptRoot "requirements.txt"
    if (Test-Path $reqFile) {
        pip install -r $reqFile
    } else {
        Write-Host "Warning: requirements.txt not found"
    }
}

# Function to install frontend dependencies
function Install-FrontendDeps {
    Write-Host "Installing frontend dependencies..."
    $frontendDir = Join-Path $PSScriptRoot "frontend"
    $nodeModules = Join-Path $frontendDir "node_modules"
    if (-not (Test-Path $nodeModules)) {
        Push-Location $frontendDir
        npm install
        Pop-Location
    }
}

# Function to start the backend
function Start-BackendServer {
    if (Test-ProcessRunning $BACKEND_PID_FILE) {
        $procId = Get-Content $BACKEND_PID_FILE
        Write-Host "Backend server is already running (PID: $procId)"
        return
    }

    Write-Host "Starting backend server..."

    $venvActivate = Join-Path $PSScriptRoot "venv\Scripts\Activate.ps1"
    if (-not (Test-Path $venvActivate)) {
        Write-Host "Error: Root venv not found. Create it with: python -m venv venv"
        return
    }

    & $venvActivate

    $backendDir = Join-Path $PSScriptRoot "backend"

    # Install deps only in deploy mode
    $reqFile = Join-Path $PSScriptRoot "requirements.txt"
    if ($Deploy -and (Test-Path $reqFile)) {
        Write-Host "Installing dependencies..."
        pip install -r $reqFile
    }

    $env:PYTHONPATH = "$backendDir;$env:PYTHONPATH"

    $proc = Start-Process -FilePath "python" `
        -ArgumentList "-m uvicorn app.main:app --reload --port 8020 --host 0.0.0.0" `
        -WorkingDirectory $backendDir `
        -PassThru -NoNewWindow

    $proc.Id | Out-File -FilePath $BACKEND_PID_FILE -NoNewline
    Write-Host "Backend server started on http://0.0.0.0:8020 (PID: $($proc.Id))"
}

# Function to start the frontend
function Start-FrontendServer {
    if (Test-ProcessRunning $FRONTEND_PID_FILE) {
        $procId = Get-Content $FRONTEND_PID_FILE
        Write-Host "Frontend server is already running (PID: $procId)"
        return
    }

    $frontendDir = Join-Path $PSScriptRoot "frontend"
    $nodeModules = Join-Path $frontendDir "node_modules"
    if (-not (Test-Path $nodeModules)) {
        Write-Host "Error: node_modules not found in frontend/"
        Write-Host "Run: .\run.ps1 install frontend"
        return
    }

    Write-Host "Starting frontend server..."

    $proc = Start-Process -FilePath "npm" `
        -ArgumentList "run dev" `
        -WorkingDirectory $frontendDir `
        -PassThru -NoNewWindow

    $proc.Id | Out-File -FilePath $FRONTEND_PID_FILE -NoNewline
    Write-Host "Frontend server started (PID: $($proc.Id))"
}

# Function to stop the backend
function Stop-BackendServer {
    if (Test-ProcessRunning $BACKEND_PID_FILE) {
        $procId = Get-Content $BACKEND_PID_FILE
        Write-Host "Stopping backend server (PID: $procId)..."
        try {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            # Also kill any child uvicorn processes
            Get-Process -Name "python" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -like "*uvicorn*app.main*" } |
                Stop-Process -Force -ErrorAction SilentlyContinue
        } catch {}
        Remove-Item $BACKEND_PID_FILE -Force -ErrorAction SilentlyContinue
        Write-Host "Backend server stopped"
    } else {
        Write-Host "Backend server is not running"
        Remove-Item $BACKEND_PID_FILE -Force -ErrorAction SilentlyContinue
    }
}

# Function to stop the frontend
function Stop-FrontendServer {
    if (Test-ProcessRunning $FRONTEND_PID_FILE) {
        $procId = Get-Content $FRONTEND_PID_FILE
        Write-Host "Stopping frontend server (PID: $procId)..."
        try {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            # Also kill any child node/vite processes
            Get-Process -Name "node" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -like "*vite*" } |
                Stop-Process -Force -ErrorAction SilentlyContinue
        } catch {}
        Remove-Item $FRONTEND_PID_FILE -Force -ErrorAction SilentlyContinue
        Write-Host "Frontend server stopped"
    } else {
        Write-Host "Frontend server is not running"
        Remove-Item $FRONTEND_PID_FILE -Force -ErrorAction SilentlyContinue
    }
}

# Function to restart the backend
function Restart-BackendServer {
    Write-Host "Restarting backend server..."
    Stop-BackendServer
    Start-Sleep -Seconds 2
    Start-BackendServer
}

# Function to restart the frontend
function Restart-FrontendServer {
    Write-Host "Restarting frontend server..."
    Stop-FrontendServer
    Start-Sleep -Seconds 2
    Start-FrontendServer
}

# Function to show status
function Show-Status {
    Write-Host "=== NEBULA Server Status ==="
    Get-ServiceStatus "Backend " $BACKEND_PID_FILE
    Get-ServiceStatus "Frontend" $FRONTEND_PID_FILE
    Write-Host "============================"
}

# Function to start all services
function Start-AllServices {
    Start-BackendServer
    Start-FrontendServer
    Write-Host ""
    Show-Status
    Write-Host ""
    Write-Host "Both services started. Use '.\run.ps1 stop' to stop them."
}

# Function to stop all services
function Stop-AllServices {
    Stop-FrontendServer
    Stop-BackendServer
    Write-Host "All services stopped"
}

# Function to restart all services
function Restart-AllServices {
    Write-Host "Restarting all services..."
    Stop-AllServices
    Start-Sleep -Seconds 2
    Start-AllServices
}

# Show usage information
function Show-Usage {
    Write-Host "Usage: .\run.ps1 {start|stop|restart|status|install} [backend|frontend]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  start [service]    - Start all services or specific service (fast, no dep install)"
    Write-Host "  stop [service]     - Stop all services or specific service"
    Write-Host "  restart [service]  - Restart all services or specific service"
    Write-Host "  status             - Show status of all services"
    Write-Host "  install [service]  - Install dependencies (backend pip/npm install frontend)"
    Write-Host ""
    Write-Host "Services:"
    Write-Host "  backend   - FastAPI backend server (port 8020)"
    Write-Host "  frontend  - Vite/React frontend dev server"
    Write-Host ""
    Write-Host "Flags:"
    Write-Host "  -Deploy   - Install dependencies before starting (deploy mode)"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\run.ps1 install          # Install all deps (run once)"
    Write-Host "  .\run.ps1 start            # Start both backend and frontend (fast)"
    Write-Host "  .\run.ps1 start backend    # Start only backend"
    Write-Host "  .\run.ps1 stop             # Stop all services"
    Write-Host "  .\run.ps1 restart          # Restart all services"
    Write-Host "  .\run.ps1 status           # Check service status"
}

# Main execution
switch ($Command) {
    "install" {
        switch ($Service) {
            "backend"  { Install-BackendDeps }
            "frontend" { Install-FrontendDeps }
            ""         { Install-BackendDeps; Install-FrontendDeps }
            default    { Write-Host "Unknown service: $Service"; Show-Usage; exit 1 }
        }
    }
    "start" {
        switch ($Service) {
            "backend"  { Start-BackendServer }
            "frontend" { Start-FrontendServer }
            ""         { Start-AllServices }
            default    { Write-Host "Unknown service: $Service"; Show-Usage; exit 1 }
        }
    }
    "stop" {
        switch ($Service) {
            "backend"  { Stop-BackendServer }
            "frontend" { Stop-FrontendServer }
            ""         { Stop-AllServices }
            default    { Write-Host "Unknown service: $Service"; Show-Usage; exit 1 }
        }
    }
    "restart" {
        switch ($Service) {
            "backend"  { Restart-BackendServer }
            "frontend" { Restart-FrontendServer }
            ""         { Restart-AllServices }
            default    { Write-Host "Unknown service: $Service"; Show-Usage; exit 1 }
        }
    }
    "status" { Show-Status }
    { $_ -in "help", "-h", "--help" } { Show-Usage }
    "" { Write-Host "No command specified"; Show-Usage; exit 1 }
    default { Write-Host "Unknown command: $Command"; Show-Usage; exit 1 }
}
