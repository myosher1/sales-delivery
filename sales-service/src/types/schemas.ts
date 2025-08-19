// Request/Response schemas for API validation
export const createOrderSchema = {
  body: {
    type: 'object',
    properties: {
      customerId: { type: 'string' },
      customerEmail: { type: 'string', format: 'email' },
      shippingAddress: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            productName: { type: 'string' },
            quantity: { type: 'number', minimum: 1 },
            unitPrice: { type: 'number', minimum: 0 }
          },
          required: ['productId', 'productName', 'quantity', 'unitPrice']
        }
      }
    },
    required: ['customerId', 'customerEmail', 'shippingAddress', 'items']
  },
  response: {
    201: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        status: { type: 'string' },
        totalAmount: { type: 'string' },
        message: { type: 'string' }
      }
    }
  }
} as const;

export const getOrderSchema = {
  params: {
    type: 'object',
    properties: {
      orderId: { type: 'string' }
    },
    required: ['orderId']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        customerId: { type: 'string' },
        customerEmail: { type: 'string' },
        status: { type: 'string' },
        totalAmount: { type: 'string' },
        currency: { type: 'string' },
        shippingAddress: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              productId: { type: 'string' },
              productName: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'string' },
              totalPrice: { type: 'string' }
            }
          }
        }
      }
    }
  }
} as const;

export const updateOrderStatusSchema = {
  params: {
    type: 'object',
    properties: {
      orderId: { type: 'string' }
    },
    required: ['orderId']
  },
  body: {
    type: 'object',
    properties: {
      status: { 
        type: 'string',
        enum: ['Pending Shipment', 'Shipped', 'Delivered']
      }
    },
    required: ['status']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        status: { type: 'string' },
        message: { type: 'string' }
      }
    }
  }
} as const;
