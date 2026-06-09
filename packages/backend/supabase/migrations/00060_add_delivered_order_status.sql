-- Add the delivered fulfillment step used by the order domain and admin UI.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'delivered' AFTER 'shipped';
