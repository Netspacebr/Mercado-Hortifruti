import { Config, Product, Category, Schedule, Neighborhood, Coupon, Order } from '../types';

// REMOVIDO: A URL do script agora é gerenciada dinamicamente pelo AppContext.
// const SCRIPT_URL = "https://script.google.com/...";

// **CORREÇÃO DEFINITIVA (NOVA TENTATIVA)**: Transforma URLs do Google Drive para um formato de imagem direta e mais confiável.
// A lógica de extração do ID do arquivo já é robusta. A mudança está no formato da URL final,
// que agora usa o endpoint 'thumbnail', conhecido por ser mais estável para embed de imagens.
// IMPORTANTE: Para que as imagens apareçam, o compartilhamento do arquivo no Google Drive
// deve ser definido como "Qualquer pessoa com o link".
const transformGoogleDriveUrl = (url: string): string => {
  if (!url || !url.includes('drive.google.com')) {
    return url; // Retorna a URL original se não for do Google Drive.
  }

  // Regex robusta para capturar o ID dos formatos mais comuns:
  // - drive.google.com/file/d/FILE_ID/...
  // - drive.google.com/open?id=FILE_ID
  // - drive.google.com/uc?id=FILE_ID
  const regex = /(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);
  const fileId = match ? match[1] : null;

  if (fileId) {
    // **A MUDANÇA ESTÁ AQUI**: Usa o endpoint 'thumbnail' para uma exibição mais direta e confiável.
    return `https://drive.google.com/thumbnail?id=${fileId}`;
  }

  // Se nenhum ID for encontrado, retorna a URL original.
  return url;
};


// FIX: Added a dedicated error handler for network failures.
const handleFetchError = (error: unknown): never => {
    // This provides a much more specific and actionable error message for the most common setup problem.
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error(
            'Não foi possível conectar com a sua planilha Google.\n\n' +
            'Este é o erro mais comum de configuração. Geralmente, é causado por um destes motivos:\n\n' +
            '1.  **URL Incorreta:** A URL no código pode estar errada. Verifique se você copiou a **URL da Implantação** (que termina em `/exec`) e não a URL do editor de script.\n\n' +
            '2.  **Permissões de Acesso:** Ao implantar o script, a opção "Quem pode acessar" **PRECISA** ser definida como **"Qualquer pessoa"**.\n\n' +
            '3.  **Nova Implantação:** Se você alterou o código do script, você precisa fazer uma **nova implantação** (`Implantar > Gerenciar Implantações > Editar > Nova Versão`) para que as mudanças tenham efeito.\n\n' +
            'Por favor, revise cuidadosamente os passos 2 e 3 do arquivo `README.md` para corrigir a implantação do seu script.'
        );
    }
    // Re-throw other types of errors.
    throw error;
}

// Helper to normalize headers: lowercase, remove accents, handle special cases.
const normalizeHeader = (header: any): string => {
  // FIX: Safely convert header to string to prevent errors if the cell is numeric or another type.
  const headerStr = header != null ? String(header) : '';
  if (!headerStr) return '';
  return headerStr
    .toLowerCase()
    .normalize("NFD") // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks
    .replace(/ç/g, "c") // Replace ç with c
    .replace(/ /g, '_'); // Replace spaces with underscores
};

// Helper to normalize category values for robust matching.
const normalizeCategoryValue = (value: string): string => {
  if (!value) return '';
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove diacritical marks
};

// **NEW**: Robust helper to determine if an item is active based on various possible column names and values.
const normalizeStatus = (item: any): 'ativo' | 'inativo' => {
  // Search for any column that might represent status (Case-Insensitive)
  const keys = Object.keys(item);
  const statusKey = keys.find(k => {
    const normalizedKey = k.toLowerCase().trim();
    return ['status', 'ativo', 'ativa', 'disponivel', 'visivel', 'habilitado', 'ativo_?', 'active', 'enabled', 'publicado'].includes(normalizedKey);
  });
  
  if (!statusKey) return 'ativo'; 
  
  const val = String(item[statusKey]).toLowerCase().trim();
  
  // Values that definitely mean INACTIVE
  const inactiveValues = ['inativo', 'inativa', 'nao', 'n', '0', 'false', 'desabilitado', 'off', 'no', 'disabled', 'false'];
  
  // If value is one of the inactive markers, or is explicitly empty (when a column exists)
  if (inactiveValues.includes(val) || val === '') {
    return 'inativo';
  }
  
  return 'ativo';
};

