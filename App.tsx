import React, { useContext, useEffect } from 'react';
import { AppContext } from './context/AppContext';
import Header from './components/Header';
import ProductList from './components/ProductList';
import Cart from './components/Cart';
import Loader from './components/Loader';
import Footer from './components/Footer';
import OrderHistory from './components/OrderHistory';

const App: React.FC = () => {
  const context = useContext(AppContext);

  useEffect(() => {
    if (context && context.config.length > 0) {
      const primaryColor = context.config.find(c => ['cor_primaria', 'cores_principais', 'cor_principal'].includes(c.key))?.value || '#4F46E5';
      const secondaryColor = context.config.find(c => ['cor_secundaria'].includes(c.key))?.value || '#FFCC00';
      const buttonColor = context.config.find(c => ['cor_botoes', 'cor_botao'].includes(c.key))?.value || primaryColor;
      const footerColor = context.config.find(c => ['cor_rodape', 'cor_do_rodape'].includes(c.key))?.value || primaryColor;
      
      const style = document.createElement('style');
      style.innerHTML = `
        :root {
          --color-primary: ${primaryColor};
          --color-secondary: ${secondaryColor};
          --color-buttons: ${buttonColor};
          --color-footer: ${footerColor};
        }
      `;
      document.head.appendChild(style);
      
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', primaryColor);
      }
    }
    
    // Add animation styles for the notification toast
    const animationStyleId = 'app-animation-styles';
    if (!document.getElementById(animationStyleId)) {
      const animationStyle = document.createElement('style');
      animationStyle.id = animationStyleId;
      animationStyle.innerHTML = `
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; transform: translateY(-20px) translateX(-50%); }
          10%, 90% { opacity: 1; transform: translateY(0) translateX(-50%); }
        }
        .animate-fade-in-out {
          animation: fadeInOut 4s ease-in-out forwards;
        }
      `;
      document.head.appendChild(animationStyle);
    }
    
  }, [context?.config]);

  if (!context) {
    return <Loader text="Initializing App..." />;
  }

  const { loading, error, updateNotification, loadData, scriptUrl, clearScriptUrl } = context;

  if (loading) {
    return <Loader text="Carregando dados da loja..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50 text-red-700 p-4">
        <div className="text-center p-8 border border-red-200 rounded-lg bg-white shadow-lg max-w-lg w-full">
          <h1 className="text-2xl font-bold mb-4 text-red-800">Ocorreu um erro na configuração</h1>
          <div className="text-left p-4 bg-red-50 border border-red-200 rounded-md my-4">
            <p className="whitespace-pre-wrap font-mono text-sm text-red-900">{error}</p>
          </div>
          <p className="mt-4 text-sm text-gray-600">Por favor, verifique se a sua planilha Google está configurada corretamente seguindo o `README.md`, cheque a URL do script e as permissões de compartilhamento, e depois recarregue a página.</p>
          {/* ACRESCENTADO: Botões para tentar novamente ou reconfigurar a URL. */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => loadData()}
              className="mt-6 px-6 py-2 rounded-full text-white font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: 'var(--color-buttons, var(--color-primary, #4F46E5))' }}
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      {updateNotification && (
        <div 
          className="fixed top-20 left-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-fade-in-out"
          role="alert"
          aria-live="assertive"
        >
          <p>{updateNotification}</p>
        </div>
      )}
      <Header />
      <main className="container mx-auto p-4 pb-24">
        <ProductList />
      </main>
      <Footer />
      <Cart />
      <OrderHistory />
    </div>
  );
};

export default App;