const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy API requests to Express backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:3000',
      changeOrigin: true,
    })
  );
};

