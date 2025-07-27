#!/bin/bash
set -e
mkdir -p reports
npx c8 -r html -r text npm test 2>&1 | tee reports/test.log
