import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import ProductCard from './ProductCard';
import CategoryFilter from './CategoryFilter';
import FeaturedProducts from './FeaturedProducts';
import { SearchIcon } from './Icons'; // Import SearchIcon

const ProductList: React.FC = () => {
  const context = useContext(AppContext);

  if (!context) return null;
  // O 'cart' foi removido daqui; o ProductCard agora o acessa diretamente.
  const { products, searchTerm, setSearchTerm, selectedCategory } = context;

  const filteredProducts = useMemo(() => {
    // FIX: Corrected the invalid regex range (\u3000 to \u0300) to prevent a SyntaxError.
    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normalizedSearchTerm = normalize(searchTerm);

    return products
      .filter(product => {
        const matchesCategory = selectedCategory === 'all' || (product.categoria || '').includes(selectedCategory);

        const matchesSearch = searchTerm === '' ||
          normalize(product.item || '').includes(normalizedSearchTerm) ||
          normalize(product.descricao || '').includes(normalizedSearchTerm) ||
          normalize(product.categoria || '').includes(normalizedSearchTerm);
          
        return matchesCategory && matchesSearch;
      });
  }, [products, searchTerm, selectedCategory]);

  return (
    <div>
      <CategoryFilter />
      
      {/* New Search Bar Position */}
      <div className="my-4 relative">
        <input
          type="text"
          placeholder="Buscar produtos..."
          className="w-full py-2 pl-10 pr-4 rounded-full border bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-opacity-50"
          style={{ borderColor: 'var(--color-secondary, #FFCC00)', '--tw-ring-color': 'var(--color-secondary, #FFCC00)' } as React.CSSProperties}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="h-5 w-5 text-gray-400" />
        </div>
      </div>

      <FeaturedProducts />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-6">
        {filteredProducts.map(product => (
          // A propriedade quantityInCart foi removida; o Card agora é autônomo.
          <ProductCard key={product.sku} product={product} />
        ))}
      </div>
      {filteredProducts.length === 0 && (
        <div className="text-center py-16 text-gray-500 col-span-full">
            <p className="text-xl font-semibold">Nenhum produto encontrado.</p>
            {searchTerm ? (
                <p className="mt-2">Não encontramos resultados para "<strong>{searchTerm}</strong>".</p>
            ) : (
                <p className="mt-2">Tente selecionar outra categoria.</p>
            )}
        </div>
      )}
    </div>
  );
};

export default ProductList;