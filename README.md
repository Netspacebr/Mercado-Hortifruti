# Supermercado Web App - PWA com Google Sheets

Este é um aplicativo web progressivo (PWA) de lista de compras para supermercado, controlado inteiramente por uma planilha Google (Google Sheets) como backend.

## Funcionalidades

- **Navegação de Produtos**: Visualize produtos em uma grade elegante com fotos, preços e descrições.
- **Busca e Filtro**: Pesquise produtos por nome ou filtre por categoria.
- **Carrinho de Compras**: Adicione produtos ao carrinho com controle de quantidade.
- **Checkout Simplificado**: Calcule frete, aplique cupons e escolha a forma de pagamento.
- **Integração com WhatsApp**: Envie o pedido finalizado diretamente para o WhatsApp do supermercado.
- **Backend em Google Sheets**: Gerencie todo o catálogo de produtos, categorias, cupons e configurações em uma única planilha.
- **PWA**: Instale o aplicativo na tela inicial do seu celular para uma experiência nativa.
- **✨ Atualização Automática**: As alterações na planilha são refletidas no aplicativo em tempo real, sem precisar recarregar a página.
- **✨ Upload de Imagens**: Envie fotos de produtos diretamente da câmera ou galeria do celular para o Imgur e atualize sua planilha com o link gerado.

---

## 🚀 Passo-a-passo para Configuração e Deploy

Siga estes 2 passos para ter seu aplicativo no ar.

### Passo 1: Configurar a Planilha Google

1.  **Crie sua Planilha**:
    *   Acesse o Google Sheets e crie uma planilha em branco.
    *   Crie as abas conforme descrito na seção "Estrutura da Planilha" abaixo.
    *   Esta será a sua base de dados. Preencha com seus próprios produtos, categorias, etc.

2.  **Nomes das Abas (Tabs)**:
    *   A nova versão do script é mais flexível! Se sua aba de entregas se chama "Entregas" em vez de "Bairros", o sistema irá encontrá-la.
    *   No entanto, é **altamente recomendado** manter os nomes das abas do modelo para garantir total compatibilidade: `Configurações`, `Itens`, `Categorias`, `Horários`, `Bairros`, `Cupons`, `Pedidos`.

3.  **Configurar Fuso Horário, Atualização e Upload de Imagens**:
    *   Na aba `Configurações`, você pode ajustar parâmetros importantes do aplicativo.

    *   **Fuso Horário (Obrigatório)**: Para garantir que o status "Aberto/Fechado" da loja seja sempre preciso, você **deve** configurar o fuso horário.
        *   Na coluna `key`, coloque `timezone_offset_utc`.
        *   Na coluna `value`, coloque o deslocamento da sua região em relação ao UTC (ex: `-3` para Brasília, `0` para Portugal).

    *   **Atualização Automática (Opcional)**: O aplicativo verifica por mudanças na planilha automaticamente. Você pode controlar a frequência.
        *   Na coluna `key`, adicione `intervalo_atualizacao_segundos`.
        *   Na coluna `value`, coloque o número de segundos (ex: `30` para 30 segundos, `60` para um minuto). O padrão é 30 segundos.

    *   **Upload de Imagens com Imgur (Opcional, mas Recomendado)**: Para ativar o envio de fotos de produtos diretamente do app.
        1.  Acesse `https://api.imgur.com/oauth2/addclient` para registrar seu aplicativo no Imgur.
        2.  Preencha o formulário:
            *   **Application name**: `WebApp Supermercado` (ou o nome que preferir).
            *   **Authorization type**: Escolha `Anonymous usage without user authorization`.
            *   **Authorization callback URL**: Deixe em branco.
            *   **Email** e **Description**: Preencha com seus dados.
        3.  Após enviar, o Imgur fornecerá um **Client ID**. Copie este valor.
        4.  Na sua planilha, na aba `Configurações`, adicione uma nova linha:
            *   Na coluna `key`, coloque `imgur_client_id`.
            *   Na coluna `value`, cole o **Client ID** que você copiou.

