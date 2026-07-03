const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
axios.get('https://www.feriados.com.br/feriados-sao_paulo-sp.php', {
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
}).then(res => {
  const $ = cheerio.load(res.data);
  $('.style_dia').each((i, el) => console.log($(el).text().trim(), $(el).parent().text().trim()));
}).catch(console.error);
