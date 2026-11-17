import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CouponsService } from './coupons.service';
import { ListCouponsQueryDto } from './dto/coupon.dto';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List running coupons, optionally priced for a subtotal' })
  list(@Query() query: ListCouponsQueryDto) {
    return this.coupons.list(query);
  }
}
