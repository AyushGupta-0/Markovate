import express from 'express';
import cors from 'cors';
import { config } from './config';
import { connectDatabase } from './config/database';
import { requestIdMiddleware } from './middlewares/requestId';
import { loggerMiddleware } from './middlewares/logger';
import { errorHandler } from './middlewares/errorHandler';
import healthRoutes from './routes/health';
import userRoutes from './routes/users';
import incidentRoutes from './routes/incidents';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(loggerMiddleware);

// Routes
app.use('/health', healthRoutes);
app.use('/ready', healthRoutes);
app.use('/v1/users', userRoutes);
app.use('/v1/incidents', incidentRoutes);

// Error handling
app.use(errorHandler);

// Start server
async function startServer() {
  await connectDatabase();

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

startServer();

export default app;
