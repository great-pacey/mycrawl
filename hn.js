const chalk = require('chalk');
const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fs = require('fs-extra');
const request = require('request');
const Readable = require('stream').Readable;
const log = console.log;

async function main() {
  const browser = await puppeteer.launch({
    headless: false
  });

  log(chalk.yellow('服务启动'));

  try {
    const page = await browser.newPage();
    // await page.emulate(devices['iPhone 6']);
    page.on('console', msg => {
      if (typeof msg === 'object' || typeof msg === 'function') {
        log(chalk.yellow('正在加载页面资源...'));
      } else {
        log(chalk.blue(msg));
      }
    })

    const keyWord = process.argv[2] || '电吹风';
    let url = `https://s.taobao.com/search?q=${keyWord}&imgfile=&js=1&style=grid&stats_click=search_radio_all%3A1&initiative_id=staobaoz_20200227&ie=utf8`


    page.on('load', () => { log(chalk.green('页面首次加载完成')) })

    await page.goto(url);

    log(chalk.yellow('等待登录中...'));
    await page.waitFor(20000);
    log(chalk.green('开始抓取资源'));

    const data = await page.evaluate(async () => {
      await scrollPage();

      const data = Object.create(null);
      const picEls = document.querySelectorAll('.J_ItemPic.img');
      const list = [].map.call(picEls, el => el.getAttribute('src').replace(/^\/\//, 'https://'));
      data.title = document.title;
      data.list = list;
      return data;

      // 滑动页面到底部，因为很多网页做了懒加载
      async function scrollPage() {
        const total_height = document.body.scrollHeight * 2, d = 600;
        let currentH = 0;
        while (currentH + d <= total_height) {
          await sleep(800);
          window.scrollTo(0, currentH = currentH + d);
        }
      }

      async function sleep(d = 600) {
        return new Promise(resolve => {
          setTimeout(resolve, d);
        });
      }
    })

    log(`页面title： ${data.title}`);
    log('图片数据如下：\n');

    function setImagesSize(list, size = 480) {
      return list.map(img => (
        img.replace(/[1-9][1-9]0\x[1-9][1-9]0/, `${size}x${size}`)
      ));
    }
    const formatData = setImagesSize(data.list, 760);

    let uid = 0, sum = 0;
    async function downloadImg(url) {
      return new Promise(resolve => {
        const suffix = url.match(/\.(jpg)|(png)|(webp)|(jpeg)|(svg)$/)[1];
        const fileName = `${++uid}.${suffix}`;
        const path = `./${keyWord}/${fileName}`;
        fs.writeFileSync(path);
        const stream = fs.createWriteStream(path);
        stream.on('finish', function() {
          log(chalk.yellow(`已下载${Math.round(++sum*100/formatData.length)}%...`));
          resolve();
        });
        stream.on('error', () => {
          log(chalk.bgRed(`${fileName}写入失败`));
          resolve();
        })
        request(url).pipe(stream);
      });
    }

    async function outputSrc() {
      return new Promise(resolve => {
        const file = 'urls.txt';
        fs.writeFileSync(file);
        const s = fs.createWriteStream(file);
        s.on('finish', resolve);
        s.on('error', resolve);
        const rs = new Readable();
        rs.push(formatData.join('\n'));
        rs.push(null);
        rs.pipe(s);
      });
    }

    log(chalk.yellow('正在下载图片...'));

    fs.emptyDirSync(keyWord);
    await Promise.all(formatData.map(url => downloadImg(url)).concat(outputSrc()));
    log(chalk.green('图片下载完毕'));
  } catch (error) {
    log(chalk.red(error));
    log(chalk.red('服务意外终止'));
    await browser.close();
  } finally {
    await browser.close();
    process.exit(0);
  }
}

main();
