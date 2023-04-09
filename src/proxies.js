import fs from "fs";
import { ProxyConfiguration } from "crawlee";

export const getProxyList = (filename = "./proxies.txt") => {
  let data;
  try {
    data = fs.readFileSync(filename, "utf8");
  } catch (err) {
    console.error(err);
    return;
  }

  let proxies = data.trim().split("\n");

  return proxies;
};
export const proxyConfiguration = new ProxyConfiguration({
  proxyUrls: getProxyList(),
});

export const pinnacleProxyConfiguration = new ProxyConfiguration({
  proxyUrls: getProxyList("./proxies-pinnacle.txt"),
});
