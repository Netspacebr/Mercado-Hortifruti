import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { Order } from '../types';
import { ReceiptIcon, CloseIcon, ArrowLeftIcon } from './Icons';

const OrderHistory: React.FC = () => {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const context = useContext(AppContext);

    if (!context) return null;
    const { orderHistory, isOrderHistoryOpen, setIsOrderHistoryOpen } = context;

    const formatCurrency = (value: any) => (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatDate = (dateString: string) => new Date(dateString).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    const handleViewOrder = (order: Order) => {
        setSelectedOrder(order);
    };

    const handleBackToList = () => {
        setSelectedOrder(null);
    };
    
    const handleClose = () => {
        setIsOrderHistoryOpen(false);
        // Delay resetting the selected order to prevent jarring UI shift during close animation
        setTimeout(() => setSelectedOrder(null), 300);
    }

    const renderOrderDetailView = () => {
        if (!selectedOrder) return null;

        const items = JSON.parse(selectedOrder.itens_json);

        return (
            <div className="flex flex-col h-full">
                <header className="flex items-center p-4 bg-white border-b sticky top-0 z-10">
                    <button onClick={handleBackToList} className="text-gray-500 hover:text-gray-800 mr-4" aria-label="Voltar para a lista">
                        <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Detalhes do Pedido</h2>
                        <p className="text-sm text-gray-500">
                            {formatDate(selectedOrder.data_hora)}
                        </p>
                    </div>
                </header>

                <div className="flex-grow p-4 space-y-4 overflow-y-auto bg-gray-100">
                    {/* Items */}
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                        <h3 className="font-semibold mb-2 text-gray-800">Itens</h3>
                        <div className="space-y-2 border-t pt-2">
                            {items.map((item: any, index: number) => (
                                <div key={index} className="flex justify-between items-start text-sm">
                                    <div className="flex-grow pr-2">
                                        <p className="font-semibold text-gray-700">
                                            {(() => {
                                                const isKg = item.tamanho?.toLowerCase() === 'kg';
                                                const qty = item.quantidade;
                                                const displayQty = isKg ? (qty < 1 ? `${(qty * 1000).toFixed(0)}g` : `${Number(qty).toFixed(3).replace(/\.?0+$/, '')}kg`) : `${qty}x`;
                                                return `${displayQty} ${item.item}`;
                                            })()}
                                        </p>
                                        {item.tamanho && item.tamanho.toLowerCase() !== 'kg' && <p className="text-gray-500">{item.tamanho}</p>}
                                    </div>
                                    <p className="text-gray-800 font-medium">{formatCurrency(item.preco_unitario * item.quantidade)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Customer & Delivery */}
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                        <h3 className="font-semibold mb-2 text-gray-800">Cliente e Entrega</h3>
                        <div className="space-y-1 text-sm text-gray-700 border-t pt-2">
                            <p><strong>Nome:</strong> {selectedOrder.cliente_nome}</p>
                            <p><strong>Telefone:</strong> {selectedOrder.telefone}</p>
                            <p><strong>Opção:</strong> {selectedOrder.retirada_ou_delivery}</p>
                            {selectedOrder.retirada_ou_delivery === 'Delivery' && (
                                <>
                                    <p><strong>Endereço:</strong> {selectedOrder.endereco}</p>
                                    <p><strong>Bairro:</strong> {selectedOrder.bairro}</p>
                                    {selectedOrder.cep && <p><strong>CEP:</strong> {selectedOrder.cep}</p>}
                                </>
                            )}
                        </div>
                    </div>
                    
                    {/* Payment & Summary */}
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                         <h3 className="font-semibold mb-2 text-gray-800">Resumo Financeiro</h3>
                         <div className="space-y-1 text-sm text-gray-700 border-t pt-2">
                            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(selectedOrder.subtotal)}</span></div>
                            {selectedOrder.retirada_ou_delivery === 'Delivery' && <div className="flex justify-between"><span>Frete</span><span>{formatCurrency(selectedOrder.frete)}</span></div>}
                            {selectedOrder.desconto > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span>-{formatCurrency(selectedOrder.desconto)}</span></div>}
                            <div className="flex justify-between font-bold text-base text-black pt-2 border-t mt-2"><span>Total</span><span>{formatCurrency(selectedOrder.total)}</span></div>
                        </div>
                        <div className="mt-4 pt-2 border-t">
                            <p className="text-sm text-gray-700"><strong>Pagamento:</strong> {selectedOrder.forma_pagamento}</p>
                            {selectedOrder.troco_para && <p className="text-sm text-gray-700"><strong>Troco para:</strong> {selectedOrder.troco_para}</p>}
                            {selectedOrder.observacoes && <p className="text-sm mt-2 text-gray-700"><strong>Observações:</strong> "{selectedOrder.observacoes}"</p>}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderOrderListView = () => (
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between p-4 bg-white border-b">
                <h2 className="text-xl font-bold text-gray-800">Seus Pedidos</h2>
                <button onClick={handleClose} className="text-gray-500 hover:text-gray-800" aria-label="Fechar histórico de pedidos">
                    <CloseIcon className="w-6 h-6" />
                </button>
            </header>
            
            {orderHistory.length === 0 ? (
                 <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500 p-4">
                    <ReceiptIcon className="w-16 h-16 mb-4 text-gray-300"/>
                    <h3 className="text-xl font-semibold">Nenhum pedido encontrado</h3>
                    <p className="mt-2">Seus pedidos recentes aparecerão aqui.</p>
                </div>
            ) : (
                <div className="flex-grow p-2 space-y-2 overflow-y-auto bg-gray-100">
                    {orderHistory.map(order => (
                        <button 
                            key={order.pedido_id} 
                            onClick={() => handleViewOrder(order)}
                            className="w-full text-left bg-white p-4 rounded-lg shadow-sm hover:bg-gray-100 transition-colors flex justify-between items-center"
                        >
                            <div>
                                <p className="font-bold text-primary">Pedido #{order.pedido_id.split('-')[1]}</p>
                                <p className="text-sm text-gray-500">{formatDate(order.data_hora)}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-medium">Enviado</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <>
            {isOrderHistoryOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={handleClose}>
                    <div
                        className="fixed top-0 right-0 h-full w-full max-w-md bg-gray-100 shadow-xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {selectedOrder ? renderOrderDetailView() : renderOrderListView()}
                    </div>
                </div>
            )}
        </>
    );
};

export default OrderHistory;
