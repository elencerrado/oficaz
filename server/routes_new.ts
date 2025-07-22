import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import { storage } from "./storage";
import { authenticateToken, requireRole, generateToken, AuthRequest } from './middleware/auth';
import { loginSchema, companyRegistrationSchema, insertVacationRequestSchema, insertMessageSchema } from '@shared/schema';
import { db } from './db';
import { eq, and, desc, sql, not, inArray } from 'drizzle-orm';
import { subscriptions, companies, features, users, workSessions, breakPeriods, vacationRequests, messages, reminders, documents } from '@shared/schema';
import { sendEmployeeWelcomeEmail } from './email';

// Initialize Stripe with environment-specific keys
const isDevelopment = process.env.NODE_ENV === 'development';
const stripeSecretKey = isDevelopment 
  ? process.env.STRIPE_SECRET_KEY_TEST 
  : process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error(`STRIPE_SECRET_KEY${isDevelopment ? '_TEST' : ''} environment variable is required`);
}

console.log('Stripe Environment:', isDevelopment ? 'Development (Test)' : 'Production (Live)');
console.log('Stripe key type:', stripeSecretKey.substring(0, 7));

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-11-20.acacia',
});

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// ⚠️ PROTECTED - DO NOT MODIFY
// Dynamic demo data generation based on company creation date
