import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const USER_TYPES = ['public', 'community', 'enterprise_client', 'esg_analyst', 'government', 'investor', 'auditor'] as const;

export class RegisterDto {
  @ApiProperty({ example: 'ishaan.mehta@reliance.com' })
  @IsEmail({}, { message: 'Valid email address required.' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ minLength: 12, description: 'Min 12 chars, uppercase, lowercase, number, special char' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'Ishaan' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @ApiProperty({ example: 'Mehta' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  lastName: string;

  @ApiPropertyOptional({ enum: USER_TYPES, default: 'community' })
  @IsOptional()
  @IsIn(USER_TYPES)
  userType?: typeof USER_TYPES[number];

  @ApiPropertyOptional({ example: 'Reliance Industries Ltd' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  organizationName?: string;
}
