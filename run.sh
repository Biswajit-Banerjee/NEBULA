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
    # python3 -m venv venv
    # source venv/bin/activate
    # pip install -r ../requirements.txt
    python app.py &
    cd ..
}

# Function to start the frontend
start_frontend() {
    echo "Starting frontend server..."
    cd frontend
    npm install
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
