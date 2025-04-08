import { Injectable } from '@nestjs/common';
import { scrapeReceitaWS } from '../scrapers/receitaws.scraper';
import { scrapeDuckDuckGo } from 'src/scrapers/duckduckgo.scraper';
import { extractExtraInsightsFromPage } from 'src/scrapers/extra-insights.scraper';

type DuckResult = { title: string; link: string };
type Insight = {
  tipo: string;
  conteudo: any;
  fonte?: string;
};

@Injectable()
export class CrawlerService {
  private insightsCache = new Map<string, any>();
  private receitaCache = new Map<string, any>();
  private pageInsightsCache = new Map<string, Insight[]>();
  private fullCnpjResults = new Map<string, any>();
  private fullTermResults = new Map<string, any>();

  async searchEverywhere(query: string): Promise<any> {
    const cleanQuery = query.trim();
    const normalized = cleanQuery.replace(/\D/g, '');
    const isCnpj = /^\d{14}$/.test(normalized);
    const isPhone = /^\d{10,11}$/.test(normalized);

    if (isCnpj) {
      return this.searchByCnpj(normalized);
    }

    return this.searchByQuery(cleanQuery, isPhone);
  }

  async searchByCnpj(cnpj: string) {
    try {
      if (this.fullCnpjResults.has(cnpj)) {
        console.log(`📦 [CACHE FULL] Resultado completo para CNPJ ${cnpj}`);
        return this.fullCnpjResults.get(cnpj);
      }

      console.log(`🌐 [SCRAPE] ReceitaWS para CNPJ ${cnpj}`);
      const data = await scrapeReceitaWS(cnpj);
      this.receitaCache.set(cnpj, data);

      const searchTerms = [data.nome_fantasia, data.razao_social].filter(Boolean);
      const extraData = await Promise.all(
        searchTerms.map((term) => this.getInsightsFromTerm(term))
      );

      const resultado = {
        tipo: 'consulta_por_cnpj',
        cnpj,
        ...data,
        buscas_adicionais: extraData,
      };

      this.fullCnpjResults.set(cnpj, resultado);
      return resultado;
    } catch (err) {
      return { erro: 'Erro ao buscar dados do CNPJ', detalhe: err.message };
    }
  }

  async searchByQuery(term: string, isPhone: boolean = false) {
    try {
      if (this.fullTermResults.has(term)) {
        console.log(`📦 [CACHE FULL] Resultado completo para termo "${term}"`);
        return this.fullTermResults.get(term);
      }

      const insightsData = await this.getInsightsFromTerm(term);
      const cnpjsDosLinks = this.extractCnpjsFromResults(insightsData.fontes.duckduckgo);
      const cnpjsDosConteudos = this.extractCnpjsFromInsights(insightsData.insights_extras);
      const todosCnpjs = [...cnpjsDosLinks, ...cnpjsDosConteudos];
      const unicos = Array.from(new Set(todosCnpjs));

      let resultadoFinal;

      if (unicos.length > 0) {
        const cnpjData = await this.searchByCnpj(unicos[0]);
        resultadoFinal = {
          tipo: 'consulta_livre_complementada',
          termo: term,
          cnpj_encontrado: unicos[0],
          resultado: cnpjData,
        };
      } else {
        resultadoFinal = {
          tipo: isPhone ? 'telefone' : 'consulta_livre',
          termo: term,
          resultado: insightsData,
        };
      }

      this.fullTermResults.set(term, resultadoFinal);
      return resultadoFinal;
    } catch (err) {
      return { erro: 'Erro ao buscar dados gerais', detalhe: err.message };
    }
  }

  private async getInsightsFromTerm(term: string) {
    if (this.insightsCache.has(term)) {
      console.log(`📦 [CACHE HIT] Insights para termo "${term}"`);
      return this.insightsCache.get(term);
    }

    console.log(`🔎 [SCRAPE] Insights do DuckDuckGo para termo "${term}"`);
    const { resultados: duckResults, insightsExtras } = await scrapeDuckDuckGo(term);
    const insights: Insight[] = [...insightsExtras];

    for (const result of duckResults) {
      const url = result.link;

      if (this.pageInsightsCache.has(url)) {
        console.log(`📄 [CACHE HIT] Insights da página: ${url}`);
        insights.push(...this.pageInsightsCache.get(url)!);
        continue;
      }

      console.log(`🌐 [SCRAPE] Página: ${url}`);
      const dados = await extractExtraInsightsFromPage(url);
      if (dados.length > 0) {
        const insightsComFonte = dados.map((i) => ({ ...i, fonte: url }));
        insights.push(...insightsComFonte);
        this.pageInsightsCache.set(url, insightsComFonte);
      }
    }

    const resultado = {
      termo: term,
      fontes: {
        duckduckgo: duckResults,
      },
      insights_extras: insights,
    };

    this.insightsCache.set(term, resultado);
    return resultado;
  }

  private extractCnpjsFromResults(results: DuckResult[]): string[] {
    const cnpjRegex = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|\b\d{14}\b/g;
    const cnpjs: string[] = [];

    for (const result of results) {
      const match = result.link.match(cnpjRegex);
      if (match) {
        cnpjs.push(...match.map((c) => c.replace(/\D/g, '')));
      }
    }

    return Array.from(new Set(cnpjs));
  }

  private extractCnpjsFromInsights(insights: Insight[]): string[] {
    const cnpjRegex = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|\b\d{14}\b/g;
    const cnpjs: string[] = [];

    for (const insight of insights) {
      const texto = typeof insight.conteudo === 'string'
        ? insight.conteudo
        : JSON.stringify(insight.conteudo);

      const match = texto.match(cnpjRegex);

      console.log('🔍 Conteúdo:', texto);
      console.log('📎 CNPJs encontrados:', match);

      if (match) {
        cnpjs.push(...match.map((c) => c.replace(/\D/g, '')));
      }
    }

    return Array.from(new Set(cnpjs));
  }
}
