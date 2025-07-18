import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Progress } from './components/ui/progress'
import { Badge } from './components/ui/badge'

interface Position {
  x: number
  y: number
}

interface Food {
  position: Position
  type: 'normal' | 'speed' | 'multiplier' | 'invincible'
  value: number
}

interface PowerUp {
  type: 'speed' | 'invincible'
  duration: number
}

const GRID_SIZE = 20
const INITIAL_SPEED = 150
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

const FOOD_TYPES = {
  normal: { color: '#00FF88', glow: '#00FF88', value: 1, chance: 0.7 },
  speed: { color: '#FFD700', glow: '#FFD700', value: 2, chance: 0.15 },
  multiplier: { color: '#FF0080', glow: '#FF0080', value: 3, chance: 0.1 },
  invincible: { color: '#00BFFF', glow: '#00BFFF', value: 5, chance: 0.05 }
}

const EVOLUTION_STAGES = [
  { length: 5, color: '#00FF88', name: 'Hatchling', glow: '#00FF88' },
  { length: 15, color: '#FFD700', name: 'Juvenile', glow: '#FFD700' },
  { length: 30, color: '#FF0080', name: 'Adult', glow: '#FF0080' },
  { length: 50, color: '#00BFFF', name: 'Elder', glow: '#00BFFF' },
  { length: 75, color: '#9400D3', name: 'Ancient', glow: '#9400D3' },
  { length: 100, color: '#FF4500', name: 'Legendary', glow: '#FF4500' }
]

