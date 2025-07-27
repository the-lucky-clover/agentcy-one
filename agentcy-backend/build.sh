#!/bin/bash

# Build script for Render.com deployment

echo "Starting build process..."

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Build React frontend
echo "Building React frontend..."
cd ../agentcy-frontend
npm install
npm run build

# Copy built frontend to Flask static directory
echo "Copying frontend build to Flask static directory..."
rm -rf ../agentcy-backend/src/static/*
cp -r dist/* ../agentcy-backend/src/static/

# Return to backend directory
cd ../agentcy-backend

echo "Build process completed successfully!"
