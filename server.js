const express = require('express');
const bodyParser = require('body-parser');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Pool } = require('pg');

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

// gRPC Registration Service
const registrationService = {
  Register: (call, callback) => {
    const { name, email, password } = call.request;

    pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)',
      [name, email, password],
      (err) => {
        if (err) {
          console.error('Error inserting data:', err.stack);
          callback(null, { success: false, message: 'Error saving data' });
        } else {
          callback(null, { success: true, message: 'Registration successful' });
        }
      }
    );
  }
};

// Khởi tạo gRPC server
const grpcServer = new grpc.Server();
grpcServer.addService(hipstershopProto.RegistrationService.service, registrationService);

const GRPC_PORT = 50051;
grpcServer.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to bind gRPC server:', err);
    return;
  }
  console.log(`gRPC Server running at http://0.0.0.0:${port}`);
  grpcServer.start();
});

// Express HTTP Server
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));

// Serve the registration form
app.get('/', (req, res) => {
  res.render('index');
});

// Handle form submission and forward to gRPC service
app.post('/register', (req, res) => {
  const { name, email, password } = req.body;

  const client = new hipstershopProto.RegistrationService(`localhost:${GRPC_PORT}`, grpc.credentials.createInsecure());

  client.Register({ name, email, password }, (err, response) => {
    if (err || !response.success) {
      console.error('Error registering user:', err ? err.message : response.message);
      res.status(500).send('Error saving data');
    } else {
      res.send('Registration successful');
    }
  });
});

const HTTP_PORT = 8080;
app.listen(HTTP_PORT, () => {
  console.log(`HTTP Server running at http://0.0.0.0:${HTTP_PORT}`);
});