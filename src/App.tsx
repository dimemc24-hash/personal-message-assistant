import { useState, useEffect } from 'react'
import { supabase, type Contact, type Occasion, type Message } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import { Send, Users, Calendar, MessageSquare, LogOut } from 'lucide-react'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  
  // App state
  const [contacts, setContacts] = useState<Contact[]>([])
  const [occasions, setOccasions] = useState<Occasion[]>([])
  // eslint-disable-next-line
  const [activeTab, setActiveTab] = useState<'generate' | 'contacts' | 'occasions'>('generate')
  
  // Form states
  const [selectedContact, setSelectedContact] = useState<string>('')
  const [selectedOccasion, setSelectedOccasion] = useState<string>('')
  const [messageStyle, setMessageStyle] = useState<'formal' | 'casual' | 'warm'>('warm')
  const [generatedMessages, setGeneratedMessages] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return

const [contactsRes, occasionsRes] = await Promise.all([
  supabase.from('contacts').select('*').eq('user_id', user.id).order('name'),
  supabase.from('occasions').select('*').eq('user_id', user.id).order('date')
])

if (contactsRes.data) setContacts(contactsRes.data)
if (occasionsRes.data) setOccasions(occasionsRes.data)
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Check your email for confirmation link!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const generateMessages = async () => {
    if (!selectedContact) {
      alert('Please select a contact')
      return
    }

    setIsGenerating(true)
    
    const contact = contacts.find(c => c.id === selectedContact)
    const occasion = occasions.find(o => o.id === selectedOccasion)
    
    // Generate 3 message variations using Claude API
    try {
      const prompt = `Generate 3 ${messageStyle} text message variations for ${contact?.name}${occasion ? ` for ${occasion.occasion_name}` : ' just to check in'}. 
      
Relationship: ${contact?.relationship_tier.replace('_', ' ')}
Style: ${messageStyle}

Return ONLY a JSON array of 3 strings, no other text:
["message 1", "message 2", "message 3"]`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      })

      const data = await response.json()
      const messageText = data.content[0].text
      
      // Parse the JSON array from the response
      const parsed = JSON.parse(messageText)
      setGeneratedMessages(parsed)
      
    } catch (error) {
      console.error('Error generating messages:', error)
      // Fallback messages if API fails
      const fallbackMessages = [
        `Hey ${contact?.name}! ${occasion ? `Happy ${occasion.occasion_name}!` : 'Just wanted to check in and see how you\'re doing.'} Hope all is well! 😊`,
        `Hi ${contact?.name}, ${occasion ? `wishing you a wonderful ${occasion.occasion_name}` : 'thinking of you today'}. Let's catch up soon!`,
        `${contact?.name}! ${occasion ? `Have an amazing ${occasion.occasion_name}!` : 'Hope you\'re having a great day.'} Miss you! 💙`
      ]
      setGeneratedMessages(fallbackMessages)
    } finally {
      setIsGenerating(false)
    }
  }

  const saveAndSendMessage = async (messageText: string) => {
    if (!user || !selectedContact) return

    const contact = contacts.find(c => c.id === selectedContact)
    
    try {
      // Save to database
      await supabase.from('messages').insert({
        contact_id: selectedContact,
        occasion_id: selectedOccasion || null,
        message_text: messageText,
        style: messageStyle,
        status: 'sent',
        sent_at: new Date().toISOString(),
        user_id: user.id
      })

      // Copy to clipboard
      await navigator.clipboard.writeText(messageText)
      
      alert(`Message copied to clipboard! Now open your Android Messages app and send to ${contact?.phone_number}`)
      
      // Reload messages
      loadData()
      setGeneratedMessages([])
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            Personal Message Assistant
          </h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="w-full text-blue-600 hover:text-blue-700 text-sm"
            >
              {authMode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Personal Message Assistant</h1>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('generate')}
              className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 font-medium transition-colors ${
                activeTab === 'generate'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <MessageSquare size={20} />
              Generate Messages
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 font-medium transition-colors ${
                activeTab === 'contacts'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Users size={20} />
              Contacts ({contacts.length})
            </button>
            <button
              onClick={() => setActiveTab('occasions')}
              className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 font-medium transition-colors ${
                activeTab === 'occasions'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Calendar size={20} />
              Occasions ({occasions.length})
            </button>
          </div>
        </div>

        {/* Generate Messages Tab */}
        {activeTab === 'generate' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Generate Message</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Contact</label>
                <select
                  value={selectedContact}
                  onChange={(e) => setSelectedContact(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a contact...</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} ({contact.relationship_tier.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Occasion (Optional)
                </label>
                <select
                  value={selectedOccasion}
                  onChange={(e) => setSelectedOccasion(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Just checking in</option>
                  {occasions
                    .filter(o => o.contact_id === selectedContact)
                    .map(occasion => (
                      <option key={occasion.id} value={occasion.id}>
                        {occasion.occasion_name} ({occasion.date})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message Style</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['formal', 'casual', 'warm'] as const).map(style => (
                    <button
                      key={style}
                      onClick={() => setMessageStyle(style)}
                      className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                        messageStyle === style
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={generateMessages}
                disabled={!selectedContact || isGenerating}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <MessageSquare size={20} />
                    Generate 3 Message Options
                  </>
                )}
              </button>
            </div>

            {/* Generated Messages */}
            {generatedMessages.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Choose a message to send:</h3>
                {generatedMessages.map((msg, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <p className="text-gray-700 mb-3">{msg}</p>
                    <button
                      onClick={() => saveAndSendMessage(msg)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Send size={18} />
                      Copy & Send This One
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contacts Tab - Simplified for now */}
        {activeTab === 'contacts' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Contacts</h2>
            <p className="text-gray-600">Contact management coming soon. For now, add contacts directly in your Supabase dashboard.</p>
          </div>
        )}

        {/* Occasions Tab - Simplified for now */}
        {activeTab === 'occasions' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Occasions</h2>
            <p className="text-gray-600">Occasion management coming soon. For now, add occasions directly in your Supabase dashboard.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
