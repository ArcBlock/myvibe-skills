import chalk from 'chalk'

/**
 * Detect output mode: 'json' for AI agents, 'human' for CLI users
 */
function detectMode() {
  if (process.env.MYVIBE_OUTPUT === 'json') return 'json'
  if (process.env.MYVIBE_OUTPUT === 'human') return 'human'
  const isAgent = !!(process.env.CLAUDECODE || process.env.CODEX || process.env.GEMINI_CLI || process.env.OPENCODE)
  return isAgent ? 'json' : 'human'
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

/**
 * Render a text progress bar
 */
function renderProgressBar(percent, width = 20) {
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`
}

/**
 * Write JSON line to stdout
 */
function jsonLine(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

/**
 * Create a UX output instance
 */
export function createUx() {
  const mode = detectMode()

  return {
    mode,

    header(text) {
      if (mode === 'json') {
        jsonLine({ event: 'phase', message: text })
      } else {
        process.stdout.write(chalk.bold(`\n${text}\n\n`))
      }
    },

    step(message) {
      if (mode === 'json') {
        jsonLine({ event: 'step', message })
      } else {
        process.stdout.write(chalk.cyan(`→ ${message}\n`))
      }
    },

    progress(phase, percent, message) {
      if (mode === 'json') {
        jsonLine({ event: 'progress', phase, percent, message })
      } else {
        const bar = renderProgressBar(percent)
        process.stdout.write(`\r${bar} ${percent}% ${message || ''}`)
        if (percent >= 100) {
          process.stdout.write('\n')
        }
      }
    },

    success(message) {
      if (mode === 'json') {
        jsonLine({ event: 'success', message })
      } else {
        process.stdout.write(chalk.green(`✅ ${message}\n`))
      }
    },

    warn(message) {
      if (mode === 'json') {
        jsonLine({ event: 'warn', message })
      } else {
        process.stdout.write(chalk.yellow(`⚠️  ${message}\n`))
      }
    },

    error(code, message, hint) {
      if (mode === 'json') {
        jsonLine({ event: 'error', code, message, hint })
      } else {
        process.stdout.write(chalk.red(`\n❌ ${code}: ${message}\n`))
        if (hint) {
          process.stdout.write(chalk.yellow(`   Hint: ${hint}\n`))
        }
      }
    },

    info(message) {
      if (mode === 'json') {
        jsonLine({ event: 'info', message })
      } else {
        process.stdout.write(chalk.gray(`  ${message}\n`))
      }
    },

    summary(result) {
      if (mode === 'json') {
        jsonLine({ event: 'summary', ...result })
      } else {
        process.stdout.write('\n')
        if (result.success) {
          const lines = ['✅ Published successfully!', '']
          if (result.title) lines.push(`Title:      ${result.title}`)
          if (result.did) lines.push(`DID:        ${result.did}`)
          if (result.url) lines.push(`URL:        ${result.url}`)
          if (result.visibility) lines.push(`Visibility: ${result.visibility}`)
          if (result.duration_ms != null) lines.push(`Time:       ${(result.duration_ms / 1000).toFixed(1)}s`)

          const maxLen = Math.max(...lines.map((l) => l.length)) + 4
          process.stdout.write(chalk.green(`┌${'─'.repeat(maxLen)}┐\n`))
          for (const line of lines) {
            process.stdout.write(chalk.green(`│ ${line.padEnd(maxLen - 2)} │\n`))
          }
          process.stdout.write(chalk.green(`└${'─'.repeat(maxLen)}┘\n`))
        } else {
          process.stdout.write(chalk.red.bold('❌ Publish failed\n\n'))
          if (result.error_code) process.stdout.write(chalk.red(`Error:  ${result.error_code} — ${result.message}\n`))
          else if (result.message) process.stdout.write(chalk.red(`Error:  ${result.message}\n`))
          if (result.hint) process.stdout.write(chalk.yellow(`Hint:   ${result.hint}\n`))
          if (result.phase) {
            const retryInfo = result.retries ? ` (after ${result.retries} retries)` : ''
            process.stdout.write(chalk.gray(`Phase:  ${result.phase}${retryInfo}\n`))
          }
          if (result.duration_ms != null)
            process.stdout.write(chalk.gray(`Time:   ${(result.duration_ms / 1000).toFixed(1)}s\n`))
        }
        process.stdout.write('\n')
      }
    },
  }
}
