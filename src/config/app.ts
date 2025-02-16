import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import errorHandler from '../middlewares/errorHandler';
import routes from '../routes/index'; 

const app: Express = express();

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

app.use('/api', routes, limiter);

// Handle errors after all routes have been checked.
app.use(errorHandler);

app.all('*', (req, res, _) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`,
  });
});

export default app;
