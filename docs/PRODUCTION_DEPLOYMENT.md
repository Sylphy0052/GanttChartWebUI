# Production Deployment Guide

## Overview

This guide covers the production deployment of GanttChartWebUI using Docker containers with proper security, monitoring, and backup configurations.

## Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- Minimum 4GB RAM, 20GB storage available
- SSL certificate for HTTPS (recommended)
- Domain name configured (recommended)

## Quick Start

### 1. Environment Setup

1. Copy the production environment template:
   ```bash
   cp .env.production.template .env.production
   ```

2. Edit `.env.production` with your production values:
   ```bash
   # Generate strong passwords
   openssl rand -base64 32  # For POSTGRES_PASSWORD
   openssl rand -base64 32  # For REDIS_PASSWORD
   openssl rand -base64 64  # For JWT_SECRET
   ```

3. Update domain-specific settings:
   ```env
   CORS_ORIGIN=https://your-domain.com
   NEXT_PUBLIC_API_URL=https://your-domain.com/api
   NEXT_PUBLIC_API_BASE=https://your-domain.com/api/v1
   ```

### 2. Pre-Deployment Validation

Run the deployment script in check mode:
```bash
./scripts/deploy-production.sh --check
```

### 3. Deploy to Production

Execute the deployment:
```bash
./scripts/deploy-production.sh
```

The script will:
- Validate environment configuration
- Create automatic backups
- Build and deploy containers
- Run health checks
- Provide rollback on failure

## Manual Deployment Steps

If you prefer manual deployment:

### 1. Create Data Directories

```bash
mkdir -p ./data/postgres ./data/redis
chmod 700 ./data/postgres ./data/redis
```

### 2. Deploy Services

```bash
# Load environment variables
source .env.production

# Build images
docker-compose -f docker-compose.production.yml build

# Start services
docker-compose -f docker-compose.production.yml up -d

# Check health
docker-compose -f docker-compose.production.yml ps
```

### 3. Verify Deployment

```bash
# API Health Check
curl http://localhost:3001/health

# Web Health Check
curl http://localhost:3000/health

# Database Connection Test
docker-compose -f docker-compose.production.yml exec postgres pg_isready -U gantt_user
```

## Security Configuration

### Environment Variables

Ensure all sensitive values are properly configured:

- `POSTGRES_PASSWORD`: Strong database password
- `REDIS_PASSWORD`: Redis authentication password
- `JWT_SECRET`: 64+ character secret for JWT signing
- Update default ports if needed for security

### Network Security

- Configure firewall rules to restrict access
- Use HTTPS with valid SSL certificates
- Consider using a reverse proxy (nginx/traefik)
- Enable rate limiting on public endpoints

### Container Security

The production configuration includes:
- Non-root user execution
- Resource limits (CPU/Memory)
- Read-only filesystem where possible
- Security scanning with vulnerability checks

## Monitoring & Logging

### Health Checks

All services include comprehensive health checks:
- **Database**: Connection and query performance
- **API**: Endpoint availability and response time
- **Web**: Service availability and API connectivity

### Logging Configuration

Logs are configured with:
- JSON structured logging
- Log rotation (10MB max, 3-5 files)
- Centralized collection ready
- Performance and audit logging

### Performance Monitoring

Monitor these key metrics:
- Response times (target: <200ms average)
- Memory usage (limits configured)
- Database connections and query performance
- Error rates and exceptions

## Backup & Recovery

### Automated Backups

The system includes:
- Daily automated database backups
- Configuration backups with each deployment
- 30-day retention policy (configurable)
- Backup integrity verification

### Manual Backup

Create immediate backup:
```bash
# Database backup
docker-compose -f docker-compose.production.yml exec postgres pg_dump -U gantt_user gantt_chart > backup_$(date +%Y%m%d).sql

# Full system backup
./scripts/backup-production.sh
```

### Disaster Recovery

Recovery procedures:
1. Restore from latest backup
2. Verify data integrity
3. Update configuration if needed
4. Restart services
5. Verify health checks

## Maintenance

### Routine Maintenance

Weekly tasks:
- Review system logs for errors
- Check backup integrity
- Monitor resource usage
- Review security alerts

Monthly tasks:
- Update container base images
- Review and rotate secrets
- Performance optimization review
- Capacity planning assessment

### Updates and Upgrades

1. **Test in staging environment first**
2. Create full backup before update
3. Use deployment script for consistency
4. Monitor for 24h after deployment
5. Document any issues or changes

### Scaling Considerations

For increased load:
- Add API/Web service replicas
- Configure load balancer
- Increase database connection pool
- Add Redis caching layer
- Consider read replicas for database

## Troubleshooting

### Common Issues

1. **Services won't start**
   ```bash
   docker-compose -f docker-compose.production.yml logs
   ```

2. **Database connection errors**
   ```bash
   docker-compose -f docker-compose.production.yml exec postgres pg_isready -U gantt_user
   ```

3. **High memory usage**
   ```bash
   docker stats
   ```

### Emergency Procedures

1. **System Outage**
   - Check container status
   - Review recent logs
   - Restart affected services
   - Escalate if needed

2. **Data Corruption**
   - Stop write operations
   - Assess damage scope
   - Restore from backup
   - Verify integrity

3. **Security Incident**
   - Isolate affected systems
   - Preserve logs for analysis
   - Apply security patches
   - Notify stakeholders

## Performance Targets

Expected performance metrics:
- **Initial Load**: < 1.5 seconds
- **API Response**: < 200ms average
- **Concurrent Users**: 100+ supported
- **Uptime**: > 99.5% target
- **Memory Usage**: < 2GB total

## Support Contacts

- **Technical Issues**: [Technical Lead]
- **Security Incidents**: [Security Team]
- **Infrastructure**: [DevOps Team]
- **Business Impact**: [Business Owner]

## Change Log

- **v1.0**: Initial production deployment guide
- **Date**: 2025-01-06
- **Author**: Claude Code Assistant