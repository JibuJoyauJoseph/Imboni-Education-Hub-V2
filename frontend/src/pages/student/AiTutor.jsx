import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../../components/Navbar.jsx';
import { api } from '../../services/api';

export default function AiTutor() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    if (!input.trim()) return;
    const userMsg = { sender: 'student', message: input };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setBusy(true);
    try {
      const res = await api.post('/ai-tutor/chat', { conversation_id: conversationId, message: userMsg.message });
      setConversationId(res.conversation_id);
      setMessages(m => [...m, { sender: 'ai', message: res.reply }]);
    } catch (err) {
      setMessages(m => [...m, { sender: 'ai', message: `Sorry, something went wrong: ${err.data?.message || err.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full flex flex-col">
        <h1 className="font-display text-3xl font-semibold mb-1">AI Tutor</h1>
        <p className="text-ink/60 mb-6">Ask about anything from your courses — explanations, examples, practice problems.</p>

        <div className="flex-1 space-y-4 mb-4 overflow-y-auto" style={{ minHeight: '40vh' }}>
          {messages.length === 0 && <p className="text-ink/40 text-sm">Start by asking a question below.</p>}
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${m.sender === 'student' ? 'bg-ink text-parchment ml-auto' : 'bg-paper border border-ink/10'}`}>
              {m.message}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2">
          <input className="input" placeholder="Ask the AI tutor..." value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()} />
          <button className="btn-primary" onClick={send} disabled={busy}>{busy ? '...' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}
