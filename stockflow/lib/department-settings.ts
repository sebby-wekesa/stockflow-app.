import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE_PATH = path.join(DATA_DIR, 'departments.json')

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, JSON.stringify({}), 'utf8')
}

export function getDepartmentsForOrg(organizationId: string): string[] {
  ensureDataFile()
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8')
    const obj = JSON.parse(raw || '{}')
    return Array.isArray(obj[organizationId]) ? obj[organizationId] : []
  } catch (e) {
    console.error('Failed to read departments file', e)
    return []
  }
}

export function setDepartmentsForOrg(organizationId: string, list: string[]) {
  ensureDataFile()
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8')
    const obj = JSON.parse(raw || '{}')
    obj[organizationId] = list
    fs.writeFileSync(FILE_PATH, JSON.stringify(obj, null, 2), 'utf8')
    return true
  } catch (e) {
    console.error('Failed to write departments file', e)
    return false
  }
}
