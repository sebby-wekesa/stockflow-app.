const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = "postgresql://postgres.aojpbuwuybbsikelbmqt:9093Sebby123@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require";

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log("Connected to database successfully!");

  const sqlPath = path.join(__dirname, '..', 'prisma', 'migrations', '20260520000000_multitenancy_stage1', 'migration.sql');
  let sql = fs.readFileSync(sqlPath, 'utf8');

  // Let's run it.
  try {
    console.log("Running SQL...");
    await client.query(sql);
    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration failed!");
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
