# E-Commerce Order Processing System

A microservices-based order processing system with Sales and Delivery services, built with Node.js, Express, TypeORM, Docker, and RabbitMQ.

## Architecture

- **Sales Service**: Handles order intake and status management
- **Delivery Service**: Manages order fulfillment and delivery status
- **API Gateway**: Single entry point for all client requests
- **PostgreSQL**: Primary database
- **Redis**: Caching layer
- **RabbitMQ**: Message broker for inter-service communication

## Prerequisites

- Docker and Docker Compose
- Node.js 16+
- npm or yarn

## Getting Started

1. Clone the repository
2. Run `docker-compose up --build`
3. Access the API at `http://localhost:3000`

## Services

- **Sales Service**: `http://localhost:3001`
- **Delivery Service**: `http://localhost:3002`
- **RabbitMQ Management**: `http://localhost:15672` (guest/guest)
- **PGAdmin**: `http://localhost:5050` (admin@admin.com/admin)
