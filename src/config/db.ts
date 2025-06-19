import mongoose from 'mongoose';
import { config } from './index';

const connection = async () => {
  try {
    await mongoose.connect(config.mongoose.url);
    console.log(`[database]: Database Connection established!`);
  } catch (error) {
    console.log(`[database]: Database connection error: ${error}`);
  }
};

export default connection;
