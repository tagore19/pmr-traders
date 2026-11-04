
const dotenv = require('dotenv');
const result = dotenv.config({ path: 'E:/PMR-Traders/server/.env' });
console.log('Dotenv result:', result);
if (result.error) {
  console.error('Dotenv error:', result.error);
}
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);  
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '[SET]' : '[NOT SET]');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '[SET]' : '[NOT SET]');

