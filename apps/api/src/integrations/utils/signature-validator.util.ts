/**
 * T034 AC1: Webhook Signature Validation Utilities
 */

import * as crypto from 'crypto';

export class SignatureValidator {
  /**
   * Validates GitHub webhook signature
   * @param payload - Raw request body
   * @param signature - X-Hub-Signature-256 header value
   * @param secret - Webhook secret
   * @returns true if signature is valid
   */
  static validateGitHubSignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex'),
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates GitLab webhook signature
   * @param payload - Raw request body
   * @param signature - X-Gitlab-Token header value
   * @param secret - Webhook secret
   * @returns true if signature is valid
   */
  static validateGitLabSignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    try {
      // GitLab uses simple token comparison
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(secret),
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates webhook signature based on source type
   * @param source - Webhook source (github, gitlab, etc.)
   * @param payload - Raw request body
   * @param signature - Signature header value
   * @param secret - Webhook secret
   * @returns true if signature is valid
   */
  static validateSignature(
    source: string,
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    if (!signature || !secret) {
      return false;
    }

    switch (source.toLowerCase()) {
      case 'github':
        return this.validateGitHubSignature(payload, signature, secret);
      case 'gitlab':
        return this.validateGitLabSignature(payload, signature, secret);
      default:
        // For generic webhooks, use GitHub-style HMAC-SHA256
        return this.validateGitHubSignature(payload, signature, secret);
    }
  }

  /**
   * Generates a webhook signature for testing purposes
   * @param payload - Raw payload
   * @param secret - Secret key
   * @param algorithm - Hashing algorithm (default: sha256)
   * @returns Generated signature with prefix
   */
  static generateSignature(
    payload: string | Buffer,
    secret: string,
    algorithm: string = 'sha256',
  ): string {
    const signature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');
    
    return `${algorithm}=${signature}`;
  }
}