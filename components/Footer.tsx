

import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';

const Footer: React.FC = () => {
    const context = useContext(AppContext);

    if (!context) return null;
    const { config, loadData, scriptUrl } = context;

    const storeName = config.find(c => c.key === 'nome_empresa')?.value || 'Seu Supermercado';
    const address = config.find(c => c.key === 'endereco')?.value || '';
    const whatsapp = config.find(c => c.key === 'whatsapp')?.value || '';

    return (
        <footer className="text-white p-6 mt-8" style={{ backgroundColor: 'var(--color-footer, var(--color-primary, #4F46E5))' }}>
            <div className="container mx-auto text-center">
                <div>
                    <h3 className="text-xl font-bold">{storeName}</h3>
                    {address && <p className="text-sm mt-2">{address}</p>}
                    {whatsapp && <p className="text-sm mt-1">WhatsApp: {whatsapp}</p>}
                </div>
                <div className="flex flex-col items-center gap-4 mt-6">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => loadData()}
                        className="text-xs opacity-60 hover:opacity-100 flex items-center justify-center gap-1 border border-white/30 px-3 py-1 rounded-full transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                        Sincronizar Planilha
                      </button>
                      <button 
                        onClick={context.clearScriptUrl}
                        className="text-xs opacity-60 hover:opacity-100 flex items-center justify-center gap-1 border border-white/30 px-3 py-1 rounded-full transition-all"
                      >
                        Trocar Planilha
                      </button>
                    </div>
                    
                    {scriptUrl && (
                      <div className="text-[10px] opacity-30 max-w-xs truncate" title={scriptUrl}>
                        URL do Script: {scriptUrl}
                      </div>
                    )}
                </div>
            </div>
        </footer>
    );
};

export default Footer;