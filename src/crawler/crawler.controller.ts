import { Controller, Get, Query } from '@nestjs/common';
import { CrawlerService } from './crawler.service';

@Controller('crawler')
export class CrawlerController {
  constructor(private readonly crawlerService: CrawlerService) { }

  @Get('search')
  async search(@Query('query') query: string) {
    return this.crawlerService.searchEverywhere(query);
  }
}
