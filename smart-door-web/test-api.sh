#!/bin/bash

# Test script untuk ESP32 Web Logging API
# Usage: ./test-api.sh

API_URL="http://localhost:3000/api"
API_KEY="${ESP32_API_KEY:?Set ESP32_API_KEY in your private shell}"

echo "🧪 Testing ESP32 Web Logging API"
echo "================================"
echo ""

# Test 1: Send log (unlock success)
echo "1️⃣ Testing POST /api/logs (unlock success)..."
curl -X POST "$API_URL/logs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "cardUid": "BE:02:28:DB",
    "cardNickname": "Test Card 1",
    "action": "unlock",
    "success": true
  }' \
  -w "\nStatus: %{http_code}\n\n"

sleep 1

# Test 2: Send log (denied)
echo "2️⃣ Testing POST /api/logs (denied)..."
curl -X POST "$API_URL/logs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "cardUid": "AA:BB:CC:DD",
    "action": "denied",
    "success": false
  }' \
  -w "\nStatus: %{http_code}\n\n"

sleep 1

# Test 3: Get all logs
echo "3️⃣ Testing GET /api/logs..."
curl -X GET "$API_URL/logs" \
  -w "\nStatus: %{http_code}\n\n"

sleep 1

# Test 4: Add card
echo "4️⃣ Testing POST /api/cards..."
curl -X POST "$API_URL/cards" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "uid": "BE:02:28:DB",
    "nickname": "Test Card 1"
  }' \
  -w "\nStatus: %{http_code}\n\n"

sleep 1

# Test 5: Get all cards
echo "5️⃣ Testing GET /api/cards..."
curl -X GET "$API_URL/cards" \
  -w "\nStatus: %{http_code}\n\n"

sleep 1

# Test 6: Test unauthorized (wrong API key)
echo "6️⃣ Testing unauthorized access (wrong API key)..."
curl -X POST "$API_URL/logs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wrong_key" \
  -d '{
    "cardUid": "AA:BB:CC:DD",
    "action": "unlock",
    "success": true
  }' \
  -w "\nStatus: %{http_code}\n\n"

echo ""
echo "✅ All tests completed!"
echo ""
echo "📁 Check the following:"
echo "   - web/data/logs.json (should have 2 entries)"
echo "   - web/data/cards.json (should have 1 entry)"
echo "   - http://localhost:3000/logs (view in browser)"
echo ""
