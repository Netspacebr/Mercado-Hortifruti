// FIX: Imported Dispatch and SetStateAction to resolve React namespace errors.
import type { Dispatch, SetStateAction } from 'react';

export interface Config {
  seccao: string;
  key: string;
  value: string;
}

export interface Product {
  sku: string;
  item: string;
  categoria: string;
  descricao: string;
  preco: string;
  status: 'ativo' | 'inativo';
  classificacao: string;
  observacao: string;
  foto_urls: string[];
  variants: ProductVariant[];
}

export interface ProductVariant {
  size: string;
  price: number;
}

export interface Category {
  nome_categoria: string;
  titulo_exibicao: string;
  descricao: string;
  ordem: number;
  status: 'ativo' | 'inativo';
}

export interface Schedule {
  dia_semana: string;
  // EXACT LOGIC: Only look for 'inicio' and 'fim' as requested.
  inicio?: string;
  fim?: string;
}

export interface Neighborhood {
  bairro: string;
  taxa_entrega: number;
}

export interface Coupon {
  codigo: string;
  tipo: 'produto' | 'total' | 'frete';
  valor: string;
  produto_sku?: string;
  inicio: string;
  fim: string;
  status: 'ativo' | 'inativo';
}

export interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export interface Order {
    pedido_id: string;
    data_hora: string;
    cliente_nome: string;
    telefone: string;
    cep: string;
    endereco: string;
    bairro: string;
    itens_json: string;
    subtotal: number;
    frete: number;
    desconto: number;
    total: number;
    forma_pagamento: string;
    troco_para: string;
    retirada_ou_delivery: 'Retirada' | 'Delivery';
    observacoes: string;
}

export interface StoreStatus {
  isOpen: boolean;
  message: string;
}

export interface AppContextType {
  loading: boolean;
  error: string | null;
  config: Config[];
  products: Product[];
  categories: Category[];
  schedules: Schedule[];
  neighborhoods: Neighborhood[];
  coupons: Coupon[];
  cart: CartItem[];
  addToCart: (product: Product, variant: ProductVariant, quantity?: number) => void;
  updateQuantity: (sku: string, variantSize: string, newQuantity: number) => void;
  removeFromCart: (sku: string, variantSize: string) => void;
  clearCart: () => void;
  placeOrder: (orderDetails: Omit<Order, 'pedido_id' | 'data_hora' | 'itens_json' | 'subtotal' | 'frete' | 'desconto' | 'total'>) => Promise<{order: Order, error?: string}>;
  isStoreOpen: () => StoreStatus;
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  selectedCategory: string;
  setSelectedCategory: Dispatch<SetStateAction<string>>;
  orderHistory: Order[];
  isOrderHistoryOpen: boolean;
  setIsOrderHistoryOpen: Dispatch<SetStateAction<boolean>>;
  updateNotification: string;
  // FIX: Added coupon state management to the context to fix discount bug on order placement.
  couponCode: string;
  setCouponCode: Dispatch<SetStateAction<string>>;
  appliedCoupon: Coupon | null;
  couponMessage: string;
  applyCoupon: () => void;
  removeCoupon: () => void;
  loadData: () => Promise<void>;
  imgurClientId: string | null;
  // ACRESCENTADO: Gerenciamento da URL do script para permitir configuração pelo usuário.
  scriptUrl: string | null;
  setScriptUrl: (url: string) => void;
  clearScriptUrl: () => void;
}