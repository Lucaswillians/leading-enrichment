import axios from 'axios';

export async function scrapeReceitaWS(cnpj: string): Promise<any> {
  const cleanCnpj = cnpj.replace(/\D/g, ''); 

  try {
    const { data } = await axios.get(`https://www.receitaws.com.br/v1/cnpj/${cleanCnpj}`);

    if (data.status === 'ERROR') {
      throw new Error(data.message || 'Erro ao buscar CNPJ');
    }

    return {
      razao_social: data.nome,
      nome_fantasia: data.fantasia,
      cnpj: data.cnpj,
      email: data.email,
      telefone: data.telefone,
      atividade_principal: data.atividade_principal?.[0]?.text,
      endereco: `${data.logradouro}, ${data.numero} - ${data.bairro}, ${data.municipio} - ${data.uf}`,
      situacao: data.situacao,
    };
  } catch (error) {
    console.error('Erro no ReceitaWS:', error.message);
    return null;
  }
}
