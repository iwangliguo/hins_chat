import { useState, useRef, useEffect } from 'react';
import '../styles/ChatPage.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// Web Speech API 类型声明
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognitionInstance;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognitionInstance;
    };
  }
}

const API_URL = '/api/chat';
const STORAGE_KEY = 'hins-chat-conversations';

const defaultWelcome: Message = {
  id: '1',
  role: 'assistant',
  content: '欢迎来到hins chat，如果你相信宿命论，这就是hins的数字生命载体',
  timestamp: new Date(),
};

const ChatPage = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([defaultWelcome]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceError, setVoiceError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // 加载本地存储的对话
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setConversations(parsed);
      } catch (e) {
        console.error('Failed to parse conversations:', e);
      }
    }
  }, []);

  // 保存对话到本地
  const saveConversations = (newConversations: Conversation[]) => {
    setConversations(newConversations);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConversations));
  };

  // 创建新对话
  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [defaultWelcome],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const newConversations = [newConversation, ...conversations];
    saveConversations(newConversations);
    setCurrentConversationId(newConversation.id);
    setMessages(newConversation.messages);
    setConversationId('');
    setSidebarOpen(false);
  };

  // 选择对话
  const selectConversation = (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (conv) {
      setCurrentConversationId(convId);
      setMessages(conv.messages);
      setConversationId('');
      setSidebarOpen(false);
    }
  };

  // 删除对话
  const deleteConversation = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    const newConversations = conversations.filter((c) => c.id !== convId);
    saveConversations(newConversations);
    if (currentConversationId === convId) {
      createNewConversation();
    }
  };

  // 更新当前对话的标题（取第一条用户消息的前20个字符）
  const updateConversationTitle = (newMessages: Message[], userFirstMessage?: string) => {
    if (!currentConversationId) return;
    const userMsg = userFirstMessage 
      ? { content: userFirstMessage }
      : newMessages.find((m) => m.role === 'user');
    if (userMsg && conversations.find((c) => c.id === currentConversationId)?.title === '新对话') {
      const title = userMsg.content.slice(0, 20) + (userMsg.content.length > 20 ? '...' : '');
      const newConversations = conversations.map((c) =>
        c.id === currentConversationId ? { ...c, title, updatedAt: new Date() } : c
      );
      saveConversations(newConversations);
    } else {
      const newConversations = conversations.map((c) =>
        c.id === currentConversationId ? { ...c, updatedAt: new Date() } : c
      );
      saveConversations(newConversations);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初始化语音识别
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setVoiceSupported(false);
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputValue(transcript);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setVoiceError(event.error);
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const startVoiceInput = () => {
    if (!voiceSupported) {
      setVoiceError('您的浏览器不支持语音识别，请使用 Chrome 或 Safari');
      return;
    }

    setVoiceError('');
    if (recognitionRef.current && !isRecording) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Failed to start recognition:', e);
      }
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    // 如果是新对话，先创建
    if (!currentConversationId) {
      createNewConversation();
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          inputs: {},
          response_mode: 'blocking',
          user: 'website-visitor',
          conversation_id: conversationId,
        }),
      });

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || '抱歉，我暂时无法回答这个问题。',
        timestamp: new Date(),
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      // 更新本地存储
      if (currentConversationId) {
        const newConversations = conversations.map((c) =>
          c.id === currentConversationId ? { ...c, messages: finalMessages, updatedAt: new Date() } : c
        );
        saveConversations(newConversations);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，连接失败了。请稍后再试。',
        timestamp: new Date(),
      };
      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);

      if (currentConversationId) {
        const newConversations = conversations.map((c) =>
          c.id === currentConversationId ? { ...c, messages: finalMessages, updatedAt: new Date() } : c
        );
        saveConversations(newConversations);
      }
    } finally {
      setIsLoading(false);
      // 回复完成后更新对话标题
      if (currentConversationId) {
        updateConversationTitle(messages, userMessage.content);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return '今天';
    }
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return '昨天';
    }
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="chat-page">
      {/* Left Sidebar */}
      <aside className={`chat-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">
            <img src="/planet3.svg" alt="hins" className="sidebar-icon" />
            hins chat
          </div>
          <button className="new-chat-btn" onClick={createNewConversation}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            新建对话
          </button>
        </div>
        <div className="sidebar-content">
          {conversations.length === 0 ? (
            <div className="sidebar-tip">
              开始新对话，探索 AI 的无限可能
            </div>
          ) : (
            <div className="conversation-list">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
                  onClick={() => selectConversation(conv.id)}
                >
                  <div className="conversation-info">
                    <div className="conversation-title">{conv.title}</div>
                    <div className="conversation-date">{formatDate(conv.updatedAt)}</div>
                  </div>
                  <button
                    className="conversation-delete"
                    onClick={(e) => deleteConversation(e, conv.id)}
                    title="删除对话"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main">
        <header className="chat-header">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>
          <img src="/赞恩.jpg" alt="hins" className="chat-header-avatar" />
          <div className="chat-header-info">
            <h1>hins chat</h1>
            <p>在线</p>
          </div>
        </header>

        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className={`message-avatar ${msg.role === 'assistant' ? 'ai' : ''}`}>
                <img 
                  src={msg.role === 'assistant' ? '/planet1.svg' : '/planet2.svg'} 
                  alt={msg.role === 'assistant' ? 'AI' : 'User'} 
                />
              </div>
              <div className="message-content">
                <div className="message-bubble">{msg.content}</div>
                <div className="message-time">{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message assistant">
              <div className="message-avatar ai">
                <img src="/planet1.svg" alt="AI" />
              </div>
              <div className="message-content">
                <div className="message-bubble">
                  <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          {voiceError && <div className="voice-error">{voiceError}</div>}
          <div className="chat-input-wrapper">
            <textarea
              className="chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isRecording ? '正在聆听...' : '输入消息...'}
              rows={1}
            />
            <div className="input-actions">
              <button
                className={`input-btn voice-btn ${isRecording ? 'recording' : ''}`}
                onClick={isRecording ? stopVoiceInput : startVoiceInput}
                disabled={isLoading || !voiceSupported}
                title={isRecording ? '点击停止录音' : '点击开始语音输入'}
              >
                {isRecording ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M6 6h12v12H6z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
                  </svg>
                )}
              </button>
              <button
                className="input-btn send-btn"
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                title="发送消息"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatPage;
