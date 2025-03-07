#!/bin/bash
# Migrate the db and start the server
# Used in the docker container
set -eo pipefail

function motd {
    echo "———————— grate server ————————"
    echo "https://github.com/wjdp/grate"
    echo "——————————————————————————————"
}

function check_data_directory {
  if [ ! -d "/app/data" ]; then
    echo "🔴❌ Data directory not found. Please mount a volume to /app/data"
    echo "❌🔴 Without a mounted data directory you will lose all data on restart"
    exit 1
  fi
}

function check_variables {
    fail=0
    if [ -z "$STEAM_USER_ID" ]; then
        echo "❓❌ STEAM_API_KEY not set"
        fail=1
    fi
    if [ -z "$STEAM_USER_ID" ]; then
        echo "❓❌ STEAM_USER_ID not set"
        fail=1
    fi
    # check fail state
    if [ $fail -ne 0 ]; then
        exit 1
    fi
}

function migrate_db {
  echo "🚂 Migrating the database"
  node_modules/.bin/prisma migrate deploy
}

function start_server {
  echo "🚀 Starting grate server"
  node .output/server/index.mjs
}

motd

check_data_directory
check_variables

migrate_db
start_server
