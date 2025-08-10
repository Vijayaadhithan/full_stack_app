#!/bin/bash
set -e
mkdir -p reports
npm run test:coverage -- --reporter=html --reporter=text 2>&1 | tee reports/test.log
