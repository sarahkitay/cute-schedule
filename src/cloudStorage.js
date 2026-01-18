// Cloud Storage Service
// This provides a unified interface for cloud storage
// Currently uses localStorage as fallback, but can be easily extended to use:
// - Firebase Firestore
// - Supabase
// - AWS DynamoDB
// - Any cloud storage service

class CloudStorage {
  constructor() {
    this.storageKey = 'cute-schedule-data'
    this.syncKey = 'cute-schedule-sync'
  }

  // Save data to cloud/localStorage
  async save(data) {
    try {
      // Save to localStorage (always available)
      const dataToSave = {
        categories: data,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(dataToSave))
      localStorage.setItem(this.syncKey, Date.now().toString())
      
      // TODO: Integrate with cloud service
      // Example with Firebase:
      // await firebase.firestore().collection('users').doc(userId).set(dataToSave)
      
      // Example with Supabase:
      // await supabase.from('schedules').upsert({ user_id: userId, data: dataToSave })
      
      return { success: true }
    } catch (error) {
      console.error('Error saving to cloud:', error)
      // Fallback to localStorage only
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(data))
        return { success: true, fallback: true }
      } catch (e) {
        return { success: false, error: e.message }
      }
    }
  }

  // Load data from cloud/localStorage
  async load() {
    try {
      // Try cloud storage first (when implemented)
      // const cloudData = await this.loadFromCloud()
      // if (cloudData) return cloudData
      
      // Fallback to localStorage
      const saved = localStorage.getItem(this.storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Support both old format (array) and new format (object with metadata)
        if (Array.isArray(parsed)) {
          return parsed
        } else if (parsed.categories) {
          return parsed.categories
        }
      }
      
      return null
    } catch (error) {
      console.error('Error loading from cloud:', error)
      return null
    }
  }

  // Get last sync time
  getLastSync() {
    try {
      const syncTime = localStorage.getItem(this.syncKey)
      return syncTime ? new Date(parseInt(syncTime)) : null
    } catch (error) {
      return null
    }
  }

  // Check if data needs syncing
  needsSync() {
    const lastSync = this.getLastSync()
    if (!lastSync) return true
    
    // Sync if last sync was more than 5 minutes ago
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    return lastSync < fiveMinutesAgo
  }

  // Initialize cloud storage (can be called when user logs in)
  initialize(userId, cloudService = null) {
    this.userId = userId
    this.cloudService = cloudService
    // This would initialize connection to cloud service
  }
}

// Export singleton instance
const cloudStorage = new CloudStorage()

// Make it available globally for the app
if (typeof window !== 'undefined') {
  window.cloudStorage = cloudStorage
}

export default cloudStorage