### Passo 2: Criar o Proxy com Google Apps Script e Conectar ao App

Para ler e escrever na sua planilha de forma segura, sem expor chaves de API no frontend, usaremos um Google Apps Script como intermediário.

1.  **Abra o Editor de Script**:
    *   Na sua planilha, vá em `Extensões` > `Apps Script`.
    *   Um novo projeto de script será aberto. Apague todo o código existente.

2.  **Cole o Código do Script (Versão Definitiva e Inteligente)**:
    *   Copie o código abaixo e cole no editor do Apps Script. **Se você já tinha um script, substitua-o por este.**

    ```javascript
    // Este script foi atualizado para detectar automaticamente a planilha à qual está vinculado!
    // Não é mais necessário usar SPREADSHEET_ID.

    // Mapeamento que torna o script mais robusto. Ele procura pela aba usando o nome principal
    // (a chave, ex: "Bairros") e, se não encontrar, tenta os nomes alternativos no array.
    const SHEET_NAME_MAPPING = {
      "Configurações": ["Configurações", "Configuracoes", "Config"],
      "Itens": ["Itens", "Produtos"],
      "Categorias": ["Categorias", "Setores"],
      "Horários": ["Horários", "Horarios", "Funcionamento"],
      "Bairros": ["Bairros", "Entregas", "Taxas", "Fretes", "Regiões", "Regioes"],
      "Cupons": ["Cupons", "Cupom"],
      "Pedidos": ["Pedidos"]
    };

    // Função auxiliar para encontrar uma aba na planilha tentando vários nomes possíveis.
    function findSheetByName(spreadsheet, canonicalName) {
      const possibleNames = SHEET_NAME_MAPPING[canonicalName] || [canonicalName];
      for (const name of possibleNames) {
        const sheet = spreadsheet.getSheetByName(name);
        if (sheet) {
          Logger.log(`Sucesso: Aba para '${canonicalName}' encontrada com o nome '${name}'.`);
          return sheet;
        }
      }
      Logger.log(`AVISO: Não foi possível encontrar a aba para '${canonicalName}'. Nomes tentados: ${possibleNames.join(', ')}`);
      return null;
    }

    function doGet(e) {
      const action = e && e.parameter && e.parameter.action;

      if (action === 'getTime') {
        return ContentService.createTextOutput(JSON.stringify({ "server_time_utc": new Date().toISOString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      if (action === 'readAll') {
        return readAllData();
      }
      
      return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Ação inválida ou ausente. Use ?action=readAll ou ?action=getTime" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    function doPost(e) {
      try {
        const requestData = JSON.parse(e.postData.contents);
        if (requestData.action === 'writeOrder') {
          return writeOrder(requestData.order);
        }
        throw new Error("Ação inválida na requisição POST");
      } catch (error) {
        Logger.log(`POST Error: ${error.toString()}`);
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    function readAllData() {
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        if (!ss) throw new Error("O script deve estar vinculado a uma planilha. Vá em Extensões > Apps Script na sua planilha.");
        
        const responseData = {};

        // Itera sobre os nomes canônicos e busca a aba correspondente na planilha.
        Object.keys(SHEET_NAME_MAPPING).forEach(canonicalName => {
          const sheet = findSheetByName(ss, canonicalName);
          if (sheet) {
            // getDisplayValues() garante que os dados (datas, horas, moeda) sejam enviados
            // como texto (string), exatamente como aparecem na planilha, evitando erros de tipo.
            responseData[canonicalName] = sheet.getDataRange().getDisplayValues();
          } else {
            responseData[canonicalName] = []; // Retorna um array vazio se a aba não for encontrada.
          }
        });
        
        return ContentService.createTextOutput(JSON.stringify(responseData)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        Logger.log(`readAllData Error: ${error.toString()}`);
        return ContentService.createTextOutput(JSON.stringify({ "error": error.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    function normalizeHeader(header) {
      if (header === null || header === undefined) return '';
      return String(header)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ç/g, "c")
        .replace(/ /g, '_');
    }

    function writeOrder(order) {
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pedidosSheet = findSheetByName(ss, "Pedidos");
        
        if (!pedidosSheet) {
          throw new Error("Aba 'Pedidos' (ou similar) não encontrada.");
        }
        
        const headers = pedidosSheet.getRange(1, 1, 1, pedidosSheet.getLastColumn()).getValues()[0];
        const normalizedHeaders = headers.map(normalizeHeader);
        
        // Constrói a nova linha na ordem correta dos cabeçalhos da planilha
        const newRow = normalizedHeaders.map(headerKey => {
            return order.hasOwnProperty(headerKey) ? order[headerKey] : "";
        });

        pedidosSheet.appendRow(newRow);
        
        return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Pedido registrado." }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        Logger.log(`writeOrder Error: ${error.toString()}`);
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    ```

