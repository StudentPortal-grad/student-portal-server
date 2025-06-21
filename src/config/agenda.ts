import Agenda from 'agenda';
import { config } from './index';

// Initialize Agenda
const agenda = new Agenda({
  db: { address: config.mongoose.url, collection: 'agendaJobs' },
  processEvery: '1 minute', // How often the queue is checked
  maxConcurrency: 20, // Max number of jobs to run at once
});

// Event listeners for Agenda
agenda.on('ready', () => {
  console.log('[agenda]: Agenda started successfully');
});

agenda.on('error', (err) => {
  console.error('[agenda]: Agenda failed to start:', err);
});

export default agenda;
