const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'ws://192.168.1.218:8080/ws';

class WebSocketService {
  static instance = null;

  static getInstance() {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  constructor() {
    this.socketRef = null;
    this.reconnectTimeout = null;
    this.username = null;
    this.baseUrl = SOCKET_URL;
    this.listeners = {}; // Lưu trữ danh sách callback theo event (Pub/Sub pattern)
  }

  // Đăng ký lắng nghe sự kiện
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    // Trả về hàm huỷ đăng ký
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  // Phát sự kiện nội bộ
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  connect(username) {
    if (!username) return;
    if (this.socketRef && (this.socketRef.readyState === WebSocket.OPEN || this.socketRef.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.username = username;
    const wsUrl = `${this.baseUrl}?username=${username}`;

    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
    this.socketRef = new WebSocket(wsUrl);

    this.socketRef.onopen = () => {
      console.log(`✅ Mobile WebSocket Connected: ${username}`);
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    };

    this.socketRef.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Phát sự kiện chat-update tới tất cả những màn hình đang lắng nghe
        this.emit('chat-update', data);
      } catch (e) {
        console.error("Error parsing WS message", e);
      }
    };

    this.socketRef.onclose = () => {
      console.log("❌ Mobile WebSocket Disconnected");
      this.socketRef = null;

      // Tự động kết nối lại sau 3s
      this.reconnectTimeout = setTimeout(() => {
        console.log("🔄 Attempting to reconnect...");
        this.connect(this.username);
      }, 3000);
    };

    this.socketRef.onerror = (error) => {
      console.log("WebSocket Error:", error.message || "Unknown error");
      // Tránh crash, cứ kệ để onclose xử lý kết nối lại
    };
  }

  send(data) {
    if (this.socketRef && this.socketRef.readyState === WebSocket.OPEN) {
      this.socketRef.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket not connected. Cannot send.");
    }
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.socketRef) {
      this.socketRef.close();
      this.socketRef = null;
    }
    this.username = null;
  }
}

const socketService = WebSocketService.getInstance();
export default socketService;
