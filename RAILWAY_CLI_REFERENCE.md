# Railway CLI Quick Reference

## Installation

```bash
npm install -g @railway/cli
```

or

```bash
yarn global add @railway/cli
```

## Authentication

```bash
# Login to Railway (opens browser)
railway login

# Logout
railway logout

# Check current user
railway whoami
```

## Project Management

```bash
# Create new project and initialize in current directory
railway init

# Link to existing project
railway link

# List all projects
railway projects

# Show project info
railway status
```

## Services & Deployment

```bash
# Deploy current service from current directory
railway up

# Deploy with specific service name
railway up --name my-backend

# Deploy specific file/directory
railway up ./backend

# Check deployment status
railway status

# View recent deployments
railway logs -m 50
```

## Environment Variables

```bash
# View all environment variables
railway variables

# Set single variable
railway variables set DATABASE_URL=postgresql://...

# Set multiple variables
railway variables set KEY1=value1 KEY2=value2

# Unset variable
railway variables unset KEY_NAME

# View specific variable
railway variables list
```

## Logs & Monitoring

```bash
# View service logs
railway logs

# View last 100 lines
railway logs -m 100

# Follow logs (real-time)
railway logs -f

# View logs for specific service
railway logs -s backend
```

## Database Management

```bash
# Run command in service context
railway run npm install

# Run migrations
railway run npx prisma migrate deploy

# Seed database
railway run npx prisma db seed

# Access database directly
railway database connect
```

## Remote Execution

```bash
# Execute command in deployed environment
railway run bash -c "some command"

# Run migrations
railway run npx prisma migrate deploy

# List environment
railway run printenv
```

## Configuration

```bash
# Set current service
railway service backend

# View service info
railway service

# List all services in project
railway services
```

## Plugins & Add-ons

```bash
# Add PostgreSQL database
railway add-plugin

# View plugins
railway plugins
```

## Advanced

```bash
# Run locally (requires docker)
railway run npm run dev

# Execute shell in remote environment
railway shell

# Show Railway configuration
railway config

# View full command help
railway help
railway help <command>
```

## Common Workflows

### Deploy all services

```bash
# Backend
cd backend && railway up && cd ..

# Frontend
cd frontend && railway up && cd ..

# Landing Page
cd landing-page && railway up && cd ..
```

### Setup environment variables from .env file

```bash
# Export from .env to Railway
set -a
source .env
set +a

# Then use railway variables set
railway variables set KEY1=$KEY1 KEY2=$KEY2
```

### Monitor deployments

```bash
# Follow logs in real-time
railway logs -f

# Check status
railway status

# Get service URL
railway service info
```

### Troubleshooting

```bash
# View detailed error logs
railway logs -m 500

# Check service configuration
railway service

# Run health check
railway run curl http://localhost:3001/health

# Debug environment
railway run printenv
```

## Resources

- Railway Docs: https://docs.railway.app
- CLI Reference: https://docs.railway.app/reference/cli-api
- Dashboard: https://railway.app/dashboard

## Environment Variables for Kenge

**Backend (.env for railway)**
```bash
DATABASE_URL=postgresql://user:password@host:port/dbname
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-id
GOOGLE_CLIENT_SECRET=your-secret
SMTP_HOST=smtp-host
SMTP_PORT=587
SMTP_USER=user
SMTP_PASSWORD=password
SMTP_FROM=sender@email.com
NODE_ENV=production
```

**Frontend (.env for railway)**
```bash
VITE_API_URL=https://backend-url.railway.app
VITE_GOOGLE_CLIENT_ID=your-id
```

**Landing Page**
```bash
(Usually none required)
```

## Useful Commands for Kenge

```bash
# Build and deploy backend
cd backend
npm run build
railway up --name backend

# Deploy frontend
cd ../frontend
npm run build
railway up --name frontend

# Deploy landing page
cd ../landing-page
npm run build
railway up --name landing-page

# Run migrations after backend is deployed
railway run npx prisma migrate deploy

# Seed database
railway run npx prisma db seed

# Check if backend is healthy
railway run curl http://localhost:3001/health
```
