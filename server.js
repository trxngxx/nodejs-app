const pino = require('pino');
const pinoHttp = require('pino-http');
const pinoLogger = pino();
const httpLogger = pinoHttp({ logger: pinoLogger });

const express = require('express');
const bodyParser = require('body-parser');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Pool } = require('pg');
const http = require('http');
const winston = require('winston');
const promClient = require('prom-client');

// OpenTelemetry
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { trace } = require('@opentelemetry/api');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'nodejs-registration-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Configure Prometheus
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

register.registerMetric(httpRequestDurationMicroseconds);

// Configure OpenTelemetry
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'nodejs-registration-service',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger-collector.istio-system:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();

const tracer = trace.getTracer('example-tracer-http');

const PROTO_PATH = './proto/hipstershop.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const hipstershopProto = grpc.loadPackageDefinition(packageDefinition).hipstershop;

// PostgreSQL connection pool setup
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

// Check connection on startup
pool.connect((err, client, release) => {
  if (err) {
    logger.error('Error connecting to PostgreSQL:', err.stack);
  } else {
    logger.info('Connected to PostgreSQL');
    release();
  }
});

// Periodic health check
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
    logger.info('Database connection is alive');
  } catch (error) {
    logger.error('Database connection error:', error);
  }
}, 60000);

// gRPC interceptor for tracing
function createGrpcInterceptor() {
  return (options, nextCall) => {
    return new grpc.InterceptingCall(nextCall(options), {
      start: (metadata, listener, next) => {
        const span = trace.getTracer('example-tracer-grpc').startSpan(`grpc-${options.method_definition.path}`);
        metadata.set('traceparent', span.spanContext().toString());
        next(metadata, {
          onReceiveStatus: (status, next) => {
            span.setStatus({
              code: status.code === grpc.status.OK ? trace.SpanStatusCode.OK : trace.SpanStatusCode.ERROR,
              message: status.details
            });
            span.end();
            next(status);
          }
        });
      }
    });
  };
}

// gRPC Registration Service
const registrationService = {
  Register: (call, callback) => {
    const span = trace.getTracer('example-tracer-grpc').startSpan('Register');
    const { name, email, password } = call.request;
    span.setAttribute('user.name', name);
    span.setAttribute('user.email', email);

    pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)',
      [name, email, password],
      (err) => {
        if (err) {
          logger.error('Error inserting data:', err.stack);
          span.recordException(err);
          span.setStatus({ code: trace.SpanStatusCode.ERROR, message: 'Error saving data' });
          callback(null, { success: false, message: 'Error saving data' });
        } else {
          span.setStatus({ code: trace.SpanStatusCode.OK });
          callback(null, { success: true, message: 'Registration successful' });
        }
        span.end();
      }
    );
  }
};

// Initialize gRPC server
const grpcServer = new grpc.Server();
grpcServer.addService(hipstershopProto.RegistrationService.service, registrationService);

const GRPC_PORT = 50051;
grpcServer.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    logger.error('Failed to bind gRPC server:', err);
    return;
  }
  logger.info(`gRPC Server running at http://0.0.0.0:${port}`);
  grpcServer.start();
});

// Express HTTP Server
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(httpLogger); // Move this line after Express server initialization

// Middleware to measure HTTP request duration
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDurationMicroseconds
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration / 1000); // Convert to seconds
  });
  next();
});

// Serve the registration form
app.get('/', (req, res) => {
  res.render('index');
});

// Handle form submission and forward to gRPC service
app.post('/register', (req, res) => {
  const span = tracer.startSpan('http-register');
  const { name, email, password } = req.body;
  span.setAttribute('user.name', name);
  span.setAttribute('user.email', email);

  const client = new hipstershopProto.RegistrationService(
    `localhost:${GRPC_PORT}`,
    grpc.credentials.createInsecure(),
    { interceptors: [createGrpcInterceptor()] }
  );

  client.Register({ name, email, password }, (err, response) => {
    if (err || !response.success) {
      logger.error('Error registering user:', err ? err.message : response.message);
      span.recordException(err || new Error(response.message));
      span.setStatus({ code: trace.SpanStatusCode.ERROR, message: 'Error saving data' });
      res.status(500).send('Error saving data');
    } else {
      span.setStatus({ code: trace.SpanStatusCode.OK });
      res.send('Registration successful');
    }
    span.end();
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const span = tracer.startSpan('health-check');
  try {
    await pool.query('SELECT 1');
    const memoryUsage = process.memoryUsage();
    const healthStatus = {
      status: 'UP',
      db: 'UP',
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      }
    };
    span.setStatus({ code: trace.SpanStatusCode.OK });
    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed:', error);
    span.recordException(error);
    span.setStatus({ code: trace.SpanStatusCode.ERROR, message: 'Database connection error' });
    res.status(500).json({ status: 'DOWN', error: error.message });
  } finally {
    span.end();
  }
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Function to fetch content from a given URL with OpenTelemetry tracing
function fetchContent(url) {
  const span = tracer.startSpan(`fetching ${url}`);
  span.setAttribute('http.url', url);

  http.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      pinoLogger.info(`Data fetched from ${url}`, { dataLength: data.length });
      span.end();
    });
  }).on('error', (err) => {
    pinoLogger.error(`Error fetching ${url}:`, err.message);
    span.recordException(err);
    span.setStatus({ code: trace.SpanStatusCode.ERROR, message: err.message });
    span.end();
  });
}

// Write timer interval every 1 second to get content from multiple URLs
setInterval(() => {
  fetchContent('http://google.com');
  fetchContent('http://yahoo.com');
  fetchContent('http://facebook.com');
}, 1000);

const HTTP_PORT = 8080;
app.listen(HTTP_PORT, () => {
  logger.info(`HTTP Server running at http://0.0.0.0:${HTTP_PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  sdk.shutdown()
    .then(() => logger.info('Tracing terminated'))
    .catch((error) => logger.error('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
