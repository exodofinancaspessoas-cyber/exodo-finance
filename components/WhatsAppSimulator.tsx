import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Image, Paperclip } from 'lucide-react';
import { processWhatsAppMessage } from '../services/mockService';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  time: string;
}

export default function WhatsAppSimulator() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'Olá! Eu sou o assistente do BRUK. Pode me mandar seus gastos.', isBot: true, time: 'Now' }
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input,
      isBot: false,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulate Network Delay
    setTimeout(() => {
       const result = processWhatsAppMessage(userMsg.text);
       const botMsg: Message = {
         id: (Date.now() + 1).toString(),
         text: result.response,
         isBot: true,
         time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
       };
       setMessages(prev => [...prev, botMsg]);
    }, 1000);
  };

  return (
    <div className="max-w-md mx-auto h-[600px] flex flex-col bg-[#e5ddd5] rounded-3xl shadow-2xl overflow-hidden border-8 border-slate-800">
      {/* Header */}
      <div className="bg-[#075e54] p-4 flex items-center space-x-3 text-white">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#075e54] font-bold">
            BK
        </div>
        <div>
            <h3 className="font-bold">BRUK Bot</h3>
            <p className="text-xs opacity-80">online</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
         {messages.map(msg => (
             <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
                 <div className={`max-w-[80%] p-3 rounded-lg shadow-sm text-sm relative ${
                     msg.isBot ? 'bg-white rounded-tl-none' : 'bg-[#dcf8c6] rounded-tr-none'
                 }`}>
                     <p className="whitespace-pre-line text-slate-800">{msg.text}</p>
                     <span className="text-[10px] text-slate-500 block text-right mt-1">{msg.time}</span>
                 </div>
             </div>
         ))}
         <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#f0f0f0] p-2 px-3 flex items-center space-x-2">
        <button className="text-slate-500"><Paperclip size={20} /></button>
        <div className="flex-1 bg-white rounded-full flex items-center px-4 py-2">
           <input 
              className="flex-1 outline-none text-sm bg-transparent"
              placeholder="Digite uma mensagem..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
           />
        </div>
        {input ? (
             <button onClick={handleSend} className="bg-[#075e54] text-white p-2 rounded-full">
                 <Send size={18} />
             </button>
        ) : (
            <button className="bg-[#075e54] text-white p-2 rounded-full">
                <Mic size={18} />
            </button>
        )}
      </div>

      {/* Helper Chips */}
      <div className="bg-slate-800 p-2 overflow-x-auto whitespace-nowrap space-x-2">
          {['Gastei 50 no uber', 'Paguei 200 de luz', 'Recebi 1500 salario', 'Compra 1200 em 10x'].map(suggestion => (
              <button 
                key={suggestion}
                onClick={() => setInput(suggestion)}
                className="text-xs text-white bg-slate-700 px-3 py-1 rounded-full hover:bg-slate-600 transition"
              >
                  {suggestion}
              </button>
          ))}
      </div>
    </div>
  );
}