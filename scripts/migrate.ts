import dotenv from 'dotenv';
import { databaseProvider, runMysqlMigrations, seedAppDatabase } from '../server/database/compat.ts';

dotenv.config();

async function main() {
  if (databaseProvider !== 'mysql') {
    console.log(`DATABASE_PROVIDER=${databaseProvider}; no MySQL migration needed.`);
    return;
  }

  await runMysqlMigrations();
  await seedAppDatabase();
  console.log('MySQL migrations and seed completed.');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
