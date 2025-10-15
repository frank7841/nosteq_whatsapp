// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  const configService = app.get(ConfigService);
  app.useStaticAssets('/home/simiyu/uploads', {
    prefix: '/uploads/',
  });

  
  // Enable CORS
  app.enableCors({
    origin:true,
    // (origin, callback) => {
    //   // Allow requests with no origin (e.g., Postman, curl, server-to-server)
    //   if (!origin) {
    //     return callback(null, true);
    //   }
      
    //   // Allow requests from localhost with any port (development)
    //   if (origin.match(/^https?:\/\/localhost:\d+$/)) {  // Added https? for flexibility
    //     return callback(null, true);
    //   }
      
    //   // Allow specific origins from environment variable (comma-separated)
    //   const allowedOrigins = configService.get('CORS_ORIGIN')?.split(',') || [];
    //   if (allowedOrigins.includes(origin)) {
    //     return callback(null, true);
    //   } else {
    //     return callback(new Error('Not allowed by CORS'), false);
    //   }
    // },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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