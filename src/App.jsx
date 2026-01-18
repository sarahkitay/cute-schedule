import { useState, useEffect } from 'react'
import './App.css'
import cloudStorage from './cloudStorage.js'

function App() {
  const [categories, setCategories] = useState([
    { id: 1, name: 'Rhea EPC', color: '#FF69B4', tasks: [] },
    { id: 2, name: 'Personal', color: '#FFB6C1', tasks: [] }
  ])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#FF69B4')
  const [showAI, setShowAI] = useState(false)
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', content: 'Hi there! 👋✨ I\'m your cute productivity assistant! Ask me anything about your schedule, get personalized tips, or let me help you stay organized! 💕' }
  ])
  const [aiInput, setAiInput] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [lastSynced, setLastSynced] = useState(null)

  const colors = [
    '#FF69B4', '#FFB6C1', '#FFC0CB', '#FF1493',
    '#FF91A4', '#FF6EC7', '#FF69B4', '#FFB6E1'
  ]

  useEffect(() => {
    // Load from cloud/localStorage
    loadFromCloud()
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setNotificationsEnabled(permission === 'granted')
      })
    } else if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true)
    }
    
    // Set up cloud sync interval (check and sync if needed)
    const syncInterval = setInterval(() => {
      if (cloudStorage.needsSync()) {
        saveToCloud(categories)
      }
    }, 60000) // Check every minute
    
    return () => clearInterval(syncInterval)
  }, [])

  useEffect(() => {
    // Save to cloud/localStorage whenever categories change
    saveToCloud(categories)
  }, [categories])

  const saveToCloud = async (data) => {
    try {
      await cloudStorage.save(data)
      setLastSynced(new Date())
    } catch (error) {
      console.error('Error saving to cloud:', error)
    }
  }

  const loadFromCloud = async () => {
    try {
      const cloudData = await cloudStorage.load()
      if (cloudData && cloudData.length > 0) {
        setCategories(cloudData)
      } else {
        // Fallback to localStorage if cloud returns empty
        const saved = localStorage.getItem('scheduleCategories')
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            if (Array.isArray(parsed)) {
              setCategories(parsed)
            } else if (parsed.categories) {
              setCategories(parsed.categories)
            }
          } catch (e) {
            console.error('Error parsing saved data:', e)
          }
        }
      }
      setLastSynced(cloudStorage.getLastSync())
    } catch (error) {
      console.error('Error loading from cloud:', error)
      // Fallback to localStorage
      const saved = localStorage.getItem('scheduleCategories')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            setCategories(parsed)
          } else if (parsed.categories) {
            setCategories(parsed.categories)
          }
        } catch (e) {
          console.error('Error parsing saved data:', e)
        }
      }
    }
  }

  const addCategory = () => {
    if (newCategoryName.trim()) {
      const newCategory = {
        id: Date.now(),
        name: newCategoryName.trim(),
        color: newCategoryColor,
        tasks: []
      }
      setCategories([...categories, newCategory])
      setNewCategoryName('')
      setShowAddCategory(false)
    }
  }

  const updateCategory = (id, updates) => {
    setCategories(categories.map(cat => 
      cat.id === id ? { ...cat, ...updates } : cat
    ))
    setEditingCategory(null)
  }

  const deleteCategory = (id) => {
    if (categories.length > 1) {
      setCategories(categories.filter(cat => cat.id !== id))
      if (selectedCategory?.id === id) {
        setSelectedCategory(null)
      }
    }
  }

  const addTask = (categoryId, taskName, scheduledTime = null) => {
    if (taskName.trim()) {
      const newTask = {
        id: Date.now(),
        name: taskName.trim(),
        completed: false,
        scheduledTime: scheduledTime || null
      }
      
      setCategories(categories.map(cat => 
        cat.id === categoryId 
          ? { ...cat, tasks: [...cat.tasks, newTask] }
          : cat
      ))
      
      // Show notification for new task
      if (notificationsEnabled) {
        const category = categories.find(c => c.id === categoryId)
        new Notification(`Task added to ${category?.name}`, {
          body: taskName.trim(),
          icon: '/vite.svg',
          badge: '/vite.svg',
          tag: `task-${newTask.id}`
        })
        
        // Schedule notification if time provided
        if (scheduledTime) {
          scheduleTaskNotification(newTask, category?.name, scheduledTime)
        }
      }
    }
  }

  const scheduleTaskNotification = (task, categoryName, scheduledTime) => {
    try {
      const now = new Date()
      const [hours, minutes] = scheduledTime.split(':').map(Number)
      const notificationTime = new Date(now)
      notificationTime.setHours(hours, minutes, 0, 0)
      
      // If the time has passed today, schedule for tomorrow
      if (notificationTime < now) {
        notificationTime.setDate(notificationTime.getDate() + 1)
      }
      
      const delay = notificationTime.getTime() - now.getTime()
      
      setTimeout(() => {
        if (notificationsEnabled && 'Notification' in window) {
          new Notification(`Time for: ${task.name}`, {
            body: `Category: ${categoryName}`,
            icon: '/vite.svg',
            badge: '/vite.svg',
            tag: `scheduled-task-${task.id}`,
            requireInteraction: true
          })
        }
      }, delay)
    } catch (error) {
      console.error('Error scheduling notification:', error)
    }
  }

  const toggleTask = (categoryId, taskId) => {
    setCategories(categories.map(cat => 
      cat.id === categoryId
        ? { 
            ...cat, 
            tasks: cat.tasks.map(task => 
              task.id === taskId ? { ...task, completed: !task.completed } : task
            )
          }
        : cat
    ))
  }

  const deleteTask = (categoryId, taskId) => {
    setCategories(categories.map(cat => 
      cat.id === categoryId
        ? { ...cat, tasks: cat.tasks.filter(task => task.id !== taskId) }
        : cat
    ))
  }

  const sendAIMessage = async () => {
    if (!aiInput.trim()) return

    const userMessage = { role: 'user', content: aiInput }
    setAiMessages([...aiMessages, userMessage])
    setAiInput('')

    // Simulate AI response (in production, this would call an actual AI API)
    setTimeout(() => {
      const response = generateAIResponse(aiInput, categories)
      setAiMessages(prev => [...prev, { role: 'assistant', content: response }])
    }, 500)
  }

  const generateAIResponse = (query, cats) => {
    const lowerQuery = query.toLowerCase()
    const totalTasks = cats.reduce((sum, cat) => sum + cat.tasks.length, 0)
    const completedTasks = cats.reduce((sum, cat) => 
      sum + cat.tasks.filter(t => t.completed).length, 0
    )
    
    // Specific productivity recommendations
    if (lowerQuery.includes('recommend') || lowerQuery.includes('tip') || lowerQuery.includes('help') || lowerQuery.includes('suggest')) {
      const recommendations = [
        `Based on your ${cats.length} categories, try time-blocking: allocate 2-3 hour chunks for ${cats[0]?.name} and shorter bursts for other categories.`,
        'Pro tip: Review your schedule every morning and pick the top 3 tasks you MUST complete today. This prevents overwhelm.',
        'Use the Pomodoro Technique: 25 minutes focused work, 5 minutes break. After 4 pomodoros, take a 15-30 minute break.',
        'Group similar tasks together to reduce context switching. For example, do all your emails at once rather than scattered throughout the day.',
        `Schedule your most important tasks during your peak energy hours. Most people are most alert between 9-11 AM and 2-4 PM.`,
        'Try the "2-minute rule": If a task takes less than 2 minutes, do it immediately instead of adding it to your list.',
        `Break down large tasks in ${cats.find(c => c.tasks.length > 3)?.name || 'your categories'} into smaller, actionable steps. This makes progress feel more achievable.`,
        'Practice "eating the frog": Do your hardest or most dreaded task first thing in the morning. Everything else feels easier after.',
        `Set specific times for checking messages and notifications rather than responding immediately. Try checking 3 times a day: morning, midday, and end of day.`,
        'Use the Eisenhower Matrix: Categorize tasks as urgent/important, important/not urgent, urgent/not important, or neither. Focus on important tasks first.'
      ]
      return recommendations[Math.floor(Math.random() * recommendations.length)]
    }
    
    // Schedule planning
    if (lowerQuery.includes('schedule') || lowerQuery.includes('plan') || lowerQuery.includes('organize')) {
      if (totalTasks > 0) {
        const categoryNames = cats.map(c => `${c.name} (${c.tasks.length} tasks)`).join(', ')
        return `I see you have ${cats.length} categories with ${totalTasks} total tasks:\n${categoryNames}\n\nWould you like me to suggest a time-blocking strategy? For example, you could:\n- Dedicate morning hours to your most important category\n- Use afternoon for lighter tasks\n- Review and plan tomorrow's priorities at end of day`
      }
      const categoryNames = cats.map(c => c.name).join(', ')
      return `You have ${cats.length} categories set up: ${categoryNames}. Start adding tasks to see personalized scheduling recommendations!`
    }
    
    // Productivity general
    if (lowerQuery.includes('productivity') || lowerQuery.includes('efficient') || lowerQuery.includes('focus')) {
      if (totalTasks > 5) {
        return `You have ${totalTasks} tasks across ${cats.length} categories. Here's how to boost productivity:\n\n1. PRIORITIZE: Pick your top 3 tasks for today - one from each major category if possible\n2. TIME-BLOCK: Allocate specific hours to each category (e.g., 9-11 AM for ${cats[0]?.name})\n3. ELIMINATE DISTRACTIONS: Turn off non-essential notifications during focused work blocks\n4. TAKE BREAKS: Work in 90-minute focused sessions, then take a 15-20 minute break\n5. REVIEW: End each day by reviewing what you accomplished and planning tomorrow's priorities`
      }
      return 'To boost productivity:\n1. Start with your most challenging task first (eat the frog!)\n2. Minimize distractions - use focus mode on your devices\n3. Take regular breaks every 90 minutes\n4. Batch similar tasks together\n5. Review and adjust your schedule weekly'
    }
    
    // Task management
    if (lowerQuery.includes('task') || lowerQuery.includes('todo') || lowerQuery.includes('complete')) {
      if (totalTasks > 0) {
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        return `You have ${totalTasks} total tasks with ${completedTasks} completed (${completionRate}% done). ${completionRate < 50 ? 'Try breaking down remaining tasks into smaller steps!' : 'Great progress! Keep the momentum going by tackling your next priority.'}`
      }
      return 'Start adding tasks to your categories! I can help you prioritize and organize them once you have some tasks.'
    }
    
    // Time management
    if (lowerQuery.includes('time') || lowerQuery.includes('manage') || lowerQuery.includes('balance')) {
      return `Time management strategies:\n\n1. TIME-BLOCKING: Assign specific time slots to each category\n2. THE 2-MINUTE RULE: Do tasks under 2 minutes immediately\n3. BATCH PROCESSING: Group similar activities together\n4. SET DEADLINES: Even for non-urgent tasks to create urgency\n5. SAY NO: Protect your time by declining non-essential requests\n6. REVIEW WEEKLY: Adjust your schedule based on what worked`
    }
    
    // Motivational/encouragement
    if (lowerQuery.includes('motivat') || lowerQuery.includes('stuck') || lowerQuery.includes('overwhelm')) {
      return `I understand! Here's how to get unstuck:\n\n1. START SMALL: Pick just ONE task, even if it's tiny\n2. USE THE 2-MINUTE RULE: Commit to just 2 minutes - often you'll keep going\n3. BREAK IT DOWN: If a task feels too big, break it into smaller steps\n4. REWARD YOURSELF: Celebrate small wins after completing tasks\n5. CHANGE ENVIRONMENT: Sometimes a new location can refresh your focus\n\nRemember: Progress, not perfection! 🚀`
    }
    
    // Category-specific questions
    if (lowerQuery.includes('category') || lowerQuery.includes('categories')) {
      if (cats.length > 0) {
        return `You have ${cats.length} categories:\n${cats.map((c, i) => `${i + 1}. ${c.name} - ${c.tasks.length} tasks`).join('\n')}\n\nYou can:\n- Double-click any category name to edit it\n- Click the edit button to change a category\n- Add new categories using the "+ Add" button`
      }
      return 'You currently have no categories. Click "+ Add" to create your first category!'
    }
    
    // Default response
    return `I can help you with:\n\n📅 Scheduling and time management\n💡 Productivity tips and techniques\n✅ Task prioritization\n📊 Organizing your categories\n🎯 Focus and motivation strategies\n\nTry asking:\n- "Give me productivity tips"\n- "How should I schedule my day?"\n- "Help me prioritize my tasks"\n- "What's the best way to manage my time?"`
  }

  return (
    <div className="app">
      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="header-title-section">
            <h1 className="app-title">✨ Schedule ✨</h1>
            {lastSynced && (
              <div className="sync-indicator" title={`Last synced: ${lastSynced.toLocaleTimeString()}`}>
                ☁️
              </div>
            )}
          </div>
          <div className="header-actions">
            <button 
              className="icon-button"
              onClick={() => setShowAI(!showAI)}
              aria-label="AI Assistant"
            >
              💬
            </button>
          </div>
        </header>

        {/* Category List */}
        <div className="categories-section">
          <div className="section-header">
            <h2>Categories</h2>
            <button 
              className="add-button"
              onClick={() => setShowAddCategory(true)}
            >
              + Add
            </button>
          </div>

          <div className="categories-list">
            {categories.map(category => (
              <div 
                key={category.id} 
                className={`category-card ${selectedCategory?.id === category.id ? 'selected' : ''}`}
                onClick={() => setSelectedCategory(category)}
                style={{ borderLeftColor: category.color }}
              >
                <div className="category-info">
                  <div 
                    className="category-color-dot"
                    style={{ backgroundColor: category.color }}
                  />
                  {editingCategory?.id === category.id ? (
                    <input
                      className="category-name-input"
                      value={editingCategory.name}
                      onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => updateCategory(category.id, { name: editingCategory.name })}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          updateCategory(category.id, { name: editingCategory.name })
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="category-name"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setEditingCategory(category)
                      }}
                    >
                      {category.name}
                    </span>
                  )}
                </div>
                <div className="category-actions">
                  <button
                    className="category-edit-button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingCategory(category)
                    }}
                    aria-label="Edit"
                  >
                    ✏️
                  </button>
                  {categories.length > 1 && (
                    <button
                      className="category-delete-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteCategory(category.id)
                      }}
                      aria-label="Delete"
                    >
                      🗑️
                    </button>
                  )}
                </div>
                <div className="task-count">{category.tasks.length} tasks</div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Category Modal */}
        {showAddCategory && (
          <div className="modal-overlay" onClick={() => setShowAddCategory(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>✨ New Category ✨</h3>
              <input
                type="text"
                placeholder="Category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="modal-input"
                autoFocus
              />
              <div className="color-picker">
                {colors.map(color => (
                  <button
                    key={color}
                    className={`color-option ${newCategoryColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategoryColor(color)}
                  />
                ))}
              </div>
              <div className="modal-actions">
                <button className="modal-button cancel" onClick={() => setShowAddCategory(false)}>
                  Cancel
                </button>
                <button className="modal-button primary" onClick={addCategory}>
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task List for Selected Category */}
        {selectedCategory && (
          <div className="tasks-section">
            <div className="section-header">
              <h2>{selectedCategory.name}</h2>
              <button 
                className="close-button"
                onClick={() => setSelectedCategory(null)}
              >
                ✕
              </button>
            </div>
            
            <TaskInput 
              onAdd={(taskName, scheduledTime) => addTask(selectedCategory.id, taskName, scheduledTime)}
              placeholder={`Add task to ${selectedCategory.name}...`}
            />
            
            <div className="tasks-list">
              {selectedCategory.tasks.map(task => (
                <div 
                  key={task.id} 
                  className={`task-item ${task.completed ? 'completed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(selectedCategory.id, task.id)}
                    className="task-checkbox"
                  />
                  <div className="task-content">
                    <span className="task-name">{task.name}</span>
                    {task.scheduledTime && (
                      <span className="task-time">🕐 {task.scheduledTime}</span>
                    )}
                  </div>
                  <button
                    className="task-delete"
                    onClick={() => deleteTask(selectedCategory.id, task.id)}
                    aria-label="Delete task"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {selectedCategory.tasks.length === 0 && (
                <div className="empty-state">✨ No tasks yet. Add one above! 💕</div>
              )}
            </div>
          </div>
        )}

        {/* AI Assistant Panel */}
        {showAI && (
          <div className="ai-panel">
            <div className="ai-header">
              <h3>💕 AI Assistant 💕</h3>
              <button 
                className="close-button"
                onClick={() => setShowAI(false)}
              >
                ✕
              </button>
            </div>
            <div className="ai-messages">
              {aiMessages.map((msg, idx) => (
                <div key={idx} className={`ai-message ${msg.role}`}>
                  <div className="ai-message-content">{msg.content}</div>
                </div>
              ))}
            </div>
            <div className="ai-input-container">
              <input
                type="text"
                placeholder="Ask me anything... ✨"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    sendAIMessage()
                  }
                }}
                className="ai-input"
              />
              <button 
                className="ai-send-button"
                onClick={sendAIMessage}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TaskInput({ onAdd, placeholder }) {
  const [value, setValue] = useState('')
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [scheduledTime, setScheduledTime] = useState('')

  const handleSubmit = () => {
    if (value.trim()) {
      onAdd(value, scheduledTime || null)
      setValue('')
      setScheduledTime('')
      setShowTimePicker(false)
    }
  }

  return (
    <div className="task-input-wrapper">
      <div className="task-input-container">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSubmit()
            }
          }}
          placeholder={placeholder}
          className="task-input"
        />
        <button 
          className="time-picker-button"
          onClick={() => setShowTimePicker(!showTimePicker)}
          title="Schedule notification"
        >
          🕐
        </button>
        <button className="task-add-button" onClick={handleSubmit}>
          Add
        </button>
      </div>
      {showTimePicker && (
        <div className="time-picker">
          <label htmlFor="task-time">Schedule notification at:</label>
          <input
            id="task-time"
            type="time"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="time-input"
          />
          {scheduledTime && (
            <button 
              className="clear-time-button"
              onClick={() => setScheduledTime('')}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default App
