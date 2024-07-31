const express = require('express');
const bodyParser = require('body-parser');
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

// Thiết lập kết nối PostgreSQL
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err.stack);
  } else {
    console.log('Connected to PostgreSQL');
    release();
  }
});

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));

// Serve the registration form
app.get('/', (req, res) => {
  res.render('index');
});

// Handle form submission
app.post('/register', (req, res) => {
  const { name, email, password } = req.body;

  pool.query(
    'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)',
    [name, email, password],
    (err) => {
      if (err) {
        console.error('Error inserting data:', err.stack);
        res.status(500).send('Error saving data');
      } else {
        res.send('Registration successful');
      }
    }
  );
});

// Các service gRPC
const cartService = {
  AddItem: (call, callback) => {
    callback(null, {});
  },
  GetCart: (call, callback) => {
    callback(null, { user_id: call.request.user_id, items: [] });
  },
  EmptyCart: (call, callback) => {
    callback(null, {});
  }
};

const recommendationService = {
  ListRecommendations: (call, callback) => {
    callback(null, { product_ids: [] });
  }
};

const productCatalogService = {
  ListProducts: (call, callback) => {
    callback(null, { products: [] });
  },
  GetProduct: (call, callback) => {
    callback(null, { id: call.request.id, name: '', description: '', picture: '', price_usd: {}, categories: [] });
  },
  SearchProducts: (call, callback) => {
    callback(null, { results: [] });
  }
};

const shippingService = {
  GetQuote: (call, callback) => {
    callback(null, { cost_usd: {} });
  },
  ShipOrder: (call, callback) => {
    callback(null, { tracking_id: '123456' });
  }
};

const currencyService = {
  GetSupportedCurrencies: (call, callback) => {
    callback(null, { currency_codes: [] });
  },
  Convert: (call, callback) => {
    callback(null, { currency_code: '', units: 0, nanos: 0 });
  }
};

const paymentService = {
  Charge: (call, callback) => {
    callback(null, { transaction_id: 'txn_123456' });
  }
};

const emailService = {
  SendOrderConfirmation: (call, callback) => {
    callback(null, {});
  }
};

const checkoutService = {
  PlaceOrder: (call, callback) => {
    callback(null, { order: {} });
  }
};

const adService = {
  GetAds: (call, callback) => {
    callback(null, { ads: [] });
  }
};

const grpcServer = new grpc.Server();

grpcServer.addService(hipstershopProto.CartService.service, cartService);
grpcServer.addService(hipstershopProto.RecommendationService.service, recommendationService);
grpcServer.addService(hipstershopProto.ProductCatalogService.service, productCatalogService);
grpcServer.addService(hipstershopProto.ShippingService.service, shippingService);
grpcServer.addService(hipstershopProto.CurrencyService.service, currencyService);
grpcServer.addService(hipstershopProto.PaymentService.service, paymentService);
grpcServer.addService(hipstershopProto.EmailService.service, emailService);
grpcServer.addService(hipstershopProto.CheckoutService.service, checkoutService);
grpcServer.addService(hipstershopProto.AdService.service, adService);

const PORT = 50051;
grpcServer.bind(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure());
console.log(`gRPC Server running at http://0.0.0.0:${PORT}`);
grpcServer.start();

const HTTP_PORT = 8080;
app.listen(HTTP_PORT, () => {
  console.log(`HTTP Server running at http://0.0.0.0:${HTTP_PORT}`);
});
