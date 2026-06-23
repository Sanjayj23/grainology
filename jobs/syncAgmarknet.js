import 'dotenv/config';
import { syncAgmarknet } from './agmarknetCron.js';

try {
  await syncAgmarknet();
  process.exit(0);
} catch (error) {
  console.error(`Agmarknet sync failed: ${error.message}`);
  process.exit(1);
}
