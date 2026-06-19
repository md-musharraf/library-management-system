import 'dotenv/config'
import { generateLicenseKey } from '../src/utils/license'

// Simple CLI argument parsing
const args = process.argv.slice(2)
const params: { [key: string]: string } = {}

args.forEach(arg => {
  if (arg.startsWith('--')) {
    const parts = arg.slice(2).split('=')
    if (parts.length === 2) {
      params[parts[0]] = parts[1]
    }
  }
})

const tenantId = params.tenantId
const type = params.type as '1YEAR' | '2YEAR'

if (!tenantId) {
  console.error('❌ Error: Missing --tenantId parameter')
  console.log('Usage: npx tsx scripts/generate-license.ts --tenantId=<uuid> --type=<1YEAR|2YEAR>')
  process.exit(1)
}

if (!type || (type !== '1YEAR' && type !== '2YEAR')) {
  console.error('❌ Error: --type must be either 1YEAR or 2YEAR')
  console.log('Usage: npx tsx scripts/generate-license.ts --tenantId=<uuid> --type=<1YEAR|2YEAR>')
  process.exit(1)
}

const now = new Date()
let durationMs = 365 * 24 * 60 * 60 * 1000 // 1 year
if (type === '2YEAR') {
  durationMs = 2 * 365 * 24 * 60 * 60 * 1000 // 2 years
}

const expiresAt = new Date(now.getTime() + durationMs)
const key = generateLicenseKey(tenantId, expiresAt, type)

console.log('\n===========================================')
console.log('🔑 LICENSE KEY GENERATION SUCCESSFUL')
console.log('===========================================')
console.log(`Tenant ID:  ${tenantId}`)
console.log(`Type:       ${type}`)
console.log(`Expires At: ${expiresAt.toLocaleString()}`)
console.log(`License Key:\n`)
console.log(`👉 \x1b[36m${key}\x1b[0m`)
console.log('===========================================\n')
