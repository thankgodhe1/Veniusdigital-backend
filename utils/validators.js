const { body } = require('express-validator');

module.exports = {
  registerValidator: [
    body('email')
      .isString()
      .withMessage('Email is required')
      .bail()
      .trim()
      .isEmail()
      .withMessage('Email must be a valid email')
      .normalizeEmail(),
    body('password')
      .isString()
      .withMessage('Password is required')
      .bail()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('password_confirmation')
      .isString()
      .withMessage('Password confirmation is required')
      .bail()
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Passwords do not match'),
  ],
};
