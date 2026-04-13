import { useState, useRef, useEffect } from 'react';
import '../styles/ChatPage.css';

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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Dify API 配置
const DIFY_API_URL = 'http://150.158.57.162:8081/v1/chat-messages';

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '欢迎来到hins的数字世界',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceError, setVoiceError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初始化语音识别
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
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

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(DIFY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer app-oYVKHjo6fnc6CNOjUwD6uYqc',
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

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，连接失败了。请稍后再试。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-page-header">
        <img src="/赞恩.jpg" alt="hins" className="chat-page-avatar" />
        <h1>Talk to hins</h1>
        <p>AI 助手</p>
      </div>

      <div className="chat-page-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`dify-message ${msg.role === 'user' ? 'user' : 'assistant'}`}
          >
            {msg.role === 'assistant' && (
              <div className="dify-message-avatar">
                <img src="/赞恩.jpg" alt="AI" width="32" height="32" />
              </div>
            )}
            <div className="dify-message-content">
              <p>{msg.content}</p>
              <span className="dify-message-time">
                {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="dify-message assistant">
            <div className="dify-message-avatar">
              <img src="/赞恩.jpg" alt="AI" width="32" height="32" />
            </div>
            <div className="dify-message-content">
              <div className="dify-loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {voiceError && (
        <div className="voice-error">{voiceError}</div>
      )}
      <div className="chat-page-input">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isRecording ? '正在聆听...' : '输入消息...'}
          rows={1}
        />
        <button
          className={`voice-button ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopVoiceInput : startVoiceInput}
          disabled={isLoading}
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
        <button onClick={handleSend} disabled={isLoading || !inputValue.trim()}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
