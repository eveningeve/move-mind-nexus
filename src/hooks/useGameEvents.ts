import { useState, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  player: 'white' | 'black';
  message: string;
  timestamp: Date;
  type: 'thinking' | 'action' | 'game_over';
}

export interface GameState {
  fen?: string;
  pgn?: string;
  status?: string;
  winner?: string;
  // Add other fields your backend returns
}

export function useGameEvents(gameCode: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(
      `http://127.0.0.1:8000/games/${gameCode}/events`
    );

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log('SSE connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        const newMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          player: data.player,
          message: data.data,
          timestamp: new Date(),
          type: data.type === 'move' ? 'action' : 
                data.type === 'game_over' ? 'game_over' : 'thinking'
        };

        setMessages(prev => [...prev, newMessage]);

        // Fetch updated game state after each event
        if (data.type === 'move' || data.type === 'game_over') {
          fetch(`http://127.0.0.1:8000/games/${gameCode}`)
            .then(res => res.json())
            .then(setGameState)
            .catch(console.error);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [gameCode]);

  return { messages, gameState, isConnected };
}
