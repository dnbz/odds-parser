import { createPlaywrightRouter, log, PlaywrightCrawler } from "crawlee";
import { getRedisClient } from "../redis.js";
import { defaultHandler, parseDetail } from "./parse.js";
import { proxyConfiguration } from "../proxies.js";

log.setLevel(log.LEVELS.INFO);

const BetcityParser = class {
  urls = ["https://betcity.ru/ru/line/soccer"];

  constructor() {
    let router = createPlaywrightRouter();

    router.addDefaultHandler(defaultHandler);
    router.addHandler("DETAIL", parseDetail);

    this.crawler = new PlaywrightCrawler({
      requestHandler: router,
      proxyConfiguration: proxyConfiguration,
      browserPoolOptions: {
        useFingerprints: false,
      }, // Uncomment this option to see the browser window.
      maxConcurrency: 3,
      maxRequestsPerMinute: 120,
    });

    this.crawler.redis = getRedisClient();
  }

  async start() {
    await this.crawler.redis.connect();
    await this.crawler.run(this.urls);
    await this.crawler.redis.disconnect();
  }
};

const parser = new BetcityParser();
await parser.start();
