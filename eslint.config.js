const expoFlatConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoFlatConfig,
  {
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'android/**',
      'ios/**',
      '**/*.config.js',
      'babel.config.js',
      'metro.config.js',
    ],
  },
];
