import {
  normalizeUserRole,
  ROLE_COLORS,
  ROLE_NAMES,
  ROLE_PATHS,
  USER_ROLES,
} from './types';

describe('ACCOUNTS role', () => {
  it('is recognized and routes to accounting', () => {
    expect(USER_ROLES).toContain('ACCOUNTS');
    expect(normalizeUserRole('accounts')).toBe('ACCOUNTS');
    expect(ROLE_PATHS.ACCOUNTS).toBe('/accounting');
  });

  it('has display metadata', () => {
    expect(ROLE_NAMES.ACCOUNTS).toBe('Accounts Team');
    expect(ROLE_COLORS.ACCOUNTS).toBeDefined();
  });
});
