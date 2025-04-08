import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

@Injectable()
export class CrawlerService {
  async searchEverywhere(query: string): Promise<any> {
    const cleanQuery = query.trim();
    const isCnpj = /^\d{14}$/.test(cleanQuery.replace(/\D/g, ''));
    const isPhone = /^\d{10,11}$/.test(cleanQuery.replace(/\D/g, ''));

    if (isCnpj) {
      return this.searchByCnpj(cleanQuery);
    }

    if (isPhone) {
      return this.searchByPhone(cleanQuery);
    }

    return this.searchByKeyword(cleanQuery);
  }

  async searchByCnpj(cnpj: string) {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    try {
      const { data } = await axios.get(`https://www.receitaws.com.br/v1/cnpj/${cleanCnpj}`);
      return {
        tipo: 'CNPJ',
        razao_social: data.nome,
        nome_fantasia: data.fantasia,
        endereco: `${data.logradouro}, ${data.numero} - ${data.bairro}, ${data.municipio} - ${data.uf}`,
        telefone: data.telefone,
        email: data.email,
        atividade: data.atividade_principal?.[0]?.text || '',
        situacao: data.situacao,
        fonte: 'ReceitaWS',
      };
    } catch (err) {
      return { erro: 'Não foi possível buscar dados do CNPJ', detalhe: err.message };
    }
  }

  async searchByPhone(phone: string) {
    const query = encodeURIComponent(phone);
    const results = await this.scrapeGoogle(`"${phone}"`);
    return {
      tipo: 'telefone',
      resultados: results,
    };
  }

  async searchByKeyword(keyword: string) {
    const results = await this.scrapeGoogle(keyword);
    return {
      tipo: 'busca geral',
      resultados: results,
    };
  }

  async scrapeGoogle(search: string): Promise<string[]> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const url = `https://www.google.com/search?q=${encodeURIComponent(search)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const results = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('h3')).map(el => el.textContent || '');
      return links.slice(0, 10); 
    });

    await browser.close();
    return results;
  }
}
