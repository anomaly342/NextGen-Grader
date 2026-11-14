import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
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
  // Runs onModuleDestroy hooks (e.g. closing the DB pool) on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('NextGen Grader API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  // Routes + "Test Request"; no models, downloads, dev tools, MCP or telemetry.
  app.use(
    '/reference',
    apiReference({
      content: document,
      hideModels: true,
      hideClientButton: true,
      hideDownloadButton: true,
      hideDarkModeToggle: true,
      showDeveloperTools: 'never',
      mcp: { disabled: true },
      telemetry: false,
      withDefaultFonts: false,
      // Sidebar shows the route path (GET /auth/google); the summary/description go below it.
      operationTitleSource: 'path',
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
