import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createApp } from './bootstrap/create-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  createApp(app);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

if (process.env.NODE_ENV !== 'test') {
  void bootstrap();
}

export { bootstrap };
