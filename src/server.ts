import app from './config/app';
import { config } from 'dotenv';
import connection from './config/db';

config();

// eslint-disable-next-line no-undef
const port = process.env.PORT || 3000;

process.on('uncaughtException', (error: Error) => {
  console.log('We handle it there', error);

  //handle(error)
  // if (untrusted): process.exit(1)
});

await connection();

app.listen(port, () => {
  console.log(`[server]: Server is running on port ${port}`);
});
