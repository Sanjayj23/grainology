// Cashfree Verification SDK Configuration
import { Cashfree } from 'cashfree-verification';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cashfree SDK
Cashfree.XClientId = process.env.CASHFREE_CLIENT_ID || '';
Cashfree.XClientSecret = process.env.CASHFREE_CLIENT_SECRET || '';
Cashfree.XEnvironment = process.env.CASHFREE_BASE_URL?.includes('sandbox') 
  ? Cashfree.Environment.SANDBOX 
  : Cashfree.Environment.PRODUCTION;
Cashfree.XApiVersion = '2023-12-18'; // SDK default version

export default Cashfree;

