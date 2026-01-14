#!/usr/bin/env node
/**
 * Encrypts the TestFlight URL using AES-256-GCM with the invite code as the key.
 * Run by GitHub Action during deployment.
 *
 * Usage: node encrypt.js
 *
 * Environment variables:
 *   TESTFLIGHT_URL - The TestFlight invite URL to encrypt
 *   INVITE_CODE    - The invite code (used as encryption password)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TESTFLIGHT_URL = process.env.TESTFLIGHT_URL;
const INVITE_CODE = process.env.INVITE_CODE;

if (!TESTFLIGHT_URL || !INVITE_CODE) {
  console.error('Error: TESTFLIGHT_URL and INVITE_CODE environment variables are required');
  process.exit(1);
}

// Generate random salt and IV
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);

// Derive key using PBKDF2 (matching the client-side parameters)
const key = crypto.pbkdf2Sync(INVITE_CODE, salt, 100000, 32, 'sha256');

// Encrypt using AES-256-GCM
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(TESTFLIGHT_URL, 'utf8');
encrypted = Buffer.concat([encrypted, cipher.final()]);
const authTag = cipher.getAuthTag();

// Combine encrypted data with auth tag (GCM format)
const encryptedWithTag = Buffer.concat([encrypted, authTag]);

// Create the JSON payload
const payload = {
  encrypted: encryptedWithTag.toString('base64'),
  iv: iv.toString('base64'),
  salt: salt.toString('base64')
};

// Read index.html and replace the placeholder
const indexPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const placeholderPattern = /\{"encrypted":"PLACEHOLDER_ENCRYPTED_DATA","iv":"PLACEHOLDER_IV","salt":"PLACEHOLDER_SALT"\}/;

if (!placeholderPattern.test(html)) {
  console.error('Error: Could not find placeholder in index.html');
  process.exit(1);
}

html = html.replace(placeholderPattern, JSON.stringify(payload));

fs.writeFileSync(indexPath, html, 'utf8');

console.log('Successfully encrypted TestFlight URL and updated index.html');
