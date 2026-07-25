import { AppDataSource } from './data-source';

// Production migratsiya runner (ts-node'siz, kompilyatsiya qilingan dist orqali).
// Railway deploy'da start'dan oldin ishlaydi.
async function run() {
  await AppDataSource.initialize();
  const executed = await AppDataSource.runMigrations();
  console.log(`[migrations] ${executed.length} ta migratsiya bajarildi`);
  await AppDataSource.destroy();
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[migrations] xato:', e);
    process.exit(1);
  });
