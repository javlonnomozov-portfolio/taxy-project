import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PanelRole } from '@tty/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Roles } from '../auth/roles';
import { ChatService, UploadedMedia } from './chat.service';
import { ChatBeforeQuery, ChatMediaDto, ChatTextDto } from './chat.dto';
import { MAX_MEDIA_BYTES } from './chat.media';

const userOf = (req: Request) => (req as Request & { user: JwtPayload }).user;

/**
 * Multer chegarasi tekshiruvdan OLDIN ishlaydi: 2 MB dan katta tana xotiraga
 * umuman o'qilmaydi (413). Baytlar diskka yozilmaydi — xotirada tekshirilib
 * to'g'ridan bazaga ketadi.
 */
const upload = FileInterceptor('file', { limits: { fileSize: MAX_MEDIA_BYTES, files: 1 } });

/** Faylni qaytarish — tur SERVER aniqlagani, brauzer o'zicha taxmin qilmasin. */
function sendMedia(res: Response, media: { mime: string; data: Buffer }) {
  res.setHeader('Content-Type', media.mime);
  res.setHeader('Content-Length', String(media.data.length));
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Fayl o'zgarmaydi (yangi xabar = yangi id), lekin shaxsiy — umumiy keshga tushmasin.
  res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
  res.end(media.data);
}

// ============================================================ HAYDOVCHI

@ApiTags('chat')
@ApiBearerAuth('jwt')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@Roles('driver')
export class DriverChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('messages')
  @ApiOperation({ summary: 'Panel bilan suhbat (eskidan yangiga)' })
  list(@Req() req: Request, @Query() q: ChatBeforeQuery) {
    return this.chat.list(userOf(req).sub, q.before);
  }

  @Get('unread')
  unread(@Req() req: Request) {
    return this.chat.unreadForDriver(userOf(req).sub);
  }

  @Post('messages')
  sendText(@Req() req: Request, @Body() dto: ChatTextDto) {
    return this.chat.sendText(userOf(req).sub, { sender: 'driver' }, dto.body);
  }

  @Post('media')
  @UseInterceptors(upload)
  @ApiOperation({ summary: 'Ovozli xabar yoki rasm (multipart: file, kind, durationSec)' })
  sendMedia(@Req() req: Request, @UploadedFile() file: UploadedMedia, @Body() dto: ChatMediaDto) {
    return this.chat.sendMedia(userOf(req).sub, { sender: 'driver' }, dto.kind, file, dto.durationSec);
  }

  @Post('read')
  read(@Req() req: Request) {
    return this.chat.markRead(userOf(req).sub, 'driver');
  }

  @Get('media/:id')
  async media(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    sendMedia(res, await this.chat.media(id, userOf(req).sub));
  }
}

// ================================================================ PANEL

/**
 * Barcha panel rollari ko'radi va yozadi: haydovchi bilan istalgan navbatchi
 * gaplasha olsin (kechasi ham). Har xabarda kim yozgani saqlanadi.
 */
@ApiTags('ops-chat')
@ApiBearerAuth('jwt')
@Controller('ops/chat')
@UseGuards(JwtAuthGuard)
@Roles(PanelRole.OPERATOR, PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
export class OpsChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  conversations() {
    return this.chat.conversations();
  }

  @Get('drivers/:driverId/summary')
  @ApiOperation({ summary: 'Xaritadagi haydovchi oynasi: holat, reyting, bugungi ish' })
  summary(@Param('driverId', new ParseUUIDPipe()) driverId: string) {
    return this.chat.driverSummary(driverId);
  }

  @Get('drivers/:driverId/messages')
  list(@Param('driverId', new ParseUUIDPipe()) driverId: string, @Query() q: ChatBeforeQuery) {
    return this.chat.list(driverId, q.before);
  }

  @Post('drivers/:driverId/messages')
  sendText(
    @Req() req: Request,
    @Param('driverId', new ParseUUIDPipe()) driverId: string,
    @Body() dto: ChatTextDto,
  ) {
    return this.chat.sendText(driverId, { sender: 'ops', adminId: userOf(req).sub }, dto.body);
  }

  @Post('drivers/:driverId/media')
  @UseInterceptors(upload)
  sendMedia(
    @Req() req: Request,
    @Param('driverId', new ParseUUIDPipe()) driverId: string,
    @UploadedFile() file: UploadedMedia,
    @Body() dto: ChatMediaDto,
  ) {
    return this.chat.sendMedia(
      driverId,
      { sender: 'ops', adminId: userOf(req).sub },
      dto.kind,
      file,
      dto.durationSec,
    );
  }

  @Post('drivers/:driverId/read')
  read(@Param('driverId', new ParseUUIDPipe()) driverId: string) {
    return this.chat.markRead(driverId, 'ops');
  }

  @Get('media/:id')
  async media(@Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    sendMedia(res, await this.chat.media(id));
  }
}
