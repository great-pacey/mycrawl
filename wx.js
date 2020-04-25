const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fs = require('fs-extra');
const request = require('request');
const chalk = require('chalk');

const log = console.log;
const outputType = process.argv[2];
const pageUrl = process.argv[3] || 'https://mp.weixin.qq.com/s/zxtojuT7p3M-VxLN0_d6Hw';

async function main() {
  const browser = await puppeteer.launch({ headless: outputType.toLowerCase() === 'pdf' });
  const page = await browser.newPage();
  await page.emulate(devices['iPhone XR']);
  try {
    log(chalk.yellow('正在打开网页...'));
    page.on('console', message => {
      if(message && message.slice && message.slice(0, 3) === '!!!') {
        log(chalk.blue(message.slice(3)));
      }
    })
    page.on('load', () => {
      log(chalk.green('页面初始加载完成'));
    })
    await page.goto(pageUrl, {
      waitUntil: 'networkidle2'
    });
    log(chalk.yellow('等待加载更多页面资源...'));
    // await page.waitFor(800);
    const pageData = await page.evaluate(async () => {
      await scrollPage();
      const data = Object.create(null);
      data.text = document.querySelector('#js_content').innerText;
      data.title = document.title;
      return data;

      // 滑动页面到底部，因为很多网页做了懒加载
      async function scrollPage() {
        const total_height = document.body.scrollHeight * 2, d = 600;
        let currentH = 0;
        console.log('!!!开始滑动页面以加载资源...');
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

    log(chalk.green('页面内容已经抓取成功'));

    async function outputFile(fileName, type='pdf') {
      log(chalk.yellow('正在生成文件...'));
      if (type === 'pdf') {
        await page.pdf({
          path: `${fileName}.pdf`,
          format: `A4`
        })
      } else if (type === 'jpeg' || type === 'jpg' || type === 'png') {  
        await page.screenshot({
          path: `${fileName}.${type}`,
          type: type === 'jpg' ? 'jpeg' : type,
          fullPage: true
        })
      }
      
      log(chalk.green('转成文件成功'));
    }

    await outputFile(pageData.title, outputType);

  } catch (error) {
    log(chalk.red(error));
  } finally {
    browser.close();
    process.exit(0);
  }
}

main();