import * as jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';

describe('JWT Auth', () => {
  it('should sign and verify JWT correctly', () => {
    const payload = { userId: '123', email: 'test@example.com', role: 'ADMIN' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  it('should reject invalid token', () => {
    expect(() => jwt.verify('invalid-token', JWT_SECRET)).toThrow();
  });
});