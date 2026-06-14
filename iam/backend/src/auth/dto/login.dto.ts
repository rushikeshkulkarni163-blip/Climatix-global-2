import { IsEmail, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'ishaan.mehta@reliance.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ishaan.mehta@reliance.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  newPassword: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  token: string;
}

export class VerifyOtpDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  otp: string;
}
