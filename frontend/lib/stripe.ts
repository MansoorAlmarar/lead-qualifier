import Stripe from "stripe";

let client: Stripe | undefined;

// Created on first use so a missing key fails the request, not the build.
export function getStripe(): Stripe {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}