function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameOver'>('menu')
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }])
  const [direction, setDirection] = useState<Position>({ x: 1, y: 0 })
  const [food, setFood] = useState<Food | null>(null)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('neonSnakeHighScore') || '0')
  })
  const [speed, setSpeed] = useState(INITIAL_SPEED)
  const [powerUps, setPowerUps] = useState<PowerUp[]>([])
  const [evolution, setEvolution] = useState(0)
  const [achievements, setAchievements] = useState<string[]>([])
  const [showAchievement, setShowAchievement] = useState<string | null>(null)
  const [wallWrap, setWallWrap] = useState(true)
  const [particles, setParticles] = useState<Array<{id: string, x: number, y: number, color: string}>>([])
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number>()
  const lastDirectionRef = useRef<Position>({ x: 1, y: 0 })
  const particleIdRef = useRef(0)

  // Get current evolution stage
  const getCurrentEvolution = useCallback(() => {
    for (let i = EVOLUTION_STAGES.length - 1; i >= 0; i--) {
      if (snake.length >= EVOLUTION_STAGES[i].length) {
        return EVOLUTION_STAGES[i]
      }
    }
    return EVOLUTION_STAGES[0]
  }, [snake.length])

  // Generate random food
  const generateFood = useCallback(() => {
    const rand = Math.random()
    let foodType: keyof typeof FOOD_TYPES = 'normal'
    
    if (rand < FOOD_TYPES.invincible.chance) foodType = 'invincible'
    else if (rand < FOOD_TYPES.invincible.chance + FOOD_TYPES.multiplier.chance) foodType = 'multiplier'
    else if (rand < FOOD_TYPES.invincible.chance + FOOD_TYPES.multiplier.chance + FOOD_TYPES.speed.chance) foodType = 'speed'
    
    let position: Position
    do {
      position = {
        x: Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)),
        y: Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE))
      }
    } while (snake.some(segment => segment.x === position.x && segment.y === position.y))
    
    setFood({
      position,
      type: foodType,
      value: FOOD_TYPES[foodType].value
    })
  }, [snake])

  // Create particle effect
  const createParticles = useCallback((x: number, y: number, color: string) => {
    const newParticles = []
    for (let i = 0; i < 6; i++) {
      newParticles.push({
        id: `particle-${particleIdRef.current++}`,
        x: x + Math.random() * 20 - 10,
        y: y + Math.random() * 20 - 10,
        color
      })
    }
    setParticles(prev => [...prev, ...newParticles])
    
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id)))
    }, 1000)
  }, [])

  // Check achievements
  const checkAchievements = useCallback((newScore: number, newLength: number) => {
    const newAchievements = []
    
    if (newScore >= 100 && !achievements.includes('Century')) {
      newAchievements.push('Century')
    }
    if (newLength >= 50 && !achievements.includes('Massive Snake')) {
      newAchievements.push('Massive Snake')
    }
    if (newLength >= 100 && !achievements.includes('Legendary Beast')) {
      newAchievements.push('Legendary Beast')
    }
    
    if (newAchievements.length > 0) {
      setAchievements(prev => [...prev, ...newAchievements])
      setShowAchievement(newAchievements[0])
      setTimeout(() => setShowAchievement(null), 3000)
    }
  }, [achievements])

  // Move snake
  const moveSnake = useCallback(() => {
    setSnake(currentSnake => {
      const newSnake = [...currentSnake]
      const head = { ...newSnake[0] }
      
      head.x += lastDirectionRef.current.x
      head.y += lastDirectionRef.current.y
      
      // Wall wrapping or collision
      if (wallWrap) {
        if (head.x < 0) head.x = Math.floor(CANVAS_WIDTH / GRID_SIZE) - 1
        if (head.x >= Math.floor(CANVAS_WIDTH / GRID_SIZE)) head.x = 0
        if (head.y < 0) head.y = Math.floor(CANVAS_HEIGHT / GRID_SIZE) - 1
        if (head.y >= Math.floor(CANVAS_HEIGHT / GRID_SIZE)) head.y = 0
      } else {
        if (head.x < 0 || head.x >= Math.floor(CANVAS_WIDTH / GRID_SIZE) || 
            head.y < 0 || head.y >= Math.floor(CANVAS_HEIGHT / GRID_SIZE)) {
          setGameState('gameOver')
          return currentSnake
        }
      }
      
      // Self collision (unless invincible)
      const isInvincible = powerUps.some(p => p.type === 'invincible')
      if (!isInvincible && newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        setGameState('gameOver')
        return currentSnake
      }
      
      newSnake.unshift(head)
      
      // Check food collision
      if (food && head.x === food.position.x && head.y === food.position.y) {
        const points = food.value * (evolution + 1)
        setScore(prev => {
          const newScore = prev + points
          checkAchievements(newScore, newSnake.length)
          return newScore
        })
        
        // Apply food effects
        if (food.type === 'speed') {
          setPowerUps(prev => [...prev, { type: 'speed', duration: 5000 }])
        } else if (food.type === 'invincible') {
          setPowerUps(prev => [...prev, { type: 'invincible', duration: 3000 }])
        }
        
        createParticles(head.x * GRID_SIZE + GRID_SIZE/2, head.y * GRID_SIZE + GRID_SIZE/2, FOOD_TYPES[food.type].color)
        generateFood()
        
        // Check evolution
        const newEvolution = getCurrentEvolution()
        if (EVOLUTION_STAGES.indexOf(newEvolution) > evolution) {
          setEvolution(EVOLUTION_STAGES.indexOf(newEvolution))
        }
      } else {
        newSnake.pop()
      }
      
      return newSnake
    })
  }, [food, powerUps, evolution, wallWrap, generateFood, createParticles, getCurrentEvolution, checkAchievements])

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return
    
    const currentSpeed = powerUps.some(p => p.type === 'speed') ? speed * 0.5 : speed
    
    gameLoopRef.current = window.setTimeout(() => {
      moveSnake()
    }, currentSpeed)
    
    return () => {
      if (gameLoopRef.current) {
        clearTimeout(gameLoopRef.current)
      }
    }
  }, [gameState, moveSnake, speed, powerUps])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameState === 'playing') {
        switch (e.key) {
          case 'ArrowUp':
          case 'w':
            if (lastDirectionRef.current.y === 0) {
              setDirection({ x: 0, y: -1 })
              lastDirectionRef.current = { x: 0, y: -1 }
            }
            break
          case 'ArrowDown':
          case 's':
            if (lastDirectionRef.current.y === 0) {
              setDirection({ x: 0, y: 1 })
              lastDirectionRef.current = { x: 0, y: 1 }
            }
            break
          case 'ArrowLeft':
          case 'a':
            if (lastDirectionRef.current.x === 0) {
              setDirection({ x: -1, y: 0 })
              lastDirectionRef.current = { x: -1, y: 0 }
            }
            break
          case 'ArrowRight':
          case 'd':
            if (lastDirectionRef.current.x === 0) {
              setDirection({ x: 1, y: 0 })
              lastDirectionRef.current = { x: 1, y: 0 }
            }
            break
          case ' ':
            setGameState('paused')
            break
        }
      } else if (gameState === 'paused' && e.key === ' ') {
        setGameState('playing')
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [gameState])

  // Update power-ups
  useEffect(() => {
    if (powerUps.length === 0) return
    
    const interval = setInterval(() => {
      setPowerUps(prev => prev.map(p => ({ ...p, duration: p.duration - 100 })).filter(p => p.duration > 0))
    }, 100)
    
    return () => clearInterval(interval)
  }, [powerUps])

  // Start game
  const startGame = useCallback(() => {
    setGameState('playing')
    setSnake([{ x: 10, y: 10 }])
    setDirection({ x: 1, y: 0 })
    lastDirectionRef.current = { x: 1, y: 0 }
    setScore(0)
    setSpeed(INITIAL_SPEED)
    setPowerUps([])
    setEvolution(0)
    setParticles([])
    generateFood()
  }, [generateFood])

  // End game
  const endGame = useCallback(() => {
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem('neonSnakeHighScore', score.toString())
    }
  }, [score, highScore])

  useEffect(() => {
    if (gameState === 'gameOver') {
      endGame()
    }
  }, [gameState, endGame])

  // Initialize food on mount
  useEffect(() => {
    if (!food && gameState === 'playing') {
      generateFood()
    }
  }, [food, gameState, generateFood])

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear canvas
    ctx.fillStyle = '#0A0A0F'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    // Draw grid (subtle)
    ctx.strokeStyle = '#1A1A2E'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_HEIGHT)
      ctx.stroke()
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_WIDTH, y)
      ctx.stroke()
    }
    
    if (gameState === 'playing' || gameState === 'paused') {
      // Draw snake
      const currentEvolution = getCurrentEvolution()
      const isInvincible = powerUps.some(p => p.type === 'invincible')
      
      snake.forEach((segment, index) => {
        const x = segment.x * GRID_SIZE
        const y = segment.y * GRID_SIZE
        
        // Snake body with glow effect
        ctx.shadowColor = currentEvolution.glow
        ctx.shadowBlur = isInvincible ? 30 : 15
        ctx.fillStyle = isInvincible ? '#FFFFFF' : currentEvolution.color
        
        if (index === 0) {
          // Head - slightly larger
          ctx.fillRect(x + 2, y + 2, GRID_SIZE - 4, GRID_SIZE - 4)
        } else {
          // Body
          ctx.fillRect(x + 3, y + 3, GRID_SIZE - 6, GRID_SIZE - 6)
        }
      })
      
      // Draw food
      if (food) {
        const x = food.position.x * GRID_SIZE
        const y = food.position.y * GRID_SIZE
        
        ctx.shadowColor = FOOD_TYPES[food.type].glow
        ctx.shadowBlur = 20
        ctx.fillStyle = FOOD_TYPES[food.type].color
        ctx.fillRect(x + 4, y + 4, GRID_SIZE - 8, GRID_SIZE - 8)
      }
      
      // Reset shadow
      ctx.shadowBlur = 0
    }
  }, [snake, food, gameState, getCurrentEvolution, powerUps])

  const currentEvolution = getCurrentEvolution()
  const nextEvolution = EVOLUTION_STAGES[Math.min(evolution + 1, EVOLUTION_STAGES.length - 1)]
  const evolutionProgress = nextEvolution ? ((snake.length - currentEvolution.length) / (nextEvolution.length - currentEvolution.length)) * 100 : 100

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      {/* Menu Screen */}
      {gameState === 'menu' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-8"
        >
          <motion.h1 
            className="text-6xl md:text-8xl font-bold text-primary mb-4"
            animate={{ 
              textShadow: [
                '0 0 20px #00FF88',
                '0 0 40px #00FF88',
                '0 0 20px #00FF88'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            NEON SNAKE
          </motion.h1>
          <motion.div
            className="text-2xl text-accent font-bold"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            EVOLUTION
          </motion.div>
          <p className="text-xl text-muted-foreground max-w-md mx-auto">
            Grow your neon snake, evolve through stages, and collect power-ups in this addictive modern twist on the classic!
          </p>
          <div className="space-y-4">
            <Button 
              onClick={startGame}
              size="lg"
              className="text-xl px-8 py-4 bg-primary hover:bg-primary/90"
            >
              START EVOLUTION
            </Button>
            <div className="flex items-center justify-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input 
                  type="checkbox" 
                  checked={wallWrap} 
                  onChange={(e) => setWallWrap(e.target.checked)}
                  className="rounded"
                />
                Wall Wrapping
              </label>
            </div>
          </div>
          {highScore > 0 && (
            <p className="text-accent text-lg">
              High Score: {highScore}
            </p>
          )}
        </motion.div>
      )}

      {/* Game Screen */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <div className="space-y-4">
          {/* HUD */}
          <div className="flex justify-between items-center w-full max-w-4xl">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold">Score: {score}</div>
              <div className="text-lg">Length: {snake.length}</div>
            </div>
            
            <div className="flex items-center gap-4">
              {powerUps.map((powerUp, index) => (
                <Badge key={index} variant="secondary" className="animate-pulse">
                  {powerUp.type.toUpperCase()} {Math.ceil(powerUp.duration / 1000)}s
                </Badge>
              ))}
            </div>
            
            <Button 
              onClick={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
              variant="outline"
            >
              {gameState === 'paused' ? 'Resume' : 'Pause'}
            </Button>
          </div>

          {/* Evolution Progress */}
          <Card className="p-4 bg-card/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold" style={{ color: currentEvolution.color }}>
                {currentEvolution.name}
              </span>
              {evolution < EVOLUTION_STAGES.length - 1 && (
                <span className="text-sm text-muted-foreground">
                  Next: {nextEvolution.name} ({nextEvolution.length} length)
                </span>
              )}
            </div>
            {evolution < EVOLUTION_STAGES.length - 1 && (
              <Progress value={Math.max(0, Math.min(100, evolutionProgress))} className="h-2" />
            )}
          </Card>

          {/* Game Canvas */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="border border-primary/30 rounded-lg bg-background"
              style={{ 
                boxShadow: '0 0 30px rgba(0, 255, 136, 0.3)',
                maxWidth: '100%',
                height: 'auto'
              }}
            />
            
            {gameState === 'paused' && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                <div className="text-4xl font-bold text-white">PAUSED</div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="text-center text-sm text-muted-foreground">
            Use WASD or Arrow Keys to move • Space to pause
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'gameOver' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6"
        >
          <Card className="p-8 bg-card/90 backdrop-blur-sm">
            <h2 className="text-4xl font-bold text-primary mb-4">
              EVOLUTION COMPLETE
            </h2>
            <div className="space-y-2 mb-6">
              <p className="text-2xl">
                Final Score: <span className="text-accent font-bold">{score}</span>
              </p>
              <p className="text-xl">
                Final Length: <span className="text-primary font-bold">{snake.length}</span>
              </p>
              <p className="text-lg" style={{ color: currentEvolution.color }}>
                Reached: {currentEvolution.name}
              </p>
              {score === highScore && score > 0 && (
                <motion.p 
                  className="text-lg text-accent"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                >
                  🎉 NEW HIGH SCORE! 🎉
                </motion.p>
              )}
              <p className="text-lg text-muted-foreground">
                High Score: {highScore}
              </p>
            </div>
            <Button 
              onClick={startGame}
              size="lg"
              className="text-xl px-8 py-4 bg-primary hover:bg-primary/90"
            >
              EVOLVE AGAIN
            </Button>
          </Card>
        </motion.div>
      )}

      {/* Achievement Notification */}
      <AnimatePresence>
        {showAchievement && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50"
          >
            <Card className="p-4 bg-accent text-accent-foreground">
              <div className="font-bold">🏆 Achievement Unlocked!</div>
              <div>{showAchievement}</div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Particles */}
      <AnimatePresence>
        {particles.map(particle => (
          <motion.div
            key={particle.id}
            className="fixed w-2 h-2 rounded-full pointer-events-none"
            style={{
              left: particle.x,
              top: particle.y,
              backgroundColor: particle.color,
              boxShadow: `0 0 10px ${particle.color}`
            }}
            initial={{ scale: 1, opacity: 1 }}
            animate={{ 
              scale: 0,
              opacity: 0,
              x: Math.random() * 60 - 30,
              y: Math.random() * 60 - 30
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

export default App