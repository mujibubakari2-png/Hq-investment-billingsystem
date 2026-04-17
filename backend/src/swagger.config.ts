/**
 * ISP Billing System - OpenAPI 3.0 Specification
 * 
 * This file documents the complete REST API for the ISP Billing System
 * For interactive documentation, install and run Swagger UI or ReDoc
 * 
 * Setup Instructions:
 * 1. Backend: npm install swagger-jsdoc swagger-ui-express
 * 2. Add this configuration to backend/src/app.ts:
 * 
 *    import swaggerJsdoc from 'swagger-jsdoc';
 *    import swaggerUi from 'swagger-ui-express';
 *    
 *    const swaggerSpec = swaggerJsdoc(swaggerOptions);
 *    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
 */

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'ISP Billing System API',
            version: '1.0.0',
            description: 'Comprehensive REST API for managing ISP billing, routers, packages, and subscribers',
            contact: {
                name: 'HQ Investment Billing',
                email: 'support@hqinvestment.com',
            },
            license: {
                name: 'Proprietary',
            },
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Development server',
            },
            {
                url: 'https://backend-name.railway.app',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT Authorization header using the Bearer scheme',
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        username: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        fullName: { type: 'string' },
                        phone: { type: 'string' },
                        role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'VIEWER'] },
                        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                    required: ['id', 'username', 'email', 'role'],
                },
                Client: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        username: { type: 'string' },
                        fullName: { type: 'string' },
                        phone: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        serviceType: { type: 'string', enum: ['HOTSPOT', 'PPPOE'] },
                        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED'] },
                        accountType: { type: 'string', enum: ['PERSONAL', 'BUSINESS'] },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                    required: ['id', 'username', 'fullName', 'serviceType', 'status'],
                },
                Package: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        type: { type: 'string', enum: ['HOTSPOT', 'PPPOE'] },
                        uploadSpeed: { type: 'number' },
                        downloadSpeed: { type: 'number' },
                        price: { type: 'number' },
                        duration: { type: 'integer' },
                        durationUnit: { type: 'string', enum: ['MINUTES', 'HOURS', 'DAYS', 'MONTHS'] },
                        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                    required: ['id', 'name', 'type', 'uploadSpeed', 'downloadSpeed', 'price', 'duration'],
                },
                Subscription: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        clientId: { type: 'string', format: 'uuid' },
                        packageId: { type: 'string', format: 'uuid' },
                        status: { type: 'string', enum: ['ACTIVE', 'EXPIRED', 'EXTENDED', 'SUSPENDED'] },
                        activatedAt: { type: 'string', format: 'date-time' },
                        expiresAt: { type: 'string', format: 'date-time' },
                        onlineStatus: { type: 'string', enum: ['ONLINE', 'OFFLINE'] },
                    },
                    required: ['id', 'clientId', 'packageId', 'status'],
                },
                Router: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        host: { type: 'string' },
                        port: { type: 'integer', default: 8728 },
                        apiPort: { type: 'integer', default: 8728 },
                        username: { type: 'string' },
                        password: { type: 'string' },
                        type: { type: 'string', default: 'MikroTik' },
                        status: { type: 'string', enum: ['ONLINE', 'OFFLINE'] },
                        activeUsers: { type: 'integer' },
                        cpuLoad: { type: 'number' },
                        memoryUsed: { type: 'number' },
                        uptime: { type: 'string' },
                    },
                    required: ['id', 'name', 'host'],
                },
                Transaction: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        clientId: { type: 'string', format: 'uuid' },
                        planName: { type: 'string' },
                        amount: { type: 'number' },
                        type: { type: 'string', enum: ['MANUAL', 'MOBILE', 'VOUCHER'] },
                        method: { type: 'string' },
                        status: { type: 'string', enum: ['COMPLETED', 'PENDING', 'FAILED'] },
                        reference: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                    required: ['id', 'clientId', 'amount', 'method', 'status'],
                },
                Error: {
                    type: 'object',
                    properties: {
                        code: { type: 'string' },
                        message: { type: 'string' },
                        statusCode: { type: 'integer' },
                        details: { type: 'object' },
                        timestamp: { type: 'string', format: 'date-time' },
                    },
                    required: ['code', 'message', 'statusCode'],
                },
            },
        },
        security: [{ bearerAuth: [] }],
        paths: {
            '/auth/login': {
                post: {
                    summary: 'User login',
                    tags: ['Authentication'],
                    security: [],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        username: { type: 'string' },
                                        password: { type: 'string' },
                                    },
                                    required: ['username', 'password'],
                                },
                            },
                        },
                    },
                    responses: {
                        200: {
                            description: 'Login successful',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            token: { type: 'string' },
                                            user: { $ref: '#/components/schemas/User' },
                                        },
                                    },
                                },
                            },
                        },
                        401: {
                            description: 'Invalid credentials',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/Error' },
                                },
                            },
                        },
                    },
                },
            },
            '/clients': {
                get: {
                    summary: 'List all clients',
                    tags: ['Clients'],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                        { name: 'search', in: 'query', schema: { type: 'string' } },
                        { name: 'status', in: 'query', schema: { type: 'string' } },
                    ],
                    responses: {
                        200: {
                            description: 'List of clients',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            data: {
                                                type: 'array',
                                                items: { $ref: '#/components/schemas/Client' },
                                            },
                                            total: { type: 'integer' },
                                            page: { type: 'integer' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                post: {
                    summary: 'Create a new client',
                    tags: ['Clients'],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Client' },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'Client created successfully' },
                        400: { description: 'Invalid input' },
                    },
                },
            },
            '/packages': {
                get: {
                    summary: 'List all packages',
                    tags: ['Packages'],
                    responses: {
                        200: {
                            description: 'List of packages',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Package' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/routers': {
                get: {
                    summary: 'List all routers',
                    tags: ['Routers'],
                    responses: {
                        200: {
                            description: 'List of routers',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Router' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/dashboard': {
                get: {
                    summary: 'Get dashboard statistics',
                    tags: ['Dashboard'],
                    parameters: [
                        { name: 'tenantId', in: 'query', schema: { type: 'string' } },
                        { name: 'routerId', in: 'query', schema: { type: 'string' } },
                    ],
                    responses: {
                        200: { description: 'Dashboard data' },
                    },
                },
            },
        },
    },
    apis: [
        './src/app/**/*.ts', // Scan for JSDoc comments in your routes
        './src/routes/**/*.ts',
    ],
};

export default swaggerOptions;
