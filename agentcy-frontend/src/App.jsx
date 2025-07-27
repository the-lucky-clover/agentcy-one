import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { 
  MessageCircle, 
  Settings, 
  Zap, 
  Brain, 
  Code, 
  Search, 
  FileText, 
  Image, 
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  Plus,
  Menu,
  X
} from 'lucide-react'
import './App.css'

// API Configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5001/api'

// Chat Component
function ChatInterface() {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)

  const sendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage = { role: 'user', content: inputMessage, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          conversation_id: conversationId
        })
      })

      const data = await response.json()
      setConversationId(data.conversation_id)
      
      const agentMessage = { 
        role: 'agent', 
        content: data.message, 
        timestamp: new Date(data.timestamp) 
      }
      setMessages(prev => [...prev, agentMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = { 
        role: 'agent', 
        content: 'Sorry, I encountered an error. Please try again.', 
        timestamp: new Date() 
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4">
        <ScrollArea className="h-full">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                <Brain className="mx-auto h-12 w-12 mb-4 text-blue-500" />
                <h3 className="text-lg font-semibold mb-2">Welcome to Agentcy.one</h3>
                <p>Start a conversation with your AI agent. I can help you with various tasks!</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span>Agent is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={isLoading}
          />
          <Button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Tasks Component
function TaskManager() {
  const [tasks, setTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/agent/tasks`)
      const data = await response.json()
      setTasks(data)
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const createTask = async () => {
    if (!newTaskTitle.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/agent/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          description: newTaskDescription
        })
      })

      if (response.ok) {
        setNewTaskTitle('')
        setNewTaskDescription('')
        fetchTasks()
      }
    } catch (error) {
      console.error('Error creating task:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateTaskStatus = async (taskId, status) => {
    try {
      await fetch(`${API_BASE_URL}/agent/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      fetchTasks()
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Task Manager</h2>
        <Button onClick={() => document.getElementById('new-task-form').scrollIntoView()}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      <div className="grid gap-4">
        {tasks.map((task) => (
          <Card key={task.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    {getStatusIcon(task.status)}
                    <span>{task.title}</span>
                  </CardTitle>
                  <CardDescription>{task.description}</CardDescription>
                </div>
                <Badge className={getStatusColor(task.status)}>
                  {task.status.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => updateTaskStatus(task.id, 'in_progress')}
                  disabled={task.status === 'in_progress'}
                >
                  Start
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => updateTaskStatus(task.id, 'completed')}
                  disabled={task.status === 'completed'}
                >
                  Complete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card id="new-task-form">
        <CardHeader>
          <CardTitle>Create New Task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Task title"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
          />
          <Textarea
            placeholder="Task description (optional)"
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
          />
          <Button onClick={createTask} disabled={isLoading || !newTaskTitle.trim()}>
            {isLoading ? 'Creating...' : 'Create Task'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// Capabilities Component
function AgentCapabilities() {
  const [capabilities, setCapabilities] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCapabilities()
  }, [])

  const fetchCapabilities = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/agent/capabilities`)
      const data = await response.json()
      setCapabilities(data)
    } catch (error) {
      console.error('Error fetching capabilities:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const capabilityIcons = {
    text_generation: <FileText className="h-6 w-6" />,
    code_execution: <Code className="h-6 w-6" />,
    web_search: <Search className="h-6 w-6" />,
    file_operations: <FileText className="h-6 w-6" />,
    image_generation: <Image className="h-6 w-6" />,
    data_analysis: <BarChart3 className="h-6 w-6" />,
    task_planning: <Brain className="h-6 w-6" />
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">{capabilities?.name || 'Agentcy.one AI Agent'}</h2>
        <p className="text-gray-600">Version {capabilities?.version || '1.0.0'}</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {capabilities?.capabilities && Object.entries(capabilities.capabilities).map(([key, enabled]) => (
          <Card key={key} className={enabled ? 'border-green-200' : 'border-gray-200'}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {capabilityIcons[key] || <Zap className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="font-semibold capitalize">
                    {key.replace('_', ' ')}
                  </h3>
                  <Badge variant={enabled ? 'default' : 'secondary'}>
                    {enabled ? 'Available' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About Agentcy.one</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Agentcy.one is a powerful AI agent platform that provides autonomous task execution, 
            intelligent conversation capabilities, and comprehensive tool integration. Our agent 
            can help you with a wide range of tasks from simple queries to complex multi-step workflows.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// Navigation Component
function Navigation({ isMobileMenuOpen, setIsMobileMenuOpen }) {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'Chat', icon: MessageCircle },
    { path: '/tasks', label: 'Tasks', icon: Settings },
    { path: '/capabilities', label: 'Capabilities', icon: Brain }
  ]

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex flex-col w-64 bg-gray-50 border-r">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600">Agentcy.one</h1>
          <p className="text-sm text-gray-600">AI Agent Platform</p>
        </div>
        <div className="flex-1 px-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                  isActive 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <h1 className="text-xl font-bold text-blue-600">Agentcy.one</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        
        {isMobileMenuOpen && (
          <div className="bg-white border-b p-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                    isActive 
                      ? 'bg-blue-100 text-blue-600' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// Main App Component
function AppContent() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen bg-white">
      <Navigation isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<ChatInterface />} />
          <Route path="/tasks" element={<TaskManager />} />
          <Route path="/capabilities" element={<AgentCapabilities />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App

