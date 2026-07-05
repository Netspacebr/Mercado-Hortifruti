import React, { useState, useContext, useMemo, useCallback } from 'react';
import { AppContext } from '../context/AppContext';
import { TrashIcon, CloseIcon, WhatsAppIcon, PlusIcon, MinusIcon, CartIcon, LocationMarkerIcon, ChevronDownIcon, TagIcon } from './Icons';
import LazyImage from './LazyImage';

const Cart: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const context = useContext(AppContext);
  
  // Checkout state
  const [deliveryOption, setDeliveryOption] = useState<'Delivery' | 'Retirada'>('Delivery');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCEP, setCustomerCEP] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [customerChange, setCustomerChange] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState('copiar chave');
  const [isCouponInputVisible, setIsCouponInputVisible] = useState(false);


  if (!context) return null;
  const { 
    cart, 
    updateQuantity, 
    removeFromCart, 
    clearCart, 
    neighborhoods, 
    config, 
    placeOrder, 
    setIsOrderHistoryOpen,
    couponCode,
    setCouponCode,
    appliedCoupon,
    couponMessage,
    applyCoupon,
    removeCoupon
  } = context;

  const subtotal = cart.reduce((total, item) => total + item.variant.price * item.quantity, 0);

  const deliveryFee = useMemo(() => {
    if (deliveryOption === 'Retirada' || !selectedNeighborhood) return 0;
    const neighborhood = neighborhoods.find(n => n.bairro === selectedNeighborhood);
    return neighborhood ? Number(neighborhood.taxa_entrega) : 0;
  }, [deliveryOption, selectedNeighborhood, neighborhoods]);

  const discount = useMemo(() => {
    if (!appliedCoupon) return 0;
    let discountValue = 0;
    const couponValue = parseFloat(appliedCoupon.valor.replace(',', '.'));

    switch (appliedCoupon.tipo) {
      case 'total':
        if (appliedCoupon.valor.includes('%')) {
          discountValue = subtotal * (couponValue / 100);
        } else {
          discountValue = couponValue;
        }
        break;
      case 'frete':
        if (appliedCoupon.valor.includes('%')) {
          discountValue = deliveryFee * (couponValue / 100);
        } else {
          discountValue = couponValue;
        }
        break;
      case 'produto':
        const targetItem = cart.find(item => item.product.sku === appliedCoupon.produto_sku);
        if (targetItem) {
          if (appliedCoupon.valor.includes('%')) {
            discountValue = (targetItem.variant.price * targetItem.quantity) * (couponValue / 100);
          } else {
            discountValue = couponValue;
          }
        }
        break;
      default:
        break;
    }
    return Math.min(discountValue, subtotal + deliveryFee);
  }, [appliedCoupon, subtotal, deliveryFee, cart]);

  const total = subtotal + deliveryFee - discount;
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const formatCurrency = (value: any) => (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const pixKey = useMemo(() => {
    return config.find(c => ['chave_pix', 'chave'].includes(c.key))?.value || 'N/A';
  }, [config]);

  const generateWhatsAppMessage = useCallback(() => {
    const storeName = config.find(c => c.key === 'nome_empresa')?.value || 'Supermercado';
    
    const separator = '----';

    let message = `🛒 *Novo Pedido – ${storeName}* 🛒\n\n`;
    message += `👤 *Cliente:* ${customerName}\n`;
    message += `📱 *Telefone:* ${customerPhone}\n`;
    if (deliveryOption === 'Delivery') {
        message += `🏠 *Endereço:* ${customerAddress} - ${selectedNeighborhood} - CEP: ${customerCEP}\n`;
        message += `📍 *Bairro:* ${selectedNeighborhood} – Taxa de entrega: ${formatCurrency(deliveryFee)}\n`;
    }
    message += `📦 *Opção:* ${deliveryOption}\n\n`;
    message += `${separator}\n`;
    message += `🧾 *Itens do Pedido:*\n\n`;
    cart.forEach(item => {
        const isKg = item.variant.size.toLowerCase() === 'kg';
        const displayQty = isKg ? (item.quantity < 1 ? `${(item.quantity * 1000).toFixed(0)}g` : `${item.quantity.toFixed(3).replace(/\.?0+$/, '')}kg`) : item.quantity;
        message += `• ${item.product.item} (${item.variant.size}) – ${formatCurrency(item.variant.price)} × ${displayQty} = ${formatCurrency(item.variant.price * item.quantity)}\n`;
    });
    message += `\n${separator}\n`;
    message += `💰 *Resumo:*\n`;
    message += `Subtotal: ${formatCurrency(subtotal)}\n`;
    if (deliveryOption === 'Delivery') message += `Frete: ${formatCurrency(deliveryFee)}\n`;
    if (appliedCoupon) message += `Cupom aplicado: 🎟️ *${appliedCoupon.codigo}* → -${formatCurrency(discount)}\n`;
    message += `🔻 *Total a pagar: ${formatCurrency(total)}*\n\n`;
    message += `${separator}\n`;
    message += `💳 *Forma de pagamento:* ${paymentMethod}\n`;
    if (paymentMethod === 'PIX') message += `🔑 Chave PIX: ${pixKey}\n`;
    if (paymentMethod === 'Dinheiro' && customerChange) message += `💵 Troco para: ${formatCurrency(parseFloat(customerChange))}\n`;
    if (customerNotes) message += `\n💬 *Observações:* "${customerNotes}"\n`;

    return message;
  }, [config, customerName, customerPhone, customerAddress, selectedNeighborhood, customerCEP, deliveryOption, deliveryFee, cart, subtotal, appliedCoupon, discount, total, paymentMethod, customerChange, customerNotes, pixKey]);
  
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const orderDetails = {
        cliente_nome: customerName,
        telefone: customerPhone,
        cep: customerCEP,
        endereco: customerAddress,
        bairro: selectedNeighborhood,
        forma_pagamento: paymentMethod,
        troco_para: customerChange,
        retirada_ou_delivery: deliveryOption,
        observacoes: customerNotes,
      };
      
      const { error } = await placeOrder(orderDetails);
      
      const message = generateWhatsAppMessage();
      const whatsappNumberRaw = config.find(c => c.key === 'whatsapp')?.value;
      if (!whatsappNumberRaw) {
        alert("Número de WhatsApp da loja não configurado.");
        setIsSubmitting(false);
        return;
      }
      
      let sanitizedNumber = whatsappNumberRaw.replace(/\D/g, '');

      if ((sanitizedNumber.length === 10 || sanitizedNumber.length === 11) && !sanitizedNumber.startsWith('55')) {
        sanitizedNumber = '55' + sanitizedNumber;
      }
      
      if (sanitizedNumber.length < 12) {
          alert("O número de WhatsApp da loja parece inválido. Por favor, verifique se ele inclui o código do país (ex: 55) e o DDD na planilha de configurações.");
          setIsSubmitting(false);
          return;
      }

      const whatsappUrl = `https://wa.me/${sanitizedNumber}?text=${encodeURIComponent(message)}`;
      
      window.open(whatsappUrl, '_blank');

      clearCart();
      setIsOpen(false);

      if (error) {
        setTimeout(() => alert(error), 500);
      }

    } catch (error) {
      alert(`Ocorreu um erro inesperado: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPixKey = () => {
    if (pixKey && pixKey !== 'N/A') {
        navigator.clipboard.writeText(pixKey).then(() => {
            setCopyButtonText('Copiado!');
            setTimeout(() => setCopyButtonText('copiar chave'), 2000);
        }).catch(err => {
            console.error('Falha ao copiar a chave PIX:', err);
            alert('Não foi possível copiar a chave PIX.');
        });
    }
  };


  return (
    <>
      <div className="fixed bottom-4 right-4 z-30">
        <button
          onClick={() => setIsOpen(true)}
          className="p-4 rounded-full text-white shadow-lg flex items-center justify-center transition-transform hover:scale-110"
          style={{ backgroundColor: 'var(--color-buttons, var(--color-primary, #4F46E5))' }}
          aria-label="Abrir carrinho"
        >
          <CartIcon className="w-8 h-8" />
        </button>
      </div>
      
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsOpen(false)}>
          <div
            className="fixed top-0 right-0 h-full w-full max-w-md bg-gray-50 shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-4 bg-white border-b">
              <div>
                  <h2 className="text-xl font-bold text-gray-800">Seu Carrinho</h2>
                  <button 
                      onClick={() => { setIsOpen(false); setIsOrderHistoryOpen(true); }}
                      className="text-sm font-medium hover:underline"
                      style={{ color: 'var(--color-primary, #4F46E5)' }}
                  >
                      Ver pedidos anteriores
                  </button>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800">
                <CloseIcon className="w-6 h-6" />
              </button>
            </header>

            {cart.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500 p-4">
                    <CartIcon className="w-16 h-16 mb-4 text-gray-300"/>
                    <h3 className="text-xl font-semibold">Seu carrinho está vazio</h3>
                    <p className="mt-2">Adicione produtos para começar a comprar!</p>
                </div>
            ) : (
                <div className="flex-grow overflow-y-auto">
                    <form onSubmit={handleSubmitOrder} className="flex flex-col h-full">
                        <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                           {/* Item List */}
                            <div className="space-y-3 bg-white p-3 rounded-lg">
                                {cart.map(item => (
                                    <div key={`${item.product.sku}-${item.variant.size}`} className="flex items-center gap-4">
                                        <LazyImage 
                                          src={item.product.foto_urls?.[0] || `https://picsum.photos/seed/${item.product.sku}/100/100`} 
                                          alt={item.product.item} 
                                          className="w-16 h-16 rounded-md object-cover bg-gray-200"
                                        />
                                        <div className="flex-grow">
                                            <p className="font-semibold text-gray-900">{item.product.item}</p>
                                            <p className="text-xs text-gray-500">{item.variant.size} • {formatCurrency(item.variant.price)}</p>
                                            <p className="text-sm font-semibold text-gray-700 mt-0.5">Subtotal: {formatCurrency(item.variant.price * item.quantity)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 border rounded-full p-1">
                                            {(() => {
                                                const isKg = item.variant.size.toLowerCase() === 'kg';
                                                const step = isKg ? 0.05 : 1;
                                                const displayQty = isKg ? (item.quantity < 1 ? `${(item.quantity * 1000).toFixed(0)}g` : `${item.quantity.toFixed(3).replace(/\.?0+$/, '')}kg`) : item.quantity;
                                                return (
                                                    <>
                                                        <button type="button" onClick={() => updateQuantity(item.product.sku, item.variant.size, item.quantity - step)} className="p-1 text-gray-600 rounded-full hover:bg-gray-200">
                                                            <MinusIcon className="w-4 h-4" />
                                                        </button>
                                                        <span className="font-semibold text-gray-800 w-auto min-w-[1.25rem] px-2 text-center text-sm">{displayQty}</span>
                                                        <button type="button" onClick={() => updateQuantity(item.product.sku, item.variant.size, item.quantity + step)} className="p-1 text-gray-600 rounded-full hover:bg-gray-200">
                                                            <PlusIcon className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )
                                            })()}
                                        </div>
                                        <button type="button" onClick={() => removeFromCart(item.product.sku, item.variant.size)} className="text-red-500 hover:text-red-700">
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Coupon */}
                            <div className="bg-white p-3 rounded-lg space-y-2">
                                {appliedCoupon ? (
                                    <div>
                                        <p className="text-sm font-semibold text-gray-700">Cupom Aplicado</p>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-sm text-green-600 font-bold">🎟️ {appliedCoupon.codigo}</p>
                                            <button
                                                type="button"
                                                onClick={removeCoupon}
                                                className="text-xs text-red-500 hover:underline"
                                            >
                                                Remover
                                            </button>
                                        </div>
                                        {couponMessage && <p className="text-xs mt-1 text-green-600">{couponMessage}</p>}
                                    </div>
                                ) : (
                                    <>
                                        {!isCouponInputVisible ? (
                                            <button
                                                type="button"
                                                onClick={() => setIsCouponInputVisible(true)}
                                                className="w-full text-sm font-semibold flex items-center gap-2"
                                                style={{ color: 'var(--color-primary, #4F46E5)' }}
                                            >
                                                <TagIcon className="w-5 h-5" />
                                                <span>Adicionar cupom de desconto</span>
                                            </button>
                                        ) : (
                                            <div>
                                                <div className="flex justify-between items-center">
                                                    <label htmlFor="couponCode" className="block text-sm font-semibold text-gray-700">Cupom de Desconto</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsCouponInputVisible(false);
                                                            removeCoupon();
                                                        }}
                                                        className="text-xs text-gray-500 hover:underline"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                                <div className="flex gap-2 mt-1">
                                                    <input id="couponCode" type="text" value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="Insira o código" className="flex-grow border rounded-md px-3 py-2 text-sm w-full"/>
                                                    <button type="button" onClick={applyCoupon} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-300 whitespace-nowrap">Aplicar</button>
                                                </div>
                                                {couponMessage && <p className="text-xs mt-1 text-red-600">{couponMessage}</p>}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Delivery Options */}
                            <div className="bg-white p-3 rounded-lg space-y-3">
                                <h3 className="font-semibold text-gray-800">Opção de Entrega</h3>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setDeliveryOption('Delivery')} className={`flex-1 py-2 rounded-md text-sm font-semibold ${deliveryOption === 'Delivery' ? 'text-white' : 'bg-gray-200'}`} style={{backgroundColor: deliveryOption === 'Delivery' ? 'var(--color-buttons, var(--color-primary))' : ''}}>Delivery</button>
                                    <button type="button" onClick={() => setDeliveryOption('Retirada')} className={`flex-1 py-2 rounded-md text-sm font-semibold ${deliveryOption === 'Retirada' ? 'text-white' : 'bg-gray-200'}`} style={{backgroundColor: deliveryOption === 'Retirada' ? 'var(--color-buttons, var(--color-primary))' : ''}}>Retirar no Local</button>
                                </div>
                                {deliveryOption === 'Delivery' && (
                                    <div>
                                        <label htmlFor="neighborhood" className="block text-sm font-semibold text-gray-700 mb-1">Bairro para Entrega</label>
                                        {neighborhoods.length > 0 ? (
                                            <div className="relative">
                                                <LocationMarkerIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                {/* FIX: Ensured select text is dark for legibility */}
                                                <select id="neighborhood" required value={selectedNeighborhood} onChange={e => setSelectedNeighborhood(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white text-gray-900 pl-10 appearance-none">
                                                    <option value="">Selecione seu bairro</option>
                                                    {neighborhoods.map(n => <option key={n.bairro} value={n.bairro}>{n.bairro}</option>)}
                                                </select>
                                                <ChevronDownIcon className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 mt-2">Nenhuma área de entrega configurada.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {/* Customer Info */}
                             <div className="bg-white p-3 rounded-lg space-y-4">
                                <h3 className="font-semibold text-gray-800">Seus Dados</h3>
                                <div>
                                    <label htmlFor="customerName" className="block text-sm font-semibold text-gray-700 mb-1">Nome completo</label>
                                    <input id="customerName" required type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Digite seu nome completo" className="w-full border rounded-md px-3 py-2 text-sm" />
                                </div>
                                <div>
                                    <label htmlFor="customerPhone" className="block text-sm font-semibold text-gray-700 mb-1">Telefone (WhatsApp)</label>
                                    <input id="customerPhone" required type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="(XX) 9XXXX-XXXX" className="w-full border rounded-md px-3 py-2 text-sm" pattern="(\d{10,11})" title="Digite um telefone válido com DDD (10 ou 11 dígitos)"/>
                                </div>
                                {deliveryOption === 'Delivery' && <>
                                    <div>
                                        <label htmlFor="customerCEP" className="block text-sm font-semibold text-gray-700 mb-1">CEP</label>
                                        <input id="customerCEP" type="text" value={customerCEP} onChange={e => setCustomerCEP(e.target.value)} placeholder="00000-000" className="w-full border rounded-md px-3 py-2 text-sm" />
                                    </div>
                                    <div>
                                        <label htmlFor="customerAddress" className="block text-sm font-semibold text-gray-700 mb-1">Endereço completo (Rua, Nº, Comp.)</label>
                                        <input id="customerAddress" required type="text" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Ex: Rua das Flores, 123, Apto 4B" className="w-full border rounded-md px-3 py-2 text-sm" />
                                    </div>
                                </>}
                             </div>
                             
                             {/* Payment */}
                             <div className="bg-white p-3 rounded-lg space-y-3">
                                 <h3 className="font-semibold text-gray-800">Pagamento</h3>
                                 <div>
                                     <label htmlFor="paymentMethod" className="block text-sm font-semibold text-gray-700 mb-1">Forma de Pagamento</label>
                                     {/* FIX: Ensured select text is dark for legibility */}
                                     <select id="paymentMethod" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-white text-gray-900">
                                         <option value="PIX">PIX</option>
                                         <option value="Dinheiro">Dinheiro</option>
                                         <option value="Cartão">Cartão na entrega</option>
                                     </select>
                                 </div>
                                 {paymentMethod === 'Dinheiro' && <div>
                                     <label htmlFor="customerChange" className="block text-sm font-semibold text-gray-700 mb-1">Troco para R$</label>
                                     <input id="customerChange" type="number" value={customerChange} onChange={e => setCustomerChange(e.target.value)} placeholder="Ex: 50,00" className="w-full border rounded-md px-3 py-2 text-sm" />
                                 </div>}
                                 {paymentMethod === 'PIX' && pixKey !== 'N/A' && (
                                    <div className="pt-2 border-t border-gray-200">
                                        <p className="text-sm text-gray-700 mb-2">
                                            Chave PIX: <strong className="font-mono bg-gray-100 p-1 rounded">{pixKey}</strong>
                                        </p>
                                        <button 
                                            type="button" 
                                            onClick={handleCopyPixKey}
                                            className="px-4 py-1.5 text-xs font-bold text-white rounded-full hover:opacity-90 transition-all w-32"
                                            style={{ backgroundColor: 'var(--color-buttons, var(--color-primary, #4F46E5))' }}
                                        >
                                            {copyButtonText}
                                        </button>
                                    </div>
                                )}
                             </div>

                            {/* Notes */}
                            <div className="bg-white p-3 rounded-lg">
                                <label htmlFor="customerNotes" className="block text-sm font-semibold text-gray-700 mb-1">Observações do pedido</label>
                                <textarea id="customerNotes" value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} placeholder="Explo.: Banana madurinha, procurar o João caseiro..." className="w-full border rounded-md px-3 py-2 text-sm h-20"></textarea>
                            </div>
                        </div>

                        {/* Footer / Summary */}
                        <footer className="p-4 bg-white border-t mt-auto">
                            <div className="space-y-1 text-sm text-gray-700">
                                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                                {deliveryOption === 'Delivery' && selectedNeighborhood && <div className="flex justify-between"><span>Frete</span><span>{formatCurrency(deliveryFee)}</span></div>}
                                {discount > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span>-{formatCurrency(discount)}</span></div>}
                                <div className="flex justify-between font-bold text-lg text-black pt-2 border-t mt-2"><span>Total</span><span>{formatCurrency(total)}</span></div>
                            </div>
                            <button disabled={isSubmitting} type="submit" className="w-full mt-4 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:bg-gray-400" style={{backgroundColor: 'var(--color-buttons, var(--color-primary, #4F46E5))'}}>
                                {isSubmitting ? 'Enviando...' : <> <WhatsAppIcon className="w-6 h-6" /> Enviar Pedido por WhatsApp </> }
                            </button>
                        </footer>
                    </form>
                </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Cart;
