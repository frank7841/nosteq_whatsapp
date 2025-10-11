import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if user with email already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email }
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      select: ['id', 'email', 'fullName', 'role', 'isActive', 'createdAt'],
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: ['id', 'email', 'fullName', 'role', 'isActive', 'createdAt', 'updatedAt']
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const user = await this.usersRepository.findOne({ where: { email } });
    return user || undefined;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // If email is being updated, check for conflicts
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: updateUserDto.email }
      });
      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }
    }

    await this.usersRepository.update(id, updateUserDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async findByRole(role: UserRole): Promise<User[]> {
    return this.usersRepository.find({
      where: { role },
      select: ['id', 'email', 'fullName', 'role', 'isActive', 'createdAt']
    });
  }

  async updateUserRole(id: number, role: UserRole): Promise<User> {
    const user = await this.findOne(id);

    if (user.role === role) {
      return user;
    }

    await this.usersRepository.update(id, { role });
    return this.findOne(id);
  }

  async toggleUserStatus(id: number): Promise<User> {
    const user = await this.findOne(id);
    await this.usersRepository.update(id, { isActive: !user.isActive });
    return this.findOne(id);
  }

  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    admins: number;
    agents: number;
  }> {
    const users = await this.usersRepository.find();

    return {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      inactive: users.filter(u => !u.isActive).length,
      admins: users.filter(u => u.role === UserRole.ADMIN).length,
      agents: users.filter(u => u.role === UserRole.AGENT).length,
    };
  }
}