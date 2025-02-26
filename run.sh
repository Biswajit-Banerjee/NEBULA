#!/bin/bash
set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | sed 's/\r$//' | awk '/=/ {print $1}' )
fi

# Function to start the backend
start_backend() {
    echo "Starting backend server..."
    cd backend
    # Create Python virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        source venv/bin/activate
        pip install -r ../requirements.txt
    else
        source venv/bin/activate
    fi
    # Set PYTHONPATH to recognize the app package
    export PYTHONPATH=$PYTHONPATH:$(pwd)
    # Start the FastAPI server
    python3 -m uvicorn app.main:app --reload --port 8000 &
    cd ..
}

# Function to start the frontend
start_frontend() {
    echo "Starting frontend server..."
    cd frontend
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    npm run dev &
    cd ..
}

# Main execution
case "$1" in
    "backend")
        start_backend
        ;;
    "frontend")
        start_frontend
        ;;
    *)
        start_backend
        start_frontend
        ;;
esac

wait