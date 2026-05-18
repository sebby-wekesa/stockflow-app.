# Database Connection Pooling Configuration

## Issue
The application was hitting connection pool limits with error:
```
(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15
```

## Root Causes Fixed

### 1. Middleware Database Queries
**FIXED**: Removed expensive database profile lookups in middleware. Now uses role data already stored in the Supabase JWT session metadata.
- **Before**: Every request queried `profiles` table via Supabase Admin client
- **After**: Role data read directly from `session.user.user_metadata.role` (no DB query)

### 2. Insufficient Connection Limit
**FIXED**: Increased Prisma connection limit from 5 to 20 connections.
- **Location**: `lib/prisma.ts` - `connection_limit` parameter

## DATABASE_URL Configuration

Your `DATABASE_URL` must be properly configured for production use. For Supabase, ensure:

```
postgresql://user:password@db.region.supabase.co:5432/postgres?pgbouncer=true&connection_limit=20&pool_timeout=30&sslmode=require
```

### Key Parameters
- `pgbouncer=true` - Enable PgBouncer connection pooling
- `connection_limit=20` - Maximum connections per client (increased from 5)
- `pool_timeout=30` - Connection timeout in seconds
- `sslmode=require` - Require SSL for security

## Supabase-Specific Setup

If using Supabase:

1. **Get the correct connection string**:
   - Go to Supabase Dashboard → Settings → Database → Connection string
   - Copy the URI format

2. **Add pooling parameters**:
   ```
   postgresql://postgres.[project-id]:[password]@db.[region].supabase.co:5432/postgres?pgbouncer=true&connection_limit=20&pool_timeout=30&sslmode=require&uselibpqcompat=true
   ```

3. **Set environment variable**:
   ```bash
   DATABASE_URL="your-pooled-connection-string"
   ```

## Monitoring Connections

To check active connections in PostgreSQL:
```sql
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
```

To check Prisma client status:
```typescript
// In your application
const stats = await prisma.$metrics.usage();
console.log(stats);
```

## Best Practices

1. **Middleware**: No database queries - use cached session data
2. **Route Handlers**: Query only necessary data, use `.select()` to limit columns
3. **Batch Operations**: Use `$transaction()` for multiple operations
4. **Connection Reuse**: Always use the singleton Prisma client from `lib/prisma.ts`
5. **Error Handling**: Implement retry logic for transient connection errors

## Testing Connection Pool

```bash
# Install ab for load testing
ab -n 100 -c 20 http://localhost:3000/stock

# This simulates 20 concurrent connections
```

## Further Optimization (If Needed)

If still seeing pool exhaustion:

1. **Increase connection_limit further** (to 30-50)
   - Only if database server allows it
   
2. **Use PgBouncer in session mode** (already configured)
   - Supports role credentials with minimal session state

3. **Lazy load heavy queries**:
   - Move expensive queries to background jobs
   - Use React Server Components to stream data

4. **Cache frequently accessed data**:
   - User roles and permissions
   - Product catalog
   - Branch information

5. **Database-level monitoring**:
   - Set up alerts for connection pool exhaustion
   - Monitor slow queries
