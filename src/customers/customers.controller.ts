import { 
    Controller, 
    Get, 
    Post, 
    Body, 
    Patch, 
    Param, 
    Delete, 
    UseGuards,
    HttpCode,
    HttpStatus 
  } from '@nestjs/common';
  import { CustomersService } from './customers.service';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  
  @Controller('customers')
  @UseGuards(JwtAuthGuard)
  export class CustomersController {
    constructor(private readonly customersService: CustomersService) {}
  
    @Get()
    @HttpCode(HttpStatus.OK)
    findAll() {
      return this.customersService.findAll();
    }
  
    @Get(':id')
    @HttpCode(HttpStatus.OK)
    findOne(@Param('id') id: string) {
      return this.customersService.findOne(+id);
    }
  
    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() customerData: any) {
      return this.customersService.create(customerData);
    }
  
    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    update(@Param('id') id: string, @Body() customerData: any) {
      return this.customersService.update(+id, customerData);
    }
  
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string) {
      return this.customersService.remove(+id);
    }
  }