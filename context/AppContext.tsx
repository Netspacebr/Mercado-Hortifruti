import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppContextType, Product, ProductVariant, Config, Category, Schedule, Neighborhood, Coupon, CartItem, Order, StoreStatus } from '../types';
import { fetchSheetData, postOrder, fetchServerTime } from '../services/googleSheetsService';

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxc3YKyaBHnb2gzojx2uuz6a_u4NRDzU2uJd1aNuhz4dAA_CfJWIvv_Pd9_r3kIotczgg/exec";

export const AppContext = createContext<AppContextType | null>(null);

// **A CORREÇÃO DEFINITIVA ESTÁ AQUI**:
// Esta função agora é muito mais robusta. Ela identifica o dia da semana
// corretamente, mesmo que haja variações na planilha (ex: "Sexta", "Sexta-feira", "sexta feira").
// Este era o bug final que fazia o status aparecer como "Fechado".
const normalizeDay = (day: string): string => {
  if (!day) return '';
  const lowerDay = day
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove accents first

  if (lowerDay.startsWith('seg')) return 'segunda';
  if (lowerDay.startsWith('ter')) return 'terca';
  if (lowerDay.startsWith('qua')) return 'quarta';
  if (lowerDay.startsWith('qui')) return 'quinta';
  if (lowerDay.startsWith('sex')) return 'sexta';
  if (lowerDay.startsWith('sab')) return 'sabado';
  if (lowerDay.startsWith('dom')) return 'domingo';

  return lowerDay.replace(/(-feira|\s)/g, ''); // Fallback for other cases
};


// Helper function to normalize time format for reliable string comparison.
// It's now more robust against malformed data from the sheet.
const normalizeTime = (time: string): string => {
  if (!time || typeof time !== 'string' || !time.includes(':')) return '';
  const parts = time.split(':');
  const hour = (parts[0] || '').trim().padStart(2, '0');
  const minute = (parts[1] || '').trim().padStart(2, '0');
  
  // Validate that we have two-digit numbers to prevent errors.
  if (hour.length !== 2 || minute.length !== 2 || isNaN(parseInt(hour)) || isNaN(parseInt(minute))) {
      return '';
  }
  return `${hour}:${minute}`;
};

