import React, { useContext, useState } from 'react';
import { Product } from '../types';
import { AppContext } from '../context/AppContext';
import { PlusIcon, MinusIcon, ArrowLeftIcon, ArrowRightIcon, UploadIcon, SpinnerIcon } from './Icons';
import { uploadImageToImgur } from '../services/imageService';
import LazyImage from './LazyImage';

interface ProductCardProps {
  product: Product;
  // A propriedade quantityInCart foi removida para que o card busque a informação diretamente.
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const context = useContext(AppContext);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  if (!context) return null;
  // O card agora acessa o 'cart' e 'config' diretamente para se manter sempre atualizado.
  const { addToCart, updateQuantity, cart, config, imgurClientId } = context;

  const logoUrl = config.find(c => ['foto_url_logomarca', 'logo', 'logomarca'].includes(c.key))?.value || 'https://i.imgur.com/F1jQ3k6.png';

  const variant = product.variants[0]; // Default variant

  // A lógica para calcular a quantidade agora vive dentro do próprio card.
  const cartItem = variant 
    ? cart.find(item => item.product.sku === product.sku && item.variant.size === variant.size)
    : undefined;
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  const price = Number(variant?.price) || 0;

  const handleAddToCart = () => {
    if (variant) {
      addToCart(product, variant);
    }
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !imgurClientId) return;

    setIsUploading(true);
    
    try {
        const link = await uploadImageToImgur(file, imgurClientId);
        setUploadedImageUrl(link);
        prompt(
            "✅ Imagem enviada! Copie este link e cole na coluna de fotos da sua planilha para salvar a alteração:",
            link
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        alert(`Erro ao enviar imagem: ${errorMessage}`);
    } finally {
        setIsUploading(false);
    }
  };

  const formatCurrency = (value: any) => (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Carousel logic
  const hasImages = product.foto_urls && product.foto_urls.length > 0;
  const hasMultipleImages = hasImages && product.foto_urls.length > 1;

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentImageIndex(prev => (prev + 1) % product.foto_urls.length);
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentImageIndex(prev => (prev - 1 + product.foto_urls.length) % product.foto_urls.length);
  };

  return (
    <div 
      className={`bg-white rounded-lg shadow-md overflow-hidden flex flex-col transition-all duration-300 hover:scale-105 ${quantityInCart > 0 ? 'ring-2' : ''}`}
      style={{ '--tw-ring-color': quantityInCart > 0 ? 'var(--color-primary, #4F46E5)' : 'transparent' } as React.CSSProperties}
    >
      <div className="relative w-full h-48 bg-gray-100 flex items-center justify-center group overflow-hidden">
        {isUploading ? (
            <div className="flex flex-col items-center justify-center text-gray-500">
                <SpinnerIcon className="w-12 h-12" style={{ color: 'var(--color-primary)' }} />
                <span className="text-sm font-semibold mt-2">Enviando...</span>
            </div>
        ) : uploadedImageUrl ? (
             <LazyImage 
                src={uploadedImageUrl} 
                alt={product.item} 
                className="w-full h-full object-contain"
            />
        ) : hasImages ? (
          <>
            <LazyImage 
              src={product.foto_urls[currentImageIndex]} 
              alt={product.item} 
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
              placeholderSrc={logoUrl}
            />
             {hasMultipleImages && (
              <>
                <button 
                  onClick={handlePrevImage}
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-10 bg-black/30 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Imagem anterior"
                >
                  <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleNextImage}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-10 bg-black/30 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Próxima imagem"
                >
                  <ArrowRightIcon className="w-5 h-5" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {product.foto_urls.map((_, index) => (
                    <div 
                      key={index} 
                      className={`w-2 h-2 rounded-full transition-colors ${index === currentImageIndex ? 'bg-white ring-1 ring-black/50' : 'bg-black/40'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <img 
              src={logoUrl} 
              alt="Logomarca" 
              className="w-1/2 h-1/2 object-contain opacity-20"
            />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              {imgurClientId ? (
                <label 
                  htmlFor={`upload-${product.sku}`}
                  className="flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-400 rounded-lg p-4 bg-white/50 cursor-pointer hover:bg-white/80 transition-colors w-full h-full"
                  role="button"
                  aria-label="Adicionar foto do produto"
                >
                  <UploadIcon className="w-8 h-8" />
                  <span className="text-xs font-semibold mt-1 text-center">Adicionar foto</span>
                </label>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 cursor-default text-center">
                    <UploadIcon className="w-8 h-8" />
                    <span className="text-xs mt-1">Sem imagem</span>
                </div>
              )}
            </div>
            {imgurClientId && (
                <input
                    id={`upload-${product.sku}`}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                />
            )}
          </>
        )}
        {variant?.size.toLowerCase() === 'kg' && quantityInCart > 0 && (
            <div className="absolute top-0 right-0 overflow-hidden w-24 h-24 pointer-events-none z-20">
                <div className="absolute top-4 -right-6 w-32 bg-blue-500 text-white text-center py-1 text-xs font-bold transform rotate-45 shadow-sm">
                    {quantityInCart < 1 ? `${(quantityInCart * 1000).toFixed(0)}g` : `${quantityInCart.toFixed(3).replace(/\.?0+$/, '')}kg`}
                </div>
            </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-bold text-gray-900 truncate">{product.item}</h3>
        {product.descricao && <p className="text-sm text-gray-600 mt-1 flex-grow">{product.descricao}</p>}
        {product.observacao && <p className="text-xs text-gray-500 mt-1 italic">{product.observacao}</p>}
        <div className="mt-4 flex justify-between items-center">
          <p className="text-xl font-bold" style={{ color: 'var(--color-primary, #4F46E5)' }}>
            {formatCurrency(price)}
          </p>
          <div className="flex items-center gap-2">
            <button 
                onClick={() => {
                    if (quantityInCart > 0 && variant) {
                        const isKg = variant.size.toLowerCase() === 'kg';
                        const step = isKg ? 0.05 : 1;
                        updateQuantity(product.sku, variant.size, quantityInCart - step);
                    }
                }}
                className={`w-10 h-10 rounded-full text-white flex items-center justify-center transition-transform ${quantityInCart > 0 ? 'bg-red-500 hover:scale-110' : 'bg-red-300 cursor-not-allowed'}`}
                aria-label="Remover do carrinho"
                disabled={quantityInCart === 0}
            >
                <MinusIcon className="w-6 h-6" />
            </button>
            <div className="relative">
              <button 
                onClick={handleAddToCart}
                className="w-10 h-10 rounded-full text-white flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: 'var(--color-buttons, var(--color-primary, #4F46E5))' }}
                aria-label="Adicionar ao carrinho"
              >
                <PlusIcon className="w-6 h-6" />
              </button>
              {quantityInCart > 0 && (!variant || variant.size.toLowerCase() !== 'kg') && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-auto min-w-[1.5rem] px-1 flex items-center justify-center border-2 border-white pointer-events-none">
                      {quantityInCart}
                  </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
