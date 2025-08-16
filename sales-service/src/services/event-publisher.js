const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../config');

// Connection and channel cache
let connection = null;
let channel = null;
const exchangeName = config.rabbitmq.exchange;

/**
 * Initialize the RabbitMQ connection and channel
 */
const init = async () => {
  try {
    if (connection) return; // Already initialized

    // Create connection
    connection = await amqp.connect(config.rabbitmq.url, {
      clientProperties: {
        connection_name: 'sales-service-publisher',
      },
    });

    logger.info('Connected to RabbitMQ');

    // Create channel
    channel = await connection.createConfirmChannel();

    // Assert the exchange
    await channel.assertExchange(exchangeName, 'topic', {
      durable: true,
    });

    logger.info(`Exchange '${exchangeName}' asserted`);

    // Handle connection close
    connection.on('close', (err) => {
      logger.error('RabbitMQ connection closed', { error: err });
      connection = null;
      channel = null;

      // Attempt to reconnect after a delay
      setTimeout(() => init(), 5000);
    });

    // Handle errors
    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', { error: err });
    });

  } catch (error) {
    logger.error('Failed to initialize RabbitMQ connection', { error: error.message });
    // Retry after a delay
    setTimeout(() => init(), 5000);
  }
};

/**
 * Publish an event to the message broker
 * @param {string} routingKey - The routing key for the message
 * @param {Object} payload - The message payload
 * @param {Object} options - Additional options
 * @param {string} options.correlationId - Correlation ID for the message
 * @param {Object} options.headers - Additional headers
 * @returns {Promise<boolean>} - Whether the message was published successfully
 */
const publishEvent = async (routingKey, payload, options = {}) => {
  if (!channel) {
    logger.warn('RabbitMQ channel not ready, attempting to initialize...');
    await init();

    if (!channel) {
      throw new Error('Failed to initialize RabbitMQ channel');
    }
  }

  const messageId = uuidv4();
  const timestamp = new Date().toISOString();
  const { correlationId = uuidv4(), headers = {} } = options;

  const message = {
    eventId: messageId,
    eventType: routingKey,
    timestamp,
    data: payload,
  };

  try {
    const messageBuffer = Buffer.from(JSON.stringify(message));

    const published = await new Promise((resolve, reject) => {
      try {
        channel.publish(
          exchangeName,
          routingKey,
          messageBuffer,
          {
            messageId,
            correlationId,
            contentType: 'application/json',
            contentEncoding: 'utf-8',
            persistent: true,
            timestamp: Date.now(),
            headers: {
              ...headers,
              'x-service': 'sales-service',
              'x-event-type': routingKey,
            },
          },
          (err, ok) => {
            if (err) {
              logger.error('Failed to publish message', {
                error: err.message,
                routingKey,
                messageId,
              });
              reject(err);
            } else {
              logger.debug('Message published successfully', {
                routingKey,
                messageId,
                correlationId,
              });
              resolve(true);
            }
          }
        );
      } catch (error) {
        logger.error('Error publishing message', {
          error: error.message,
          routingKey,
          messageId,
          stack: error.stack,
        });
        reject(error);
      }
    });

    return published;
  } catch (error) {
    logger.error('Failed to publish event', {
      error: error.message,
      routingKey,
      messageId,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Close the RabbitMQ connection
 */
const close = async () => {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }

    if (connection) {
      await connection.close();
      connection = null;
    }

    logger.info('RabbitMQ connection closed gracefully');
  } catch (error) {
    logger.error('Error closing RabbitMQ connection', { error: error.message });
    throw error;
  }
};

// Initialize on startup
init();

// Handle process termination
process.on('SIGINT', async () => {
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await close();
  process.exit(0);
});

module.exports = {
  publishEvent,
  close,
};
