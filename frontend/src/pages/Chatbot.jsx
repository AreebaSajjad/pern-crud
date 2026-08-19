import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import Layout from '../components/Layout';
import { useConfirm } from '../components/ConfirmDialog'; 

const DEFAULT_GREETING = {
  role: 'bot',
  text: "Hi! I'm your MyStore assistant. Ask me about products, prices, stock, or store stats.",
};

const Chatbot = () => {
  const { user } = useSelector((state) => state.auth);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([DEFAULT_GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
   const { askConfirm } = useConfirm(); 

  const loadConversations = async () => {
    try {
      const res = await api.get('/rag/conversations');
      setConversations(res.data.conversations);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleNewChat = () => {
    setActiveId(null);
    setMessages([DEFAULT_GREETING]);
    setSidebarOpen(false); // mobile: drawer band ho jaye
    inputRef.current?.focus();
  };

  const handleSelectChat = async (id) => {
    try {
      const res = await api.get(`/rag/conversations/${id}`);
      setActiveId(id);
      setMessages(res.data.conversation.messages.map((m) => ({ role: m.role, text: m.text })));
      setSidebarOpen(false); // mobile: chat select karte hi drawer band ho jaye
    } catch (err) {
      // ignore
    }
  };

  const handleDeleteChat = async (e, id) => {
    e.stopPropagation();
     const ok = await askConfirm('Delete this conversation?'); if (!ok) return;
    try {
      await api.delete(`/rag/conversations/${id}`);
      if (activeId === id) handleNewChat();
      loadConversations();
    } catch (err) {
      // ignore
    }
  };

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles((prev) => [...prev, ...files].slice(0, 5));
    e.target.value = '';
  };

  const handleRemoveAttachment = (idx) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!input.trim() && attachedFiles.length === 0) || loading) return;

    const userMessage = input.trim() || '(sent image(s), no text)';
    const attachedCount = attachedFiles.length;
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: userMessage, imageCount: attachedCount || undefined },
    ]);
    setInput('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', userMessage);
      if (activeId) formData.append('conversationId', activeId);
      attachedFiles.forEach((file) => formData.append('images', file));
      setAttachedFiles([]);

      const res = await api.post('/rag/chat', formData);
      setMessages((prev) => [...prev, { role: 'bot', text: res.data.answer }]);
      if (!activeId) setActiveId(res.data.conversationId);
      loadConversations();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Something went wrong, please try again.';
      setMessages((prev) => [...prev, { role: 'bot', text: errMsg }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const suggestedPrompts = [
    'What products do you have?',
    'What are my upcoming meetings?',
    'Show me the cheapest product',
    'What is my email?',
  ];

  const handleSuggestionClick = (text) => {
    setInput(text);
    inputRef.current?.focus();
  };

  return (
    <Layout>
      <div className="chatbot-layout">
        {sidebarOpen && <div className="chatbot-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        <div className={`chatbot-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
          <button className="btn-new-chat" onClick={handleNewChat}>
            + New Chat
          </button>
          <div className="chat-list">
            {conversations.map((c) => (
              <div
                key={c._id}
                className={`chat-list-item ${activeId === c._id ? 'active' : ''}`}
                onClick={() => handleSelectChat(c._id)}
              >
                <span className="chat-list-title">{c.title}</span>
                <button className="chat-list-delete" onClick={(e) => handleDeleteChat(e, c._id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="chatbot-main">
          <div className="chatbot-topbar">
            <div className="chatbot-topbar-info">
              <button className="chatbot-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Show chat list">
                ☰
              </button>
              <div className="chatbot-avatar-icon">🤖</div>
              <div>
                <h2>AI Assistant</h2>
                <span className="chatbot-status">
                  <span className="status-dot"></span> Online
                </span>
              </div>
            </div>
          </div>

          <div className="chatbot-body">
            <div className="chat-messages">
              {messages.map((m, i) => (
                <div key={i} className={`chat-bubble-row ${m.role === 'user' ? 'chat-row-user' : 'chat-row-bot'}`}>
                  {m.role === 'bot' && <div className="chat-avatar chat-avatar-bot">🤖</div>}
                  <div className={`chat-bubble ${m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'}`}>
                    {m.text}
                    {m.imageCount ? (
                      <div style={{ fontSize: '12px', opacity: 0.75, marginTop: '4px' }}>
                        📎 {m.imageCount} image{m.imageCount > 1 ? 's' : ''} attached
                      </div>
                    ) : null}
                  </div>
                  {m.role === 'user' && (
                    <div className="chat-avatar chat-avatar-user">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="chat-bubble-row chat-row-bot">
                  <div className="chat-avatar chat-avatar-bot">🤖</div>
                  <div className="chat-bubble chat-bubble-bot chat-typing">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                </div>
              )}

              {messages.length === 1 && !loading && (
                <div className="suggested-prompts">
                  {suggestedPrompts.map((p, i) => (
                    <button key={i} className="suggestion-chip" onClick={() => handleSuggestionClick(p)}>
                      {p}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {attachedFiles.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '0 32px 8px' }}>
                {attachedFiles.map((file, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      background: '#eef1f7', borderRadius: '6px', padding: '4px 8px', fontSize: '12px',
                    }}
                  >
                    <span>🖼️ {file.name.length > 18 ? file.name.slice(0, 15) + '...' : file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(i)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleSend} className="chat-input-row">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="btn-attach"
                title="Attach product image(s)"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || attachedFiles.length >= 5}
                style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 8px' }}
              >
                📎
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a product, your meetings, or more..."
                disabled={loading}
                autoFocus
              />
              <button type="submit" className="btn-send" disabled={loading || (!input.trim() && attachedFiles.length === 0)}>
                <span>Send</span>
                <span className="send-icon">➤</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Chatbot;