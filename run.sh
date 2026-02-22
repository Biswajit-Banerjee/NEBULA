#!/bin/bash
set -e

# Configuration
PID_DIR="${PWD}/.pids"
BACKEND_PID_FILE="${PID_DIR}/backend.pid"
FRONTEND_PID_FILE="${PID_DIR}/frontend.pid"
DEPLOY_MODE=false

# Create PID directory if it doesn't exist
mkdir -p "${PID_DIR}"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | sed 's/\r$//' | awk '/=/ {print $1}' )
fi

# Parse flags
for arg in "$@"; do
    case $arg in
        --deploy)
            DEPLOY_MODE=true
            shift
            ;;
    esac
done

# Helper function to check if a process is running
is_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Function to get process status
get_status() {
    local name=$1
    local pid_file=$2
    if is_running "$pid_file"; then
        local pid=$(cat "$pid_file" 2>/dev/null)
        echo "${name}: RUNNING (PID: ${pid})"
    else
        echo "${name}: STOPPED"
        [ -f "$pid_file" ] && rm -f "$pid_file"
    fi
}

# Function to install backend dependencies
install_backend_deps() {
    echo "Installing backend dependencies..."
    
    if [ ! -f "venv/bin/activate" ]; then
        echo "Error: Root venv not found. Create it with: python3 -m venv venv"
        return 1
    fi
    
    source venv/bin/activate
    
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    else
        echo "Warning: requirements.txt not found"
    fi
}

# Function to install frontend dependencies
install_frontend_deps() {
    echo "Installing frontend dependencies..."
    cd frontend
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    cd ..
}

# Function to start the backend
start_backend() {
    if is_running "$BACKEND_PID_FILE"; then
        echo "Backend server is already running (PID: $(cat "$BACKEND_PID_FILE"))"
        return 0
    fi
    
    echo "Starting backend server..."
    cd backend
    
    # Only use root-level venv
    if [ ! -f "../venv/bin/activate" ]; then
        echo "Error: Root venv not found at ../venv/bin/activate"
        echo "Create it with: python3 -m venv venv"
        cd ..
        return 1
    fi
    
    source ../venv/bin/activate
    
    # Install deps only in deploy mode
    if [ "$DEPLOY_MODE" = true ] && [ -f "../requirements.txt" ]; then
        echo "Installing dependencies..."
        pip install -r ../requirements.txt
    fi
    
    export PYTHONPATH=$PYTHONPATH:$(pwd)
    python3 -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0 &
    local pid=$!
    echo $pid > "$BACKEND_PID_FILE"
    echo "Backend server started on http://0.0.0.0:8000 (PID: ${pid})"
    
    cd ..
}

# Function to start the frontend
start_frontend() {
    if is_running "$FRONTEND_PID_FILE"; then
        echo "Frontend server is already running (PID: $(cat "$FRONTEND_PID_FILE"))"
        return 0
    fi
    
    # Check node_modules exists
    if [ ! -d "frontend/node_modules" ]; then
        echo "Error: node_modules not found in frontend/"
        echo "Run: ./run.sh install frontend"
        return 1
    fi
    
    echo "Starting frontend server..."
    cd frontend
    
    npm run dev &
    local pid=$!
    echo $pid > "$FRONTEND_PID_FILE"
    echo "Frontend server started (PID: ${pid})"
    
    cd ..
}

# Function to stop the backend
stop_backend() {
    if is_running "$BACKEND_PID_FILE"; then
        local pid=$(cat "$BACKEND_PID_FILE" 2>/dev/null)
        echo "Stopping backend server (PID: ${pid})..."
        kill "$pid" 2>/dev/null || true
        rm -f "$BACKEND_PID_FILE"
        echo "Backend server stopped"
    else
        echo "Backend server is not running"
        rm -f "$BACKEND_PID_FILE"
    fi
}

# Function to stop the frontend
stop_frontend() {
    if is_running "$FRONTEND_PID_FILE"; then
        local pid=$(cat "$FRONTEND_PID_FILE" 2>/dev/null)
        echo "Stopping frontend server (PID: ${pid})..."
        kill "$pid" 2>/dev/null || true
        pkill -f "npm run dev" 2>/dev/null || true
        pkill -f "vite" 2>/dev/null || true
        rm -f "$FRONTEND_PID_FILE"
        echo "Frontend server stopped"
    else
        echo "Frontend server is not running"
        rm -f "$FRONTEND_PID_FILE"
    fi
}

# Function to restart the backend
restart_backend() {
    echo "Restarting backend server..."
    stop_backend
    sleep 2
    start_backend
}

# Function to restart the frontend
restart_frontend() {
    echo "Restarting frontend server..."
    stop_frontend
    sleep 2
    start_frontend
}

# Function to show status
show_status() {
    echo "=== NEBULA Server Status ==="
    get_status "Backend " "$BACKEND_PID_FILE"
    get_status "Frontend" "$FRONTEND_PID_FILE"
    echo "============================"
}

# Function to start all services
start_all() {
    start_backend
    start_frontend
    echo ""
    show_status
    echo ""
    echo "Both services started. Press Ctrl+C to stop."
    wait
}

# Function to stop all services
stop_all() {
    stop_frontend
    stop_backend
    echo "All services stopped"
}

# Function to restart all services
restart_all() {
    echo "Restarting all services..."
    stop_all
    sleep 2
    start_all
}

# Show usage information
show_usage() {
    echo "Usage: $0 {start|stop|restart|status|install} [backend|frontend]"
    echo ""
    echo "Commands:"
    echo "  start [service]    - Start all services or specific service (fast, no dep install)"
    echo "  stop [service]     - Stop all services or specific service"
    echo "  restart [service]  - Restart all services or specific service"
    echo "  status             - Show status of all services"
    echo "  install [service]  - Install dependencies (backend pip/npm install frontend)"
    echo ""
    echo "Services:"
    echo "  backend   - FastAPI backend server (port 8000)"
    echo "  frontend  - Vite/React frontend dev server"
    echo ""
    echo "Examples:"
    echo "  $0 install          # Install all deps (run once)"
    echo "  $0 start            # Start both backend and frontend (fast)"
    echo "  $0 start backend    # Start only backend"
    echo "  $0 stop             # Stop all services"
    echo "  $0 restart          # Restart all services"
    echo "  $0 status           # Check service status"
}

# Main execution
case "${1:-}" in
    "install")
        case "${2:-}" in
            "backend") install_backend_deps ;;
            "frontend") install_frontend_deps ;;
            "")
                install_backend_deps
                install_frontend_deps
                ;;
            *)
                echo "Unknown service: $2"
                show_usage
                exit 1
                ;;
        esac
        ;;
    "start")
        case "${2:-}" in
            "backend") start_backend ;;
            "frontend") start_frontend ;;
            "") start_all ;;
            *)
                echo "Unknown service: $2"
                show_usage
                exit 1
                ;;
        esac
        ;;
    "stop")
        case "${2:-}" in
            "backend") stop_backend ;;
            "frontend") stop_frontend ;;
            "") stop_all ;;
            *)
                echo "Unknown service: $2"
                show_usage
                exit 1
                ;;
        esac
        ;;
    "restart")
        case "${2:-}" in
            "backend") restart_backend ;;
            "frontend") restart_frontend ;;
            "") restart_all ;;
            *)
                echo "Unknown service: $2"
                show_usage
                exit 1
                ;;
        esac
        ;;
    "status")
        show_status
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    "")
        echo "No command specified"
        show_usage
        exit 1
        ;;
    *)
        echo "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac