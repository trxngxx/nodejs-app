const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const { Pool } = require('pg');
require('dotenv').config();

const PROTO_PATH = './proto/hipstershop.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const hipstershopProto = grpc.loadPackageDefinition(packageDefinition).hipstershop;

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD
});

pool.connect(err => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err.stack);
  } else {
    console.log('Connected to PostgreSQL');
  }
});

// CartService implementation
const cartService = {
  AddItem: async (call, callback) => {
    try {
      console.log('AddItem called with:', call.request);
      const { user_id, item } = call.request;
      await pool.query('INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3)', [user_id, item.product_id, item.quantity]);
      callback(null, {});
    } catch (err) {
      console.error('Error adding item to cart:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  },
  GetCart: async (call, callback) => {
    try {
      console.log('GetCart called with:', call.request);
      const { user_id } = call.request;
      const result = await pool.query('SELECT product_id, quantity FROM cart WHERE user_id = $1', [user_id]);
      const items = result.rows.map(row => ({ product_id: row.product_id, quantity: row.quantity }));
      callback(null, { user_id, items });
    } catch (err) {
      console.error('Error getting cart:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  },
  EmptyCart: async (call, callback) => {
    try {
      console.log('EmptyCart called with:', call.request);
      const { user_id } = call.request;
      await pool.query('DELETE FROM cart WHERE user_id = $1', [user_id]);
      callback(null, {});
    } catch (err) {
      console.error('Error emptying cart:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  }
};

// RecommendationService implementation
const recommendationService = {
  ListRecommendations: (call, callback) => {
    console.log('ListRecommendations called with:', call.request);
    callback(null, { product_ids: [] });
  }
};

// ProductCatalogService implementation
const productCatalogService = {
  ListProducts: async (call, callback) => {
    try {
      console.log('ListProducts called');
      const result = await pool.query('SELECT id, name, description, picture, price_usd, categories FROM products');
      const products = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        picture: row.picture,
        price_usd: { currency_code: 'USD', units: row.price_usd, nanos: 0 },
        categories: row.categories.split(',')
      }));
      callback(null, { products });
    } catch (err) {
      console.error('Error listing products:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  },
  GetProduct: async (call, callback) => {
    try {
      console.log('GetProduct called with:', call.request);
      const { id } = call.request;
      const result = await pool.query('SELECT id, name, description, picture, price_usd, categories FROM products WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        callback({
          code: grpc.status.NOT_FOUND,
          details: 'Product not found'
        });
        return;
      }
      const row = result.rows[0];
      callback(null, {
        id: row.id,
        name: row.name,
        description: row.description,
        picture: row.picture,
        price_usd: { currency_code: 'USD', units: row.price_usd, nanos: 0 },
        categories: row.categories.split(',')
      });
    } catch (err) {
      console.error('Error getting product:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  },
  SearchProducts: async (call, callback) => {
    try {
      console.log('SearchProducts called with:', call.request);
      const { query } = call.request;
      const result = await pool.query('SELECT id, name, description, picture, price_usd, categories FROM products WHERE name ILIKE $1 OR description ILIKE $1', [`%${query}%`]);
      const results = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        picture: row.picture,
        price_usd: { currency_code: 'USD', units: row.price_usd, nanos: 0 },
        categories: row.categories.split(',')
      }));
      callback(null, { results });
    } catch (err) {
      console.error('Error searching products:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  }
};

// ShippingService implementation
const shippingService = {
  GetQuote: async (call, callback) => {
    try {
      console.log('GetQuote called with:', call.request);
      // Add logic to get shipping quote
      callback(null, { cost_usd: { currency_code: 'USD', units: 0, nanos: 0 } });
    } catch (err) {
      console.error('Error getting shipping quote:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  },
  ShipOrder: async (call, callback) => {
    try {
      console.log('ShipOrder called with:', call.request);
      // Add logic to ship order
      callback(null, { tracking_id: '123456' });
    } catch (err) {
      console.error('Error shipping order:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  }
};

// CurrencyService implementation
const currencyService = {
  GetSupportedCurrencies: async (call, callback) => {
    try {
      console.log('GetSupportedCurrencies called');
      // Add logic to get supported currencies
      callback(null, { currency_codes: ['USD'] });
    } catch (err) {
      console.error('Error getting supported currencies:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  },
  Convert: async (call, callback) => {
    try {
      console.log('Convert called with:', call.request);
      // Add logic to convert currency
      callback(null, { currency_code: 'USD', units: 0, nanos: 0 });
    } catch (err) {
      console.error('Error converting currency:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  }
};

// PaymentService implementation
const paymentService = {
  Charge: async (call, callback) => {
    try {
      console.log('Charge called with:', call.request);
      // Add logic to charge payment
      callback(null, { transaction_id: 'txn_123456' });
    } catch (err) {
      console.error('Error charging payment:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  }
};

// EmailService implementation
const emailService = {
  SendOrderConfirmation: async (call, callback) => {
    try {
      console.log('SendOrderConfirmation called with:', call.request);
      // Add logic to send order confirmation email
      callback(null, {});
    } catch (err) {
      console.error('Error sending order confirmation email:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  }
};

// CheckoutService implementation
const checkoutService = {
  PlaceOrder: async (call, callback) => {
    try {
      console.log('PlaceOrder called with:', call.request);
      // Add logic to place order
      callback(null, { order: {} });
    } catch (err) {
      console.error('Error placing order:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  }
};

// AdService implementation
const adService = {
  GetAds: async (call, callback) => {
    try {
      console.log('GetAds called with:', call.request);
      // Add logic to get ads
      callback(null, { ads: [] });
    } catch (err) {
      console.error('Error getting ads:', err);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Internal server error'
      });
    }
  }
};

const server = new grpc.Server();

server.addService(hipstershopProto.CartService.service, cartService);
server.addService(hipstershopProto.RecommendationService.service, recommendationService);
server.addService(hipstershopProto.ProductCatalogService.service, productCatalogService);
server.addService(hipstershopProto.ShippingService.service, shippingService);
server.addService(hipstershopProto.CurrencyService.service, currencyService);
server.addService(hipstershopProto.PaymentService.service, paymentService);
server.addService(hipstershopProto.EmailService.service, emailService);
server.addService(hipstershopProto.CheckoutService.service, checkoutService);
server.addService(hipstershopProto.AdService.service, adService);

const PORT = 50051;
server.bind(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure());
console.log(`Server running at http://0.0.0.0:${PORT}`);
server.start();
