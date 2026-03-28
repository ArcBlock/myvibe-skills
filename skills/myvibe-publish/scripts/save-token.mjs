#!/usr/bin/env node
// Usage: node save-token.mjs --token <token> [--hub <hub-url>]
// Saves the access credential to ~/.myvibe/myvibe-connected.yaml

import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    token: { type: 'string' },
    hub: { type: 'string', default: 'https://www.myvibe.so' },
  },
})

if (!values.token) {
  console.error('Usage: node save-token.mjs --token <token> [--hub <hub-url>]')
  process.exit(1)
}

// Reuse existing store logic
const { createStore } = await import('./utils/store.mjs')
const { hostname } = new URL(values.hub)
const store = await createStore()
await store.setItem(hostname, { MYVIBE_ACCESS_TOKEN: values.token })
console.log(`Credential saved for ${hostname}`)
