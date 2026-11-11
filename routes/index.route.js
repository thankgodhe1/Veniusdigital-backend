const router = require('express').Router();

const frontendUrl = () =>
  (process.env.FRONTEND_URL || '').replace(/\/$/, '');

// Home
router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend home page',
    redirect: `${frontendUrl()}/index.html`
  });
});

module.exports = router;
