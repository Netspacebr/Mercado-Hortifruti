import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { TagIcon } from './Icons';

const CategoryFilter: React.FC = () => {
    const context = useContext(AppContext);

    if (!context) return null;
    const { categories, selectedCategory, setSelectedCategory } = context;

    const renderCategoryButton = (name: string, key: string) => {
        const isActive = selectedCategory === key;
        const baseClasses = "flex flex-shrink-0 items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-200";
        const activeClasses = "text-white shadow";
        const inactiveClasses = "bg-white text-gray-700 hover:bg-gray-200";
        
        return (
            <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
                style={{ backgroundColor: isActive ? 'var(--color-buttons, var(--color-primary))' : '' }}
            >
                <TagIcon className="w-4 h-4" />
                <span>{name}</span>
            </button>
        );
    };

    return (
        <div className="py-4">
            {/* Added a style tag to hide the scrollbar for a cleaner "invisible slider" look */}
            <style>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
            `}</style>
            <div className="flex gap-2 overflow-x-auto flex-nowrap no-scrollbar">
                {renderCategoryButton('Todas', 'all')}
                {categories.map(category => renderCategoryButton(category.titulo_exibicao || category.nome_categoria, category.nome_categoria))}
            </div>
        </div>
    );
}

export default CategoryFilter;