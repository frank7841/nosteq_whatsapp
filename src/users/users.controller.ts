import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UserRole } from './entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  getProfile(@Request() req) {
    return this.usersService.findOne(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }

  @Get('role/:role')
  findByRole(@Param('role') role: UserRole) {
    return this.usersService.findByRole(role);
  }

  @Put(':id/role')
  updateUserRole(@Param('id') id: string, @Body() body: { role: UserRole }) {
    return this.usersService.updateUserRole(+id, body.role);
  }

  @Put(':id/toggle-status')
  toggleUserStatus(@Param('id') id: string) {
    return this.usersService.toggleUserStatus(+id);
  }

  @Get('stats/overview')
  getUserStats() {
    return this.usersService.getUserStats();
  }
}