#!/bin/bash
# start-dev.sh — wrapper pour le preview Claude
cd /Users/wmaurice/projects/calsnap
exec ./node_modules/.bin/vite --port "${PORT:-5173}"
