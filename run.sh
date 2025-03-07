#!/bin/bash
# Migrate the db and start the server
# Used in the docker container
node_modules/.bin/prisma migrate deploy
node .output/server/index.mjs