// **A CORREÇÃO DEFINITIVA ESTÁ AQUI**:
// Esta função agora é robusta o suficiente para lidar com valores de moeda
// como "R$ 5,00", "5,00", ou "5.00", que era a causa raiz do problema de frete.
const parseCurrency = (value: string | null | undefined): number => {
    if (!value) return 0;
    // Remove tudo que não for número, vírgula, ponto ou sinal de menos.
    // Depois, substitui a vírgula por ponto para garantir que o parseFloat funcione.
    const numericString = String(value)
        .replace(/[^0-9,.-]+/g, "") 
        .replace(',', '.');
    const parsed = parseFloat(numericString);
    return isNaN(parsed) ? 0 : parsed;
};


const parseProducts = (data: string[][]): Product[] => {
  if (!data || data.length < 2) return [];
  const headers = data[0].map(normalizeHeader);
  const products = data
    .slice(1)
    // Filter out rows where the 'item' column (assuming it's the second one) is empty or null.
    .filter(row => row && row.length > 0 && row[1] != null && String(row[1]).trim() !== '')
    .map((row, rowIndex) => {
      const productData: any = {};
      headers.forEach((header, index) => {
        // FIX: Definitively solve type errors by ensuring all data is a string before processing.
        productData[header] = row[index] != null ? String(row[index]) : '';
      });
      
      // FIX: Normalize the 'categoria' string from the 'Itens' sheet for consistent filtering.
      if (productData.categoria) {
        productData.categoria = String(productData.categoria)
          .split('|')
          .map(normalizeCategoryValue)
          .join('|');
      }

      // ACRESCENTADO: Suporte para múltiplas imagens com busca flexível de coluna.
      // Esta nova lógica procura por qualquer coluna cujo nome contenha 'foto' ou 'imagem',
      // resolvendo o problema de nomes de coluna inesperados como 'link_da_foto'.
      let imageUrlsString = '';
      const productKeys = Object.keys(productData);
      // Procura pela primeira chave que contenha 'foto' ou 'imagem'.
      const photoKey = productKeys.find(key => key.includes('foto') || key.includes('imagem'));

      if (photoKey) {
          imageUrlsString = String(productData[photoKey] || '');
      }
      
      // A ALTERAÇÃO ESTÁ AQUI: O sistema agora usa APENAS ponto e vírgula (;)
      // para separar múltiplos links de imagem, e também converte automaticamente links do Google Drive
      // para um formato que pode ser exibido, corrigindo o problema das imagens não carregarem.
      const foto_urls = imageUrlsString
          .split(';')
          .map((url: string) => url.trim())
          .filter((url: string) => url && url.startsWith('http'))
          .map(transformGoogleDriveUrl);

      productData.foto_urls = foto_urls;

      // Lista de todas as possíveis chaves de foto que podem ter vindo da planilha
      const allPossiblePhotoKeys = ['foto_urls', 'foto_url', 'fotos', 'imagem', 'imagens', 'foto', 'image', 'url_da_foto', 'imagem_url'];
      if(photoKey) allPossiblePhotoKeys.push(photoKey);

      // Remove todas as chaves de foto antigas, exceto a propriedade final `foto_urls`,
      // para garantir que o objeto do produto fique limpo e correto.
      for(const key of new Set(allPossiblePhotoKeys)) {
          if (key !== 'foto_urls' && productData.hasOwnProperty(key)) {
              delete productData[key];
          }
      }

      // FIX: Use the robust `parseCurrency` function to handle prices correctly.
      const prices = String(productData.preco || '')
          .split('/')
          .map(p => parseCurrency(p.trim()));

      // FIX: Ensure 'observacao' is a string before calling string methods.
      const sizes = String(productData.observacao || '').split('/');

      const variants = prices.map((price, index) => ({
        size: sizes[index] ? sizes[index].trim() : 'Padrão',
        price: price
      }));

      if (variants.length === 0) {
          variants.push({ size: 'Padrão', price: 0 });
      }

      // **FIX**: Standardization of status ensures that filtering works regardless of column name (Status vs Ativo).
      const standardizedStatus = normalizeStatus(productData);
      
      // DIAGNOSTICO: Loga as colunas do primeiro produto para ajudar o usuário a identificar nomes
      if (rowIndex === 0) {
        console.log("[DEBUG] Colunas encontradas no Produto:", Object.keys(productData));
        console.log("[DEBUG] Status identificado como:", standardizedStatus, "usando o valor:", productData[Object.keys(productData).find(k => k.toLowerCase().includes('status') || k.toLowerCase().includes('ativ')) || '']);
      }

      return { ...productData, variants, status: standardizedStatus } as Product;
    });
    
    // Final strict filter remains to ensure data integrity.
    return products.filter(p => p && p.item && p.item.trim() !== '');
};

