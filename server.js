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

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD
});

// CartService implementation
const cartService = {
  AddItem: (call, callback) => {
    // Logic to add item to cart in database
    callback(null, {});
  },
  GetCart: (call, callback) => {
    // Logic to get cart from database
    callback(null, { user_id: call.request.user_id, items: [] });
  },
  EmptyCart: (call, callback) => {
    // Logic to empty cart in database
    callback(null, {});
  }
};

// RecommendationService implementation
const recommendationService = {
  ListRecommendations: (call, callback) => {
    // Logic to get recommendations
    callback(null, { product_ids: [] });
  }
};

// ProductCatalogService implementation
const productCatalogService = {
  ListProducts: (call, callback) => {
    // Logic to list products
    callback(null, { products: [] });
  },
  GetProduct: (call, callback) => {
    // Logic to get a product
    callback(null, { id: call.request.id, name: '', description: '', picture: '', price_usd: {}, categories: [] });
  },
  SearchProducts: (call, callback) => {
    // Logic to search products
    callback(null, { results: [] });
  }
};

// ShippingService implementation
const shippingService = {
  GetQuote: (call, callback) => {
    // Logic to get shipping quote
    callback(null, { cost_usd: {} });
  },
  ShipOrder: (call, callback) => {
    // Logic to ship order
    callback(null, { tracking_id: '123456' });
  }
};

// CurrencyService implementation
const currencyService = {
  GetSupportedCurrencies: (call, callback) => {
    // Logic to get supported currencies
    callback(null, { currency_codes: [] });
  },
  Convert: (call, callback) => {
    // Logic to convert currency
    callback(null, { currency_code: '', units: 0, nanos: 0 });
  }
};

// PaymentService implementation
const paymentService = {
  Charge: (call, callback) => {
    // Logic to charge payment
    callback(null, { transaction_id: 'txn_123456' });
  }
};

// EmailService implementation
const emailService = {
  SendOrderConfirmation: (call, callback) => {
    // Logic to send order confirmation email
    callback(null, {});
  }
};

// CheckoutService implementation
const checkoutService = {
  PlaceOrder: (call, callback) => {
    // Logic to place order
    callback(null, { order: {} });
  }
};

// AdService implementation
const adService = {
  GetAds: (call, callback) => {
    // Logic to get ads
    callback(null, { ads: [] });
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