#!/bin/bash
# Vercel build script - builds only web app

cd apps/web
pnpm install
pnpm build
