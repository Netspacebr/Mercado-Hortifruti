import React, { useContext, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { AppContext } from '../context/AppContext';
import ProductCard from './ProductCard';
import { OfferIcon, ArrowLeftIcon, ArrowRightIcon } from './Icons';

const FeaturedProducts: React.FC = () => {
  const context = useContext(AppContext);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  if (!context) return null;
  // O 'cart' foi removido daqui; o ProductCard agora o acessa diretamente.
  const { products } = context;

  const featuredProducts = useMemo(() => {
    // FIX: Changed filter keyword from "destaque" to "oferta"
    return products.filter(product => 
      (product.classificacao || '').toLowerCase().includes('oferta')
    );
  }, [products]);

  const checkScrollability = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const hasOverflow = el.scrollWidth > el.clientWidth;
      setCanScrollLeft(el.scrollLeft > 5); // 5px tolerance
      // Use a small tolerance for floating point inaccuracies
      setCanScrollRight(hasOverflow && el.scrollLeft < (el.scrollWidth - el.clientWidth - 5));
    }
  }, []);

  // Check scrollability when products load or window resizes
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      checkScrollability();
      window.addEventListener('resize', checkScrollability);
      
      const observer = new MutationObserver(checkScrollability);
      observer.observe(el, { childList: true, subtree: true });

      return () => {
        window.removeEventListener('resize', checkScrollability);
        observer.disconnect();
      };
    }
  }, [featuredProducts, checkScrollability]);


  const scroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = el.clientWidth * 0.8; // Scroll by 80% of the visible width
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (featuredProducts.length === 0) {
    return null;
  }

  return (
    <section className="relative border border-gray-200 rounded-lg p-4 my-4">
      {/* FIX: Renamed section and changed icon */}
      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <OfferIcon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
        Ofertas da Semana
      </h2>

      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white rounded-full p-1 shadow-md transition-opacity"
          aria-label="Rolar para a esquerda"
        >
          <ArrowLeftIcon className="w-6 h-6 text-gray-700" />
        </button>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={checkScrollability}
        className="flex overflow-x-auto space-x-4 pb-2 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Hide scrollbar
      >
        {featuredProducts.map(product => (
          <div key={product.sku} className="flex-shrink-0 w-48 sm:w-56">
            {/* A propriedade quantityInCart foi removida; o Card agora é autônomo. */}
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white rounded-full p-1 shadow-md transition-opacity"
          aria-label="Rolar para a direita"
        >
          <ArrowRightIcon className="w-6 h-6 text-gray-700" />
        </button>
      )}
    </section>
  );
};

export default FeaturedProducts;