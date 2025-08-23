-- Migration to fix orderId and customerId data types from integer to varchar
ALTER TABLE "deliveries" ALTER COLUMN "order_id" TYPE varchar(255);
ALTER TABLE "deliveries" ALTER COLUMN "customer_id" TYPE varchar(255);
