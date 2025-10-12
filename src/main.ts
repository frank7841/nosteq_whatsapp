// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  
  // Enable CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGIN') || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ✅ CHANGE THIS: Make validation less strict
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false, // ✅ Changed from true to false
      transform: true,
      forbidNonWhitelisted: false, // ✅ Changed from true to false
    }),
  );

  app.setGlobalPrefix('api');

  const port = configService.get('PORT') || 3000;
  await app.listen(port);
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 WhatsApp Gateway Backend is running!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 API Server: http://localhost:${port}/api`);
  console.log(`🔌 WebSocket: ws://localhost:${port}`);
  console.log(`🌍 Environment: ${configService.get('NODE_ENV')}`);
  console.log(`📊 Database: ${configService.get('DB_DATABASE')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

bootstrap();