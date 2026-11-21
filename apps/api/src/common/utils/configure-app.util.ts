import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/** Nest's route prefix. The web host's `/api` rewrite points here. */
const API_PREFIX = 'api/v1';

/**
 * Request handling shared by main.ts and the e2e tests: route prefix, CORS,
 * cookies and body validation. Keeps the tested app identical to the real one.
 */
export function configureApp(app: INestApplication): void {
  // Browsers reach Nest only through the web host's `/api` rewrite to this prefix (ADR 0002).
  app.setGlobalPrefix(API_PREFIX);
  // The web app goes through the rewrite (same origin). CORS is left for local dev tools.
  app.enableCors({
    origin: process.env['WEB_URL'],
    credentials: true,
  });
  app.use(cookieParser());
  // Validates every @Body() DTO; unknown fields are rejected.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
}
