import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('subscriptions')
@ApiBearerAuth('access-token')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('features')
  @ApiOperation({ summary: 'Get available features for current subscription tier' })
  getFeatures(@CurrentUser() user: JwtPayload) {
    return this.subscriptionsService.getFeatures(user.tier);
  }
}
