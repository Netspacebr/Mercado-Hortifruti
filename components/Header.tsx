import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';

const Header: React.FC = () => {
  const context = useContext(AppContext);
  const [shareText, setShareText] = useState('Compartilhar');

  if (!context) return null;

  const { config, isStoreOpen } = context;

  // ACRESCENTADO: Procura por uma cor específica para o cabeçalho.
  // Se não encontrar, usará a cor primária do tema.
  const headerColor = config.find(c => ['cor_header', 'cor_cabecalho', 'cor_do_header'].includes(c.key))?.value;

  // FIX: Made key lookup more flexible. This works because keys are now pre-normalized.
  // UPDATE: Replaced the Google Drive fallback with the user's new Imgur direct link.
  const logoUrl = config.find(c => ['foto_url_logomarca', 'logo', 'logomarca'].includes(c.key))?.value || 'https://i.imgur.com/F1jQ3k6.png';
  const storeName = config.find(c => ['nome_empresa', 'nome_da_loja', 'nome_do_mercado'].includes(c.key))?.value || 'Supermercado App';
  
  const storeStatus = isStoreOpen();

  const handleShare = async () => {
    let shareUrl = '';

    // 1. Best case: Access the top window's URL. This works when not in a cross-origin iframe.
    try {
      const topUrl = window.top.location.href;
      if (topUrl && !topUrl.startsWith('blob:')) {
        shareUrl = topUrl;
      }
    } catch (error) {
      // This is expected in the cross-origin preview environment.
      // We'll proceed to the next fallback.
      console.warn("Could not access top window's location. This is expected in a cross-origin iframe. Falling back...");
    }

    // 2. Fallback for preview environment: Use the iframe's origin.
    // This gives the base URL of the preview server, which is shareable.
    // It correctly resolves blob URLs to their origin.
    if (!shareUrl) {
      if (window.location.origin && window.location.origin !== 'null') {
          shareUrl = window.location.origin;
      }
    }
    
    // 3. Last resort fallback: document.referrer.
    // This can sometimes be empty or unreliable, so it's a final choice.
    if (!shareUrl) {
        if (document.referrer && !document.referrer.startsWith('blob:')) {
            shareUrl = document.referrer;
        }
    }

    // Final check. If we still couldn't find a valid URL, alert the user.
    if (!shareUrl || shareUrl.startsWith('blob:')) {
      alert("Não foi possível determinar o link compartilhável. Por favor, copie a URL da barra de endereço do seu navegador.");
      return;
    }
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareText('Copiado!');
      setTimeout(() => setShareText('Compartilhar'), 2000);
    } catch (err) {
      console.error('Falha ao copiar o link:', err);
      alert('Não foi possível copiar o link. Por favor, copie a URL da barra de endereço do seu navegador.');
    }
  };


  return (
    <header style={{ backgroundColor: headerColor || 'var(--color-primary, #4F46E5)' }} className="p-4 shadow-md sticky top-0 z-20">
      <div className="container mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex-shrink-0">
              {logoUrl && <img src={logoUrl} alt="Logomarca" className="h-16 w-16 rounded-md object-cover shadow-sm" />}
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{storeName}</h1>
              <div className="flex items-center text-white text-xs font-semibold mt-1">
                <span className={`w-3 h-3 rounded-full mr-2 ring-1 ring-white/50 ${storeStatus.isOpen ? 'bg-green-400' : 'bg-red-500'}`}></span>
                <span>{storeStatus.message}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleShare}
              className="px-4 py-2 rounded-full text-white text-sm font-semibold hover:bg-white/20 transition-colors border border-white/50 w-28 flex items-center justify-center"
              aria-label="Compartilhar loja"
            >
              {shareText}
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;