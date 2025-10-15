import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    UseGuards,
  } from '@nestjs/common';
  import { FileInterceptor } from '@nestjs/platform-express';
  import { diskStorage } from 'multer';
  import { extname } from 'path';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  
  @Controller('upload')
  @UseGuards(JwtAuthGuard)
  export class UploadController {
    @Post('image')
    @UseInterceptors(
      FileInterceptor('file', {
        storage: diskStorage({
          destination: '/home/simiyu/uploads/images',
          filename: (req, file, callback) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
          },
        }),
        fileFilter: (req, file, callback) => {
          if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
            return callback(
              new BadRequestException('Only image files are allowed!'),
              false,
            );
          }
          callback(null, true);
        },
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB
        },
      }),
    )
    uploadImage(@UploadedFile() file: Express.Multer.File) {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
  
      const fileUrl = `https://chat.nosteq.co.ke/uploads/images/${file.filename}`;
      
      return {
        success: true,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        url: fileUrl,
        type: 'image',
      };
    }
  
    @Post('video')
    @UseInterceptors(
      FileInterceptor('file', {
        storage: diskStorage({
          destination: '/home/simiyu/uploads/videos',
          filename: (req, file, callback) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
          },
        }),
        fileFilter: (req, file, callback) => {
          if (!file.originalname.match(/\.(mp4|avi|mov|wmv|flv|mkv)$/)) {
            return callback(
              new BadRequestException('Only video files are allowed!'),
              false,
            );
          }
          callback(null, true);
        },
        limits: {
          fileSize: 16 * 1024 * 1024, // 16MB (WhatsApp limit)
        },
      }),
    )
    uploadVideo(@UploadedFile() file: Express.Multer.File) {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
  
      const fileUrl = `https://chat.nosteq.co.ke/uploads/videos/${file.filename}`;
      
      return {
        success: true,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        url: fileUrl,
        type: 'video',
      };
    }
  
    @Post('document')
    @UseInterceptors(
      FileInterceptor('file', {
        storage: diskStorage({
          destination: '/home/simiyu/uploads/documents',
          filename: (req, file, callback) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
          },
        }),
        fileFilter: (req, file, callback) => {
          if (!file.originalname.match(/\.(pdf|doc|docx|xls|xlsx|txt|csv)$/)) {
            return callback(
              new BadRequestException('Only document files are allowed!'),
              false,
            );
          }
          callback(null, true);
        },
        limits: {
          fileSize: 100 * 1024 * 1024, // 100MB (WhatsApp limit)
        },
      }),
    )
    uploadDocument(@UploadedFile() file: Express.Multer.File) {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
  
      const fileUrl = `https://chat.nosteq.co.ke/uploads/documents/${file.filename}`;
      
      return {
        success: true,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        url: fileUrl,
        type: 'document',
      };
    }
  
    @Post('audio')
    @UseInterceptors(
      FileInterceptor('file', {
        storage: diskStorage({
          destination: '/home/simiyu/uploads/audio',
          filename: (req, file, callback) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
          },
        }),
        fileFilter: (req, file, callback) => {
          if (!file.originalname.match(/\.(mp3|wav|ogg|m4a|aac)$/)) {
            return callback(
              new BadRequestException('Only audio files are allowed!'),
              false,
            );
          }
          callback(null, true);
        },
        limits: {
          fileSize: 16 * 1024 * 1024, // 16MB (WhatsApp limit)
        },
      }),
    )
    uploadAudio(@UploadedFile() file: Express.Multer.File) {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
  
      const fileUrl = `https://chat.nosteq.co.ke/uploads/audio/${file.filename}`;
      
      return {
        success: true,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        url: fileUrl,
        type: 'audio',
      };
    }
  }