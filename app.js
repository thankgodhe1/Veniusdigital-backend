const express = require('express');
const createHttpError = require('http-errors');
const morgan = require('morgan');
const mongoose = require('mongoose');
require('dotenv').config();
const session = require('express-session');
const connectFlash = require('connect-flash');
const connectMongo = require('connect-mongo');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { requireAuth, requireAdmin, checkUser } = require('./utils/authMiddleware');

const app = express();
app.set('trust proxy', 1);
app.use(morgan('dev'));

function normalizeOrigin(url) {
  if (!url) return null;
  return String(url).trim().replace(/\/$/, '');
}

const FRONTEND_URL = normalizeOrigin(process.env.FRONTEND_URL);
if (!FRONTEND_URL) throw new Error('FRONTEND_URL must be set');

const allowedOrigins = [FRONTEND_URL].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalized)) {
      return callback(null, true);
    }
    console.warn('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.use(cookieParser());
app.use(express.static('public'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const sessionSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
if (!sessionSecret) throw new Error('SESSION_SECRET or JWT_SECRET must be set');
let sessionStore;
if (typeof connectMongo.create === 'function') {
  sessionStore = connectMongo.create({ mongoUrl: process.env.MONGODB_URI });
} else {
  const MongoStore = connectMongo(session);
  sessionStore = new MongoStore({ mongooseConnection: mongoose.connection });
}
app.use(session({
  name: 'connect.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  },
}));
app.use(connectFlash());
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});
app.use(checkUser);


app.use('/', require('./routes/index.route'));
app.use('/auth', require('./routes/auth.route'));
app.use('/user', requireAuth, require('./routes/user.route'));
app.use('/admin', requireAuth, requireAdmin, require('./routes/admin.route'));

const { startFeatureLifecycle } = require('./services/featureLifecycle.service');
const { startMarketPriceRefresh } = require('./services/marketPrice.service');
startFeatureLifecycle();
startMarketPriceRefresh();

app.use((req, res, next) => next(createHttpError(404, 'Not found')));
app.use((error, req, res, next) => {
  if (error.message === 'Not allowed by CORS') return res.status(403).json({ success: false, error: error.message, message: error.message });
  if (error && error.code === 11000) return res.status(409).json({ success: false, message: 'A record with that value already exists', errors: error.keyPattern || {} });
  console.error(error);
  return res.status(error.status || 500).json({ success: false, error: error.message || 'Internal Server Error', message: error.status ? error.message : 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('💾 connected...');
    app.listen(PORT, () => console.log(`🚀 Backend @ http://127.0.0.1:${PORT}`));
  })
  .catch(err => console.log(err.message));

module.exports = app;

