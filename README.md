# E-Commerce Microservices System

A distributed e-commerce order processing system built with microservices architecture, featuring event-driven communication via RabbitMQ and containerized deployment with Docker.

## 🏗️ Architecture Overview

### Services
- **API Gateway** (Port 3000): Single entry point with idempotency middleware and request routing
- **Sales Service** (Port 3001): Order creation, status management, inventory validation
- **Inventory Service** (Port 3003): Stock management, product catalog, audit trail
- **Delivery Service** (Port 3002): Delivery management, status updates, route tracking

### Infrastructure
- **PostgreSQL** (Port 5432): Three databases (sales_db, delivery_db, inventory_db)
- **RabbitMQ** (Port 5672): Event-driven communication between services
- **RabbitMQ Management UI** (Port 15672): Queue monitoring and management
- **Redis** (Port 6379): Caching and session management for API Gateway

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

- **API Gateway**: http://localhost:3000/health
- **Sales Service**: http://localhost:3001/health  
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
3. The collection includes automated scripts for seamless workflow testing

### Automated Workflow Testing

The Postman collection now includes **automated scripts** that eliminate manual work:

- **Automatic Variable Capture**: Order IDs and Delivery IDs are automatically extracted and stored
- **Seamless Flow**: Run requests in sequence without manual copy-pasting of IDs
- **Complete Lifecycle Testing**: From order creation to delivery status updates

### Complete Order Workflow

#### Step 1: Create an Order
```http
POST http://localhost:3000/api/sales
Content-Type: application/json
Idempotency-Key: lifecycle-test-{timestamp}

{
  "customerId": "customer-lifecycle-test",
  "customerEmail": "lifecycle@example.com",
  "shippingAddress": "123 Lifecycle Test St, Demo City, State 12345",
  "items": [
    {
      "productId": "prod-001",
      "quantity": 2,
      "unitPrice": 99.99,
      "productName": "Wireless Bluetooth Headphones"
    }
  ]
}
```

**✨ Automated Script**: Captures `orderId` from response and stores it as a collection variable.

**Expected Response:**
```json
{
  "orderId": "uuid-generated-id",
  "status": "Pending Shipment",
  "totalAmount": "199.98",
  "message": "Order created successfully with inventory validation and delivery process initiated"
}
```

#### Step 2: Get Order Details
```http
GET http://localhost:3000/api/sales/orders/{orderId}
```

**✨ Automated**: Uses the captured `orderId` variable automatically.

#### Step 3: Get Delivery Information
```http
GET http://localhost:3002/deliveries
```

**✨ Automated Script**: Captures the first delivery's `id` and stores it as `deliveryId` variable.

#### Step 4: Update Delivery Status
```http
PATCH http://localhost:3002/deliveries/{deliveryId}/status
Content-Type: application/json

{
  "status": "IN_TRANSIT"
}
```

**✨ Automated**: Uses the captured `deliveryId` variable automatically.

**Available delivery statuses:**
- `PENDING` (initial status)
- `IN_TRANSIT` 
- `DELIVERED`
- `FAILED`

#### Step 5: Verify Order Status Update
```http
GET http://localhost:3000/api/sales/orders/{orderId}
```

**✨ Automated**: Verifies the order status was automatically updated based on delivery status change.

### Running the Complete Workflow

1. **Import Collection**: Load `My Ecomerce Shop.postman_collection.json`
2. **Run Collection**: Use Postman's "Run Collection" feature for automated testing
3. **Individual Requests**: Run requests one by one - variables are automatically managed
4. **No Manual Work**: All IDs are captured and reused automatically

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

## 📚 API Documentation

### API Gateway Routes
All requests go through the API Gateway at `http://localhost:3000`:

- **Sales Service**: `/api/sales/*` → Routes to Sales Service
- **Delivery Service**: Direct access at `http://localhost:3002`
- **Inventory Service**: Direct access at `http://localhost:3003`

### Sales Service Endpoints (via API Gateway)
- `POST /api/sales` - Create new order
- `GET /api/sales/orders/:id` - Get order details
- `PATCH /api/sales/orders/:id/status` - Update order status

### Delivery Service Endpoints (Direct Access)
- `GET /deliveries` - List all deliveries
- `GET /deliveries/:id` - Get delivery details
- `PATCH /deliveries/:id/status` - Update delivery status

### Inventory Service Endpoints (Direct Access)
- `POST /check-availability` - Check product availability

## 📈 System Features

- ✅ **Event-Driven Architecture**: Asynchronous communication via RabbitMQ
- ✅ **Database Per Service**: Independent data management
- ✅ **Automatic Stock Management**: Inventory validation and reservation
- ✅ **Bidirectional Status Updates**: Real-time order/delivery synchronization
- ✅ **Audit Trail**: Complete stock movement history
- ✅ **Containerized Deployment**: Docker-based infrastructure
- ✅ **API Gateway**: Centralized request routing with idempotency
- ✅ **Health Checks**: Service availability monitoring
- ✅ **Automated Testing**: Postman collection with smart variable management
- ✅ **Redis Caching**: Performance optimization and session management

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

All endpoints are accessible through the API Gateway at `http://localhost:3000/api/`

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