// Automated diagnostic check to validate the Google Sheet configuration on load.
const runDiagnostics = (data: {
    config: Config[],
    products: Product[],
    categories: Category[],
    schedules: Schedule[],
    neighborhoods: Neighborhood[],
    coupons: Coupon[],
}): { critical: string[], warnings: string[] } => {
    const results = { critical: [] as string[], warnings: [] as string[] };
    const config = data.config || [];

    // Critical Checks
    if (!data.products || data.products.length === 0) {
        results.critical.push("Aba 'Itens' (ou 'Produtos') não encontrada ou vazia. A loja não pode funcionar sem produtos.");
    }
    if (!config || config.length === 0) {
        results.critical.push("Aba 'Configurações' não encontrada ou vazia. As configurações básicas da loja são necessárias.");
    }

    // Warnings
    if (config.length > 0) {
        const keys = config.map(c => c.key);
        if (!keys.some(k => ['nome_empresa', 'nome_da_loja', 'nome_do_mercado'].includes(k))) {
            results.warnings.push("A configuração 'nome_empresa' não foi encontrada. Um nome padrão será usado.");
        }
        if (!keys.includes('whatsapp')) {
            results.warnings.push("A configuração 'whatsapp' não foi encontrada. O envio de pedidos para o WhatsApp pode falhar.");
        }
    }

    if (!data.categories || data.categories.length === 0) {
        results.warnings.push("Aba 'Categorias' não encontrada ou vazia. O filtro por categorias pode não aparecer.");
    }
    
    if (!data.schedules || data.schedules.length === 0) {
        results.warnings.push("Aba 'Horários' não encontrada ou vazia. O status da loja (aberto/fechado) pode não funcionar corretamente e aparecerá como 'Fechado'.");
    }

    if (!data.neighborhoods || data.neighborhoods.length === 0) {
        results.warnings.push("Aba 'Bairros' (ou 'Entregas') não encontrada ou vazia. O cálculo de frete para delivery não funcionará.");
    }

    return results;
};


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Config[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
        const localData = localStorage.getItem('shoppingCart');
        return localData ? JSON.parse(localData) : [];
    } catch (error) {
        return [];
    }
  });
  const [orderHistory, setOrderHistory] = useState<Order[]>(() => {
    try {
        const localData = localStorage.getItem('orderHistory');
        return localData ? JSON.parse(localData) : [];
    } catch (error) {
        console.error("Failed to parse order history from localStorage", error);
        return [];
    }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [updateNotification, setUpdateNotification] = useState('');

  // State for time synchronization to ensure status is always accurate
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // FIX: Lifted coupon state from Cart.tsx to context to fix discount bug.
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponMessage, setCouponMessage] = useState('');
  
  const [imgurClientId, setImgurClientId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('orderHistory', JSON.stringify(orderHistory));
  }, [orderHistory]);

  // Effect to keep the current time ticking for status updates
  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timerId);
  }, []);

  // Effect to synchronize with server time
  useEffect(() => {
    const syncTime = async () => {
      if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "SUA_URL_AQUI") return; // Não tenta sincronizar se a URL não estiver configurada
      try {
        const serverTimeStr = await fetchServerTime(APPS_SCRIPT_URL);
        const serverTime = new Date(serverTimeStr).getTime();
        const clientTime = new Date().getTime();
        setServerTimeOffset(serverTime - clientTime);
        console.log(`Time synchronized. Offset is ${serverTime - clientTime}ms.`);
      } catch (e) {
        console.error("Could not sync time with server. Using client time.", e);
        setServerTimeOffset(0);
      }
    };
    syncTime();
    const intervalId = setInterval(syncTime, 5 * 60 * 1000); // Re-sync every 5 minutes
    return () => clearInterval(intervalId);
  }, []);


  const loadData = useCallback(async () => {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "SUA_URL_AQUI") {
      setLoading(false);
      setError("Configure a constante APPS_SCRIPT_URL no topo de AppContext.tsx.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSheetData(APPS_SCRIPT_URL);
      
      const diagnosticResults = runDiagnostics(data);

      if (diagnosticResults.critical.length > 0) {
          const errorMsg = `Erros Críticos de Configuração:\n- ${diagnosticResults.critical.join('\n- ')}`;
          throw new Error(errorMsg);
      }
      
      if (diagnosticResults.warnings.length > 0) {
          console.warn(`[Diagnóstico da Loja] Avisos de Configuração:\n- ${diagnosticResults.warnings.join('\n- ')}`);
      }

      // **FIX**: Refined filtering. A product is only shown if it's 'ativo' AND 
      // belongs to at least one category that is also 'ativo'.
      const activeCategories = (data.categories || []).filter(c => c.status !== 'inativo');
      const activeCategoryNames = new Set(activeCategories.map(c => c.nome_categoria.toLowerCase().trim()));

      const filteredProducts = data.products.filter(p => {
        const isProductAtivo = p.status !== 'inativo';
        
        // Check if at least one of the product's categories is active
        const productCategories = (p.categoria || '').split('|').map(c => c.trim().toLowerCase()).filter(c => c !== '');
        
        // If the product has categories, at least one must be active.
        // If it has NO categories assigned, we only check the product's own status.
        const hasActiveCategory = productCategories.length === 0 || productCategories.some(cat => activeCategoryNames.has(cat));
        
        return isProductAtivo && hasActiveCategory;
      });

      console.log(`[Data Load] Products: ${data.products.length} total -> ${filteredProducts.length} active. Categories: ${data.categories.length} total -> ${activeCategories.length} active.`);

      setConfig(data.config);
      setProducts(filteredProducts);
      setCategories(activeCategories.sort((a,b) => a.ordem - b.ordem));
      setSchedules(data.schedules || []);
      setNeighborhoods(data.neighborhoods || []);
      setCoupons(data.coupons || []);
      setImgurClientId(data.config.find(c => c.key === 'imgur_client_id')?.value || null);

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Effect for polling for live updates from the Google Sheet
  useEffect(() => {
    if (loading || error || !APPS_SCRIPT_URL || APPS_SCRIPT_URL === "SUA_URL_AQUI") return; // Não executa se não houver URL

    const intervalConfig = config.find(c => ['intervalo_atualizacao_segundos', 'intervalo_atualizacao'].includes(c.key))?.value;
    let intervalSeconds = intervalConfig ? parseInt(intervalConfig, 10) : 30;

    if (isNaN(intervalSeconds) || intervalSeconds < 15) {
        intervalSeconds = 30;
    }

    const timerId = setInterval(async () => {
        console.log(`Verificando atualizações na planilha... (intervalo: ${intervalSeconds}s)`);
        try {
            const newData = await fetchSheetData(APPS_SCRIPT_URL);

            // **FIX**: Apply the same refined filtering logic during polling updates.
            const activeCats = (newData.categories || []).filter(c => c.status !== 'inativo');
            const activeCatNames = new Set(activeCats.map(c => c.nome_categoria.toLowerCase().trim()));

            const activeProds = newData.products.filter(p => {
                const isAtivo = p.status !== 'inativo';
                const productCats = (p.categoria || '').split('|').map(c => c.trim().toLowerCase()).filter(c => c !== '');
                const hasActiveCat = productCats.length === 0 || productCats.some(cat => activeCatNames.has(cat));
                return isAtivo && hasActiveCat;
            });

            const currentState = { config, products, categories, schedules, neighborhoods, coupons };
            const newState = {
                config: newData.config || [],
                products: activeProds,
                categories: activeCats.sort((a,b) => a.ordem - b.ordem),
                schedules: newData.schedules || [],
                neighborhoods: newData.neighborhoods || [],
                coupons: newData.coupons || [],
            };

            if (JSON.stringify(currentState) !== JSON.stringify(newState)) {
                console.log('Dados alterados. Atualizando o estado do app.');
                setConfig(newState.config);
                setProducts(newState.products);
                setCategories(newState.categories);
                setSchedules(newState.schedules);
                setNeighborhoods(newState.neighborhoods);
                setCoupons(newState.coupons);
                setImgurClientId(newState.config.find(c => c.key === 'imgur_client_id')?.value || null);

                setUpdateNotification('A loja foi atualizada com novas informações!');
                setTimeout(() => setUpdateNotification(''), 4000);
            }
        } catch (e) {
            console.error('Erro ao verificar atualizações:', e);
            if (e instanceof Error && e.message.includes('Não foi possível conectar')) {
                setError(e.message);
                clearInterval(timerId); 
            }
        }
    }, intervalSeconds * 1000);

    return () => clearInterval(timerId);
  }, [loading, error, config, products, categories, schedules, neighborhoods, coupons]);

  const addToCart = (product: Product, variant: ProductVariant, quantity?: number) => {
    const isKg = variant.size.toLowerCase() === 'kg';
    const defaultQuantity = isKg ? 0.05 : 1;
    const finalQuantity = quantity ?? defaultQuantity;

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.sku === product.sku && item.variant.size === variant.size);
      if (existingItem) {
        return prevCart.map(item =>
          item.product.sku === product.sku && item.variant.size === variant.size
            ? { ...item, quantity: Number((item.quantity + finalQuantity).toFixed(3)) }
            : item
        );
      }
      return [...prevCart, { product, variant, quantity: finalQuantity }];
    });
  };

  const updateQuantity = (sku: string, variantSize: string, newQuantity: number) => {
    // Para garantir que itens por kg não tenham erro de precisão no JS
    const formattedQuantity = Number(newQuantity.toFixed(3));
    if (formattedQuantity <= 0) {
      removeFromCart(sku, variantSize);
    } else {
      setCart(prevCart =>
        prevCart.map(item =>
          item.product.sku === sku && item.variant.size === variantSize
            ? { ...item, quantity: formattedQuantity }
            : item
        )
      );
    }
  };

  const removeFromCart = (sku: string, variantSize: string) => {
    setCart(prevCart => prevCart.filter(item => !(item.product.sku === sku && item.variant.size === variantSize)));
  };

  const clearCart = () => {
    setCart([]);
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponMessage('');
  };

  const applyCoupon = useCallback(() => {
    const coupon = coupons.find(c => (c.codigo || '').toLowerCase() === couponCode.toLowerCase() && c.status === 'ativo');
    if (coupon) {
      const now = new Date();
      const start = new Date(coupon.inicio);
      const end = new Date(coupon.fim);
      if (now >= start && now <= end) {
        setAppliedCoupon(coupon);
        setCouponMessage('Cupom aplicado com sucesso!');
      } else {
        setAppliedCoupon(null);
        setCouponMessage('Cupom expirado ou inválido.');
      }
    } else {
      setAppliedCoupon(null);
      setCouponMessage('Cupom inválido.');
    }
  }, [coupons, couponCode]);

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponMessage('');
  }, []);

  const placeOrder = async (orderDetails: Omit<Order, 'pedido_id' | 'data_hora' | 'itens_json' | 'subtotal' | 'frete' | 'desconto' | 'total'>): Promise<{order: Order, error?: string}> => {
      const orderId = `${new Date().getTime()}-${Math.random().toString(36).substr(2, 5)}`;
      const orderTime = new Date().toISOString();

      const subtotal = cart.reduce((total, item) => total + item.variant.price * item.quantity, 0);
      const deliveryFee = orderDetails.retirada_ou_delivery === 'Delivery' 
        ? (neighborhoods.find(n => n.bairro === orderDetails.bairro)?.taxa_entrega || 0) 
        : 0;
      
      // FIX: Correctly calculate discount based on the applied coupon from context state
      let calculatedDiscount = 0;
      if (appliedCoupon) {
        const couponValue = parseFloat(appliedCoupon.valor.replace(',', '.'));
        switch (appliedCoupon.tipo) {
          case 'total':
            if (appliedCoupon.valor.includes('%')) {
              calculatedDiscount = subtotal * (couponValue / 100);
            } else {
              calculatedDiscount = couponValue;
            }
            break;
          case 'frete':
            if (appliedCoupon.valor.includes('%')) {
              calculatedDiscount = deliveryFee * (couponValue / 100);
            } else {
              calculatedDiscount = couponValue;
            }
            break;
          case 'produto':
            const targetItem = cart.find(item => item.product.sku === appliedCoupon.produto_sku);
            if (targetItem) {
              if (appliedCoupon.valor.includes('%')) {
                calculatedDiscount = (targetItem.variant.price * targetItem.quantity) * (couponValue / 100);
              } else {
                calculatedDiscount = couponValue;
              }
            }
            break;
        }
        calculatedDiscount = Math.max(0, Math.min(calculatedDiscount, subtotal + deliveryFee));
      }

      const total = subtotal + deliveryFee - calculatedDiscount;
      
      const order: Order = {
          ...orderDetails,
          pedido_id: orderId,
          data_hora: orderTime,
          itens_json: JSON.stringify(cart.map(item => ({ sku: item.product.sku, item: item.product.item, tamanho: item.variant.size, quantidade: item.quantity, preco_unitario: item.variant.price }))),
          subtotal,
          frete: deliveryFee,
          desconto: calculatedDiscount,
          total
      };
      
      setOrderHistory(prev => [order, ...prev]);

      try {
          if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "SUA_URL_AQUI") throw new Error("URL do script não configurada.");
          const response = await postOrder(order, APPS_SCRIPT_URL);
          if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Falha ao registrar pedido na planilha: ${errorText}`);
          }
          return { order };
      } catch (error) {
          console.error("Erro ao registrar pedido na planilha:", error);
          const errorMessage = "Não foi possível registrar seu pedido no sistema, mas ele será enviado via WhatsApp.";
          return { order, error: errorMessage };
      }
  };

  const isStoreOpen = useCallback((): StoreStatus => {
    const twentyFourHours = config.find(c => c.key === 'atender_24h')?.value?.toLowerCase() === 'sim';
    if (twentyFourHours) {
        return { isOpen: true, message: "Aberto" };
    }

    if (!schedules || schedules.length === 0) {
        return { isOpen: false, message: "Fechado" };
    }
    
    const getCorrectedDate = () => {
        const clientNow = currentTime.getTime();
        return new Date(clientNow + serverTimeOffset);
    };

    const correctedNow = getCorrectedDate();
    let currentDayName: string;
    let timeString: string;
    
    const utcOffsetSetting = config.find(c => ['timezone_offset_utc', 'utc_offset'].includes(c.key))?.value;
    const utcOffset = utcOffsetSetting ? parseFloat(utcOffsetSetting.replace(',', '.')) : NaN;

    if (!isNaN(utcOffset)) {
        const utcHour = correctedNow.getUTCHours();
        const utcMinute = correctedNow.getUTCMinutes();
        const utcDay = correctedNow.getUTCDay();
        let targetHour = utcHour + utcOffset;
        let targetDayIndex = utcDay;
        
        if (targetHour < 0) {
            targetHour += 24;
            targetDayIndex = (utcDay - 1 + 7) % 7;
        } else if (targetHour >= 24) {
            targetHour %= 24;
            targetDayIndex = (utcDay + 1) % 7;
        }

        const weekdayMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        currentDayName = weekdayMap[targetDayIndex];
        timeString = `${Math.floor(targetHour).toString().padStart(2, '0')}:${utcMinute.toString().padStart(2, '0')}`;
    } else {
        const timezoneValue = config.find(c => ['timezone', 'fuso_horario'].includes(c.key))?.value;
        const timezone = timezoneValue && timezoneValue.trim() ? timezoneValue : 'America/Sao_Paulo';
        
        let parts;
        try {
          parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
          }).formatToParts(correctedNow);
        } catch (e) {
          parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
          }).formatToParts(correctedNow);
        }

        const getPart = (partType: string) => parts.find(p => p.type === partType)?.value || '';
        const weekdayMap: { [key: string]: string } = { 'Sunday': 'domingo', 'Monday': 'segunda', 'Tuesday': 'terca', 'Wednesday': 'quarta', 'Thursday': 'quinta', 'Friday': 'sexta', 'Saturday': 'sabado' };
        currentDayName = weekdayMap[getPart('weekday')];
        const currentHour = getPart('hour');
        const finalHour = currentHour === '24' ? '00' : currentHour;
        timeString = `${finalHour}:${getPart('minute')}`;
    }

    // **A CORREÇÃO DEFINITIVA ESTÁ AQUI**:
    // Procura por 'dia_da_semana' (gerado a partir de "Dia da Semana") OU 'dia_semana'.
    // Isso torna o código resiliente ao nome exato do cabeçalho na planilha.
    const todaySchedule = schedules.find(s => {
        const dayValue = (s as any).dia_da_semana || s.dia_semana || '';
        return normalizeDay(dayValue) === currentDayName;
    });
    
    if (!todaySchedule) {
        return { isOpen: false, message: "Fechado" };
    }
    
    const normalizedStart = normalizeTime(todaySchedule.inicio || '');
    const normalizedEnd = normalizeTime(todaySchedule.fim || '');

    if (!normalizedStart || !normalizedEnd || (normalizedStart === '00:00' && normalizedEnd === '00:00')) {
        return { isOpen: false, message: "Fechado" };
    }
    
    const isOpen = (normalizedStart < normalizedEnd && timeString >= normalizedStart && timeString < normalizedEnd) || 
                   (normalizedStart > normalizedEnd && (timeString >= normalizedStart || timeString < normalizedEnd));
    
    if (isOpen) {
        return { isOpen: true, message: "Aberto" };
    }

    return { isOpen: false, message: "Fechado" };
  }, [schedules, config, serverTimeOffset, currentTime]);


  const value = {
    loading,
    error,
    config,
    products,
    categories,
    schedules,
    neighborhoods,
    coupons,
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    placeOrder,
    isStoreOpen,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    orderHistory,
    isOrderHistoryOpen,
    setIsOrderHistoryOpen,
    updateNotification,
    couponCode,
    setCouponCode,
    appliedCoupon,
    couponMessage,
    applyCoupon,
    removeCoupon,
    loadData,
    imgurClientId,
    scriptUrl: APPS_SCRIPT_URL,
    setScriptUrl: () => {},
    clearScriptUrl: () => {},
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};