const parseConfig = (data: string[][]): Config[] => {
  if (!data || data.length < 2) return [];
  const headers = data[0].map(normalizeHeader);
  const keyIndex = headers.indexOf('key');
  const valueIndex = headers.indexOf('value');
  const seccaoIndex = headers.indexOf('seccao');

  if (keyIndex === -1 || valueIndex === -1) {
    console.warn("Aviso: A aba 'Configurações' não possui as colunas 'key' e 'value'.");
    return [];
  }

  return data
    .slice(1)
    .filter(row => row && row[keyIndex] != null && String(row[keyIndex]).trim() !== '')
    .map(row => {
      const key = row[keyIndex] != null ? String(row[keyIndex]) : '';
      const value = row[valueIndex] != null ? String(row[valueIndex]) : '';
      const seccao = seccaoIndex !== -1 && row[seccaoIndex] != null ? String(row[seccaoIndex]) : '';
      
      return {
        seccao: seccao,
        // **Crucial Fix**: Normalize the key itself to make lookups reliable.
        key: normalizeHeader(key), 
        value: value,
      };
    });
};


const parseGeneric = <T,>(data: string[][]): T[] => {
  if (!data || data.length < 2) return [];
  const headers = data[0].map(normalizeHeader);
  return data
    .slice(1)
    // FIX: Stricter filter to ignore rows that are effectively empty.
    .filter(row => row && row.length > 0 && row.some(cell => cell != null && String(cell).trim() !== ''))
    .map(row => {
      const item: any = {};
      headers.forEach((header, index) => {
        const headerKey = header;
        // FIX: Definitively solve type errors by ensuring every cell value is a string before processing.
        const value = row[index] != null ? String(row[index]) : '';
        
        if (headerKey === 'taxa_entrega' || headerKey === 'ordem') {
          item[headerKey] = parseCurrency(value);
        } else {
          item[headerKey] = value;
        }
      });
      return item as T;
    });
};

const parseCategories = (data: string[][]): Category[] => {
  if (!data || data.length < 2) return [];
  const headers = data[0].map(normalizeHeader);

  // Find the primary category name column by checking for common names.
  const nameHeaderKey = headers.find(h => ['categoria', 'setor', 'nome_categoria'].includes(h));

  return data
    .slice(1)
    // Filter rows that are empty or don't have a value in a primary column
    .filter(row => row && row.length > 0 && row.some(cell => cell != null && String(cell).trim() !== ''))
    .map(row => {
      const item: any = {};
      
      // Build the object from all headers
      headers.forEach((header, index) => {
        const value = row[index] != null ? String(row[index]) : '';
        item[header] = value;
      });

      // **Crucial Step**: Ensure the `nome_categoria` property exists and is normalized,
      // regardless of the original column name ('setor', 'categoria', etc.). This makes the app resilient.
      if (nameHeaderKey && item[nameHeaderKey]) {
        item.nome_categoria = normalizeCategoryValue(item[nameHeaderKey]);
      } else if (headers.length > 0 && row[0]) {
        // Fallback to the first column if no known header is found
        item.nome_categoria = normalizeCategoryValue(row[0]);
      } else {
        item.nome_categoria = ''; // Ensure property exists
      }
      
      // Ensure 'ordem' is parsed as a number
      if (item.ordem) {
        item.ordem = parseFloat(String(item.ordem).replace(',', '.')) || 0;
      }
      
      // Use titulo_exibicao if available, otherwise fall back to the main category name.
      if (!item.titulo_exibicao) {
          item.titulo_exibicao = item[nameHeaderKey || headers[0]] || '';
      }

      // **FIX**: Standardize status for categories as well.
      item.status = normalizeStatus(item);

      return item as Category;
    })
    // Final filter to remove any categories that still ended up without a name
    .filter(cat => cat.nome_categoria && cat.nome_categoria.trim() !== '');
};


