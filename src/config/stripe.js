/**
 * stripe.js
 * Wrapper léger pour Stripe, centralise la configuration.
 */

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET || '', { apiVersion: '2023-08-16' });

export default stripe;
