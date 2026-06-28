#!/bin/bash
set -e

echo "==> Building React frontend..."
cd frontend
npm install
npm run build

echo "==> Copying frontend build to Spring Boot static resources..."
rm -rf ../backend/src/main/resources/static
mkdir -p ../backend/src/main/resources/static
cp -r build/* ../backend/src/main/resources/static/

echo "==> Building Spring Boot JAR..."
cd ../backend
mvn clean package -DskipTests

echo ""
echo "Build complete! JAR is at: backend/target/attendance-app-1.0.0.jar"
echo "Run with: java -jar backend/target/attendance-app-1.0.0.jar"