const parseNeighborhoods = (data: string[][]): Neighborhood[] => {
  if (!data || data.length < 2) return [];
  const headers = data[0].map(normalizeHeader);
  
  // The logic to FIND the columns is correct and flexible.
  const bairroIndex = headers.findIndex(h => h.includes('bairro') || h.includes('localidade') || h.includes('regiao'));
  const taxaIndex = headers.findIndex(h => h.includes('taxa') || h.includes('frete'));

  if (bairroIndex === -1) {
    console.warn("AVISO CRÍTICO: Não foi possível encontrar uma coluna para 'bairro' (ex: 'bairro', 'localidade') na aba 'Bairros'. O cálculo de frete NÃO irá funcionar.");
    return [];
  }
  if (taxaIndex === -1) {
    console.warn("AVISO CRÍTICO: Não foi possível encontrar uma coluna para a taxa de entrega (ex: 'taxa', 'frete') na aba 'Bairros'. O cálculo de frete NÃO irá funcionar.");
    return [];
  }

  return data
    .slice(1)
    .filter(row => row && row[bairroIndex] && String(row[bairroIndex]).trim() !== '')
    .map(row => {
      return {
        bairro: String(row[bairroIndex]).trim(),
        // FIX: Use the robust `parseCurrency` function to correctly read the fee.
        taxa_entrega: parseCurrency(row[taxaIndex]),
      };
    });
};


export const fetchSheetData = async (scriptUrl: string) => {
  if (!scriptUrl) throw new Error("URL do Google Apps Script não configurada.");
  let res;
  try {
    // **FIX**: Added cache-busting timestamp to prevent browser from showing old spreadsheet data.
    res = await fetch(`${scriptUrl}?action=readAll&t=${Date.now()}`);
  } catch (error) {
    handleFetchError(error);
  }

  if (!res.ok) {
    let errorText = '';
    try {
        errorText = await res.text();
    } catch(e) {}
    throw new Error(`Falha ao carregar (Status: ${res.status} ${res.statusText}). Detalhes: ${errorText.substring(0, 100)}. Verifique a URL do script.`);
  }
  
  const data = await res.json();
  if (data.error) {
    throw new Error(`Erro no script do Google: ${data.error}`);
  }
  
  // **Definitive Fix**: With the new robust Apps Script, the client can now reliably
  // ask for 'Horários' and trust the script to find the correct sheet,
  // simplifying the code and making it more maintainable.
  const schedulesData = data['Horários'] || [];
  
  if (!schedulesData || schedulesData.length === 0) {
      console.warn("Aviso: A aba de horários ('Horários' ou similar) não foi encontrada ou está vazia na sua planilha. O status da loja será 'Fechado' por padrão.");
  } else if (schedulesData.length <= 1) { // length <= 1 because it might just contain the header row
      console.warn("Aviso: A aba de horários foi encontrada, mas parece estar vazia. Verifique se os dados de funcionamento estão preenchidos.");
  }


  // Each sheet is parsed independently to improve robustness.
  return {
    config: parseConfig(data['Configurações'] || []),
    products: parseProducts(data['Itens'] || []),
    categories: parseCategories(data['Categorias'] || []),
    schedules: parseGeneric<Schedule>(schedulesData),
    neighborhoods: parseNeighborhoods(data['Bairros'] || []),
    coupons: parseGeneric<Coupon>(data['Cupons'] || []),
  };
};

export const fetchServerTime = async (scriptUrl: string): Promise<string> => {
    if (!scriptUrl) throw new Error("URL do Google Apps Script não configurada.");
    let res;
    try {
        // **FIX**: Added cache-busting to time sync as well.
        res = await fetch(`${scriptUrl}?action=getTime&t=${Date.now()}`);
    } catch (error) {
        handleFetchError(error);
    }
    
    if (!res.ok) {
        throw new Error('Falha ao buscar a hora do servidor.');
    }
    const data = await res.json();
    if (data.error || !data.server_time_utc) {
        throw new Error(`Erro no script do Google ao buscar a hora: ${data.error || 'Resposta inválida'}`);
    }
    return data.server_time_utc;
};


export const postOrder = async (orderData: Order, scriptUrl: string): Promise<Response> => {
    if (!scriptUrl) {
        throw new Error("A URL do Google Apps Script não está configurada.");
    }

    let response;
    try {
        response = await fetch(scriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain', 
            },
            body: JSON.stringify({
                action: 'writeOrder',
                order: orderData,
            }),
            mode: 'cors',
        });
    } catch (error) {
        handleFetchError(error);
    }
    
    return response;
};