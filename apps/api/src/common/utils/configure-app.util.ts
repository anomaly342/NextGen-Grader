import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/**
 * Request handling shared by main.ts and the e2e tests: CORS, cookies and
 * body validation. Keeps the tested app identical to the real one.
 */
export function configureApp(app: INestApplication): void {
  // Only the web app may call the API, with cookies (the `ngg.sid` session cookie).
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
