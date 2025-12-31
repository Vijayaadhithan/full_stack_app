#!/bin/bash
#
# Run Load Test Benchmark Suite
# 
# Usage:
#   ./run-benchmarks.sh           # Run all tiers sequentially
#   ./run-benchmarks.sh tier_100  # Run single tier
#   ./run-benchmarks.sh quick     # Quick 100-user test
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/benchmark-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create results directory
mkdir -p "$RESULTS_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                      LOAD TEST BENCHMARK SUITE                             ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

run_benchmark() {
    local scenario=$1
    local output_file="${RESULTS_DIR}/${scenario}_${TIMESTAMP}.json"
    
    echo -e "\n${YELLOW}━━━ Running Scenario: ${scenario} ━━━${NC}\n"
    
    npx k6 run \
        --env SCENARIO="${scenario}" \
        --out json="${output_file}" \
        "${SCRIPT_DIR}/load-test-benchmark.js"
    
    echo -e "\n${GREEN}✓ ${scenario} complete${NC}"
    echo -e "  Results saved to: ${output_file}\n"
}

# Parse arguments
SCENARIO="${1:-all}"

case "$SCENARIO" in
    "quick"|"tier_100")
        run_benchmark "tier_100"
        ;;
    "tier_500")
        run_benchmark "tier_500"
        ;;
    "tier_1000")
        run_benchmark "tier_1000"
        ;;
    "tier_5000")
        run_benchmark "tier_5000"
        ;;
    "all_tiers")
        run_benchmark "all_tiers"
        ;;
    "all"|"full")
        echo -e "${BLUE}Running all benchmark tiers sequentially...${NC}"
        echo -e "${YELLOW}This will take approximately 15-20 minutes${NC}\n"
        
        for tier in tier_100 tier_500 tier_1000 tier_5000; do
            run_benchmark "$tier"
            echo -e "${YELLOW}Cooling down for 30 seconds before next tier...${NC}"
            sleep 30
        done
        ;;
    *)
        echo -e "${RED}Unknown scenario: $SCENARIO${NC}"
        echo ""
        echo "Usage:"
        echo "  ./run-benchmarks.sh                 # Run all tiers sequentially"
        echo "  ./run-benchmarks.sh quick           # Quick 100-user test"
        echo "  ./run-benchmarks.sh tier_100        # 100 concurrent users"
        echo "  ./run-benchmarks.sh tier_500        # 500 concurrent users"
        echo "  ./run-benchmarks.sh tier_1000       # 1000 concurrent users"  
        echo "  ./run-benchmarks.sh tier_5000       # 5000 concurrent users"
        echo "  ./run-benchmarks.sh all_tiers       # All tiers in single run"
        exit 1
        ;;
esac

echo -e "\n${GREEN}"
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                        BENCHMARK COMPLETE                                  ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "Results saved to: ${RESULTS_DIR}/"
echo ""