3.  **Obtenha o ID da Planilha**:
    *   Olhe a URL da sua planilha. Ela se parece com: `https://docs.google.com/spreadsheets/d/ID_DA_PLANILHA/edit`
    *   Copie o valor de `ID_DA_PLANILHA`.
    *   No código do script, substitua `COLE_O_ID_DA_SUA_PLANILHA_AQUI` pelo ID que você copiou.

4.  **Implante o Script como um Aplicativo Web**:
    *   Clique em **Implantar** (no canto superior direito) > **Nova implantação**.
    *   Clique no ícone de engrenagem (⚙️) ao lado de "Selecionar tipo" e escolha **App da Web**.
    *   Na configuração, preencha:
        *   **Descrição**: `API do Supermercado` (ou o que preferir).
        *   **Executar como**: `Eu (seu@email.com)`.
        *   **Quem pode acessar**: **Qualquer pessoa**. (Isso é crucial para que o app possa acessar os dados).
    *   Clique em **Implantar**.
    *   **Autorize o acesso**: O Google pedirá permissão para que o script acesse suas planilhas. Clique em "Revisar permissões", escolha sua conta, clique em "Avançado", e depois em "Acessar (nome do projeto) (não seguro)" e "Permitir".
    *   **Copie a URL do App da Web**: Após a implantação, uma URL será exibida. Copie-a. Esta é a sua URL da API.
    *   **PARA ATUALIZAR**: Se você já implantou antes, use **Implantar > Gerenciar implantações**, clique no lápis (✏️), escolha **Nova versão** e clique em **Implantar**.

5.  **Cole a URL no Aplicativo**:
    *   Ao abrir o aplicativo pela primeira vez, ele mostrará uma tela de configuração.
    *   **Cole a URL do App da Web** que você copiou no passo anterior no campo indicado e clique em "Conectar".

---

## Como Funciona

### Registro de Pedidos

Quando um cliente clica em "Enviar Pedido por WhatsApp", duas coisas acontecem:
1.  O aplicativo envia os detalhes do pedido para o seu Google Apps Script.
2.  O script adiciona uma nova linha na aba `Pedidos` da sua planilha.
3.  Se o registro for bem-sucedido, o aplicativo abre o WhatsApp com uma mensagem pré-formatada.

### Exemplo da Mensagem do WhatsApp

```
🛒 *Novo Pedido – Supermercado Bom Preço* 🛒

👤 *Cliente:* Maria Oliveira
📱 *Telefone:* (11) 91234-5678
🏠 *Endereço:* Rua das Flores, 321 - Bela Vista - CEP: 01311-000
📍 *Bairro:* Bela Vista – Taxa de entrega: R$ 5,00
📦 *Opção:* Delivery

────────────────────────────
🧾 *Itens do Pedido:*

• Café Tradicional (500g) – R$ 22,50 × 1 = R$ 22,50
• Leite Integral (1L) – R$ 4,99 × 2 = R$ 9,98

────────────────────────────
💰 *Resumo:*
Subtotal: R$ 32,48
Frete: R$ 5,00
🔻 *Total a pagar: R$ 37,48*

────────────────────────────
💳 *Forma de pagamento:* PIX
🔑 Chave PIX: supermercado@bompreco.com.br

💬 *Observações:* "Por favor, entregar após as 19h"
```