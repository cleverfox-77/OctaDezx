// Ambient declarations for Deno runtime and remote modules used in Supabase functions.
// This file prevents the Node/tsc type-checker from reporting missing module or global
// errors for Deno-based function files during local development.

declare var Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Allow importing remote modules from deno.land and esm.sh without specific types
declare module "https://deno.land/*";
declare module "https://esm.sh/*";
declare module "jsr:@kitsonk/xhr";
