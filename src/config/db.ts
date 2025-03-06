import mongoose from 'mongoose';

/* global process */

const connection = async () => {
  try {
    await mongoose.connect(
      (process.env.DB_URI as string) || (process.env.DB_LOCAL as string)
    );
    console.log(`[database]: Database Connection established!`);
  } catch (error) {
    console.log(`[database]: Database connection error: ${error}`);
  }
};

export default connection;
