import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('app')
@Controller()
export class AppController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'API metadata' })
  root() {
    return {
      name: 'DukaanHub API',
      version: '1.0.0',
      docs: '/docs',
      health: '/api/v1/health',
    };
  }
}
