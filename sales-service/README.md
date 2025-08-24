# Sales Service

A Fastify-based microservice for handling sales operations with PostgreSQL and Drizzle ORM.

## Features

- **Order Management**: Create, retrieve, and update order status
- **PostgreSQL Database**: Using Drizzle ORM for type-safe database operations
- **Order Statuses**: Pending Shipment, Shipped, Delivered
- **UUID Generation**: Using Node.js built-in crypto module
- **Type-safe APIs**: JSON Schema validation with TypeScript inference

## Database Setup

1. Make sure PostgreSQL is running
2. Create database: `createdb sales_db`
3. Generate migrations: `npm run db:generate`
4. Run migrations: `npm run db:migrate`

## API Endpoints

### Orders

#### Create Order
```
POST /orders
```

**Request Body:**
```json
{
  "customerId": "customer-123",
  "customerEmail": "customer@example.com",
  "shippingAddress": "123 Main St, City, State 12345",
  "items": [
    {
      "productId": "product-456",
      "productName": "Product Name",
      "quantity": 2,
      "unitPrice": 29.99
    }
  ]
}
```

**Response:**
```json
{
  "orderId": "uuid-generated-id",
  "status": "Pending Shipment",
  "totalAmount": "59.98",
  "message": "Order created successfully and delivery process initiated"
}
```

#### Get Order
```
GET /orders/:orderId
```

#### Update Order Status
```
PATCH /orders/:orderId/status
```

**Request Body:**
```json
{
  "status": "Shipped"
}
```

### Hello Route
```
GET /hello
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)

## Scripts

- `npm run dev` - Development mode with hot reload
- `npm run build` - Build TypeScript
- `npm run start` - Build and start production server
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
