// Sovelluksen konfiguraatio ympäristömuuttujista.

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Puuttuva ympäristömuuttuja: ${name}`);
  }
  return v;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'production',
  port: parseInt(process.env.APP_PORT ?? '8080', 10),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin',
  // Onko sovellus HTTPS:n takana (Secure-cookie). Tuotannossa Caddy hoitaa TLS:n.
  cookieSecure: (process.env.COOKIE_SECURE ?? 'true') === 'true',
  // JWT / cookie voimassa 30 päivää.
  sessionDays: 30,
};

export const isProd = config.nodeEnv === 'production';
