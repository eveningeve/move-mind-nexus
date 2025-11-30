import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Home, Crown, Sparkles, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  player: "white" | "black";
  content: string;
  timestamp: string;
}

interface GameState {
  fen: string;
  turn: "white" | "black";
  status: string;
  moves: string[];
}

const GameViewer = () => {
  const { gameCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState(new Chess());
  const [messages, setMessages] = useState<Message[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!gameCode) return;

    // Fetch initial game state
    const fetchGameState = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/games/${gameCode}`);
        if (!response.ok) throw new Error("Failed to fetch game");
        const data = await response.json();
        setGameState(data);
        const newGame = new Chess(data.fen);
        setGame(newGame);
      } catch (error) {
        console.error("Error fetching game:", error);
        toast({
          title: "Error",
          description: "Failed to load game",
          variant: "destructive",
        });
      }
    };

    fetchGameState();

    // Set up SSE connection
    const eventSource = new EventSource(
      `http://127.0.0.1:8000/games/${gameCode}/events`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "reasoning") {
          setMessages((prev) => [
            ...prev,
            {
              player: data.player,
              content: data.reasoning,
              timestamp: new Date().toISOString(),
            },
          ]);
        } else if (data.type === "move") {
          setGameState((prev) => ({
            ...prev!,
            fen: data.fen,
            turn: data.turn,
            moves: [...(prev?.moves || []), data.move],
          }));
          const newGame = new Chess(data.fen);
          setGame(newGame);
        } else if (data.type === "game_over") {
          setGameState((prev) => ({
            ...prev!,
            status: data.status,
          }));
          toast({
            title: "Game Over",
            description: data.status,
          });
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      eventSource.close();
    };

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
    };
  }, [gameCode, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isGameOver = gameState?.status && gameState.status !== "ongoing";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Game: <span className="text-primary">{gameCode}</span>
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={gameState?.turn === "white" ? "default" : "secondary"}>
                <Crown className="w-3 h-3 mr-1" />
                White
              </Badge>
              <span className="text-muted-foreground">vs</span>
              <Badge variant={gameState?.turn === "black" ? "default" : "secondary"}>
                <Sparkles className="w-3 h-3 mr-1" />
                Black
              </Badge>
              {gameState?.turn && !isGameOver && (
                <Badge variant="outline" className="ml-2">
                  <Clock className="w-3 h-3 mr-1" />
                  {gameState.turn === "white" ? "White" : "Black"} to move
                </Badge>
              )}
              {isGameOver && (
                <Badge variant="destructive" className="ml-2">
                  {gameState.status}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
        </header>

        {/* Main content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column - Board and moves */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 bg-card/50 backdrop-blur">
              <div className="aspect-square max-w-2xl mx-auto">
                <Chessboard
                  options={{
                    position: game.fen(),
                    boardOrientation: "white",
                    allowDragging: false,
                    darkSquareStyle: {
                      backgroundColor: "hsl(var(--board-dark))",
                    },
                    lightSquareStyle: {
                      backgroundColor: "hsl(var(--board-light))",
                    },
                    showAnimations: true,
                  }}
                />
              </div>
            </Card>

            {/* Move history */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Move History</h2>
              <ScrollArea className="h-32">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {gameState?.moves.map((move, index) => (
                    <Badge key={index} variant="secondary" className="justify-center">
                      {index + 1}. {move}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Right column - Chat */}
          <Card className="p-6 flex flex-col h-[700px]">
            <h2 className="text-xl font-semibold mb-4">Agent Reasoning</h2>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      msg.player === "white" ? "justify-start" : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        msg.player === "white"
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-foreground text-background"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {msg.player === "white" ? (
                          <Crown className="w-4 h-4" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span className="text-xs font-semibold uppercase">
                          {msg.player}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GameViewer;
