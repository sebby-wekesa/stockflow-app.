import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

export const DEFAULT_PRODUCTION_DEPARTMENTS = ['Production']

export async function getDepartmentsForOrg(organizationId: string): Promise<string[]> {
  try {
    // Fetch all users for the organization with their department and departments fields
    const users = await prisma.user.findMany({
      where: { organizationId },
      select: {
        department: true,
        departments: true,
      },
    })

    // Collect all non-empty department values from both fields
    const departmentSet = new Set<string>()

    for (const user of users) {
      // Add singular department if it exists and is not empty
      if (user.department && typeof user.department === 'string' && user.department.trim() !== '') {
        departmentSet.add(user.department.trim())
      }

      // Add departments from the plural array if they exist and are not empty
      if (Array.isArray(user.departments)) {
        for (const dept of user.departments) {
          if (dept && typeof dept === 'string' && dept.trim() !== '') {
            departmentSet.add(dept.trim())
          }
        }
      }
    }

    // Convert set to sorted array
    const departments = Array.from(departmentSet).sort()

    // Return the departments if we found any, otherwise fall back to defaults
    return departments.length > 0 ? departments : DEFAULT_PRODUCTION_DEPARTMENTS
  } catch (error) {
    console.error('Failed to fetch departments from database:', error)
    // Fall back to defaults on error
    return DEFAULT_PRODUCTION_DEPARTMENTS
  }
}

export function setDepartmentsForOrg(organizationId: string, list: string[]): boolean {
  // Keep the existing file-based implementation for backward compatibility
  // or to store admin-configured department lists separately from user-assigned ones

  const DATA_DIR = path.join(process.cwd(), 'data')
  const FILE_PATH = path.join(DATA_DIR, 'departments.json')

  function ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, JSON.stringify({}), 'utf8')
  }

  ensureDataFile()
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8')
    const obj = JSON.parse(raw || '{}')
    obj[organizationId] = list.map((department) => department.trim()).filter(Boolean)
    fs.writeFileSync(FILE_PATH, JSON.stringify(obj, null, 2), 'utf8')
    return true
  } catch (e) {
    console.error('Failed to write departments file', e)
    return false
  }
}