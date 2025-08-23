# E-Commerce Microservices System

A distributed e-commerce order processing system built with microservices architecture, featuring event-driven communication via RabbitMQ and containerized deployment with Docker.

## 🏗️ Architecture Overview

### Services
- **API Gateway** (Port 3001): Single entry point with idempotency middleware
- **Sales Service** (Port 3000): Order creation, status management, inventory validation
- **Inventory Service** (Port 3003): Stock management, product catalog, audit trail
- **Delivery Service** (Port 3002): Delivery management, status updates, route tracking

### Infrastructure
- **PostgreSQL** (Port 5432): Three databases (sales_db, delivery_db, inventory_db)
- **RabbitMQ** (Port 5672): Event-driven communication between services
- **RabbitMQ Management UI** (Port 15672): Queue monitoring and management

### Communication Flow
1. **Order Creation**: Sales Service → Inventory Service (stock validation) → Delivery Service
2. **Status Updates**: Delivery Service → Sales Service (bidirectional status sync)
3. **Stock Management**: Sales Service ↔ Inventory Service (reservation/release)

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Postman (for API testing)

### 1. Clone and Start System
```bash
# Clone the repository
git clone <repository-url>
cd my_shop

# Start all services with Docker Compose
docker-compose up --build

# Wait for all services to be healthy (check logs)
docker-compose logs -f
```

### 2. Verify Services
Once all containers are running, verify services are accessible:

- **API Gateway**: http://localhost:3001/health
- **Sales Service**: http://localhost:3000/health  
- **Inventory Service**: http://localhost:3003/health
- **Delivery Service**: http://localhost:3002/health
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

## 📋 Database Setup

The system automatically creates and initializes three PostgreSQL databases:

- **sales_db**: Orders and order items
- **delivery_db**: Deliveries and delivery logs  
- **inventory_db**: Products and stock movements

Database initialization happens automatically via Docker initialization scripts.

## 🧪 Testing with Postman

### Import Collection
1. Open Postman
2. Import the collection: `My Ecomerce Shop.postman_collection.json`
3. The collection includes all necessary API endpoints

### Complete Order Workflow

#### Step 1: Create an Order
```http
POST http://localhost:3001/api/orders
Content-Type: application/json

{
  "customerId": "customer-123",
  "customerEmail": "customer@example.com",
  "shippingAddress": "123 Main St, City, State 12345",
  "items": [
    {
      "productId": "1",
      "productName": "Laptop",
      "quantity": 1,
      "unitPrice": 999.99
    }
  ]
}
```

**Expected Response:**
```json
{
  "orderId": "uuid-generated-id",
  "status": "Pending Shipment",
  "totalAmount": "999.99",
  "message": "Order created successfully with inventory validation and delivery process initiated"
}
```

#### Step 2: Get Order Details
```http
GET http://localhost:3001/api/orders/{orderId}
```

#### Step 3: Get Delivery Information
```http
GET http://localhost:3001/api/deliveries
```

**Find your delivery by matching the orderId, then note the delivery ID.**

#### Step 4: Update Delivery Status
```http
PUT http://localhost:3001/api/deliveries/{deliveryId}/status
Content-Type: application/json

{
  "status": "IN_TRANSIT"
}
```

**Available delivery statuses:**
- `PENDING` (initial status)
- `IN_TRANSIT` 
- `DELIVERED`
- `FAILED`

#### Step 5: Verify Order Status Update
```http
GET http://localhost:3001/api/orders/{orderId}
```

The order status should be automatically updated based on the delivery status change.

## 🔧 Development Setup

### Running Individual Services
```bash
# Sales Service
cd sales-service
npm install
npm run dev

# Delivery Service  
cd delivery-service
npm install
npm run dev

# Inventory Service
cd inventory-service
npm install
npm run dev

# API Gateway
cd api-gateway
npm install
npm run dev
```

### Database Migrations
```bash
# Sales Service
cd sales-service
npm run db:generate  # Generate new migrations
npm run db:migrate   # Apply migrations

# Delivery Service
cd delivery-service
npm run db:generate
npm run db:migrate

# Inventory Service
cd inventory-service
npm run db:generate
npm run db:migrate
```

## 🐳 Docker Commands

### Basic Operations
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Stop all services
docker-compose down

# Rebuild and start
docker-compose up --build

# Remove volumes (reset databases)
docker-compose down -v
```

### Individual Service Management
```bash
# Restart specific service
docker-compose restart sales-service

# View service logs
docker-compose logs -f sales-service

# Execute commands in container
docker-compose exec sales-service npm run db:migrate
```

## 🔍 Monitoring & Debugging

### RabbitMQ Management
- **URL**: http://localhost:15672
- **Credentials**: guest/guest
- **Monitor**: Queue depths, message rates, consumer status

### Key Queues to Monitor
- `delivery_queue`: Sales → Delivery (order creation)
- `order_status_queue`: Delivery → Sales (status updates)
- `inventory_check_queue`: Sales → Inventory (stock validation)
- `inventory_response_queue`: Inventory → Sales (validation responses)
- `stock_reservation_queue`: Sales → Inventory (stock reservations)
- `stock_release_queue`: Sales → Inventory (stock releases)

### Database Access
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres

# List databases
\l

# Connect to specific database
\c sales_db

# List tables
\dt
```

## 🚨 Troubleshooting

### Common Issues

**Services not starting:**
```bash
# Check container status
docker-compose ps

# View detailed logs
docker-compose logs [service-name]
```

**Database connection errors:**
```bash
# Ensure PostgreSQL is ready
docker-compose logs postgres

# Restart services after DB is ready
docker-compose restart sales-service delivery-service inventory-service
```

**RabbitMQ connection issues:**
```bash
# Check RabbitMQ status
docker-compose logs rabbitmq

# Verify queue creation
# Visit http://localhost:15672 and check Queues tab
```

**Port conflicts:**
```bash
# Check if ports are in use
lsof -i :3000
lsof -i :3001
lsof -i :3002
lsof -i :3003
lsof -i :5432
lsof -i :5672
```

## 📚 API Documentation

### Sales Service Endpoints
- `POST /orders` - Create new order
- `GET /orders/:id` - Get order details
- `PATCH /orders/:id/status` - Update order status

### Delivery Service Endpoints  
- `GET /deliveries` - List all deliveries
- `GET /deliveries/:id` - Get delivery details
- `PUT /deliveries/:id/status` - Update delivery status

### Inventory Service Endpoints
- `POST /check-availability` - Check product availability

All endpoints are accessible through the API Gateway at `http://localhost:3001/api/`

## 🏷️ Environment Variables

Key environment variables are configured in `docker-compose.yml`:

```yaml
# Database
DATABASE_URL=postgresql://postgres:password@postgres:5432/sales_db

# RabbitMQ  
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672

# Service Ports
PORT=3000  # Sales Service
PORT=3002  # Delivery Service  
PORT=3003  # Inventory Service
```

## 📈 System Features

- ✅ **Event-Driven Architecture**: Asynchronous communication via RabbitMQ
- ✅ **Database Per Service**: Independent data management
- ✅ **Automatic Stock Management**: Inventory validation and reservation
- ✅ **Bidirectional Status Updates**: Real-time order/delivery synchronization
- ✅ **Audit Trail**: Complete stock movement history
- ✅ **Containerized Deployment**: Docker-based infrastructure
- ✅ **API Gateway**: Centralized request routing with idempotency
- ✅ **Health Checks**: Service availability monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with the provided Postman collection
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
