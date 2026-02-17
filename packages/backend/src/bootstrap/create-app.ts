import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';

export function createApp(app: INestApplication): INestApplication {
  const appWithOptionalApis = app as INestApplication & {
    setGlobalPrefix?: (prefix: string) => void;
    useGlobalGuards?: (...guards: unknown[]) => void;
  };

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  appWithOptionalApis.setGlobalPrefix?.('api');
  appWithOptionalApis.useGlobalGuards?.(new AuthGuard());
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
  });
  return app;
}
