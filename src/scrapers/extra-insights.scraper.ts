import axios from 'axios';
import * as cheerio from 'cheerio';

type Insight = {
  tipo: string;
  conteudo: any;
  fonte?: string;
};

export async function extractExtraInsightsFromPage(url: string): Promise<Insight[]> {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000,
    });

    const $ = cheerio.load(data);
    const text = $('body').text().replace(/\s+/g, ' ').toLowerCase();
    const insights: Insight[] = [];

    if (text.includes('missão') || text.includes('visão') || text.includes('valores')) {
      insights.push({
        tipo: 'institucional',
        conteudo: extractSectionContaining(text, ['missão', 'visão', 'valores']),
        fonte: url,
      });
    }

    if (text.includes('serviços') || text.includes('soluções') || text.includes('oferecemos')) {
      insights.push({
        tipo: 'servicos',
        conteudo: extractSectionContaining(text, ['serviços', 'soluções', 'oferecemos']),
        fonte: url,
      });
    }

    const socialLinks = {
      linkedin: $('a[href*="linkedin.com"]').attr('href'),
      instagram: $('a[href*="instagram.com"]').attr('href'),
      facebook: $('a[href*="facebook.com"]').attr('href'),
    };

    const redes = Object.entries(socialLinks)
      .filter(([_, val]) => val && !val.includes('dun-&-bradstreet') && !val.includes('DunBradstreet'));

    if (redes.length > 0) {
      insights.push({
        tipo: 'redes_sociais',
        conteudo: Object.fromEntries(redes),
        fonte: url,
      });
    }

    if (text.includes('reclamação') || text.includes('problema') || text.includes('atendimento ruim')) {
      insights.push({
        tipo: 'reputacao',
        conteudo: 'Foram encontradas palavras relacionadas a reclamações nesta página.',
        fonte: url,
      });
    }

    const reclameAquiLink = $('a[href*="reclameaqui.com.br"]').attr('href');
    if (reclameAquiLink) {
      insights.push({
        tipo: 'reputacao',
        conteudo: `Possível perfil no ReclameAqui: ${reclameAquiLink}`,
        fonte: reclameAquiLink,
      });
    }

    return insights;
  } catch (err) {
    console.error(`Erro ao extrair insights de ${url}:`, err.message);
    return [];
  }
}

// 🔍 Extrai trecho textual contendo palavras-chave
function extractSectionContaining(text: string, keywords: string[]): string {
  const lower = text.toLowerCase();
  const match = keywords
    .map(k => lower.indexOf(k))
    .filter(i => i !== -1)
    .sort((a, b) => a - b)[0];

  if (match !== undefined) {
    const start = Math.max(0, match - 100);
    const end = match + 300;
    return text.slice(start, end).trim() + '...';
  }

  return '';
}
