/**
 * Global teardown for Jest tests
 * This ensures that any remaining handles are properly closed
 */
export default async () => {
  // Give time for any open handles to close
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Force close any remaining handles
  if (global.gc) {
    global.gc();
  }
};
