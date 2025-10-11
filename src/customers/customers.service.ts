import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  async findAll(): Promise<Customer[]> {
    return this.customerRepository.find({
      order: { lastMessageAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Customer | undefined> {
    const customer = await this.customerRepository.findOne({ where: { phoneNumber } });
    return customer ?? undefined;
  }

  async create(customerData: Partial<Customer>): Promise<Customer> {
    const customer = this.customerRepository.create(customerData);
    return this.customerRepository.save(customer);
  }

  async update(id: number, customerData: Partial<Customer>): Promise<Customer> {
    await this.customerRepository.update(id, customerData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.customerRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
  }
}