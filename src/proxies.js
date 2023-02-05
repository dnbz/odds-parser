import fs from "fs";
import { ProxyConfiguration } from "crawlee";

export const getProxyList = () => {
  let data;
  try {
    data = fs.readFileSync("./proxies.txt", "utf8");
    console.log(data);
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