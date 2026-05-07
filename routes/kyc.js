import express from 'express';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Note: KYC verification for authenticated users is now handled by Cashfree routes at /api/cashfree/kyc/*
// This file can be used for additional KYC-related routes if needed in the future

export default router;
