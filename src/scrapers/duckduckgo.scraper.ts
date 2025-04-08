import axios from 'axios';
import * as cheerio from 'cheerio';

type ResultadoBusca = {
  title: string;
  link: string;
};

type Insight = {
  tipo: string;
  conteudo: string;
  fonte: string;
};

export async function scrapeDuckDuckGo(query: string): Promise<{
  resultados: ResultadoBusca[];
  insightsExtras: Insight[];
}> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    const $ = cheerio.load(data);
    const resultados: ResultadoBusca[] = [];
    const insightsExtras: Insight[] = [];

    $('.result__title').each((_, el) => {
      const title = $(el).text().trim();
      const rawLink = $(el).find('a').attr('href');
      const match = rawLink?.match(/uddg=([^&]+)/);
      const decodedLink = match ? decodeURIComponent(match[1]) : null;

      if (title && decodedLink) {
        resultados.push({ title, link: decodedLink });

        if (decodedLink.includes('reclameaqui.com.br')) {
          insightsExtras.push({
            tipo: 'reputacao',
            conteudo: `Possível perfil encontrado no ReclameAqui: ${decodedLink}`,
            fonte: decodedLink,
          });
        }
      }
    });

    return {
      resultados: resultados.slice(0, 10),
      insightsExtras,
    };
  } catch (err) {
    console.error('Erro no DuckDuckGo scraper:', err.message);
    return {
      resultados: [],
      insightsExtras: [],
    };
  }
}
