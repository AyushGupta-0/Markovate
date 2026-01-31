import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Incident & Alerts API',
      version: '1.0.0',
      description: 'Production-grade incident management system with caching, idempotency, and rate limiting',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User ID',
            },
            name: {
              type: 'string',
              description: 'User name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email (unique)',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
          },
        },
        Incident: {
          type: 'object',
          required: ['title', 'description', 'severity', 'createdBy'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Incident ID',
            },
            title: {
              type: 'string',
              description: 'Incident title',
            },
            description: {
              type: 'string',
              description: 'Detailed description',
            },
            severity: {
              type: 'string',
              enum: ['P1', 'P2', 'P3'],
              description: 'Incident severity',
            },
            status: {
              type: 'string',
              enum: ['OPEN', 'ACK', 'RESOLVED'],
              description: 'Current status',
            },
            createdBy: {
              type: 'string',
              format: 'uuid',
              description: 'User ID who created this incident',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Error code',
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            request_id: {
              type: 'string',
              format: 'uuid',
              description: 'Request ID for tracking',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Users',
        description: 'User management',
      },
      {
        name: 'Incidents',
        description: 'Incident management with caching and idempotency',
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
