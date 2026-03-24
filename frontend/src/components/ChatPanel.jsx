import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Bot, User, Database, ChevronRight, Activity } from 'lucide-react';
import './ChatPanel.css';

const ChatPanel = ({ onHighlightNodes }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I can help you analyze the Order to Cash process. Ask me about orders, deliveries, or billing documents.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    const newHistory = [...messages, { role: 'user', content: userMessage }];
    setMessages(newHistory);
    setLoading(true);
    
    // Clear previous highlights
    onHighlightNodes([]);

    try {
      // Send history excluding the initial welcome message to save tokens if we want,
      // but let's just send the whole thing formatted for the LLM.
      const apiHistory = newHistory.slice(1).map(m => ({ role: m.role, content: m.content }));
      
      const res = await axios.post('/api/chat', {
        message: userMessage,
        history: apiHistory.slice(0, -1) // send previous context
      });

      const { answer, sql, data, error, guardrail } = res.data;

      setMessages(prev => [...prev, { role: 'assistant', content: answer, sql, data, isError: error, isGuardrail: guardrail }]);

      if (data && data.length > 0 && !error && !guardrail) {
        // Simple heuristic to highlight nodes: 
        // We look at all string values in the data rows that look like numeric IDs (e.g. Sales Orders "740506")
        // and tell the graph to highlight them.
        const idsToHighlight = [];
        data.forEach(row => {
          Object.values(row).forEach(val => {
            const strVal = String(val);
            // Prefix matching logic: we know prefixes are C_, O_, D_, I_, J_
            idsToHighlight.push(`C_${strVal}`);
            idsToHighlight.push(`O_${strVal}`);
            idsToHighlight.push(`D_${strVal}`);
            idsToHighlight.push(`I_${strVal}`);
            idsToHighlight.push(`J_${strVal}`);
          });
        });
        onHighlightNodes(idsToHighlight);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered a connection error.', isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="header-info">
          <h2>Chat with Graph</h2>
          <span className="subtitle">Order to Cash</span>
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-wrapper ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
            </div>
            <div className="message-content">
              <div className="message-sender">
                {msg.role === 'assistant' ? 'Dodge AI Agent' : 'You'}
              </div>
              <div className={`message-bubble ${msg.isError ? 'error' : ''} ${msg.isGuardrail ? 'guardrail' : ''}`}>
                <p>{msg.content}</p>
                {msg.sql && (
                  <div className="sql-snippet">
                    <div className="sql-header">
                      <Database size={12} /> Executed SQL
                    </div>
                    <code>{msg.sql}</code>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="message-wrapper assistant">
            <div className="message-avatar pulse"><Bot size={18} /></div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        {loading && (
          <div className="status-indicator">
            <Activity className="spin" size={14} /> Dodge AI is computing...
          </div>
        )}
        <form onSubmit={handleSubmit} className="chat-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about the dataset..."
            disabled={loading}
          />
          <button type="submit" disabled={!input.trim() || loading}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
