const express = require('express');
const router = express.Router();
const { pool } = require('../../db/pool');
const logger = require('../../utils/logger');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the service and its dependencies
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2023-05-15T10:00:00.000Z
 *                 uptime:
 *                   type: number
 *                   example: 123.45
 */
router.get('/', async (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  // Check database connection
  try {
    await pool.query('SELECT NOW()');
    healthCheck.database = { status: 'ok' };
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    healthCheck.database = {
      status: 'error',
      error: error.message
    };
    healthCheck.status = 'error';
  }

  // Add Redis health check if needed
  // Add other dependency checks here

  const statusCode = healthCheck.status === 'ok' ? 200 : 503;
  return res.status(statusCode).json(healthCheck);
});

module.exports = router;
