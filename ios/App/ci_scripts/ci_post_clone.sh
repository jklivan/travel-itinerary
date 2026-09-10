#!/bin/sh
set -eu

# Xcode Cloud checks out Git, but node_modules is deliberately not committed.
# Install dependencies before Xcode resolves CapApp-SPM's local plugin packages.
cd "${CI_PRIMARY_REPOSITORY_PATH:?Xcode Cloud repository path is required}"

export HOMEBREW_NO_AUTO_UPDATE=1
brew list --versions node@22 >/dev/null 2>&1 || brew install node@22
PATH="$(brew --prefix node@22)/bin:$PATH"
export PATH

# The native shell loads the deployed website. It needs package sources only,
# not Prisma generation, database credentials, or a Next.js production build.
npm ci --ignore-scripts --no-audit --no-fund

test -f node_modules/@capacitor/push-notifications/Package.swift
