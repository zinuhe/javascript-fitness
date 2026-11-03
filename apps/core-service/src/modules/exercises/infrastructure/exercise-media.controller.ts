import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExerciseImagesService } from '../application/exercise-images.service';

/**
 * Serves exercise images without authentication: an <img> tag cannot send the bearer token,
 * and these are catalog pictures shared by every user. Uploading and removing them stays
 * behind the JWT guard (ExercisesController).
 */
/** The bits of Express's response used here (core-service has no Express typings). */
interface HttpResponse {
  setHeader(name: string, value: string | number): void;
  status(code: number): { end(body?: Uint8Array): void };
}

@ApiTags('media')
@Controller('media/exercises')
export class ExerciseMediaController {
  constructor(private readonly images: ExerciseImagesService) {}

  @Get(':id/:slot/:size')
  @ApiOperation({ summary: 'An exercise image: size is `thumb` or `large`' })
  async image(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slot', ParseIntPipe) slot: number,
    @Param('size') size: string,
    @Res() res: HttpResponse,
    @Query('v') requested?: string,
    @Headers('if-none-match') ifNoneMatch?: string,
  ): Promise<void> {
    const image = await this.images.get(id, slot, size);
    const etag = `"${image.version}-${size}"`;
    res.setHeader('ETag', etag);
    // A URL with the current version never changes: cache it for good. Otherwise (no or an
    // old version) revalidate, so a replaced image shows up right away.
    res.setHeader(
      'Cache-Control',
      requested === image.version ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
    if (ifNoneMatch === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Content-Length', image.data.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).end(image.data);
  }
}
