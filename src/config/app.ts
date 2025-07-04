import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { initializeSocket } from './socket';
import { errorHandler } from '../middleware/errorHandler';
import routes from '../routes/index';
import { responseHandler } from 'middleware/responseHandler';

const app: Express = express() as any;
const httpServer = createServer(app);

// Initialize socket.io
const io = initializeSocket(httpServer);

app.set('io', io);

app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '30mb' }));

app.use(
  cors({
    allowedHeaders: '*',
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);
app.use(helmet());

app.use(morgan('dev'));

const limiter = rateLimit({
  max: 10000,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});

app.use(responseHandler);

app.use('/', limiter, routes);

// Handle errors after all routes have been checked.
app.use(errorHandler);

app.all('*', (req, res, _) => {
  res.notFound(`Can't find ${req.originalUrl} on this server!`);
});

export { httpServer };
export default app;
