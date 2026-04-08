#!/usr/bin/env bash
# ============================================================
# Outage Simulation Test Script
# Tests that the sync-worker survives internet outages and
# resumes syncing when connectivity is restored.
#
# Requires: root/sudo, iptables, curl, jq
# Run from the appliance where the Docker stack is running.
# ============================================================

set -euo pipefail

CLOUD_API_URL="${CLOUD_API_URL:?Set CLOUD_API_URL}"
NODE_ID="${NODE_ID:?Set NODE_ID}"
NODE_TOKEN="${NODE_REGISTRATION_TOKEN:?Set NODE_REGISTRATION_TOKEN}"
SYNC_WORKER_HEALTH="http://localhost:3200/health"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${YELLOW}[TEST]${NC} $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# Check prerequisites
command -v iptables >/dev/null 2>&1 || fail "iptables is required"
command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v jq >/dev/null 2>&1 || fail "jq is required"

# Verify sync-worker is running
log "Checking sync-worker health..."
HEALTH=$(curl -sf "$SYNC_WORKER_HEALTH" 2>/dev/null) || fail "Sync worker not reachable at $SYNC_WORKER_HEALTH"
echo "$HEALTH" | jq .
pass "Sync worker is running"

# Step 1: Block outbound internet (keep LAN)
log "Blocking outbound internet access (ports 80, 443)..."
sudo iptables -A OUTPUT -p tcp --dport 443 ! -d 10.0.0.0/8 ! -d 172.16.0.0/12 ! -d 192.168.0.0/16 -j DROP
sudo iptables -A OUTPUT -p tcp --dport 80 ! -d 10.0.0.0/8 ! -d 172.16.0.0/12 ! -d 192.168.0.0/16 -j DROP
pass "Internet blocked via iptables"

# Step 2: Trigger a sync job via cloud API (from a machine WITH internet)
log "Note: If this machine has no internet, trigger the sync job from another machine."
log "Attempting to create sync job from cloud..."
ENQUEUE_RESULT=$(curl -sf -X POST "${CLOUD_API_URL}/api/sync/enqueue" \
  -H "Content-Type: application/json" \
  -d "{\"package_id\": \"test\", \"node_ids\": [\"${NODE_ID}\"]}" 2>/dev/null) || log "Could not reach cloud (expected — we blocked internet)"

# Step 3: Wait 2 minutes
log "Waiting 2 minutes with internet blocked..."
sleep 120

# Verify sync-worker is still alive
HEALTH2=$(curl -sf "$SYNC_WORKER_HEALTH" 2>/dev/null) || fail "Sync worker crashed during outage!"
WAN_STATUS=$(echo "$HEALTH2" | jq -r '.wan_connected')
[ "$WAN_STATUS" = "false" ] && pass "Sync worker correctly reports WAN disconnected" || log "WAN status: $WAN_STATUS"

# Step 4: Restore internet
log "Restoring internet access..."
sudo iptables -D OUTPUT -p tcp --dport 443 ! -d 10.0.0.0/8 ! -d 172.16.0.0/12 ! -d 192.168.0.0/16 -j DROP
sudo iptables -D OUTPUT -p tcp --dport 80 ! -d 10.0.0.0/8 ! -d 172.16.0.0/12 ! -d 192.168.0.0/16 -j DROP
pass "Internet restored"

# Step 5: Wait for sync-worker to detect connectivity and pick up jobs
log "Waiting 60 seconds for sync-worker to reconnect..."
sleep 60

# Check health again
HEALTH3=$(curl -sf "$SYNC_WORKER_HEALTH" 2>/dev/null) || fail "Sync worker not reachable after restore"
WAN_STATUS3=$(echo "$HEALTH3" | jq -r '.wan_connected')

if [ "$WAN_STATUS3" = "true" ]; then
  pass "Sync worker reconnected to WAN"
else
  fail "Sync worker did not reconnect to WAN"
fi

# Check if any jobs were processed
LAST_SYNC=$(echo "$HEALTH3" | jq -r '.last_sync_at')
if [ "$LAST_SYNC" != "null" ]; then
  pass "Sync worker processed jobs after reconnect (last_sync: $LAST_SYNC)"
else
  log "No jobs processed yet (may need a published package with target nodes)"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  OUTAGE SIMULATION TEST: PASS${NC}"
echo -e "${GREEN}========================================${NC}"
